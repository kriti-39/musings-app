import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc,
  query, where, Timestamp, serverTimestamp, runTransaction, onSnapshot,
} from 'firebase/firestore'
import { db } from './config'
import { createNotification } from './notify'
import {
  creditExpiry, validityLabel, canGrant, spendOrder, staleBatches,
  creditSummary, batchRemaining, endOfDay, addDays, addCalendarMonth, toDate,
  creditsWord, fmtExpiry,
} from '../utils/credits'

// ─── CREDITS IN FIRESTORE ────────────────────────────────────────────────────
// Collection: `credits`. One document per GRANT — a batch of credits bought (or
// given) at one moment, with its own expiry date. A student normally has one
// live batch; they can have two while an old one is being used up.
//
// Why batches and not a single number on the student: every grant has its own
// validity window, so "3 credits" is meaningless without knowing when each of
// them dies. A counter cannot express that; a batch can.
//
//   {
//     studentId, quantity, used,
//     expiresAt,  grantedAt, grantedBy, grantedByName,
//     status: 'active' | 'exhausted' | 'expired' | 'revoked',
//     validity: '1 month' | '6 weeks',      // what was promised, for the record
//     source: 'admin' | 'refund',
//     reason, paymentId,
//     extensions: [{ at, by, days, reason, from, to }],
//   }
//
// This collection is NEW, so nothing the live app does can touch it — the
// deployed version has never heard of it.

const COL = 'credits'

const asBatch = (d) => ({ id: d.id, ...d.data() })

export async function getStudentCredits(studentId) {
  if (!studentId) return []
  const snap = await getDocs(query(collection(db, COL), where('studentId', '==', studentId)))
  return snap.docs.map(asBatch)
}

// Live balance, for the student's own dashboard — credits change underneath them
// when staff grant, extend or refund, and a stale number here is the one thing
// that would make them doubt the whole system.
export function subscribeStudentCredits(studentId, onChange, onError) {
  if (!studentId) return () => {}
  return onSnapshot(
    query(collection(db, COL), where('studentId', '==', studentId)),
    snap => onChange(snap.docs.map(asBatch)),
    onError,
  )
}

// Every batch, for the admin overview. Small collection (a few docs per student
// per month), so one read is cheaper than one query per student.
export async function getAllCredits() {
  const snap = await getDocs(collection(db, COL))
  return snap.docs.map(asBatch)
}

export function groupByStudent(batches) {
  const map = {}
  ;(batches || []).forEach(b => {
    if (!b.studentId) return
    ;(map[b.studentId] ||= []).push(b)
  })
  return map
}

// ─── GRANTING ────────────────────────────────────────────────────────────────

// Admin adds credits — normally 4, after a payment lands. The expiry is worked
// out from the student's own window (a month at home, six weeks abroad) and is
// fixed at this moment, so a later change to their country never moves credits
// they already hold.
//
// `student` is normally passed in, since the caller usually has the profile
// already. It is read here when it is not, because BOTH the cap and the expiry
// now depend on it: judging a student abroad against India's cap of three would
// refuse a grant they are entitled to, and silently. Read straight from
// Firestore rather than through db.js, which imports this file.
async function profileFor(studentId, student) {
  if (student) return student
  if (!studentId) return null
  try {
    const snap = await getDoc(doc(db, 'users', studentId))
    return snap.exists() ? { id: snap.id, ...snap.data() } : null
  } catch (e) {
    console.error('Could not read the profile for a credit grant:', e)
    return null
  }
}

