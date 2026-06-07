import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, Timestamp, serverTimestamp
} from 'firebase/firestore'
import { db } from './config'

// ─── USERS ────────────────────────────────────────────────────────────────────

export async function getUser(uid) {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function getAllStudents() {
  const q = query(collection(db, 'users'), where('role', '==', 'student'), where('isActive', '==', true))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
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

export async function createClass(data) {
  const ref = await addDoc(collection(db, 'classes'), {
    ...data,
    markedDoneBy: null,
    lessonNotes: data.lessonNotes || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  // Notify teacher and all admins about the new booking request
  if (data.status === 'pending') {
    const staffIds = await getStaffIds()
    await Promise.all(staffIds.map(id =>
      createNotification(id, 'new_booking', 'A student has requested a new class.', ref.id)
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
export async function createBooking({
  studentId, teacherId, scheduledAt, duration,
  lessonNotes = '', isRecurring = false, recurringId = null, forceStatus = null,
}) {
  const startDate = scheduledAt?.toDate ? scheduledAt.toDate() : new Date(scheduledAt)
  let overlap = false
  let status = forceStatus

  if (!status) {
    const overlaps = await findOverlappingClasses(teacherId, startDate, duration)
    overlap = overlaps.length > 0
    status = overlap ? 'pending' : 'scheduled'
  }

  const ref = await addDoc(collection(db, 'classes'), {
    studentId, teacherId,
    scheduledAt: scheduledAt?.toDate ? scheduledAt : Timestamp.fromDate(startDate),
    duration, lessonNotes,
    isRecurring, recurringId,
    status,
    isOverlap: overlap,
    markedDoneBy: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  // Notify staff: overlaps need confirmation, free bookings are just a heads-up
  const staffIds = await getStaffIds()
  const [type, msg] = status === 'pending'
    ? ['overlap_booking', 'A booking overlaps an existing class — please confirm.']
    : ['class_booked', 'A student booked a new class.']
  await Promise.all(staffIds.map(id => createNotification(id, type, msg, ref.id)))

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

export async function updateClass(classId, data) {
  await updateDoc(doc(db, 'classes', classId), {
    ...data,
    updatedAt: serverTimestamp(),
  })
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

export async function cancelClass(classId, notifyStudentId = null) {
  await updateDoc(doc(db, 'classes', classId), {
    status: 'cancelled',
    updatedAt: serverTimestamp(),
  })
  // When staff cancels, notify the student
  if (notifyStudentId) {
    await createNotification(notifyStudentId, 'class_cancelled', 'Your class has been cancelled.', classId)
  }
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
    await createNotification(studentId, 'class_confirmed', 'Your class request has been confirmed!', classId)
  }
}

export async function rejectClass(classId, studentId = null) {
  await updateDoc(doc(db, 'classes', classId), {
    status: 'rejected',
    updatedAt: serverTimestamp(),
  })
  if (studentId) {
    await createNotification(studentId, 'class_rejected', 'Your class request was not accepted.', classId)
  }
}

// Staff reschedules a class → notify student
export async function rescheduleClass(classId, newScheduledAt, notifyStudentId = null) {
  const newDate = new Date(newScheduledAt)
  await updateDoc(doc(db, 'classes', classId), {
    scheduledAt: Timestamp.fromDate(newDate),
    status: 'scheduled',
    updatedAt: serverTimestamp(),
  })
  if (notifyStudentId) {
    const when = newDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) +
      ' at ' + newDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    await createNotification(notifyStudentId, 'class_rescheduled', `Your class was rescheduled to ${when}.`, classId)
  }
}

// Student requests a reschedule → goes back to pending for staff to re-confirm + notify staff
export async function requestReschedule(classId, newScheduledAt) {
  await updateDoc(doc(db, 'classes', classId), {
    scheduledAt: Timestamp.fromDate(new Date(newScheduledAt)),
    status: 'pending',
    updatedAt: serverTimestamp(),
  })
  const staffIds = await getStaffIds()
  await Promise.all(staffIds.map(id =>
    createNotification(id, 'reschedule_request', 'A student requested to reschedule a class.', classId)
  ))
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

export async function getAllRecurringSchedules() {
  const snap = await getDocs(query(collection(db, 'recurringSchedules'), where('isActive', '==', true)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
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

export async function addBlockedSlot(teacherId, startAt, endAt, reason = '') {
  return await addDoc(collection(db, 'availability'), {
    teacherId,
    startAt: Timestamp.fromDate(new Date(startAt)),
    endAt: Timestamp.fromDate(new Date(endAt)),
    reason,
    createdAt: serverTimestamp(),
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
  return await addDoc(collection(db, 'payments'), {
    ...data,
    submittedAt: serverTimestamp(),
  })
}

export async function getStudentPayments(studentId) {
  // No orderBy → avoids composite index; sorted client-side
  const q = query(collection(db, 'payments'), where('studentId', '==', studentId))
  const snap = await getDocs(q)
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.submittedAt?.seconds ?? 0) - (a.submittedAt?.seconds ?? 0))
}

export async function getAllPayments() {
  const q = query(collection(db, 'payments'), orderBy('submittedAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function confirmPayment(paymentId, confirmedByUid, studentId = null) {
  await updateDoc(doc(db, 'payments', paymentId), {
    status: 'confirmed',
    confirmedBy: confirmedByUid,
    confirmedAt: serverTimestamp(),
  })
  if (studentId) {
    await createNotification(studentId, 'payment_confirmed', 'Your payment has been confirmed!', null)
  }
}

// Staff declines a submitted payment → student is asked to re-submit
export async function rejectPayment(paymentId, studentId = null) {
  await updateDoc(doc(db, 'payments', paymentId), {
    status: 'rejected',
    updatedAt: serverTimestamp(),
  })
  if (studentId) {
    await createNotification(studentId, 'payment_rejected', 'Your payment could not be confirmed — please re-submit.', null)
  }
}

export async function getAllStudentsIncludingInactive() {
  const q = query(collection(db, 'users'), where('role', '==', 'student'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function deactivateStudent(uid) {
  await updateDoc(doc(db, 'users', uid), { isActive: false })
}

export async function reactivateStudent(uid) {
  await updateDoc(doc(db, 'users', uid), { isActive: true })
}

// Permanently delete a student and all their data (classes, payments, recurring,
// notifications). Does NOT remove their Firebase Auth login — delete that in the
// Firebase Console if needed. Use for cleaning up test accounts.
export async function deleteStudentCompletely(uid) {
  const [classesSnap, paymentsSnap, recurringSnap, notifsSnap] = await Promise.all([
    getDocs(query(collection(db, 'classes'), where('studentId', '==', uid))),
    getDocs(query(collection(db, 'payments'), where('studentId', '==', uid))),
    getDocs(query(collection(db, 'recurringSchedules'), where('studentId', '==', uid))),
    getDocs(query(collection(db, 'notifications'), where('userId', '==', uid))),
  ])
  await Promise.all([
    ...classesSnap.docs.map(d => deleteDoc(doc(db, 'classes', d.id))),
    ...paymentsSnap.docs.map(d => deleteDoc(doc(db, 'payments', d.id))),
    ...recurringSnap.docs.map(d => deleteDoc(doc(db, 'recurringSchedules', d.id))),
    ...notifsSnap.docs.map(d => deleteDoc(doc(db, 'notifications', d.id))),
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

export async function createNotification(userId, type, message, relatedClassId = null) {
  await addDoc(collection(db, 'notifications'), {
    userId,
    type,
    message,
    relatedClassId,
    isRead: false,
    createdAt: serverTimestamp(),
  })
}

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

export async function updatePaymentScreenshot(paymentId, url) {
  await updateDoc(doc(db, 'payments', paymentId), { screenshotUrl: url })
}

export async function getTeacherId() {
  const q = query(collection(db, 'users'), where('role', '==', 'teacher'))
  const snap = await getDocs(q)
  return snap.empty ? null : snap.docs[0].id
}

// The teacher's profile, incl. their timezone (the "studio" timezone)
export async function getTeacher() {
  const q = query(collection(db, 'users'), where('role', '==', 'teacher'))
  const snap = await getDocs(q)
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }
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

  // Anonymize: only id, time, duration, and whether it's the student's own
  const bookedSlots = allClassesSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(c => {
      const t = c.scheduledAt?.toDate?.()
      const status = c.status || 'scheduled'
      return inRange(t) && (status === 'scheduled' || status === 'pending')
    })
    .map(c => ({
      id: c.id,
      scheduledAt: c.scheduledAt,
      duration: c.duration || 60,
      mine: c.studentId === studentId,
    }))

  const blockedSlots = blockedSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(s => inRange(s.startAt?.toDate?.()))

  return { bookedSlots, blockedSlots }
}
