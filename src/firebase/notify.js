import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './config'
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
export async function createNotification(userId, type, message, relatedClassId = null, title = null) {
  await addDoc(collection(db, 'notifications'), {
    userId,
    type,
    title,
    message,
    relatedClassId,
    isRead: false,
    createdAt: serverTimestamp(),
  })
  // Every in-app notification is also offered as a phone push (fire-and-forget;
  // the API skips admins and users with no registered devices).
  sendPushForNotification(userId, type, message, relatedClassId, title)
}