export async function grantCredits({
  studentId, student, quantity,
  grantedBy = null, grantedByName = '', reason = '', paymentId = null,
  notify = true,
}) {
  const qty = Number(quantity) || 0
  const profile = await profileFor(studentId, student)

  // Re-read right before writing: the balance may have moved since the modal
  // opened (the student may have booked a class, or another admin added some).
  const existing = await getStudentCredits(studentId)
  const verdict = canGrant(existing, qty, Date.now(), profile)
  if (!verdict.ok) {
    const err = new Error(verdict.reason)
    err.code = 'credit-cap'
    throw err
  }

  const now = new Date()
  const expiresAt = creditExpiry(now, profile)

  const ref = await addDoc(collection(db, COL), {
    studentId,
    quantity: qty,
    used: 0,
    status: 'active',
    expiresAt: Timestamp.fromDate(expiresAt),
    validity: validityLabel(profile),
    source: 'admin',
    reason: (reason || '').trim(),
    paymentId,
    grantedBy,
    grantedByName: (grantedByName || '').trim(),
    grantedAt: serverTimestamp(),
    extensions: [],
    updatedAt: serverTimestamp(),
  })

  // Never let a notification failure look like a failed grant — the credits are
  // already in place by this point.
  if (notify) {
    try {
      await createNotification(
        studentId, 'credits_granted',
        `${qty} class ${creditsWord(qty)} added. Use them by ${fmtExpiry(expiresAt)}.`,
        null, 'Credits added',
      )
    } catch (e) { console.error('Credits granted, student notify failed:', e) }
  }

  return { id: ref.id, quantity: qty, expiresAt }
}

// ─── SPENDING ────────────────────────────────────────────────────────────────

// Take one credit for a class, from the batch that expires soonest.
//
// The increment runs inside a transaction on that one batch, so two devices
// booking at the same moment can never spend the same credit twice: the second
// one re-reads, sees the batch is full, and moves on to the next batch (or is
// told there are none left). Firestore's web SDK can't query inside a
// transaction, hence the query first and the guard inside.
export async function consumeCredit(studentId) {
  const batches = await getStudentCredits(studentId)

  for (const candidate of spendOrder(batches)) {
    try {
      const taken = await runTransaction(db, async (tx) => {
        const ref = doc(db, COL, candidate.id)
        const snap = await tx.get(ref)
        if (!snap.exists()) return false

        const b = snap.data()
        const qty = Number(b.quantity) || 0
        const used = Number(b.used) || 0
        const expired = (b.expiresAt?.toDate?.()?.getTime() ?? 0) <= Date.now()
        if (b.status !== 'active' || used >= qty || expired) return false   // someone beat us to it

        const next = used + 1
        tx.update(ref, {
          used: next,
          status: next >= qty ? 'exhausted' : 'active',
          updatedAt: serverTimestamp(),
        })
        return true
      })
      if (taken) return { batchId: candidate.id }
    } catch (e) {
      // A contended transaction can fail outright; try the next batch rather
      // than failing the booking while the student still has credits.
      console.error('Could not spend from batch', candidate.id, e)
    }
  }

  const err = new Error('No class credits left.')
  err.code = 'no-credits'
  throw err
}

// Put a credit back into its batch. Used when a booking fails after the credit
// was taken, and when a class is cancelled by the studio.
export async function returnCredit(batchId) {
  return await releaseToBatch(batchId)
}

async function releaseToBatch(batchId) {
  return await runTransaction(db, async (tx) => {
    const ref = doc(db, COL, batchId)
    const snap = await tx.get(ref)
    if (!snap.exists()) return false

    const b = snap.data()
    const used = Number(b.used) || 0
    if (used <= 0) return false
    if (b.status === 'revoked') return false
    // An expired batch is not worth refunding into — the credit would be dead on
    // arrival. The caller issues a fresh one instead.
    if ((b.expiresAt?.toDate?.()?.getTime() ?? 0) <= Date.now()) return false

    tx.update(ref, {
      used: used - 1,
      status: 'active',          // it has room again, so it's spendable
      updatedAt: serverTimestamp(),
    })
    return true
  })
}

// ─── REFUNDS ─────────────────────────────────────────────────────────────────

