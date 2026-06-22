import { useState, useEffect } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase/config'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import PasswordInput from '../components/shared/PasswordInput'
import InstallButton from '../components/shared/InstallButton'
import { idToEmail } from '../utils/auth'

export default function Login() {
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { role } = useAuth()

  useEffect(() => {
    if (role === 'student') navigate('/student/dashboard', { replace: true })
    else if (role === 'teacher') navigate('/teacher/dashboard', { replace: true })
    else if (role === 'admin') navigate('/admin/dashboard', { replace: true })
  }, [role])

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, idToEmail(loginId), password)
    } catch {
      setError('Invalid User ID or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-8">
        <img
          src="/heroLogin.jpeg"
          alt="Deva's Classes"
          className="w-full h-40 object-cover rounded-xl mb-6"
        />
        <h1 className="text-2xl font-semibold text-gray-800 mb-1 text-center">Deva's Classes</h1>
        <p className="text-sm text-gray-400 text-center mb-6">Music Classes Portal</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">User ID</label>
            <input
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="your user id"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Password</label>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* One-tap install — shows only when installable and not already installed */}
        <div className="mt-5">
          <InstallButton />
        </div>
      </div>
    </div>
  )
}
