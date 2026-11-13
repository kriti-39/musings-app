// POST /api/classes/cancel — a student cancels their own class, and the credit
// comes back.
//
// WHY THIS IS ON THE SERVER. Returning a credit means writing to `credits`,
// and a student is not allowed to: the rules let them move `used` UP by one
// and nothing else, because a student who could move it down could book for
// ever on one credit. So a refund attempted from the student's own device is
// refused, however the app is written — and for a while the app was written
// that way, passed its tests (which run with the rules switched off), and in
// real use quietly fell back to flagging every cancellation for staff.
//
// Here the Admin SDK does it, after checking the things only a server can be
// trusted to check: that the class is the caller's own, that it has not
// already started, and that it has not been refunded before.
//
// WHAT COMES BACK
//   • The credit's batch is still valid  → it goes back into that batch.
//   • The batch has EXPIRED              → one replacement, valid only until
//     the moment the cancelled class was due to start. That is exactly the
//     right the student still held, and no more.
//   • The expired credit was itself a replacement → nothing. Without this a
//     student could keep one credit alive for ever: book at the far end of the
//     week, cancel after the expiry, receive a fresh credit, repeat.
//
// The studio's own cancellations are not touched by any of this. When Guruji
// calls a class off, the student still gets a full fresh credit.
import { getAdmin, notifyUsers } from '../_lib/firebaseAdmin.js'
import { checkRate, tooMany } from '../_lib/throttle.js'

const LIVE = new Set(['scheduled', 'pending'])

class Refusal extends Error {
  constructor(status, message) { super(message); this.status = status }
}

// The whole decision, with no HTTP in it, so it can be exercised directly
// against the emulator. Returns { refund: 'returned' | 'replaced' | 'lapsed' |
// 'none', lateNotice }.
export async function cancelForStudent(adminSdk, uid, classId, now = new Date()) {
  const db = adminSdk.firestore()
  const { FieldValue, Timestamp } = adminSdk.firestore
  if (typeof classId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(classId)) {
    throw new Refusal(400, 'That class could not be found.')
  }
  const classRef = db.doc(`classes/${classId}`)

  return await db.runTransaction(async tx => {
    const snap = await tx.get(classRef)
    if (!snap.exists) throw new Refusal(404, 'That class could not be found.')
    const cls = snap.data()

    // Somebody else's class is reported exactly as a missing one, so this
    // cannot be used to discover which ids exist.
    if (cls.studentId !== uid) throw new Refusal(404, 'That class could not be found.')
    if (!LIVE.has(cls.status || 'scheduled')) {
      throw new Refusal(409, 'That class is not booked any more.')
    }
    const start = cls.scheduledAt?.toDate?.()
    if (!start || start <= now) {
      // After the bell the credit has been used, whether or not anyone came.
      throw new Refusal(409, 'That class has already started, so it cannot be cancelled.')
    }

    const lateNotice = start.getTime() - now.getTime() < 24 * 3600000
    const patch = {
      status: 'cancelled',
      cancelledBy: 'student',
      cancelledAt: FieldValue.serverTimestamp(),
      lateNotice,
      updatedAt: FieldValue.serverTimestamp(),
    }

    let refund = 'none'
    if (cls.creditBatchId && !cls.creditRefundedAt) {
      const batchRef = db.doc(`credits/${cls.creditBatchId}`)
      const b = await tx.get(batchRef)
      const batch = b.exists ? b.data() : null
      const used = Number(batch?.used) || 0
      const expires = batch?.expiresAt?.toDate?.()

      if (batch && batch.studentId === uid && batch.status !== 'revoked' && used > 0 && expires && expires > now) {
        tx.update(batchRef, { used: used - 1, status: 'active', updatedAt: FieldValue.serverTimestamp() })
        refund = 'returned'
      } else if (batch && batch.studentId === uid && batch.status !== 'revoked' && batch.source !== 'refund') {
        // Expired since the class was booked. One replacement, good only until
        // the class they are giving up would have begun.
        tx.set(db.collection('credits').doc(), {
          studentId: uid,
          quantity: 1,
          used: 0,
          status: 'active',
          expiresAt: Timestamp.fromDate(start),
          validity: 'until the class you cancelled',
          source: 'refund',
          reason: 'Class cancelled after its credit had expired',
          refundedFromClassId: classId,
          grantedAt: FieldValue.serverTimestamp(),
          extensions: [],
          updatedAt: FieldValue.serverTimestamp(),
        })
        refund = 'replaced'
      } else {
        refund = 'lapsed'
      }

      if (refund !== 'lapsed') {
        patch.creditRefundedAt = FieldValue.serverTimestamp()
        patch.creditRefundType = refund === 'returned' ? 'returned' : 'reissued'
      }
    }

    tx.update(classRef, patch)
    return { refund, lateNotice, start, teacherId: cls.teacherId || null, replacementUntil: refund === 'replaced' ? start : null }
  })
}

function when(date, tz) {
  try {
    const time = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: tz })
    const day = date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: tz })
    return `${time} · ${day}`
  } catch { return '' }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })

  const authz = req.headers.authorization || ''
  const idToken = authz.startsWith('Bearer ') ? authz.slice(7) : null
  if (!idToken) return res.status(401).json({ error: 'unauthorized' })

  try {
    const admin = getAdmin()
    let decoded
    try { decoded = await admin.auth().verifyIdToken(idToken) }
    catch { return res.status(401).json({ error: 'unauthorized' }) }
    const uid = decoded.uid

    const rate = await checkRate(admin, uid, 'cancel')
    if (!rate.ok) return tooMany(res, rate)

    let result
    try {
      result = await cancelForStudent(admin, uid, req.body?.classId)
    } catch (e) {
      if (e instanceof Refusal) return res.status(e.status).json({ error: e.message })
      throw e
    }

    // Telling people comes after the cancellation and can never undo it.
    try {
      const db = admin.firestore()
      const [me, staffSnap] = await Promise.all([
        db.doc(`users/${uid}`).get(),
        db.collection('users').where('role', 'in', ['admin', 'teacher']).get(),
      ])
      const student = { id: uid, ...(me.data() || {}) }
      const staff = staffSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      const teacherTz = staff.find(s => s.role === 'teacher')?.timezone || 'Asia/Kolkata'
      const label = when(result.start, teacherTz)
      const note = result.lateNotice ? ' (last minute)' : ''

      await notifyUsers(admin, staff, {
        type: 'class_cancelled_by_student',
        title: student.name || 'A student',
        message: label ? `Cancelled their class${note} — ${label}` : `Cancelled a class${note}`,
        relatedClassId: req.body.classId,
      })

      if (result.refund === 'returned' || result.refund === 'replaced') {
        await notifyUsers(admin, [student], {
          type: 'credit_refunded',
          title: 'Credit returned',
          message: result.refund === 'returned'
            ? 'Your credit for that class has been returned.'
            : `Your credit had expired, so it has been replaced with one you can use until ${when(result.start, student.timezone || 'Asia/Kolkata')}.`,
          relatedClassId: req.body.classId,
        })
      }
    } catch (e) { console.error('Class cancelled, notifications failed:', e) }

    return res.status(200).json({ ok: true, refund: result.refund })
  } catch (e) {
    console.error('cancel failed:', e)
    return res.status(500).json({ error: 'Could not cancel the class. Please try again.' })
  }
}
