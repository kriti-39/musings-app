import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { updateUser } from '../../firebase/db'
import AdminLayout from '../../components/admin/AdminLayout'
import TeacherLayout from '../../components/teacher/TeacherLayout'
import StudentLayout from '../../components/student/StudentLayout'
import { RiUserLine, RiGlobalLine } from 'react-icons/ri'

const TIMEZONES = [
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney',
  'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Chicago',
  'America/Los_Angeles', 'America/Toronto', 'America/Vancouver', 'Pacific/Auckland',
]

export default function Settings() {
  const { user, role } = useAuth()
  const Layout = role === 'admin' ? AdminLayout : role === 'teacher' ? TeacherLayout : StudentLayout

  const [tz, setTz] = useState(user?.timezone || 'Asia/Kolkata')
  const [tzMsg, setTzMsg] = useState('')
  const [tzLoading, setTzLoading] = useState(false)

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
          {role === 'student' && (
            <p className="text-xs text-gray-400 mt-4">To change your password, please contact your teacher or admin.</p>
          )}
        </div>

        {/* Timezone — students set their own; teacher sets the studio timezone */}
        {(role === 'student' || role === 'teacher') && (
          <form onSubmit={handleTimezoneSave} className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <RiGlobalLine size={18} className="text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-800">
                {role === 'teacher' ? 'Studio Timezone' : 'Your Timezone'}
              </h2>
            </div>
            <p className="text-xs text-gray-400 mb-3">
              {role === 'teacher'
                ? 'Your local timezone. Students see this as the teacher’s time when booking.'
                : 'Class times are shown in this timezone.'}
            </p>
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
      </div>
    </Layout>
  )
}
