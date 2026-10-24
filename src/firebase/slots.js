import {
  doc, collection, runTransaction, serverTimestamp, getDoc,
} from 'firebase/firestore'
import { db } from './config'
import { granuleKeys, holdsSlot } from '../utils/slots'

// ─── One class per slot, guaranteed ──────────────────────────────────────────
// `findOverlappingClasses` asks "is this time free?" and then the class is
// written a moment later. Between those two steps someone else can book the
// same slot, and both are told yes. This closes that window.
//
// A class and its locks are written in ONE transaction. Each lock's id is
// derived from the teacher and the quarter hour, so two bookings for the same
// slot contend for the same document and Firestore lets exactly one commit;
// the loser is retried by the SDK, sees the winner's lock, and is refused.
//
// Locks are reclaimed rather than released. A lock names the class holding it,
// and a lock whose class has been cancelled, rejected, finished or deleted is
// free for the taking. That means no cancellation path has to remember to tidy
// up — if one ever forgets, the slot still frees itself, instead of becoming
// permanently unbookable. Same lazy habit as `sweepPastClasses` and
// `expireStaleCredits`: whoever comes next does the tidying.

export const SLOT_LOCKS = 'slotLocks'

export function slotTakenError() {
  const err = new Error('That time has already been booked. Please pick another slot.')
  err.code = 'slot-taken'
  return err
}

// Writes `classData` as a new class and claims every granule it covers.
// Throws 'slot-taken' if any granule is held by a class that is still going to
// happen. `allowOverlap` skips the claim entirely — for staff who mean it, and
// for statuses that do not occupy a slot in the first place.
//
// Returns { id } of the new class.
export async function createClassHoldingSlot(classData, { allowOverlap = false } = {}) {
  const { teacherId, scheduledAt, duration } = classData
  const start = scheduledAt?.toDate ? scheduledAt.toDate() : new Date(scheduledAt)
  const keys = allowOverlap ? [] : granuleKeys(teacherId, start, duration)

  // granuleKeys returns nothing for a time or duration it cannot make sense
  // of. Writing the class unlocked would be the one outcome worse than
  // refusing, so refuse — unless overlapping was asked for explicitly.
  if (!allowOverlap && keys.length === 0) {
    const err = new Error('That date and time could not be read. Please set them again.')
    err.code = 'bad-slot'
    throw err
  }

  const classRef = doc(collection(db, 'classes'))

  await runTransaction(db, async (tx) => {
    // Firestore wants every read before every write, so the locks are checked
    // in full before anything is claimed.
    const held = []
    for (const key of keys) {
      const snap = await tx.get(doc(db, SLOT_LOCKS, key))
      if (snap.exists()) held.push(snap.data())
    }

    for (const lock of held) {
      // A lock with no class behind it is debris from a deleted class.
      if (!lock?.classId) continue
      const owner = await tx.get(doc(db, 'classes', lock.classId))
      if (owner.exists() && holdsSlot(owner.data())) throw slotTakenError()
    }

    for (const key of keys) {
      tx.set(doc(db, SLOT_LOCKS, key), {
        classId: classRef.id,
        teacherId,
        claimedAt: serverTimestamp(),
      })
    }

    tx.set(classRef, classData)
  })

  return { id: classRef.id }
}

// Is this slot free, right now? A plain read for the forms to use, so they can
// say "pick another slot" before anyone taps Book. Not a guarantee — the
// transaction above is the guarantee — just a faster, kinder no.
export async function slotIsFree(teacherId, startDate, durationMin) {
  const keys = granuleKeys(teacherId, startDate, durationMin)
  if (keys.length === 0) return false

  const locks = await Promise.all(
    keys.map(k => getDoc(doc(db, SLOT_LOCKS, k)).catch(() => null))
  )

  const classIds = [...new Set(
    locks.filter(s => s?.exists()).map(s => s.data()?.classId).filter(Boolean)
  )]
  if (classIds.length === 0) return true

  const owners = await Promise.all(
    classIds.map(id => getDoc(doc(db, 'classes', id)).catch(() => null))
  )
  return !owners.some(s => s?.exists() && holdsSlot(s.data()))
}
