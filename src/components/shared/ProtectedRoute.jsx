import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { signOut } from 'firebase/auth'
import { auth } from '../../firebase/config'

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, role, loading } = useAuth()

  if (loading) return <div className="min-h-dvh flex items-center justify-center text-gray-500">Loading...</div>
  if (!user) return <Navigate to="/login" replace />

  // A paused account keeps its login — pausing is the studio's word for "not
  // coming at the moment", not a deletion — but it must not be able to use the
  // app. Before this, pausing only removed them from the active student list:
  // their sign-in still worked, and any credits they were holding could still
  // be spent on new bookings.
  if (user.isActive === false) return <PausedNotice />

  if (allowedRoles && !allowedRoles.includes(role)) return <Navigate to="/unauthorized" replace />

  return children
}

function PausedNotice() {
  return (
    <div className="min-h-dvh flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm max-w-sm w-full p-6 text-center">
        <h1 className="text-lg font-semibold text-gray-800">Your account is paused</h1>
        <p className="text-sm text-gray-500 mt-2">
          Classes are on hold for now. Please speak to Guruji or the office — any
          credits you had are safe and will be waiting when you come back.
        </p>
        <button
          onClick={() => signOut(auth)}
          className="mt-5 w-full bg-amber-500 hover:bg-amber-600 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