// Make the student whole for a class they paid for and did not get — the studio
// cancelled, or staff are undoing their own mistake.
//
// Normally the credit goes back into the batch it came from, keeping its
// original expiry. If that batch has since lapsed, putting it back would hand
// over a dead credit, so a fresh single credit is issued with a new window
// instead. That can briefly take the student above the usual limit, which is
// correct: this is a class they have already paid for, and the cap exists to
// stop over-granting, not to swallow refunds.
//
// Stamped on the class so a second cancel (or a retry) can't pay twice.
export async function refundCreditForClass(cls, student, reason = 'Class cancelled by the studio') {
  if (!cls?.id) return { refunded: false, why: 'no-class' }
  if (!cls.creditBatchId) return { refunded: false, why: 'not-paid-with-credit' }
  if (cls.creditRefundedAt) return { refunded: false, why: 'already-refunded' }

  let how = 'returned'
  const wentBack = await releaseToBatch(cls.creditBatchId).catch(e => {
    console.error('Refund into batch failed:', e)
    return false
  })

  if (!wentBack) {
    // The original batch is gone, lapsed or already whole — issue a new credit
    // so the student isn't out of pocket.
    const expiresAt = creditExpiry(new Date(), student)
    await addDoc(collection(db, COL), {
      studentId: cls.studentId,
      quantity: 1,
      used: 0,
      status: 'active',
      expiresAt: Timestamp.fromDate(expiresAt),
      validity: validityLabel(student),
      source: 'refund',
      reason,
      refundedFromClassId: cls.id,
      grantedAt: serverTimestamp(),
      extensions: [],
      updatedAt: serverTimestamp(),
    })
    how = 'reissued'
  }

  await updateDoc(doc(db, 'classes', cls.id), {
    creditRefundedAt: serverTimestamp(),
    creditRefundType: how,
    updatedAt: serverTimestamp(),
  })

  try {
    await createNotification(
      cls.studentId, 'credit_refunded',
      how === 'reissued'
        ? 'Your credit for that class has been replaced with a fresh one.'
        : 'Your credit for that class has been returned.',
      cls.id, 'Credit returned',
    )
  } catch (e) { console.error('Refunded, student notify failed:', e) }

  return { refunded: true, how }
}

// The opposite of a refund: a class that was cancelled (and refunded) is back
// on, so the credit has to come out again — otherwise removing a block would
// quietly hand out free classes.
//
// It is taken from the SAME batch it originally came from, which is where the
// refund went. If that can't be done — the batch lapsed in the meantime, or the
// student has since spent it — the class still goes ahead and is flagged for
// staff instead. Restoring a class must never fail over bookkeeping.
export async function rechargeCreditForClass(cls) {
  if (!cls?.id || !cls.creditBatchId || !cls.creditRefundedAt) {
    return { recharged: false, why: 'nothing-to-recharge' }
  }

  let taken = false
  try {
    taken = await runTransaction(db, async (tx) => {
      const ref = doc(db, COL, cls.creditBatchId)
      const snap = await tx.get(ref)
      if (!snap.exists()) return false

      const b = snap.data()
      const qty = Number(b.quantity) || 0
      const used = Number(b.used) || 0
      const expired = (b.expiresAt?.toDate?.()?.getTime() ?? 0) <= Date.now()
      if (b.status === 'revoked' || used >= qty || expired) return false

      const next = used + 1
      tx.update(ref, {
        used: next,
        status: next >= qty ? 'exhausted' : 'active',
        updatedAt: serverTimestamp(),
      })
      return true
    })
  } catch (e) {
    console.error('Could not re-take the credit for class', cls.id, e)
  }

  await updateDoc(doc(db, 'classes', cls.id), taken
    ? {
      creditRefundedAt: null,
      creditRefundType: null,
      updatedAt: serverTimestamp(),
    }
    : {
      // Staff should look at this one: the class is on, but unpaid.
      creditReviewNeeded: true,
      creditReviewReason: 'Class restored but the credit could not be taken back',
      updatedAt: serverTimestamp(),
    })

  return { recharged: taken }
}

// Flag a class for staff to decide on, without moving any credits. Used when a
// student cancels their own class: whether they get the credit back is Guruji's
// call, not something the app should assume either way.
export async function flagCreditForReview(classId, reason) {
  await updateDoc(doc(db, 'classes', classId), {
    creditReviewNeeded: true,
    creditReviewReason: reason || '',
    updatedAt: serverTimestamp(),
  })
}

// ─── EXTENDING (ADMIN ONLY) ──────────────────────────────────────────────────

