import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc, deleteField,
  query, where, orderBy, limit, Timestamp, serverTimestamp, onSnapshot
} from 'firebase/firestore'
import { db } from './config'
import { createNotification, notifyStaff } from './notify'
import {
  consumeCredit, returnCredit, refundCreditForClass,
  rechargeCreditForClass, flagCreditForReview, grantCredits,
} from './credits'
import { usesCredits, paymentProblem, creditsNeedPayment } from '../utils/credits'
import { createClassHoldingSlot, moveClassIntoSlot, slotTakenError, slotIsFree } from './slots'
import { saveClassDetail, firstUrl as firstUrlOf } from './classDetail'

// How far ahead a student may book. Staff are not limited: they schedule
// recurring series months out and arrange make-up classes in the past.
export const BOOKING_WINDOW_DAYS = 7

// Re-exported so the booking forms can ask "is this slot free?" without
// reaching past db.js, which is where everything else talks to Firestore.
export { slotIsFree }
export { creditsNeedPayment }

// ─── USERS ────────────────────────────────────────────────────────────────────

export async function getUser(uid) {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

// Every student list comes back A–Z. Firestore returns documents in whatever
// order it likes, which made the Fees tables effectively random and hard to
// scan; sorting here means every screen gets it without having to remember.
// `sensitivity: 'base'` so case and accents don't split the alphabet.
export const byStudentName = (a, b) =>
  (a?.name || '').localeCompare(b?.name || '', 'en', { sensitivity: 'base' })

export async function getAllStudents() {
  const q = query(collection(db, 'users'), where('role', '==', 'student'), where('isActive', '==', true))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort(byStudentName)
}

export async function createStudent(uid, data) {
  await setDoc(doc(db, 'users', uid), {
    ...data,
    role: 'student',
    isActive: true,
    createdAt: serverTimestamp(),
  })
}

export async function updateUser(uid, data) {
  await updateDoc(doc(db, 'users', uid), data)
}

// What a student may change about themselves that the studio must hear about.
// Guruji schedules across timezones, so a student moving from Los Angeles to
// Delhi changes when their lesson is; and the office rings these numbers.
const STAFF_WATCH = {
  timezone: 'timezone',
  phone: 'contact number',
}

// Save a person's edits to their OWN profile, telling staff if anything they
// care about moved. Staff editing their own profile notifies nobody — the
// studio does not need telling that the office changed its own phone number.
//
// `user` is the profile as it stood before the edit; the comparison needs it.
export async function updateOwnProfile(user, changes) {
  await updateUser(user.id, changes)
  if (user.role !== 'student') return

  const changed = Object.keys(STAFF_WATCH).filter(f => (
    f in changes && String(changes[f] ?? '').trim() !== String(user[f] ?? '').trim()
  ))
  if (!changed.length) return

  // The edit is already saved by this point, so a failure here must never look
  // like a failed save.
  try {
    const parts = changed.map(f => (
      `${STAFF_WATCH[f]} to ${String(changes[f] ?? '').trim() || '(blank)'}`
    ))
    await notifyStaff(
      'student_details_changed',
      `Changed their ${parts.join(', and their ')}.`,
      { title: user.name || 'A student' },
    )
  } catch (e) {
    console.error('Profile saved, staff notify failed:', e)
  }
}

export async function getStaffIds() {
  const q = query(collection(db, 'users'), where('role', 'in', ['admin', 'teacher']))
  const snap = await getDocs(q)
  return snap.docs.map(d => d.id)
}

export async function getAdmins() {
  const q = query(collection(db, 'users'), where('role', '==', 'admin'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function createAdmin(uid, data) {
  await setDoc(doc(db, 'users', uid), {
    ...data,
    role: 'admin',
    createdAt: serverTimestamp(),
  })
}

// ─── CLASSES ──────────────────────────────────────────────────────────────────

// One house format for every class time in a notification: time first, then
// day and date — "12:00 pm · Sat, 15 Aug".
export function fmtWhen(date, tz = 'Asia/Kolkata') {
  if (!date) return ''
  const time = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: tz })
  const day = date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: tz })
  return `${time} · ${day}`
}

// Staff notifications lead with the student's NAME as the headline (like a
// message from them) and put the detail underneath. Times are rendered in the
// TEACHER's timezone — staff are the readers, not the sender. Falls back to
// generic wording if any lookup fails: a notification must never block the
// action that triggered it.
async function staffContext(studentId, date, teacherId = null) {
  let name = 'A student'
  let when = ''
  try {
    const [student, teacher] = await Promise.all([
      studentId ? getUser(studentId) : null,
      teacherId ? getUser(teacherId) : getTeacher(),
    ])
    if (student?.name) name = student.name
    when = fmtWhen(date, teacher?.timezone || 'Asia/Kolkata')
  } catch (e) { console.error('Notification context lookup failed:', e) }
  return { name, when }
}

