// GET /api/reminders?secret=... — send "class starting soon" pushes.
// Pinged every few minutes by an external cron (cron-job.org). For each
// upcoming scheduled class, the student and the teacher each get one reminder
// at their own chosen lead time (users/{uid}.notifReminderMinutes). A
// remindersSent map on the class doc guarantees one reminder per person per
// class, even though the cron fires repeatedly.
import { getAdmin, sendToTokens } from './_lib/firebaseAdmin.js'

// How far ahead each run searches. Kept deliberately tight: every run reads
// every class inside this window, ~288 times a day, so a wide window burns the
// free Firestore read quota for nothing. Must be >= the longest reminder lead
// time the Settings UI allows (also 24h).
const LOOKAHEAD_HOURS = 24

function fmtTimeIn(date, tz) {
  try {
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: tz || 'Asia/Kolkata' })
  } catch {
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  }
}

function leadLabel(minutes) {
  if (minutes >= 55) {
    const h = Math.round(minutes / 60)
    return `${h} hour${h > 1 ? 's' : ''}`
  }
  return `${minutes} minutes`
}

export default async function handler(req, res) {
  try {
    const secret = req.query?.secret || req.headers['x-reminders-secret']
    if (!process.env.REMINDERS_SECRET || secret !== process.env.REMINDERS_SECRET) {
      return res.status(401).json({ error: 'unauthorized' })
    }

    const admin = getAdmin()
    const db = admin.firestore()
    const now = new Date()
    const horizon = new Date(now.getTime() + LOOKAHEAD_HOURS * 60 * 60 * 1000)
    // Look slightly into the past too: a short lead time (e.g. "2 min before")
    // can fall entirely between two cron runs — the next run still sends a
    // "your class started" note instead of silently skipping it.
    const grace = new Date(now.getTime() - 10 * 60 * 1000)

    // Range-only query (no composite index needed); status filtered in code.
    const snap = await db.collection('classes')
      .where('scheduledAt', '>', grace)
      .where('scheduledAt', '<=', horizon)
      .get()

    const users = new Map() // uid -> user data (cached per run)
    async function getUser(uid) {
      if (!uid) return null
      if (!users.has(uid)) {
        const u = await db.doc(`users/${uid}`).get()
        users.set(uid, u.exists ? { id: uid, ref: u.ref, ...u.data() } : null)
      }
      return users.get(uid)
    }

    let sent = 0
    for (const docSnap of snap.docs) {
      const cls = docSnap.data()
      if ((cls.status || 'scheduled') !== 'scheduled') continue
      const start = cls.scheduledAt?.toDate?.()
      if (!start) continue

      for (const uid of [cls.studentId, cls.teacherId]) {
        const user = await getUser(uid)
        if (!user || user.role === 'admin') continue
        const mins = Number(user.notifReminderMinutes)
        if (!mins || mins <= 0) continue
        if (cls.remindersSent?.[uid]) continue

        const fireAt = start.getTime() - mins * 60000
        if (now.getTime() < fireAt) continue // not time yet

        const tokens = (user.fcmTokens || []).filter(Boolean)
        // Mark as sent even with no devices, so it doesn't retry forever
        await docSnap.ref.update({ [`remindersSent.${uid}`]: true })
        if (!tokens.length) continue

        const remaining = Math.round((start.getTime() - now.getTime()) / 60000)
        const at = fmtTimeIn(start, user.timezone)
        const body = remaining >= 1
          ? `${at} — starts in ${leadLabel(remaining)}`
          : `${at} — starting now`
        // The teacher's headline names the student whose class it is; the
        // student's simply says it's theirs.
        const isTeacher = user.role === 'teacher'
        let title = 'Your next class'
        if (isTeacher) {
          try {
            const s = await getUser(cls.studentId)
            if (s?.name) title = `${s.name}'s class`
          } catch { /* keep the generic headline */ }
        }
        const link = isTeacher ? '/teacher/schedule' : '/student/dashboard'
        const result = await sendToTokens(admin, tokens, { title, body, link })
        sent += result.sent
        if (result.dead.length) {
          await user.ref.update({ fcmTokens: admin.firestore.FieldValue.arrayRemove(...result.dead) })
        }
      }
    }

    return res.status(200).json({ checked: snap.size, sent })
  } catch (e) {
    console.error('reminders failed:', e)
    return res.status(500).json({ error: 'reminders failed' })
  }
}
