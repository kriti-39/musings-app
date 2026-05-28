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

// ─── CLASSES ──────────────────────────────────────────────────────────────────

export async function createClass(data) {
  return await addDoc(collection(db, 'classes'), {
    ...data,
    status: 'scheduled',
    markedDoneBy: null,
    lessonNotes: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function getClass(classId) {
  const snap = await getDoc(doc(db, 'classes', classId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function getStudentUpcomingClasses(studentId) {
  const q = query(
    collection(db, 'classes'),
    where('studentId', '==', studentId),
    where('status', '==', 'scheduled'),
    where('scheduledAt', '>=', Timestamp.now()),
    orderBy('scheduledAt', 'asc')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function getStudentAllClasses(studentId) {
  const q = query(
    collection(db, 'classes'),
    where('studentId', '==', studentId),
    orderBy('scheduledAt', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function getTeacherClassesForDay(teacherId, date) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const end = new Date(date)
  end.setHours(23, 59, 59, 999)

  const q = query(
    collection(db, 'classes'),
    where('teacherId', '==', teacherId),
    where('scheduledAt', '>=', Timestamp.fromDate(start)),
    where('scheduledAt', '<=', Timestamp.fromDate(end)),
    orderBy('scheduledAt', 'asc')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function getTeacherClassesForMonth(teacherId, year, month) {
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0, 23, 59, 59)

  const q = query(
    collection(db, 'classes'),
    where('teacherId', '==', teacherId),
    where('scheduledAt', '>=', Timestamp.fromDate(start)),
    where('scheduledAt', '<=', Timestamp.fromDate(end)),
    orderBy('scheduledAt', 'asc')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
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

  let markedDoneBy = markedBy
  if ((prev === 'student' && markedBy === 'teacher') ||
      (prev === 'teacher' && markedBy === 'student')) {
    markedDoneBy = 'both'
  }

  await updateDoc(doc(db, 'classes', classId), {
    status: 'completed',
    markedDoneBy,
    updatedAt: serverTimestamp(),
  })
}

export async function cancelClass(classId) {
  await updateDoc(doc(db, 'classes', classId), {
    status: 'cancelled',
    updatedAt: serverTimestamp(),
  })
}

export async function getPendingRequests(teacherId) {
  const q = query(
    collection(db, 'classes'),
    where('teacherId', '==', teacherId),
    where('status', '==', 'pending'),
    orderBy('scheduledAt', 'asc')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function confirmClass(classId) {
  await updateDoc(doc(db, 'classes', classId), {
    status: 'scheduled',
    updatedAt: serverTimestamp(),
  })
}

export async function rejectClass(classId) {
  await updateDoc(doc(db, 'classes', classId), {
    status: 'rejected',
    updatedAt: serverTimestamp(),
  })
}

export async function rescheduleClass(classId, newScheduledAt) {
  await updateDoc(doc(db, 'classes', classId), {
    scheduledAt: Timestamp.fromDate(new Date(newScheduledAt)),
    status: 'scheduled',
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
  const q = query(
    collection(db, 'recurringSchedules'),
    where('studentId', '==', studentId),
    where('isActive', '==', true)
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
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

  const q = query(
    collection(db, 'availability'),
    where('teacherId', '==', teacherId),
    where('startAt', '>=', Timestamp.fromDate(start)),
    where('startAt', '<=', Timestamp.fromDate(end))
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function deleteBlockedSlot(slotId) {
  await deleteDoc(doc(db, 'availability', slotId))
}

// ─── PAYMENTS ─────────────────────────────────────────────────────────────────

export async function createPayment(data) {
  return await addDoc(collection(db, 'payments'), {
    ...data,
    status: 'pending',
    submittedAt: serverTimestamp(),
  })
}

export async function getStudentPayments(studentId) {
  const q = query(
    collection(db, 'payments'),
    where('studentId', '==', studentId),
    orderBy('submittedAt', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function getAllPayments() {
  const q = query(collection(db, 'payments'), orderBy('submittedAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function confirmPayment(paymentId, confirmedByUid) {
  await updateDoc(doc(db, 'payments', paymentId), {
    status: 'confirmed',
    confirmedBy: confirmedByUid,
    confirmedAt: serverTimestamp(),
  })
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
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function markNotificationRead(notificationId) {
  await updateDoc(doc(db, 'notifications', notificationId), { isRead: true })
}

export async function updatePaymentScreenshot(paymentId, url) {
  await updateDoc(doc(db, 'payments', paymentId), { screenshotUrl: url })
}

export async function getTeacherId() {
  const q = query(collection(db, 'users'), where('role', '==', 'teacher'))
  const snap = await getDocs(q)
  return snap.empty ? null : snap.docs[0].id
}

// ─── STATS ────────────────────────────────────────────────────────────────────

export async function getDashboardStats(teacherId) {
  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const [studentsSnap, todaySnap, monthSnap, pendingSnap] = await Promise.all([
    getDocs(query(collection(db, 'users'), where('role', '==', 'student'), where('isActive', '==', true))),
    getDocs(query(collection(db, 'classes'),
      where('teacherId', '==', teacherId),
      where('scheduledAt', '>=', Timestamp.fromDate(todayStart)),
      where('scheduledAt', '<=', Timestamp.fromDate(todayEnd)),
      where('status', '==', 'scheduled')
    )),
    getDocs(query(collection(db, 'classes'),
      where('teacherId', '==', teacherId),
      where('scheduledAt', '>=', Timestamp.fromDate(monthStart)),
      where('scheduledAt', '<=', Timestamp.fromDate(monthEnd))
    )),
    getDocs(query(collection(db, 'classes'),
      where('teacherId', '==', teacherId),
      where('status', '==', 'pending')
    )),
  ])

  return {
    totalStudents: studentsSnap.size,
    todayClasses: todaySnap.size,
    monthClasses: monthSnap.size,
    pendingRequests: pendingSnap.size,
  }
}

// ─── TEACHER CALENDAR (for student booking view) ──────────────────────────────

export async function getTeacherCalendarForMonth(teacherId, year, month) {
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0, 23, 59, 59)

  const [classesSnap, blockedSnap] = await Promise.all([
    getDocs(query(
      collection(db, 'classes'),
      where('teacherId', '==', teacherId),
      where('scheduledAt', '>=', Timestamp.fromDate(start)),
      where('scheduledAt', '<=', Timestamp.fromDate(end)),
      where('status', 'in', ['scheduled', 'pending']),
    )),
    getDocs(query(
      collection(db, 'availability'),
      where('teacherId', '==', teacherId),
      where('startAt', '>=', Timestamp.fromDate(start)),
      where('startAt', '<=', Timestamp.fromDate(end)),
    )),
  ])

  return {
    bookedSlots: classesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    blockedSlots: blockedSnap.docs.map(d => ({ id: d.id, ...d.data() })),
  }
}
