// POST /api/push — deliver one in-app notification as a phone push.
// Called (fire-and-forget) by the app right after it writes a notification
// doc. Recipients with role 'admin' or no registered devices are skipped.
//
// ─── Who may push to whom ────────────────────────────────────────────────────
// This used to verify the ID token and then DISCARD it — the caller's identity
// was never read, so any signed-in student could post any userId, title and
// message and have it land on anybody's phone. The Firestore rules stop a
// student writing a notification document addressed to another student; this
// endpoint went around them, and a phone push is the more convincing of the
// two.
//
// So the same rule is enforced here: staff may notify anyone, a student may
// notify STAFF only — which is all the app ever asks for, since a student's
// own actions notify Guruji and the office.
import { getAdmin, linkFor, titleFor, sendToTokens } from './_lib/firebaseAdmin.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })
  try {
    const admin = getAdmin()

    const authz = req.headers.authorization || ''
    const idToken = authz.startsWith('Bearer ') ? authz.slice(7) : null
    if (!idToken) return res.status(401).json({ error: 'unauthorized' })

    let decoded
    try { decoded = await admin.auth().verifyIdToken(idToken) }
    catch { return res.status(401).json({ error: 'unauthorized' }) }

    const { userId, type, message, title, classId } = req.body || {}
    if (!userId || !message) return res.status(400).json({ error: 'userId and message required' })

    const db = admin.firestore()

    const senderSnap = await db.doc(`users/${decoded.uid}`).get()
    const senderRole = senderSnap.exists ? senderSnap.data()?.role : null
    const senderIsStaff = senderRole === 'admin' || senderRole === 'teacher'

    const snap = await db.doc(`users/${userId}`).get()
    if (!snap.exists) return res.status(200).json({ sent: 0 })
    const user = snap.data()

    // A student may only push to staff, or to themselves. Refused rather than
    // silently dropped, so a real bug shows up instead of going quiet.
    const targetIsStaff = user.role === 'admin' || user.role === 'teacher'
    if (!senderIsStaff && !targetIsStaff && userId !== decoded.uid) {
      console.warn(`push refused: ${decoded.uid} (${senderRole}) tried to notify ${userId}`)
      return res.status(403).json({ error: 'not allowed to notify that person' })
    }

    // Admins use the in-app bell only — never push
    if (user.role === 'admin') return res.status(200).json({ sent: 0, skipped: 'admin' })

    const tokens = (user.fcmTokens || []).filter(Boolean)
    if (!tokens.length) return res.status(200).json({ sent: 0 })

    const { sent, dead } = await sendToTokens(admin, tokens, {
      // The notification carries its own headline (student name, or a short
      // status); the per-type title is only a fallback for older callers.
      title: (typeof title === 'string' && title.trim()) || titleFor(type),
      body: String(message),
      link: linkFor(user.role, type, typeof classId === 'string' ? classId : null),
    })

    if (dead.length) {
      await snap.ref.update({ fcmTokens: admin.firestore.FieldValue.arrayRemove(...dead) })
    }

    return res.status(200).json({ sent })
  } catch (e) {
    console.error('push failed:', e)
    return res.status(500).json({ error: 'push failed' })
  }
}
