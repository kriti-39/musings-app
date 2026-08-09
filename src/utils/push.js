// Best-effort push delivery: called right after an in-app notification doc is
// created. The Vercel function looks up the recipient's role (admins are
// skipped — they use the in-app bell only) and device tokens, then sends via
// FCM. Any failure here is swallowed: the bell notification is the source of
// truth, push is a bonus.

import { auth } from '../firebase/config'

export function sendPushForNotification(userId, type, message, classId = null) {
  if (!import.meta.env.PROD) return // no /api functions on the dev server
  ;(async () => {
    try {
      const user = auth.currentUser
      if (!user) return
      const idToken = await user.getIdToken()
      await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ userId, type, message, classId }),
      })
    } catch { /* push is best-effort */ }
  })()
}