// Staff path. Refuses a time that already has a class, exactly as a student
// booking does — one class per slot, whoever is doing the booking, with no way
// to override it.
export async function createClass(data) {
  const notes = (data.lessonNotes || '').trim()
  // Kept off the class document on purpose — it goes to the detail doc below.
  const rest = { ...data }
  delete rest.lessonNotes
  const ref = await createClassHoldingSlot({
    ...rest,
    duration: Math.min(Math.max(Number(data.duration) || 60, 15), 180),
    markedDoneBy: null,
    hasNotes: !!notes,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  if (notes) {
    try { await saveClassDetail(ref.id, { lessonNotes: notes }) }
    catch (e) { console.error('Class created, but the note could not be saved:', e) }
  }
  // Notify teacher and all admins about the new booking request
  if (data.status === 'pending') {
    const staffIds = await getStaffIds()
    const when = data.scheduledAt?.toDate?.() ?? null
    const { name, when: label } = await staffContext(data.studentId, when, data.teacherId)
    await Promise.all(staffIds.map(id =>
      createNotification(id, 'new_booking',
        label ? `Requested a class — ${label}` : 'Requested a new class', ref.id, name)
    ))
  }
  return ref
}

// Returns existing scheduled/pending classes that overlap the given slot
export async function findOverlappingClasses(teacherId, startDate, durationMin) {
  const start = new Date(startDate)
  const end = new Date(start.getTime() + durationMin * 60000)
  const snap = await getDocs(query(collection(db, 'classes'), where('teacherId', '==', teacherId)))
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(c => {
      const status = c.status || 'scheduled'
      if (status !== 'scheduled' && status !== 'pending') return false
      const cStart = c.scheduledAt?.toDate?.()
      if (!cStart) return false
      const cEnd = new Date(cStart.getTime() + (c.duration || 60) * 60000)
      return start < cEnd && end > cStart
    })
}

// Book a class. Auto-confirms (scheduled) if the slot is free.
// If it overlaps an existing class, it goes to 'pending' for staff to confirm.
// forceStatus='scheduled' lets staff book directly even on overlap.
//
// Students on the credit system spend one credit per booking. Staff bookings
// (demos, make-up classes, anything Guruji arranges himself) pass freeClass and
// cost nothing. Students still on the old arrangement are unaffected — they have
// no billingMode, so nothing is charged.
export async function createBooking({
  studentId, teacherId, scheduledAt, duration,
  lessonNotes = '', isRecurring = false, recurringId = null, forceStatus = null,
  student = null, freeClass = false, freeReason = '',
}) {
  const startDate = scheduledAt?.toDate ? scheduledAt.toDate() : new Date(scheduledAt)
  const dur = Math.min(Math.max(Number(duration) || 60, 15), 180) // always a clean number
  let overlap = false
  let status = forceStatus

  // The caller's profile decides what may be booked, and whether anything is
  // charged. Read before the slot work so a refusal costs nothing.
  const profile = student || (studentId ? await getUser(studentId).catch(() => null) : null)

  // A booking made by a student obeys the booking rules; one made by staff
  // (forceStatus, or a class Guruji schedules) does not — they arrange make-up
  // classes in the past and recurring series months ahead.
  if (!forceStatus && !freeClass) {
    if (profile?.isActive === false) {
      const err = new Error('This account is paused. Please contact the studio.')
      err.code = 'account-paused'
      throw err
    }
    if (Number.isNaN(startDate.getTime())) {
      const err = new Error('That date and time could not be read.')
      err.code = 'bad-slot'
      throw err
    }
    // The UI blocks past slots too, but it is the only thing that did — and the
    // UI is not where this belongs.
    if (startDate.getTime() <= Date.now()) {
      const err = new Error('That time has already passed. Please pick a later slot.')
      err.code = 'past-slot'
      throw err
    }
    if (startDate.getTime() > Date.now() + BOOKING_WINDOW_DAYS * 86400000) {
      const err = new Error(`Classes can be booked up to ${BOOKING_WINDOW_DAYS} days ahead.`)
      err.code = 'outside-window'
      throw err
    }
  }

  if (!status) {
    // Two classes can't share a time. This read is the fast, friendly no: it
    // catches the slot that was taken while the calendar sat open, and it
    // happens BEFORE any credit is spent, so the common clash never touches
    // the student's balance. It is not the guarantee — the transaction below
    // is, for the case where two people tap the same slot at the same moment.
    const overlaps = await findOverlappingClasses(teacherId, startDate, dur)
    if (overlaps.length > 0) throw slotTakenError()
    status = 'scheduled'
  }

  // The credit is taken only once the slot is known to be free, so a clash never
  // costs a student a class.
  const charge = !freeClass && usesCredits(profile)
  let creditBatchId = null
  if (charge) {
    const { batchId } = await consumeCredit(studentId)   // throws code 'no-credits'
    creditBatchId = batchId
  }

  let ref
  try {
    // The class and its slot locks commit together, so a second booking for
    // the same time cannot slip in between the check above and this write.
    ref = await createClassHoldingSlot({
      studentId, teacherId,
      scheduledAt: scheduledAt?.toDate ? scheduledAt : Timestamp.fromDate(startDate),
      duration: dur,
      // The student's note to Guruji is text about them, so it goes to the
      // detail document below rather than onto the shared class record.
      hasNotes: !!(lessonNotes || '').trim(),
      isRecurring, recurringId,
      status,
      isOverlap: overlap,
      markedDoneBy: null,
      // How this class was paid for. Absent on everything booked before v2.
      paidWith: charge ? 'credit' : (freeClass ? 'free' : null),
      creditBatchId,
      freeReason: freeClass ? (freeReason || '').trim() : '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  } catch (e) {
    // The credit was already taken, so give it straight back — a failed write
    // must never cost the student a paid class. This now also covers losing a
    // same-instant race for the slot, which arrives here as 'slot-taken'.
    if (creditBatchId) {
      await returnCredit(creditBatchId).catch(err =>
        console.error('Booking failed AND the credit could not be returned —', creditBatchId, err))
    }
    throw e
  }

  // Written after the class exists, because the rule guarding the detail
  // document looks the class up to see whose it is. Wrapped: a note that fails
  // to save must never undo a booking that succeeded.
  if ((lessonNotes || '').trim()) {
    try { await saveClassDetail(ref.id, { lessonNotes: lessonNotes.trim() }) }
    catch (e) { console.error('Booked, but the note could not be saved:', e) }
  }

  // Notify staff: overlaps need confirmation, free bookings are just a heads-up.
  // Wrapped so a notification failure can NEVER undo or hide a successful
  // booking (which would cause the student to re-book → duplicate classes).
  try {
    const staffIds = await getStaffIds()
    const { name, when } = await staffContext(studentId, startDate, teacherId)
    const [type, msg] = status === 'pending'
      ? ['overlap_booking', `Booked ${when} — clashes with another class, tap to confirm`]
      : ['class_booked', `Booked a class — ${when}`]
    await Promise.all(staffIds.map(id => createNotification(id, type, msg, ref.id, name)))
  } catch (e) {
    console.error('Booking saved, but staff notification failed:', e)
  }

  return { id: ref.id, status, overlap }
}

export async function getClass(classId) {
  const snap = await getDoc(doc(db, 'classes', classId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function getStudentAllClasses(studentId) {
  // No orderBy → avoids composite index; sorted client-side
  const q = query(collection(db, 'classes'), where('studentId', '==', studentId))
  const snap = await getDocs(q)
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.scheduledAt?.seconds ?? 0) - (a.scheduledAt?.seconds ?? 0))
}

export async function getTeacherClassesForDay(teacherId, date) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const end = new Date(date)
  end.setHours(23, 59, 59, 999)

  const snap = await getDocs(query(collection(db, 'classes'), where('teacherId', '==', teacherId)))
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(c => {
      const t = c.scheduledAt?.toDate?.()
      const s = c.status || 'scheduled'
      return t >= start && t <= end && s !== 'cancelled' && s !== 'rejected'
    })
    .sort((a, b) => (a.scheduledAt?.seconds ?? 0) - (b.scheduledAt?.seconds ?? 0))
}

export async function getTeacherClassesForMonth(teacherId, year, month) {
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0, 23, 59, 59)

  const snap = await getDocs(query(collection(db, 'classes'), where('teacherId', '==', teacherId)))
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(c => { const t = c.scheduledAt?.toDate?.(); return t >= start && t <= end })
    .sort((a, b) => (a.scheduledAt?.seconds ?? 0) - (b.scheduledAt?.seconds ?? 0))
}

export async function markClassDone(classId, markedBy) {
  const cls = await getClass(classId)
  const prev = cls?.markedDoneBy
  // Admin acts as teacher for mutual-done tracking
  const role = markedBy === 'admin' ? 'teacher' : markedBy

  let markedDoneBy = role
  if ((prev === 'student' && role === 'teacher') ||
      (prev === 'teacher' && role === 'student')) {
    markedDoneBy = 'both'
  }

  await updateDoc(doc(db, 'classes', classId), {
    status: 'completed',
    markedDoneBy,
    updatedAt: serverTimestamp(),
  })
}

// ─── AUTO-COMPLETE ────────────────────────────────────────────────────────────
// A class whose scheduled end time (start + duration) has passed is considered
// done. There's no server to do this on a schedule (free plan), so every app
// load "sweeps" the classes it just fetched: past scheduled classes are flipped
// to completed directly in Firestore — one person's sweep fixes it for everyone.
// Returns the array with the flips already applied so the UI renders the
// corrected statuses immediately, without waiting for the writes.
export function sweepPastClasses(classes) {
  const now = Date.now()
  const past = classes.filter(c => {
    if ((c.status || 'scheduled') !== 'scheduled') return false
    const start = c.scheduledAt?.toDate?.()
    if (!start) return false
    const dur = Math.min(Math.max(Number(c.duration) || 60, 15), 180)
    return start.getTime() + dur * 60000 <= now
  })
  if (past.length === 0) return classes

  // Fire-and-forget: rendering must never wait on (or fail because of) these.
  past.forEach(c => {
    updateDoc(doc(db, 'classes', c.id), {
      status: 'completed',
      markedDoneBy: 'auto',
      updatedAt: serverTimestamp(),
    }).catch(e => console.error('Auto-complete failed for class', c.id, e))
  })

  const flipped = new Set(past.map(c => c.id))
  return classes.map(c =>
    flipped.has(c.id) ? { ...c, status: 'completed', markedDoneBy: 'auto' } : c
  )
}

export async function cancelClass(classId, notifyStudentId = null) {
  // Read it first: once the status is cancelled we still need to know what the
  // class was paid with.
  const cls = await getClass(classId)

  await updateDoc(doc(db, 'classes', classId), {
    status: 'cancelled',
    // Staff cancelled this, so the student is owed a word about rescheduling —
    // it joins the follow-up list until someone actually reaches out.
    followUpNeeded: true,
    updatedAt: serverTimestamp(),
  })

  // The studio cancelled, so the class costs the student nothing. Wrapped: a
  // bookkeeping problem must not leave the class un-cancelled.
  if (cls?.creditBatchId) {
    try {
      const student = await getUser(cls.studentId)
      await refundCreditForClass(cls, student)
    } catch (e) { console.error('Cancelled, credit refund failed for', classId, e) }
  }

  // When staff cancels, notify the student
  if (notifyStudentId) {
    const when = await studentTimeLabel(notifyStudentId, cls?.scheduledAt?.toDate?.())
    await createNotification(notifyStudentId, 'class_cancelled',
      when || 'Your class has been cancelled.', classId, 'Class cancelled')
  }
}

// ─── A CLASS NOBODY TURNED UP TO ──────────────────────────────────────────────
// It happens: the slot passes and both Guruji and the student forget. The class
// has already been swept to 'completed' by then, which is a lie — so staff can
// retag it as missed.
//
// The status deliberately STAYS 'completed' rather than becoming a new value of
// its own: every tab, filter and stat in the app sorts classes into upcoming /
// completed / cancelled, and a fourth status would make a missed class vanish
// from all three. It keeps its place in the list and wears a 'Missed' tag.
//
// The credit isn't returned automatically. Nobody taught and nobody learned, so
// whether the student pays for it is Guruji's call — it goes to the same review
// queue a student's own cancellation does.
export async function markClassMissed(classId, staffId = null, note = '') {
  const cls = await getClass(classId)

  await updateDoc(doc(db, 'classes', classId), {
    status: 'completed',
    missed: true,
    missedAt: serverTimestamp(),
    missedBy: staffId,
    missedNote: (note || '').trim(),
    updatedAt: serverTimestamp(),
  })

  if (cls?.creditBatchId && !cls.creditRefundedAt && !cls.creditReviewNeeded) {
    try { await flagCreditForReview(classId, 'Class was missed — nobody attended') }
    catch (e) { console.error('Marked missed, credit flag failed:', e) }
  }

  if (cls?.studentId) {
    try {
      const when = await studentTimeLabel(cls.studentId, cls.scheduledAt?.toDate?.())
      await createNotification(cls.studentId, 'class_missed',
        when ? `${when} — marked as missed. Please speak to Guruji about rearranging it.`
             : 'A class was marked as missed. Please speak to Guruji about rearranging it.',
        classId, 'Class missed')
    } catch (e) { console.error('Marked missed, student notify failed:', e) }
  }
}

// Tagged by mistake — put it back to an ordinary completed class.
export async function unmarkClassMissed(classId) {
  await updateDoc(doc(db, 'classes', classId), {
    missed: deleteField(),
    missedAt: deleteField(),
    missedBy: deleteField(),
    missedNote: deleteField(),
    updatedAt: serverTimestamp(),
  })
}

// ─── CREDIT DECISIONS STAFF MAKE ON A CLASS ───────────────────────────────────
// When a student cancels their own class the credit is left alone and the class
// is flagged, because only Guruji can say whether they should get it back. These
// two functions are the yes and the no. Both clear the flag, so the decision is
// made once.

export async function staffReturnCredit(classId, reason = 'Returned by the studio') {
  const cls = await getClass(classId)
  if (!cls) return { refunded: false, why: 'no-class' }
  const student = await getUser(cls.studentId).catch(() => null)
  const result = await refundCreditForClass(cls, student, reason)
  await updateDoc(doc(db, 'classes', classId), {
    creditReviewNeeded: deleteField(),
    creditReviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return result
}

export async function staffKeepCredit(classId, staffId = null) {
  await updateDoc(doc(db, 'classes', classId), {
    creditReviewNeeded: deleteField(),
    creditReviewedAt: serverTimestamp(),
    creditReviewedBy: staffId,
    creditKept: true,
    updatedAt: serverTimestamp(),
  })
}

// Classes waiting on one of those two decisions.
export async function getCreditReviews() {
  const snap = await getDocs(query(collection(db, 'classes'), where('creditReviewNeeded', '==', true)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort(byLatest)
}

// Permanently delete a class document (admin/teacher only)
export async function deleteClass(classId) {
  await deleteDoc(doc(db, 'classes', classId))
}

function sortByScheduled(docs) {
  return docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.scheduledAt?.seconds ?? 0) - (b.scheduledAt?.seconds ?? 0))
}

export async function getPendingRequests(teacherId) {
  // No orderBy → avoids composite index; sorted client-side
  const q = query(
    collection(db, 'classes'),
    where('teacherId', '==', teacherId),
    where('status', '==', 'pending')
  )
  const snap = await getDocs(q)
  return sortByScheduled(snap.docs)
}

// Admin sees ALL pending requests regardless of which teacher they belong to
export async function getAllPendingRequests() {
  const q = query(collection(db, 'classes'), where('status', '==', 'pending'))
  const snap = await getDocs(q)
  return sortByScheduled(snap.docs)
}

// Admin sees ALL classes for a month (across all teachers)
export async function getAllClassesForMonth(year, month) {
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0, 23, 59, 59)
  const q = query(
    collection(db, 'classes'),
    where('scheduledAt', '>=', Timestamp.fromDate(start)),
    where('scheduledAt', '<=', Timestamp.fromDate(end)),
    orderBy('scheduledAt', 'asc')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function confirmClass(classId, studentId = null) {
  await updateDoc(doc(db, 'classes', classId), {
    status: 'scheduled',
    updatedAt: serverTimestamp(),
  })
  if (studentId) {
    const cls = await getClass(classId)
    const when = await studentTimeLabel(studentId, cls?.scheduledAt?.toDate?.())
    await createNotification(studentId, 'class_confirmed',
      when ? `${when} — see you there!` : 'Your class request has been confirmed!',
      classId, 'Class confirmed')
  }
}

export async function rejectClass(classId, studentId = null) {
  const cls = await getClass(classId)
  await updateDoc(doc(db, 'classes', classId), {
    status: 'rejected',
    updatedAt: serverTimestamp(),
  })
  // The class was never granted, so the credit goes straight back.
  if (cls?.creditBatchId) {
    try {
      await refundCreditForClass(cls, await getUser(cls.studentId),
        'Booking request was not accepted')
    } catch (e) { console.error('Rejected, credit refund failed for', classId, e) }
  }
  if (studentId) {
    const when = await studentTimeLabel(studentId, cls?.scheduledAt?.toDate?.())
    await createNotification(studentId, 'class_rejected',
      when ? `${when} — please pick another time.` : 'Your class request was not accepted.',
      classId, 'Class request declined')
  }
}

// Staff reschedules a class → notify student.
// Moving a class is booking a different time, so it takes the slot like any
// other booking and is refused if that time already has a class. Throws
// 'slot-taken', and the class stays where it was.
export async function rescheduleClass(classId, newScheduledAt, notifyStudentId = null) {
  const newDate = new Date(newScheduledAt)
  const cls = await getClass(classId)
  if (!cls) {
    const err = new Error('That class no longer exists.')
    err.code = 'no-class'
    throw err
  }

  await moveClassIntoSlot(classId, {
    scheduledAt: Timestamp.fromDate(newDate),
    status: 'scheduled',
    updatedAt: serverTimestamp(),
  }, { teacherId: cls.teacherId, scheduledAt: newDate, duration: cls.duration })
  if (notifyStudentId) {
    const when = await studentTimeLabel(notifyStudentId, newDate)
    await createNotification(notifyStudentId, 'class_rescheduled',
      when ? `Moved to ${when}` : 'Your class was rescheduled.', classId, 'Class rescheduled')
  }
}

// Student requests a reschedule → goes back to pending for staff to re-confirm + notify staff.
// Staff notification is wrapped so it can never fail the student's request.
export async function requestReschedule(classId, newScheduledAt) {
  const newDate = new Date(newScheduledAt)
  const cls = await getClass(classId)
  if (!cls) {
    const err = new Error('That class no longer exists.')
    err.code = 'no-class'
    throw err
  }

  // A pending class still occupies its time — staff have to be able to see it
  // on the calendar to confirm it — so a request to move into a taken slot is
  // refused here rather than creating a clash for someone to sort out later.
  await moveClassIntoSlot(classId, {
    scheduledAt: Timestamp.fromDate(newDate),
    status: 'pending',
    updatedAt: serverTimestamp(),
  }, { teacherId: cls.teacherId, scheduledAt: newDate, duration: cls.duration })
  try {
    const staffIds = await getStaffIds()
    const { name, when } = await staffContext(cls?.studentId, newDate, cls?.teacherId)
    await Promise.all(staffIds.map(id =>
      createNotification(id, 'reschedule_request',
        when ? `Wants to move their class to ${when}` : 'Wants to reschedule a class', classId, name)
    ))
  } catch (e) { console.error('Reschedule saved, staff notify failed:', e) }
}

// Student cancels their own class → cancels immediately and informs staff
// (no approval needed). Staff notification is wrapped so it can never fail the
// cancellation itself.
export async function cancelClassByStudent(classId) {
  const cls = await getClass(classId)
  await updateDoc(doc(db, 'classes', classId), {
    status: 'cancelled',
    updatedAt: serverTimestamp(),
  })
  // The credit is NOT returned automatically — whether a student gets it back
  // when they drop a class themselves is Guruji's decision, so it's flagged for
  // staff rather than quietly refunded (which would make cancelling free) or
  // quietly kept (which would be unfair when they had a real reason).
  if (cls?.creditBatchId && !cls.creditRefundedAt) {
    try { await flagCreditForReview(classId, 'Student cancelled their own class') }
    catch (e) { console.error('Could not flag the credit for review:', e) }
  }
  try {
    const staffIds = await getStaffIds()
    const { name, when } = await staffContext(
      cls?.studentId, cls?.scheduledAt?.toDate?.() ?? null, cls?.teacherId)
    await Promise.all(staffIds.map(id =>
      createNotification(id, 'class_cancelled_by_student',
        when ? `Cancelled their class — ${when}` : 'Cancelled a class', classId, name)
    ))
  } catch (e) { console.error('Cancelled, staff notify failed:', e) }
}

// ─── RECORDINGS AND LESSON NOTES ──────────────────────────────────────────────
// A recording is ONE free-text field: staff paste the whole thing straight from
// Zoom — link, passcode, whatever — and the student sees it with the links
// tappable and a copy button.
//
// The text itself lives in classes/{id}/detail/d, not on the class document,
// because the class document is readable by every signed-in user and these are
// not. See src/firebase/classDetail.js. Only the two booleans stay out here, so
// a list can show "has a recording" without reading anybody's private text.

export {
  getClassDetail, getClassDetails, hasRecording, recordingText,
  recordingTitleOf, notesFrom, hasNotes, firstUrl,
} from './classDetail'

export async function saveRecording(classId, info, notifyStudentId = null) {
  const text = (info || '').trim()
  await saveClassDetail(classId, {
    recordingInfo: text,
    recordingUrl: firstUrlOf(text) || '',
  })
  // The flag on the class is what lists filter on, so it is written after the
  // text — a flag with no text behind it would show an empty recording.
  await updateDoc(doc(db, 'classes', classId), {
    hasRecording: !!text,
    updatedAt: serverTimestamp(),
  })
  if (notifyStudentId) {
    try {
      await createNotification(notifyStudentId, 'recording_posted',
        'Your class recording is ready to watch', classId, 'New recording')
    } catch (e) { console.error('Recording saved, student notify failed:', e) }
  }
}

// Rename a recording (students use this on their own classes).
export async function renameRecording(classId, title) {
  await saveClassDetail(classId, { recordingTitle: (title || '').trim() })
}

// Lesson notes. Written by staff about the class, and by the student as a note
// to Guruji when they book — the same field, which is why it is one of the
// things another student must not be able to read.
export async function saveLessonNotes(classId, notes) {
  const text = (notes || '').trim()
  await saveClassDetail(classId, { lessonNotes: text })
  await updateDoc(doc(db, 'classes', classId), {
    hasNotes: !!text,
    updatedAt: serverTimestamp(),
  })
}

// ─── FOLLOW-UPS ───────────────────────────────────────────────────────────────
// When staff cancel a class, the student is owed a personal word about
// rescheduling. Those classes carry followUpNeeded until someone reaches out.
// The flag is REMOVED once handled (rather than set to false), so this query
// only ever reads the handful still open, however long the studio runs.

const byLatest = (a, b) => (b.scheduledAt?.seconds ?? 0) - (a.scheduledAt?.seconds ?? 0)

// Live version: every open dashboard hears the moment any teacher or admin
// handles a student, so nobody messages the same person twice. Because the
// query only matches open follow-ups, it stays cheap no matter how many
// cancellations the studio has had. Returns the unsubscribe function.
export function subscribePendingFollowUps(onChange, onError) {
  return onSnapshot(
    query(collection(db, 'classes'), where('followUpNeeded', '==', true)),
    snap => onChange(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort(byLatest)),
    onError,
  )
}

// `via` records how it was handled — 'whatsapp' when the message was opened,
// 'manual' when ticked off after a call or a chat in person.
export async function markFollowUpDone(classId, staffId = null, via = 'manual') {
  await updateDoc(doc(db, 'classes', classId), {
    followUpNeeded: deleteField(),
    followUpDoneAt: serverTimestamp(),
    followUpBy: staffId,
    followUpVia: via,
    updatedAt: serverTimestamp(),
  })
}

// Once the class day itself has gone, there is nothing left to rearrange, so
// the follow-up drops off the list on its own. Recorded as lapsed rather than
// contacted, so the history stays honest — and removing the flag keeps the
// query reading only what is still live.
export async function lapseFollowUp(classId) {
  await updateDoc(doc(db, 'classes', classId), {
    followUpNeeded: deleteField(),
    followUpLapsedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

// In case it was ticked off by mistake
export async function undoFollowUpDone(classId) {
  await updateDoc(doc(db, 'classes', classId), {
    followUpNeeded: true,
    followUpDoneAt: deleteField(),
    followUpBy: deleteField(),
    followUpVia: deleteField(),
    updatedAt: serverTimestamp(),
  })
}

// ─── RECURRING SCHEDULES ──────────────────────────────────────────────────────

export async function createRecurringSchedule(data) {
  return await addDoc(collection(db, 'recurringSchedules'), {
    ...data,
    isActive: true,
    createdAt: serverTimestamp(),
  })
}

export async function getStudentRecurringSchedules(studentId) {
  const snap = await getDocs(query(collection(db, 'recurringSchedules'), where('studentId', '==', studentId)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.isActive !== false)
}

// End a recurring series: mark inactive + cancel all its FUTURE generated classes
export async function cancelRecurringSchedule(recurringId) {
  await updateDoc(doc(db, 'recurringSchedules', recurringId), { isActive: false })
  const now = Timestamp.now()
  const snap = await getDocs(query(collection(db, 'classes'), where('recurringId', '==', recurringId)))
  const futureScheduled = snap.docs.filter(d => {
    const data = d.data()
    return (data.status === 'scheduled' || !data.status) && (data.scheduledAt?.seconds ?? 0) >= now.seconds
  })
  await Promise.all(futureScheduled.map(d =>
    updateDoc(doc(db, 'classes', d.id), { status: 'cancelled', updatedAt: serverTimestamp() })
  ))
}

// ─── AVAILABILITY (BLOCKED SLOTS) ─────────────────────────────────────────────

// Block a period in one go: a single day or a from–to date range, either
// full-day or with the same start/end times on each day. Stored as ONE DOC PER
// DAY sharing a groupId — month queries and per-day calendar rendering keep
// working unchanged, and the whole range can be deleted in one action.
// The concrete day-by-day time ranges a block covers. Shared by the writer
// below and by the clash check, so "what gets blocked" and "what gets cancelled"
// can never disagree.
export function buildBlockIntervals({ startDate, endDate, fullDay, startTime, endTime }) {
  const [sh, sm] = fullDay ? [0, 0] : startTime.split(':').map(Number)
  const [eh, em] = fullDay ? [23, 59] : endTime.split(':').map(Number)

  const [y0, m0, d0] = startDate.split('-').map(Number)
  const [y1, m1, d1] = (endDate || startDate).split('-').map(Number)
  const first = new Date(y0, m0 - 1, d0)
  const last = new Date(y1, m1 - 1, d1)

  const intervals = []
  for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
    intervals.push({
      start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), sh, sm, 0),
      end: fullDay
        ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59)
        : new Date(d.getFullYear(), d.getMonth(), d.getDate(), eh, em, 0),
    })
  }
  return intervals
}

export async function addBlockedRange(teacherId, opts) {
  const groupId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const intervals = buildBlockIntervals(opts)
  await Promise.all(intervals.map(({ start, end }) => addDoc(collection(db, 'availability'), {
    teacherId,
    startAt: Timestamp.fromDate(start),
    endAt: Timestamp.fromDate(end),
    reason: opts.reason || '',
    groupId,
    fullDay: !!opts.fullDay,
    createdAt: serverTimestamp(),
  })))
  return groupId
}

// Upcoming classes that fall inside a proposed block — these are what the
// teacher is warned about (and what gets cancelled if they go ahead).
// Past classes are never touched.
export async function findClassesInIntervals(teacherId, intervals) {
  const now = new Date()
  const snap = await getDocs(query(collection(db, 'classes'), where('teacherId', '==', teacherId)))
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(c => {
      const status = c.status || 'scheduled'
      if (status !== 'scheduled' && status !== 'pending') return false
      const s = c.scheduledAt?.toDate?.()
      if (!s || s < now) return false
      const e = new Date(s.getTime() + (c.duration || 60) * 60000)
      return intervals.some(iv => s < iv.end && e > iv.start)
    })
    .sort((a, b) => (a.scheduledAt?.seconds ?? 0) - (b.scheduledAt?.seconds ?? 0))
}

// A class time written in the STUDENT's own timezone, for messages they read.
async function studentTimeLabel(studentId, date) {
  if (!date) return ''
  let tz = 'Asia/Kolkata'
  try { tz = (await getUser(studentId))?.timezone || tz } catch { /* default tz */ }
  return fmtWhen(date, tz)
}

// Cancel the classes displaced by a block and tell each student why. The block's
// groupId and the class's previous status are recorded, so removing the block
// later can put these classes back exactly as they were. Each cancellation is
// independent: one failure can't stop the rest.
export async function cancelClassesForBlock(classes, groupId = null) {
  await Promise.all(classes.map(async (c) => {
    try {
      await updateDoc(doc(db, 'classes', c.id), {
        status: 'cancelled',
        cancelledByBlock: groupId || true,
        statusBeforeBlock: c.status || 'scheduled',
        followUpNeeded: true,
        updatedAt: serverTimestamp(),
      })
      // Guruji is away, so the student keeps their credit.
      if (c.creditBatchId) {
        try {
          await refundCreditForClass(c, await getUser(c.studentId))
        } catch (e) { console.error('Block refund failed for class', c.id, e) }
      }
      const when = await studentTimeLabel(c.studentId, c.scheduledAt?.toDate?.())
      await createNotification(
        c.studentId, 'class_cancelled',
        when
          ? `${when} — Guruji is unavailable. Please reschedule after consulting with Guruji.`
          : 'Guruji is unavailable. Please reschedule after consulting with Guruji.',
        c.id, 'Class cancelled',
      )
    } catch (e) {
      console.error('Block cancellation failed for class', c.id, e)
    }
  }))
}

// Classes this block cancelled that could still be put back (future ones only —
// restoring a class whose time has already passed would be pointless).
export async function findRestorableClasses(groupId) {
  if (!groupId) return []
  const now = new Date()
  const snap = await getDocs(query(collection(db, 'classes'), where('cancelledByBlock', '==', groupId)))
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(c => {
      if ((c.status || '') !== 'cancelled') return false // already handled some other way
      const s = c.scheduledAt?.toDate?.()
      return s && s > now
    })
    .sort((a, b) => (a.scheduledAt?.seconds ?? 0) - (b.scheduledAt?.seconds ?? 0))
}

// Put back classes that a (now removed) block had cancelled, restoring each to
// the status it held before, and telling the student the class is back on.
// While the block stood, these classes were cancelled and their slots were
// free for anyone to book — and someone may well have done. So a restore has
// to take the slot back like any other booking, and a class whose time has
// since gone to someone else stays cancelled rather than quietly becoming a
// second class at the same hour.
//
// Returns { restored, taken } so the caller can say what actually happened;
// `taken` holds the classes that could not come back.
export async function restoreClassesFromBlock(classes) {
  const restored = []
  const taken = []

  // One at a time, not in parallel: two classes from the same block can share
  // a slot (an old cancelled one and a newer one), and running them together
  // would let both claim it.
  for (const c of classes) {
    try {
      const start = c.scheduledAt?.toDate?.() ?? new Date(c.scheduledAt)
      await moveClassIntoSlot(c.id, {
        status: c.statusBeforeBlock || 'scheduled',
        cancelledByBlock: null,
        statusBeforeBlock: null,
        // The class is back on, so there's nothing left to chase
        followUpNeeded: deleteField(),
        updatedAt: serverTimestamp(),
      }, { teacherId: c.teacherId, scheduledAt: start, duration: c.duration })

      // The class is happening after all, so the credit that was handed back
      // when it was cancelled has to come out again.
      if (c.creditBatchId && c.creditRefundedAt) {
        try { await rechargeCreditForClass(c) }
        catch (e) { console.error('Restore: credit re-charge failed for', c.id, e) }
      }
      restored.push(c)
      const when = await studentTimeLabel(c.studentId, start)
      await createNotification(
        c.studentId, 'class_restored',
        when
          ? `${when} — Guruji is available again, your class is back on.`
          : 'Guruji is available again — your class is back on.',
        c.id, 'Class back on',
      )
    } catch (e) {
      if (e?.code === 'slot-taken') {
        // Someone else has this time now. The class stays cancelled and the
        // student keeps the credit they were already given back.
        taken.push(c)
        const when = await studentTimeLabel(c.studentId, c.scheduledAt?.toDate?.())
        await createNotification(
          c.studentId, 'class_not_restored',
          when
            ? `${when} has since been booked by someone else, so this class stays cancelled. Please pick another time.`
            : 'That time has since been booked, so this class stays cancelled. Please pick another time.',
          c.id, 'Class could not be restored',
        ).catch(err => console.error('Restore: notify failed for', c.id, err))
      } else {
        console.error('Class restore failed for', c.id, e)
      }
    }
  }

  return { restored, taken }
}

// Delete every day of a grouped block in one go.
export async function deleteBlockedGroup(groupId) {
  const snap = await getDocs(query(collection(db, 'availability'), where('groupId', '==', groupId)))
  await Promise.all(snap.docs.map(d => deleteDoc(doc(db, 'availability', d.id))))
}

// Blocked slots that overlap a given time window (for warning staff before
// they schedule a class into a blocked period).
export async function findBlockedOverlaps(teacherId, startDate, durationMin) {
  const start = new Date(startDate)
  const end = new Date(start.getTime() + durationMin * 60000)
  const snap = await getDocs(query(collection(db, 'availability'), where('teacherId', '==', teacherId)))
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(s => {
      const bStart = s.startAt?.toDate?.()
      const bEnd = s.endAt?.toDate?.()
      return bStart && bEnd && start < bEnd && end > bStart
    })
}

export async function getBlockedSlotsForMonth(teacherId, year, month) {
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0, 23, 59, 59)

  const snap = await getDocs(query(collection(db, 'availability'), where('teacherId', '==', teacherId)))
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(s => { const t = s.startAt?.toDate?.(); return t >= start && t <= end })
}

export async function deleteBlockedSlot(slotId) {
  await deleteDoc(doc(db, 'availability', slotId))
}

// ─── PAYMENTS ─────────────────────────────────────────────────────────────────

export async function createPayment(data) {
  const ref = await addDoc(collection(db, 'payments'), {
    ...data,
    submittedAt: serverTimestamp(),
  })
  // When a STUDENT submits a payment, alert the teacher + all admins to review.
  // (Staff "Mark Paid" entries are already confirmed, so they don't notify.)
  if (data.submittedBy === 'student') {
    try {
      const staffIds = await getStaffIds()
      const { name } = await staffContext(data.studentId, null)
      const amount = data.amount ? ` of ₹${data.amount}` : ''
      await Promise.all(staffIds.map(id =>
        createNotification(id, 'payment_submitted',
          `Submitted a payment${amount} — tap to review`, null, name)
      ))
    } catch (e) { console.error('Payment saved, staff notify failed:', e) }
  }
  return ref
}

// Buying credits IS the payment, so the two are recorded together: the money
// goes on the books as a confirmed payment and the credits are granted against
// it, each pointing at the other.
//
// The payment is written FIRST on purpose. If the grant then fails, the studio
// has a recorded payment and no credits — an admin sees the error and grants
// again. The other order would risk credits with no payment behind them, which
// is the expensive mistake.
export async function grantCreditsWithPayment({
  studentId, student, quantity, amount, method = 'cash', months = null,
  note = '', staffId = null, staffName = '',
}) {
  const paid = Number(amount) || 0

  // Money first, credits second. Enforced here rather than only in the form,
  // because the form is not the thing that must be right — a grant with no
  // payment behind it cannot be reconciled later. Students the studio settles
  // with outside the app are flagged as exempt on their profile.
  const profile = student || (studentId ? await getUser(studentId).catch(() => null) : null)
  const problem = paymentProblem(profile, paid)
  if (problem) {
    const err = new Error(problem)
    err.code = 'payment-required'
    throw err
  }

  let paymentId = null

  if (paid > 0) {
    const now = new Date()
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const ref = await createPayment({
      studentId,
      amount: paid,
      method,
      months: months?.length ? months : [thisMonth],
      note: note || `${quantity} class ${quantity === 1 ? 'credit' : 'credits'}`,
      submittedBy: 'staff',
      status: 'confirmed',
      confirmedBy: staffId,
      // Marks this as a credit purchase rather than a plain monthly fee
      forCredits: quantity,
    })
    paymentId = ref.id
  }

  try {
    const result = await grantCredits({
      studentId, student, quantity,
      grantedBy: staffId, grantedByName: staffName, reason: note, paymentId,
    })
    // Link back, so a payment row can show which credits it bought
    if (paymentId) {
      await updateDoc(doc(db, 'payments', paymentId), { creditBatchId: result.id })
        .catch(e => console.error('Credits granted, payment link failed:', e))
    }
    return { ...result, paymentId }
  } catch (e) {
    // Tell the caller the money is already recorded, so the message can say so
    if (paymentId) e.paymentRecorded = paid
    throw e
  }
}

export async function getStudentPayments(studentId) {
  // No orderBy → avoids composite index; sorted client-side
  const q = query(collection(db, 'payments'), where('studentId', '==', studentId))
  const snap = await getDocs(q)
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.submittedAt?.seconds ?? 0) - (a.submittedAt?.seconds ?? 0))
}

// Correct a payment that was recorded wrongly — the amount typed in a hurry,
// the wrong method, the wrong months. Staff only: the Firestore rule on
// `payments` already allows updates from admins and the teacher alone, so a
// student cannot change one even if they tried.
//
// The student is told when the AMOUNT changes, because that's the part they
// could reasonably disagree with; a corrected note or method isn't worth a
// notification.
export async function updatePayment(paymentId, data, editedBy = null) {
  const before = await getDoc(doc(db, 'payments', paymentId))
  const old = before.exists() ? before.data() : null

  await updateDoc(doc(db, 'payments', paymentId), {
    ...data,
    editedBy,
    editedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  const oldAmount = Number(old?.amount) || 0
  const newAmount = Number(data?.amount)
  if (old?.studentId && Number.isFinite(newAmount) && newAmount !== oldAmount) {
    try {
      await createNotification(old.studentId, 'payment_updated',
        `Your payment record now reads ₹${newAmount}.`, null, 'Payment updated')
    } catch (e) { console.error('Payment updated, student notify failed:', e) }
  }
}

export async function confirmPayment(paymentId, confirmedByUid, studentId = null) {
  await updateDoc(doc(db, 'payments', paymentId), {
    status: 'confirmed',
    confirmedBy: confirmedByUid,
    confirmedAt: serverTimestamp(),
  })
  if (studentId) {
    await createNotification(studentId, 'payment_confirmed',
      'Thank you — your payment is verified.', null, 'Payment confirmed')
  }
}

// Staff declines a submitted payment → student is asked to re-submit
export async function rejectPayment(paymentId, studentId = null) {
  await updateDoc(doc(db, 'payments', paymentId), {
    status: 'rejected',
    updatedAt: serverTimestamp(),
  })
  if (studentId) {
    await createNotification(studentId, 'payment_rejected',
      'Your payment could not be confirmed — please re-submit.', null, 'Payment needs attention')
  }
}

export async function getAllStudentsIncludingInactive() {
  const q = query(collection(db, 'users'), where('role', '==', 'student'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort(byStudentName)
}

// Deactivate (pause) a student: blocks their access and CANCELS their upcoming
// classes (scheduled/pending) so they leave the schedule. Completed-class
// history and all payment records are kept for your accounts. Reversible via
// reactivateStudent (their cancelled classes are not auto-restored).
export async function deactivateStudent(uid) {
  const snap = await getDocs(query(collection(db, 'classes'), where('studentId', '==', uid)))
  const active = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(c => {
      const s = c.status || 'scheduled'
      return s === 'scheduled' || s === 'pending'
    })
  await Promise.all(active.map(c =>
    updateDoc(doc(db, 'classes', c.id), { status: 'cancelled', updatedAt: serverTimestamp() })
  ))
  // Pausing someone shouldn't spend the classes they already paid for — the
  // credits go back, ready for them if they return.
  const student = await getUser(uid).catch(() => null)
  for (const c of active) {
    if (!c.creditBatchId) continue
    try { await refundCreditForClass(c, student, 'Account paused') }
    catch (e) { console.error('Pause: credit refund failed for class', c.id, e) }
  }
  await updateDoc(doc(db, 'users', uid), { isActive: false })
}

export async function reactivateStudent(uid) {
  await updateDoc(doc(db, 'users', uid), { isActive: true })
}

// Permanently delete a student and all their data (classes, payments, recurring,
// notifications). Does NOT remove their Firebase Auth login — delete that in the
// Firebase Console if needed. Use for cleaning up test accounts.
export async function deleteStudentCompletely(uid) {
  const [classesSnap, paymentsSnap, recurringSnap, notifsSnap, creditsSnap] = await Promise.all([
    getDocs(query(collection(db, 'classes'), where('studentId', '==', uid))),
    getDocs(query(collection(db, 'payments'), where('studentId', '==', uid))),
    getDocs(query(collection(db, 'recurringSchedules'), where('studentId', '==', uid))),
    getDocs(query(collection(db, 'notifications'), where('userId', '==', uid))),
    getDocs(query(collection(db, 'credits'), where('studentId', '==', uid))),
  ])
  await Promise.all([
    ...classesSnap.docs.map(d => deleteDoc(doc(db, 'classes', d.id))),
    ...paymentsSnap.docs.map(d => deleteDoc(doc(db, 'payments', d.id))),
    ...recurringSnap.docs.map(d => deleteDoc(doc(db, 'recurringSchedules', d.id))),
    ...notifsSnap.docs.map(d => deleteDoc(doc(db, 'notifications', d.id))),
    ...creditsSnap.docs.map(d => deleteDoc(doc(db, 'credits', d.id))),
  ])
  await deleteDoc(doc(db, 'users', uid))
}

export async function getTeacherAllClasses(teacherId) {
  // No orderBy → avoids composite index; sorted client-side
  const q = query(collection(db, 'classes'), where('teacherId', '==', teacherId))
  const snap = await getDocs(q)
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.scheduledAt?.seconds ?? 0) - (a.scheduledAt?.seconds ?? 0))
}

export async function getAllClassesDesc() {
  const q = query(collection(db, 'classes'), orderBy('scheduledAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

// Sending one now lives in notify.js (so credits.js can send without importing
// this whole file); re-exported here because that's where the app looks for it.
export { createNotification }

export async function getUserNotifications(userId) {
  // No orderBy → avoids composite index; sorted client-side
  const q = query(collection(db, 'notifications'), where('userId', '==', userId))
  const snap = await getDocs(q)
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
}

export async function markNotificationRead(notificationId) {
  await updateDoc(doc(db, 'notifications', notificationId), { isRead: true })
}

export async function markAllNotificationsRead(userId) {
  const snap = await getDocs(query(collection(db, 'notifications'), where('userId', '==', userId)))
  await Promise.all(
    snap.docs
      .filter(d => d.data().isRead !== true)
      .map(d => updateDoc(doc(db, 'notifications', d.id), { isRead: true }))
  )
}

export async function clearAllNotifications(userId) {
  const snap = await getDocs(query(collection(db, 'notifications'), where('userId', '==', userId)))
  await Promise.all(snap.docs.map(d => deleteDoc(doc(db, 'notifications', d.id))))
}

// ─── PROFILE PICTURES ─────────────────────────────────────────────────────────
// Stored the same way receipts are: a compressed data-URL in its OWN document,
// not on the user doc. That matters for cost — the Students and Fees pages read
// every student, and an avatar baked into each user doc would drag ~20KB per
// student into every one of those reads.
//
// `hasPhoto` on the user doc is the cheap part: lists use it to decide between
// initials and a real picture without fetching anything. The picture itself is
// only read when a profile is actually opened.
export async function savePhoto(uid, dataUrl, updatedBy = null) {
  await setDoc(doc(db, 'photos', uid), {
    dataUrl,
    updatedAt: serverTimestamp(),
    updatedBy,
  })
  await updateDoc(doc(db, 'users', uid), { hasPhoto: true })
}

export async function getPhoto(uid) {
  if (!uid) return null
  const snap = await getDoc(doc(db, 'photos', uid))
  return snap.exists() ? snap.data().dataUrl : null
}

export async function deletePhoto(uid) {
  await deleteDoc(doc(db, 'photos', uid))
  await updateDoc(doc(db, 'users', uid), { hasPhoto: deleteField() })
}

// ─── RECEIPTS (stored in Firestore, not Storage — reliable on any setup) ──────
// The compressed image lives in its own doc so payment lists stay lightweight;
// it's only fetched when staff actually open the receipt.
export async function saveReceipt(paymentId, dataUrl) {
  // hasReceipt is already set when the payment is created, so we only write the
  // receipt doc here (students can't update the payment doc, but can create this).
  await setDoc(doc(db, 'receipts', paymentId), { dataUrl, createdAt: serverTimestamp() })
}

export async function getReceipt(paymentId) {
  const snap = await getDoc(doc(db, 'receipts', paymentId))
  return snap.exists() ? snap.data().dataUrl : null
}

// Resolve the (single) teacher's id WITHOUT depending on the student being able
// to query the users collection. Students can always read `classes`, so if the
// users query is blocked (strict rules) or empty, we derive the teacherId from
// any existing class. This keeps booking working even if rules aren't perfect.
async function deriveTeacherIdFromClasses() {
  try {
    const csnap = await getDocs(query(collection(db, 'classes'), limit(20)))
    for (const d of csnap.docs) {
      const tid = d.data().teacherId
      if (tid) return tid
    }
  } catch { /* ignore */ }
  return null
}

export async function getTeacherId() {
  try {
    const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'teacher')))
    if (!snap.empty) return snap.docs[0].id
  } catch { /* student may be blocked from users — fall back below */ }
  return await deriveTeacherIdFromClasses()
}

// The teacher's profile, incl. their timezone (the "studio" timezone).
// Falls back to a minimal { id } (no timezone) if the users query is blocked,
// so the student can still book — the dual-timezone view just won't show.
export async function getTeacher() {
  try {
    const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'teacher')))
    if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() }
  } catch { /* fall back below */ }
  const tid = await deriveTeacherIdFromClasses()
  return tid ? { id: tid } : null
}

// ─── STATS ────────────────────────────────────────────────────────────────────

// Admin dashboard stats — no compound queries, all client-side filtering
export async function getAdminDashboardStats() {
  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  // Simple single-field queries — no composite index needed
  const [studentsSnap, pendingSnap, monthSnap] = await Promise.all([
    getDocs(query(collection(db, 'users'), where('role', '==', 'student'))),
    getDocs(query(collection(db, 'classes'), where('status', '==', 'pending'))),
    getDocs(query(
      collection(db, 'classes'),
      where('scheduledAt', '>=', Timestamp.fromDate(monthStart)),
      where('scheduledAt', '<=', Timestamp.fromDate(monthEnd))
    )),
  ])

  // Count only real classes (scheduled or completed), not cancelled/rejected/pending
  const isReal = (c) => { const s = c.status || 'scheduled'; return s === 'scheduled' || s === 'completed' }
  const monthDocs = monthSnap.docs.map(d => d.data())
  const todayCount = monthDocs.filter(c => {
    const t = c.scheduledAt?.toDate?.()
    return t >= todayStart && t <= todayEnd && isReal(c)
  }).length
  const monthCount = monthDocs.filter(isReal).length

  return {
    totalStudents: studentsSnap.docs.filter(d => d.data().isActive !== false).length,
    todayClasses: todayCount,
    monthClasses: monthCount,
    pendingRequests: pendingSnap.size,
  }
}

export async function getDashboardStats(teacherId) {
  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  // Single-field queries only — filter the rest client-side (no composite index)
  const [studentsSnap, classesSnap] = await Promise.all([
    getDocs(query(collection(db, 'users'), where('role', '==', 'student'))),
    getDocs(query(collection(db, 'classes'), where('teacherId', '==', teacherId))),
  ])

  const classes = classesSnap.docs.map(d => d.data())
  const isReal = (c) => { const s = c.status || 'scheduled'; return s === 'scheduled' || s === 'completed' }
  const inMonth = classes.filter(c => {
    const t = c.scheduledAt?.toDate?.()
    return t >= monthStart && t <= monthEnd && isReal(c)
  })
  const today = inMonth.filter(c => {
    const t = c.scheduledAt?.toDate?.()
    return t >= todayStart && t <= todayEnd
  })
  const pending = classes.filter(c => c.status === 'pending')

  return {
    totalStudents: studentsSnap.docs.filter(d => d.data().isActive !== false).length,
    todayClasses: today.length,
    monthClasses: inMonth.length,
    pendingRequests: pending.length,
  }
}

// ─── STUDENT BOOKING CALENDAR ─────────────────────────────────────────────────

// Student booking view: shows the teacher's blocked slots + ANONYMOUS busy blocks
// for occupied times. Other students' names/notes are never returned — only the
// time range is exposed so a student can see when the teacher is busy.
export async function getStudentBookingCalendar(teacherId, studentId, year, month) {
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0, 23, 59, 59)
  const inRange = (t) => t && t >= start && t <= end

  const [allClassesSnap, blockedSnap] = await Promise.all([
    getDocs(query(collection(db, 'classes'), where('teacherId', '==', teacherId))),
    getDocs(query(collection(db, 'availability'), where('teacherId', '==', teacherId))),
  ])

  // Anonymize others (only busy time); the student's OWN classes also show
  // their status (scheduled / completed) so the legend can colour them.
  const bookedSlots = allClassesSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(c => {
      const t = c.scheduledAt?.toDate?.()
      if (!inRange(t)) return false
      const status = c.status || 'scheduled'
      const mine = c.studentId === studentId
      if (mine) return status === 'scheduled' || status === 'pending' || status === 'completed'
      return status === 'scheduled' || status === 'pending'
    })
    .map(c => {
      const mine = c.studentId === studentId
      return {
        id: c.id,
        scheduledAt: c.scheduledAt,
        duration: c.duration || 60,
        mine,
        status: mine ? (c.status || 'scheduled') : 'busy',
      }
    })

  const blockedSlots = blockedSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(s => inRange(s.startAt?.toDate?.()))

  return { bookedSlots, blockedSlots }
}
