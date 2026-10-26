// Shared firebase-admin bootstrap for the Vercel API functions.
// FIREBASE_SERVICE_ACCOUNT (Vercel env var) holds the service-account JSON.
import admin from 'firebase-admin'

export function getAdmin() {
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT env var is not set')
    const serviceAccount = JSON.parse(raw)
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
  }
  return admin
}

// Where a tapped notification should open the app, mirroring the in-app bell
// (NotificationBell.destinationFor). Admins never get pushes, so only student
// and teacher destinations exist here.
export function linkFor(role, type, classId = null) {
  if (role === 'student') {
    if (type === 'payment_confirmed' || type === 'payment_rejected') return '/student/fees'
    if (type === 'recording_posted') return '/student/recordings'
    return '/student/dashboard'
  }
  // teacher — kept in step with NotificationBell.destinationFor, so a tapped
  // push and a tapped bell notification land in the same place.
  if (type === 'overlap_booking' || type === 'reschedule_request') return '/teacher/dashboard'
  // about one particular class → open that class on the Classes page
  if (classId) return `/teacher/classes?class=${classId}`
  if (type === 'credits_purchased') return '/teacher/fees'
  if (type === 'student_details_changed') return '/teacher/students'
  return '/teacher/dashboard'
}

// Friendlier push titles per event (default falls back to the app name).
const TITLES = {
  class_confirmed: 'Class confirmed',
  class_rejected: 'Class request update',
  class_cancelled: 'Class cancelled',
  class_restored: 'Class back on',
  class_rescheduled: 'Class rescheduled',
  class_scheduled: 'New class scheduled',
  recording_posted: 'New recording',
  payment_confirmed: 'Payment confirmed',
  payment_rejected: 'Payment update',
  new_booking: 'New booking request',
  overlap_booking: 'Booking needs confirmation',
  class_booked: 'New class booked',
  reschedule_request: 'Reschedule request',
  class_cancelled_by_student: 'Class cancelled',
  payment_submitted: 'Payment submitted',
  class_reminder: 'Upcoming class',
  credits_purchased: 'Classes bought',
  student_details_changed: 'Student details changed',
}

export function titleFor(type) {
  return TITLES[type] || "Deva's Classes"
}

// Write an in-app notification for each recipient and offer it as a phone push,
// so an event raised on the SERVER reaches people the same way one raised in
// the browser does. Before this, anything the webhook sent arrived as a bell
// notification only — no push — which is easy to miss when the point is to tell
// somebody money has come in.
//
// Mirrors api/push.js on purpose: admins take the bell and never a push, and a
// push that fails never costs the notification, which is the record that counts.
//
// Each recipient is { id, role, fcmTokens }.
export async function notifyUsers(adminSdk, recipients, { type, title = null, message, relatedClassId = null }) {
  const db = adminSdk.firestore()
  await Promise.all(recipients.filter(Boolean).map(async person => {
    await db.collection('notifications').add({
      userId: person.id,
      type,
      title,
      message,
      relatedClassId,
      isRead: false,
      createdAt: adminSdk.firestore.FieldValue.serverTimestamp(),
    })

    if (person.role === 'admin') return
    const tokens = (person.fcmTokens || []).filter(Boolean)
    if (!tokens.length) return

    try {
      const { dead } = await sendToTokens(adminSdk, tokens, {
        title: title || titleFor(type),
        body: message,
        link: linkFor(person.role, type, relatedClassId),
      })
      if (dead.length) {
        await db.doc(`users/${person.id}`)
          .update({ fcmTokens: adminSdk.firestore.FieldValue.arrayRemove(...dead) })
      }
    } catch (e) {
      console.error(`Notification stored, push failed for ${person.id}:`, e)
    }
  }))
}

// Send a data-message push to a set of device tokens; returns the tokens that
// are dead (uninstalled / expired) so the caller can prune them.
export async function sendToTokens(adminSdk, tokens, { title, body, link }) {
  if (!tokens.length) return { sent: 0, dead: [] }
  const resp = await adminSdk.messaging().sendEachForMulticast({
    tokens,
    data: { title, body: body || '', link: link || '/' },
    webpush: { headers: { Urgency: 'high', TTL: '86400' } },
  })
  const dead = []
  resp.responses.forEach((r, i) => {
    if (!r.success) {
      const code = r.error?.code || ''
      if (code.includes('registration-token-not-registered') || code.includes('invalid-argument')) {
        dead.push(tokens[i])
      }
    }
  })
  return { sent: resp.successCount, dead }
}
