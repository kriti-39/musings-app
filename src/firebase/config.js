import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)

// ─── App Check ───────────────────────────────────────────────────────────────
// The Firebase API key sits in this bundle, because it has to — every browser
// needs it to reach Firestore. So the key is not a secret, and anybody signed
// in can talk to the database from a script instead of from this app. The
// security rules are what stand in the way, and they hold; but they are the
// ONLY thing standing there.
//
// App Check adds the missing half. The browser proves to Google that it is
// running the real app, Firebase attaches that proof to every request, and
// requests without it can be refused. That is what makes the console attacks
// — forging a slot lock by hand, hammering an endpoint in a loop — difficult
// rather than merely against the rules.
//
// Two things make this safe to ship before the Firebase console is set up:
//
//  1. Without VITE_RECAPTCHA_SITE_KEY nothing initialises at all, so beta and
//     local development carry on exactly as before.
//  2. Even once it IS set, tokens are only ATTACHED. Nothing is refused until
//     enforcement is switched on per-service in the console. That is the point
//     of turning it on in monitor mode first: the console shows how many real
//     requests are arriving verified, and enforcement is flipped only once that
//     number is effectively all of them. Enforcing first and watching second is
//     how you lock out a student on an old phone and never find out why.
const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY
if (siteKey) {
  // Imported lazily so the App Check code never enters the bundle's startup
  // path when the key is absent.
  import('firebase/app-check').then(({ initializeAppCheck, ReCaptchaV3Provider }) => {
    try {
      // A debug token lets a developer machine (and the preview browser, which
      // reCAPTCHA cannot score) pass. Registered once in the console; never set
      // in production.
      const debugToken = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN
      if (debugToken) self.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken

      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(siteKey),
        // Refresh before expiry on its own, so a long-open tab (Guruji leaves
        // the dashboard up all day) does not start failing mid-session.
        isTokenAutoRefreshEnabled: true,
      })
    } catch (e) {
      // Never fatal. A failure here must not cost somebody their lesson.
      console.error('App Check did not start; continuing without it:', e)
    }
  }).catch(e => console.error('App Check module failed to load:', e))
}

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

export default app
