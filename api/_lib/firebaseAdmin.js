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
export function linkFor(role, type) {
  if (role === 'student') {
    if (type === 'payment_confirmed' || type === 'payment_rejected') return '/student/fees'
    if (type === 'recording_posted') return '/student/recordings'
    return '/student/dashboard'
  }
  // teacher
  if (type === 'overlap_booking' || type === 'reschedule_request') return '/teacher/dashboard'
  if (type === 'class_booked') return '/teacher/schedule'
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
}

export function titleFor(type) {
  return TITLES[type] || "Deva's Classes"
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
