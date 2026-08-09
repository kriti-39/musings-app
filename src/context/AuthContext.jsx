import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase/config'
import { syncPushToken } from '../firebase/messaging'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadUserDoc(firebaseUser) {
    const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
    const data = snap.data()
    setUser({ ...firebaseUser, ...data, id: firebaseUser.uid })
    setRole(data?.role ?? null)
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await loadUserDoc(firebaseUser)
        syncPushToken(firebaseUser.uid) // refresh this device's push token (no-op if push not enabled)
      } else {
        setUser(null)
        setRole(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  // Re-fetch the profile when the app regains focus, so changes like timezone
  // reflect without needing a full refresh or re-login.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible' && auth.currentUser) {
        loadUserDoc(auth.currentUser).catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  return (
    <AuthContext.Provider value={{ user, role, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
