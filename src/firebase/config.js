import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)

// Secondary app — used only for creating new user accounts without signing out admin
const secondaryApp = initializeApp(firebaseConfig, 'secondary')

export const auth = getAuth(app)
export const secondaryAuth = getAuth(secondaryApp)

// Offline-first Firestore: writes commit to a local cache instantly (so the UI is
// immediate, even on a slow connection) and sync to the server in the background.
let db
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  })
} catch {
  // Fallback if persistence can't initialise (e.g. unsupported browser)
  db = getFirestore(app)
}
export { db }

export const storage = getStorage(app)
export default app
