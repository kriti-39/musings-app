import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { updateUser } from '../../firebase/db'
import { displayId } from '../../utils/auth'
import { pushSupported, pushEnabledHere, enablePush, disablePush } from '../../firebase/messaging'
import AdminLayout from '../../components/admin/AdminLayout'
import TeacherLayout from '../../components/teacher/TeacherLayout'
import StudentLayout from '../../components/student/StudentLayout'
import { RiUserLine, RiGlobalLine, RiNotification3Line } from 'react-icons/ri'

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
            <div className="flex justify-between"><span className="text-gray-400">{role === 'student' ? 'User ID' : 'Email'}</span><span className="text-gray-700 font-medium">{displayId(user)}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Role</span><span className="text-gray-700 font-medium capitalize">{role}</span></div>
          </div>
          {role === 'student' && (
            <p className="text-xs text-gray-400 mt-4">To change your password, please contact your teacher or admin.</p>
          )}
        </div>

        {/* Notifications — students + teacher (admins use the in-app bell only) */}
        {(role === 'student' || role === 'teacher') && <NotificationSettings user={user} />}

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

// ─── Notifications card ──────────────────────────────────────────────────────

const REMINDER_PRESETS = [
  { label: 'Off', value: null },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hr', value: 60 },
]

function NotificationSettings({ user }) {
  const [supported, setSupported] = useState(null) // null = checking
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  // Reminder preference (shared across devices, stored on the profile)
  const saved = user?.notifReminderMinutes ?? null
  const isPreset = REMINDER_PRESETS.some(p => p.value === saved)
  const [custom, setCustom] = useState(!isPreset && saved != null)
  const [customVal, setCustomVal] = useState(() =>
    !isPreset && saved != null ? (saved % 60 === 0 ? saved / 60 : saved) : 6)
  const [customUnit, setCustomUnit] = useState(() =>
    !isPreset && saved != null && saved % 60 !== 0 ? 'minutes' : 'hours')
  const [remMsg, setRemMsg] = useState('')

  useEffect(() => {
    pushSupported().then(s => {
      setSupported(s)
      if (s) setEnabled(pushEnabledHere())
    })
  }, [])

  async function handleToggle() {
    setBusy(true)
    setMsg('')
    try {
      if (enabled) {
        await disablePush(user.id)
        setEnabled(false)
        setMsg('Notifications turned off on this device.')
      } else {
        const res = await enablePush(user.id)
        if (res.ok) {
          setEnabled(true)
          setMsg('Notifications are on for this device.')
        } else if (res.reason === 'denied') {
          setMsg('Notifications are blocked for this app in your phone/browser settings. Allow them there, then try again.')
        } else {
          setMsg("Couldn't enable notifications. Please try again.")
        }
      }
    } catch (e) {
      console.error(e)
      setMsg("Couldn't update notifications. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  async function saveReminder(minutes) {
    setRemMsg('')
    try {
      await updateUser(user.id, { notifReminderMinutes: minutes })
      setRemMsg(minutes == null ? 'Class reminders turned off.' : 'Reminder saved.')
    } catch {
      setRemMsg('Failed to save. Please try again.')
    }
  }

  function handleCustomSave() {
    const n = Number(customVal)
    if (!n || n <= 0) { setRemMsg('Enter a valid number.'); return }
    const minutes = customUnit === 'hours' ? Math.round(n * 60) : Math.round(n)
    if (minutes > 7 * 24 * 60) { setRemMsg('That reminder is too far ahead (max 7 days).'); return }
    saveReminder(minutes)
  }

  const savedLabel = saved == null
    ? null
    : saved % 60 === 0 ? `${saved / 60} hr${saved / 60 > 1 ? 's' : ''}` : `${saved} min`

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6">
      <div className="flex items-center gap-2 mb-4">
        <RiNotification3Line size={18} className="text-gray-400" />
        <h2 className="text-sm font-semibold text-gray-800">Notifications</h2>
      </div>

      {supported === null ? (
        <p className="text-xs text-gray-400">Checking this device...</p>
      ) : !supported ? (
        <p className="text-xs text-gray-400">
          Notifications aren't available in this browser. On iPhone, open the app you added to
          your Home Screen (not Safari). On Android, use Chrome or the installed app.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-gray-700">Push notifications on this device</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Class updates{user?.role !== 'admin' ? ' and reminders' : ''}, even when the app is closed.
              </p>
            </div>
            <button onClick={handleToggle} disabled={busy}
              className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                enabled
                  ? 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                  : 'bg-amber-500 hover:bg-amber-600 text-white'
              }`}>
              {busy ? '...' : enabled ? 'Turn off' : 'Turn on'}
            </button>
          </div>
          {msg && <p className="text-xs text-gray-500 mt-2">{msg}</p>}

          {/* Class reminder timing */}
          <div className="mt-5 pt-4 border-t border-gray-50">
            <p className="text-sm text-gray-700">Class reminder</p>
            <p className="text-xs text-gray-400 mt-0.5 mb-3">
              Get notified before each class starts{savedLabel ? ` — currently ${savedLabel} before` : ' — currently off'}.
            </p>
            <div className="flex gap-2 flex-wrap">
              {REMINDER_PRESETS.map(p => (
                <button key={p.label}
                  onClick={() => { setCustom(false); saveReminder(p.value) }}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    !custom && saved === p.value
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'border-gray-200 text-gray-600 hover:border-amber-300'
                  }`}>
                  {p.label}
                </button>
              ))}
              <button onClick={() => setCustom(true)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  custom
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'border-gray-200 text-gray-600 hover:border-amber-300'
                }`}>
                Custom
              </button>
            </div>
            {custom && (
              <div className="flex items-center gap-2 mt-3">
                <input type="number" min="1" value={customVal}
                  onChange={e => setCustomVal(e.target.value)}
                  className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <select value={customUnit} onChange={e => setCustomUnit(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
                  <option value="minutes">minutes</option>
                  <option value="hours">hours</option>
                </select>
                <span className="text-xs text-gray-400">before class</span>
                <button onClick={handleCustomSave}
                  className="ml-auto bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  Save
                </button>
              </div>
            )}
            {remMsg && <p className="text-xs text-green-600 mt-2">{remMsg}</p>}
            {!enabled && saved != null && (
              <p className="text-xs text-amber-600 mt-2">
                Turn on push notifications above so reminders can reach this device.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
