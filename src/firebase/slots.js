import {
  doc, collection, runTransaction, serverTimestamp, getDoc,
} from 'firebase/firestore'
import { db } from './config'
import { granuleKeys, lockHolds } from '../utils/slots'

// ─── One class per slot. No exceptions, for anybody ──────────────────────────
// `findOverlappingClasses` asks "is this time free?" and then the class is
// written a moment later. Between those two steps someone else can book the
// same slot, and both are told yes. This closes that window.
//
// A class and its locks are written in ONE transaction. Each lock's id is
// derived from the teacher and the quarter hour, so two bookings for the same
// slot contend for the same document and Firestore lets exactly one commit;
// the loser is retried by the SDK, sees the winner's lock, and is refused.
//
// There is deliberately no way to override this — not for a student, not for
// Guruji, not for an admin. Every route that can put a class into a slot goes
// through this file: a new booking, a staff-scheduled class, a reschedule from
// either side, and a class restored after a block is lifted.
//
// Locks are reclaimed rather than released. A lock names the class holding it,
// and it binds only while that class is both live and still at a time covering
// that granule. So nothing has to remember to tidy up: cancel a class and its
// slot frees itself, move a class and the slot it left behind frees itself.
// Same lazy habit as `sweepPastClasses` and `expireStaleCredits` — whoever
// comes next does the tidying.

export const SLOT_LOCKS = 'slotLocks'

export function slotTakenError() {
  const err = new Error('That time has already been booked. Please pick another slot.')
  err.code = 'slot-taken'
  return err
}

function badSlotError() {
  const err = new Error('That date and time could not be read. Please set them again.')
  err.code = 'bad-slot'
  return err
}

// Reads every lock the given granules point at and throws if any of them is
// still bound to a class other than `exceptClassId`. Must be called before any
// write in the transaction — Firestore requires all reads first.
async function assertFree(tx, keys, exceptClassId) {
  const locks = []
  for (const key of keys) {
    const snap = await tx.get(doc(db, SLOT_LOCKS, key))
    if (snap.exists()) locks.push({ key, ...snap.data() })
  }

  for (const lock of locks) {
    if (!lock?.classId) continue              // debris from a deleted class
    if (lock.classId === exceptClassId) continue  // our own lock, being re-confirmed
    const owner = await tx.get(doc(db, 'classes', lock.classId))
    if (owner.exists() && lockHolds(lock.key, owner.data())) throw slotTakenError()
  }
}

function claim(tx, keys, classId, teacherId) {
  for (const key of keys) {
    tx.set(doc(db, SLOT_LOCKS, key), {
      classId, teacherId, claimedAt: serverTimestamp(),
    })
  }
}

function startOf(scheduledAt) {
  return scheduledAt?.toDate ? scheduledAt.toDate() : new Date(scheduledAt)
}

// Writes `classData` as a new class and claims every granule it covers.
// Throws 'slot-taken' if any granule is held by a class that is still going to
// happen. Returns { id } of the new class.
export async function createClassHoldingSlot(classData) {
  const { teacherId, scheduledAt, duration } = classData
  const keys = granuleKeys(teacherId, startOf(scheduledAt), duration)

  // granuleKeys returns nothing for a time or duration it cannot make sense
  // of. Writing the class unlocked would be the one outcome worse than
  // refusing, so refuse.
  if (keys.length === 0) throw badSlotError()

  const classRef = doc(collection(db, 'classes'))

  await runTransaction(db, async (tx) => {
    await assertFree(tx, keys, null)
    claim(tx, keys, classRef.id, teacherId)
    tx.set(classRef, classData)
  })

  return { id: classRef.id }
}

// Moves an existing class into a slot, or brings a cancelled one back, and
// applies `patch` to it in the same transaction. Used by both reschedule paths
// and by restoring a class after a block is lifted — each of which writes a
// new time or a new status and so has to take the slot like anyone else.
//
// `slot` is where the class is going: { teacherId, scheduledAt, duration }.
// Throws 'slot-taken' if that time belongs to another live class, leaving the
// class exactly as it was.
export async function moveClassIntoSlot(classId, patch, slot) {
  const { teacherId, scheduledAt, duration } = slot
  const keys = granuleKeys(teacherId, startOf(scheduledAt), duration)
  if (keys.length === 0) throw badSlotError()

  await runTransaction(db, async (tx) => {
    // Read the class first: if it vanished, there is nothing to move.
    const classRef = doc(db, 'classes', classId)
    const current = await tx.get(classRef)
    if (!current.exists()) {
      const err = new Error('That class no longer exists.')
      err.code = 'no-class'
      throw err
    }

    // Its own locks do not count against it — a class may be confirmed in, or
    // nudged within, a slot it already holds.
    await assertFree(tx, keys, classId)
    claim(tx, keys, classId, teacherId)
    tx.update(classRef, patch)
  })
}

// Is this slot free, right now? A plain read for the forms to use, so they can
// say "pick another slot" before anyone taps Book. Not a guarantee — the
// transactions above are the guarantee — just a faster, kinder no.
export async function slotIsFree(teacherId, startDate, durationMin, exceptClassId = null) {
  const keys = granuleKeys(teacherId, startDate, durationMin)
  if (keys.length === 0) return false

  const locks = await Promise.all(
    keys.map(async k => ({ key: k, snap: await getDoc(doc(db, SLOT_LOCKS, k)).catch(() => null) }))
  )

  const held = locks
    .filter(l => l.snap?.exists())
    .map(l => ({ key: l.key, classId: l.snap.data()?.classId }))
    .filter(l => l.classId && l.classId !== exceptClassId)
  if (held.length === 0) return true

  const owners = await Promise.all(
    held.map(async l => ({ key: l.key, snap: await getDoc(doc(db, 'classes', l.classId)).catch(() => null) }))
  )
  return !owners.some(o => o.snap?.exists() && lockHolds(o.key, o.snap.data()))
}
