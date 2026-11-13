import {
  collection, addDoc, doc, setDoc, getDoc, getDocs, query, where, serverTimestamp,
} from 'firebase/firestore'
import { db, auth } from './config'
import { sendPushForNotification } from '../utils/push'

// Notifications live in their own small module so that every part of the data
// layer can send one without importing the whole of db.js. (credits.js needs to
// tell a student their credits have lapsed, and db.js needs to spend a credit
// when a class is booked — one of those imports has to be the thin one.)
//
// `title` is the bold headline — the student's name for staff notifications,
// a short status for the student's own. It's shown above the message in the
// bell and becomes the push notification's title. Older notifications have no
// title and simply render as the message alone.

// ─── A student may only send so many ─────────────────────────────────────────
// A student has to be able to notify staff — booking and cancelling both do —
// and the write comes straight from their own device, so nothing sat between a
// student and an endless loop of notifications to Guruji.
//
// Security rules cannot count documents. They CAN insist on what a document is
// called. So a student's notification must be named
//
//     <sender>_<recipient>_<clock hour>_<n>      with n from 0 to 19
//
// which leaves twenty names per member of staff per hour, and a name that is
// taken cannot be written twice. Honest use takes the next free name in one
// write; a loop runs out at the twenty-first and is refused from there on.
//
// Staff are not limited this way — blocking a day off can notify a dozen
// students at once — so they keep using addDoc.
const STUDENT_CEILING = 20
const MAX_MESSAGE = 300
const MAX_TITLE = 80

const roles = new Map()       // uid → Promise<role>
const nextFree = new Map()    // "<recipient>_<hour>" → the next n worth trying
let hourShift = 0             // set when this device's clock sits in the wrong hour

async function senderIsStudent() {
  const uid = auth?.currentUser?.uid
  if (!uid) return false
  if (!roles.has(uid)) {
    roles.set(uid, getDoc(doc(db, 'users', uid))
      .then(s => s.data()?.role || null)
      .catch(() => null))
  }
  return (await roles.get(uid)) === 'student'
}

async function writeAsStudent(uid, payload) {
  const hour = Math.floor(Date.now() / 3600000)
  // The rules compare against the SERVER's hour. A device a few minutes out
  // near the top of the hour would be refused every time, so the neighbouring
  // hours are tried once and whichever works is remembered.
  for (const shift of [hourShift, ...[0, 1, -1].filter(s => s !== hourShift)]) {
    const bucket = hour + shift
    const k = `${payload.userId}_${bucket}`
    for (let n = nextFree.get(k) ?? 0; n < STUDENT_CEILING; n++) {
      try {
        await setDoc(doc(db, 'notifications', `${uid}_${payload.userId}_${bucket}_${n}`), { ...payload, seq: n })
        nextFree.set(k, n + 1)
        hourShift = shift
        return true
      } catch (e) {
        if (e?.code !== 'permission-denied') throw e
      }
    }
    nextFree.set(k, STUDENT_CEILING)
  }
  return false
}

export async function createNotification(userId, type, message, relatedClassId = null, title = null) {
  const payload = {
    userId,
    type,
    title,
    message,
    relatedClassId,
    isRead: false,
    createdAt: serverTimestamp(),
  }

  if (await senderIsStudent()) {
    const sent = await writeAsStudent(auth.currentUser.uid, {
      ...payload,
      message: String(message ?? '').slice(0, MAX_MESSAGE),
      title: title == null ? null : String(title).slice(0, MAX_TITLE),
    })
    // Past the ceiling there is nothing to push either. Not an error: the
    // action that prompted this has already happened, and a notification that
    // cannot be sent must never be the thing that fails it.
    if (!sent) {
      console.warn('Notification not sent: hourly limit reached.')
      return
    }
  } else {
    await addDoc(collection(db, 'notifications'), payload)
  }

  // Every in-app notification is also offered as a phone push (fire-and-forget;
  // the API skips admins and users with no registered devices).
  sendPushForNotification(userId, type, message, relatedClassId, title)
}

// Tell Guruji and the office, and nobody else — for the things staff need to
// know about but did not do themselves: a student buying classes, or changing
// their own contact details.
//
// The staff query is repeated here rather than imported from db.js: db.js
// imports THIS module, and the whole point of keeping notify.js thin is that
// the import only ever runs one way.
//
// `except` drops a single recipient — the staff member who performed the
// action, who does not need telling about their own click. A student's own
// actions pass no `except`, so both of them hear about it.
export async function notifyStaff(type, message, { title = null, relatedClassId = null, except = null } = {}) {
  const snap = await getDocs(query(collection(db, 'users'), where('role', 'in', ['admin', 'teacher'])))
  const ids = snap.docs.map(d => d.id).filter(id => id !== except)
  await Promise.all(ids.map(id => createNotification(id, type, message, relatedClassId, title)))
}