// Give a batch more time. `days` adds to whichever is later — the current expiry
// or today — so extending something that already lapsed actually buys time
// rather than landing in the past. `until` sets an exact date instead.
//
// Reviving a lapsed batch is deliberate: an admin deciding a student shouldn't
// lose paid classes to a holiday or an illness is exactly what this is for.
export async function extendCredits(batchId, { days = 0, until = null, months = 0 } = {}, by = null, reason = '') {
  const ref = doc(db, COL, batchId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('That credit batch no longer exists.')

  const b = snap.data()
  const current = b.expiresAt?.toDate?.() ?? new Date()
  const from = new Date(Math.max(current.getTime(), Date.now()))

  let next
  if (until) {
    const [y, m, d] = String(until).split('-').map(Number)
    next = endOfDay(new Date(y, m - 1, d))
  } else if (months) {
    let t = from
    for (let i = 0; i < months; i++) t = addCalendarMonth(t)
    next = endOfDay(t)
  } else {
    next = endOfDay(addDays(from, Number(days) || 0))
  }

  if (next.getTime() <= current.getTime()) {
    const err = new Error('Pick a date later than the current expiry.')
    err.code = 'not-an-extension'
    throw err
  }

  const remaining = batchRemaining(b)
  await updateDoc(ref, {
    expiresAt: Timestamp.fromDate(next),
    // Bring a lapsed batch back to life, but only if it has credits left in it.
    status: remaining > 0 ? 'active' : 'exhausted',
    extensions: [
      ...(Array.isArray(b.extensions) ? b.extensions : []),
      {
        // Client time: this is an audit note, and serverTimestamp() isn't
        // allowed inside an array.
        at: Timestamp.now(),
        by,
        reason: (reason || '').trim(),
        from: b.expiresAt || null,
        to: Timestamp.fromDate(next),
      },
    ],
    updatedAt: serverTimestamp(),
  })

  if (remaining > 0) {
    try {
      await createNotification(
        b.studentId, 'credits_extended',
        `Your ${remaining} ${creditsWord(remaining)} are now valid until ${fmtExpiry(next)}.`,
        null, 'Credits extended',
      )
    } catch (e) { console.error('Extended, student notify failed:', e) }
  }

  return { expiresAt: next }
}

// Take a grant back — for a mistake, or a payment that never cleared. Kept as a
// record rather than deleted, so the history still adds up.
export async function revokeCredits(batchId, by = null, reason = '') {
  await updateDoc(doc(db, COL, batchId), {
    status: 'revoked',
    revokedAt: serverTimestamp(),
    revokedBy: by,
    revokeReason: (reason || '').trim(),
    updatedAt: serverTimestamp(),
  })
}

// ─── EXPIRY SWEEP ────────────────────────────────────────────────────────────

// There's no server on a schedule here, so credits are retired the same way
// past classes are: whoever loads the page tidies up what they just read. A
// batch past its date is marked expired, and the array is returned with the
// change already applied so the screen shows the truth immediately.
//
// `notifyStudentId` is set only when a student is looking at their OWN credits.
// That way the person who needs to know gets told exactly once — if admins'
// devices also notified, a student could get the same message several times.
export function expireStaleCredits(batches, { notifyStudentId = null } = {}) {
  const stale = staleBatches(batches)
  if (stale.length === 0) return batches

  stale.forEach(b => {
    updateDoc(doc(db, COL, b.id), {
      status: 'expired',
      expiredAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }).catch(e => console.error('Could not expire credit batch', b.id, e))

    const lost = batchRemaining(b)
    if (notifyStudentId && notifyStudentId === b.studentId && lost > 0) {
      createNotification(
        b.studentId, 'credits_expired',
        `${lost} unused class ${creditsWord(lost)} expired on ${fmtExpiry(toDate(b.expiresAt))}. Please contact Guruji.`,
        null, 'Credits expired',
      ).catch(e => console.error('Expiry notify failed:', e))
    }
  })

  const done = new Set(stale.map(b => b.id))
  return batches.map(b => (done.has(b.id) ? { ...b, status: 'expired' } : b))
}

// Read a student's credits and tidy them in one step — what most screens want.
export async function loadCredits(studentId, { notifySelf = false, student = null } = {}) {
  const raw = await getStudentCredits(studentId)
  const batches = expireStaleCredits(raw, { notifyStudentId: notifySelf ? studentId : null })
  // The cap is three in India and twelve abroad, so the summary needs the
  // profile. Read it if the caller did not hand one over.
  const profile = await profileFor(studentId, student)
  return { batches, summary: creditSummary(batches, Date.now(), profile) }
}
