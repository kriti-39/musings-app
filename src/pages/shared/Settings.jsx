import { useState } from 'react'
import { updatePassword } from 'firebase/auth'
import { auth } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'
import { updateUser } from '../../firebase/db'
import AdminLayout from '../../components/admin/AdminLayout'
import TeacherLayout from '../../components/teacher/TeacherLayout'
import StudentLayout from '../../components/student/StudentLayout'
import PasswordInput from '../../components/shared/PasswordInput'
import { RiLockLine, RiUserLine, RiGlobalLine } from 'react-icons/ri'

const TIMEZONES = [
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney',
  'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Chicago',
  'America/Los_Angeles', 'America/Toronto', 'America/Vancouver', 'Pacific/Auckland',
]

export default function Settings() {
  const { user, role } = useAuth()
  const Layout = role === 'admin' ? AdminLayout : role === 'teacher' ? TeacherLayout : StudentLayout

  const [pw, setPw] = useState({ next: '', confirm: '' })
  const [pwMsg, setPwMsg] = useState({ type: '', text: '' })
  const [pwLoading, setPwLoading] = useState(false)

  const [tz, setTz] = useState(user?.timezone || 'Asia/Kolkata')
  const [tzMsg, setTzMsg] = useState('')
  const [tzLoading, setTzLoading] = useState(false)

  async function handlePasswordChange(e) {
    e.preventDefault()
    setPwMsg({ type: '', text: '' })
    if (pw.next.length < 6) { setPwMsg({ type: 'error', text: 'Password must be at least 6 characters.' }); return }
    if (pw.next !== pw.confirm) { setPwMsg({ type: 'error', text: 'Passwords do not match.' }); return }
    setPwLoading(true)
    try {
      await updatePassword(auth.currentUser, pw.next)
      setPwMsg({ type: 'success', text: 'Password updated successfully.' })
      setPw({ next: '', confirm: '' })
    } catch (err) {
      if (err.code === 'auth/requires-recent-login') {
        setPwMsg({ type: 'error', text: 'For security, please sign out and sign back in, then try again.' })
      } else {
        setPwMsg({ type: 'error', text: err.message || 'Failed to update password.' })
      }
    } finally {
      setPwLoading(false)
    }
  }

  async function handleTimezoneSave(e) {
    e.preventDefault()
    setTzMsg('')
    setTzLoading(true)
    try {
      await updateUser(user.id, { timezone: tz })
      setTzMsg('Timezone saved. It will fully apply next time you sign in.')
    } catch {
      setTzMsg('Failed to save timezone.')
    } finally {
      setTzLoading(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-xl mx-auto space-y-6">
        <h1 className="text-xl font-semibold text-gray-800">Settings</h1>

        {/* Profile info (read-only) */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <RiUserLine size={18} className="text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-800">Profile</h2>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-400">Name</span><span className="text-gray-700 font-medium">{user?.name || '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Email</span><span className="text-gray-700 font-medium">{user?.email}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Role</span><span className="text-gray-700 font-medium capitalize">{role}</span></div>
          </div>
        </div>

        {/* Timezone — students only */}
        {role === 'student' && (
          <form onSubmit={handleTimezoneSave} className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <RiGlobalLine size={18} className="text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-800">Your Timezone</h2>
            </div>
            <select value={tz} onChange={e => setTz(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 mb-3">
              {TIMEZONES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
            {tzMsg && <p className="text-xs text-green-600 mb-3">{tzMsg}</p>}
            <button type="submit" disabled={tzLoading}
              className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
              {tzLoading ? 'Saving...' : 'Save Timezone'}
            </button>
          </form>
        )}

        {/* Change password */}
        <form onSubmit={handlePasswordChange} className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <RiLockLine size={18} className="text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-800">Change Password</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">New password</label>
              <PasswordInput value={pw.next} onChange={e => setPw(p => ({ ...p, next: e.target.value }))}
                placeholder="Min. 6 characters"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Confirm new password</label>
              <PasswordInput value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            {pwMsg.text && (
              <p className={`text-xs ${pwMsg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>{pwMsg.text}</p>
            )}
            <button type="submit" disabled={pwLoading}
              className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
              {pwLoading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  )
}
