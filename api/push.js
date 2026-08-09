// POST /api/push — deliver one in-app notification as a phone push.
// Called (fire-and-forget) by the app right after it writes a notification
// doc. Requires a valid Firebase ID token; recipients with role 'admin' or no
// registered devices are silently skipped.
import { getAdmin, linkFor, titleFor, sendToTokens } from './_lib/firebaseAdmin.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })
  try {
    const admin = getAdmin()

    const authz = req.headers.authorization || ''
    const idToken = authz.startsWith('Bearer ') ? authz.slice(7) : null
    if (!idToken) return res.status(401).json({ error: 'unauthorized' })
    await admin.auth().verifyIdToken(idToken)

    const { userId, type, message } = req.body || {}
    if (!userId || !message) return res.status(400).json({ error: 'userId and message required' })

    const snap = await admin.firestore().doc(`users/${userId}`).get()
    if (!snap.exists) return res.status(200).json({ sent: 0 })
    const user = snap.data()

    // Admins use the in-app bell only — never push
    if (user.role === 'admin') return res.status(200).json({ sent: 0, skipped: 'admin' })

    const tokens = (user.fcmTokens || []).filter(Boolean)
    if (!tokens.length) return res.status(200).json({ sent: 0 })

    const { sent, dead } = await sendToTokens(admin, tokens, {
      title: titleFor(type),
      body: String(message),
      link: linkFor(user.role, type),
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
