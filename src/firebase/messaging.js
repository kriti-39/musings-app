// ─── Push notification tokens (FCM) ─────────────────────────────────────────
// Each device that enables notifications gets an FCM token, stored on the
// user's profile (fcmTokens array — one entry per device). The Vercel API
// functions read those tokens to deliver pushes. Everything here is
// best-effort: push failures must never break the app.

import { getMessaging, getToken, deleteToken, isSupported } from 'firebase/messaging'
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore'
import app, { db } from './config'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY
const TOKEN_KEY = 'mwd_fcm_token' // this device's current token

// Push works here only if: VAPID key configured, browser supports the Push
// API (on iPhone that means the installed-to-home-screen app, iOS 16.4+).
export async function pushSupported() {
  if (!VAPID_KEY) return false
  if (typeof Notification === 'undefined') return false
  try { return await isSupported() } catch { return false }
}

// Is push active on THIS device?
export function pushEnabledHere() {
  return typeof Notification !== 'undefined'
    && Notification.permission === 'granted'
    && !!localStorage.getItem(TOKEN_KEY)
}

async function fetchToken() {
  const reg = await navigator.serviceWorker.ready
  const messaging = getMessaging(app)
  return await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg })
}

// Ask permission (must be called from a user tap) and register this device.
export async function enablePush(uid) {
  if (!(await pushSupported())) return { ok: false, reason: 'unsupported' }
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return { ok: false, reason: perm } // 'denied' | 'default'
  const token = await fetchToken()
  if (!token) return { ok: false, reason: 'no-token' }
  localStorage.setItem(TOKEN_KEY, token)
  await updateDoc(doc(db, 'users', uid), { fcmTokens: arrayUnion(token) })
  return { ok: true }
}

// Unregister this device (other devices keep their tokens).
export async function disablePush(uid) {
  const token = localStorage.getItem(TOKEN_KEY)
  try { await deleteToken(getMessaging(app)) } catch { /* already gone */ }
  localStorage.removeItem(TOKEN_KEY)
  if (token) {
    try { await updateDoc(doc(db, 'users', uid), { fcmTokens: arrayRemove(token) }) }
    catch (e) { console.warn('Token removal failed:', e) }
  }
}

// Called on app load: FCM tokens rotate occasionally, so if permission was
// already granted, refresh the stored token and swap the old one out.
export async function syncPushToken(uid) {
  try {
    if (!(await pushSupported())) return
    if (Notification.permission !== 'granted') return
    const prev = localStorage.getItem(TOKEN_KEY)
    if (!prev) return // user never enabled push on this device
    const token = await fetchToken()
    if (!token || token === prev) return
    localStorage.setItem(TOKEN_KEY, token)
    await updateDoc(doc(db, 'users', uid), { fcmTokens: arrayUnion(token) })
    await updateDoc(doc(db, 'users', uid), { fcmTokens: arrayRemove(prev) })
  } catch (e) {
    console.warn('Push token sync failed:', e)
  }
}
