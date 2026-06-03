import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StudentLayout from '../../components/student/StudentLayout'
import { useAuth } from '../../context/AuthContext'
import { getStudentAllClasses, markClassDone, cancelClass, requestReschedule } from '../../firebase/db'
import { RiCalendarLine, RiAddLine, RiCloseLine } from 'react-icons/ri'

const STATUS_STYLES = {
  scheduled: 'bg-green-50 text-green-700',
  pending:   'bg-amber-50 text-amber-700',
  completed: 'bg-gray-100 text-gray-500',
  cancelled: 'bg-red-50 text-red-500',
  rejected:  'bg-red-50 text-red-500',
}

const TABS = [
  { key: 'upcoming',  label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
]

export default function StudentDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [all, setAll] = useState([])
  const [tab, setTab] = useState('upcoming')
  const [loading, setLoading] = useState(true)

  async function fetchClasses() {
    try {
      setAll(await getStudentAllClasses(user.id))
    } catch (e) {
      console.error('Failed to fetch classes:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.id) fetchClasses()
    else if (user !== undefined) setLoading(false)
  }, [user])

  const now = new Date()
  const lists = {
    upcoming: all
      .filter(c => c.status === 'pending' || (c.status === 'scheduled' && (c.scheduledAt?.toDate?.() ?? new Date()) >= now))
      .sort((a, b) => (a.scheduledAt?.seconds ?? 0) - (b.scheduledAt?.seconds ?? 0)),
    completed: all.filter(c => c.status === 'completed'),
    cancelled: all.filter(c => c.status === 'cancelled' || c.status === 'rejected'),
  }
  const visible = lists[tab]
  const completedCount = lists.completed.length
  const tz = user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone

  return (
    <StudentLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">My Classes</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {completedCount} completed · times in {tz.replace('_', ' ')}
            </p>
          </div>
          <button
            onClick={() => navigate('/student/book')}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <RiAddLine size={18} /> Book a Class
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === t.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.key === 'upcoming' ? `Upcoming (${lists.upcoming.length})` : t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-10">Loading...</p>
        ) : visible.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
            <RiCalendarLine size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400 text-sm">
              {tab === 'upcoming' ? 'No upcoming classes.' : tab === 'completed' ? 'No completed classes yet.' : 'No cancelled classes.'}
            </p>
            {tab === 'upcoming' && (
              <button onClick={() => navigate('/student/book')} className="mt-3 text-amber-600 text-sm hover:underline">Book one now</button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map(cls => <ClassCard key={cls.id} cls={cls} onAction={fetchClasses} tz={tz} />)}
          </div>
        )}
      </div>
    </StudentLayout>
  )
}

function ClassCard({ cls, onAction, tz }) {
  const [loading, setLoading] = useState(false)
  const [reschedule, setReschedule] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('')
  const date = cls.scheduledAt?.toDate?.() ?? new Date()
  const tzOpt = tz ? { timeZone: tz } : {}

  async function handle(fn) {
    setLoading(true)
    try { await fn(); onAction() }
    finally { setLoading(false) }
  }

  async function handleReschedule() {
    if (!newDate || !newTime) return
    await handle(() => requestReschedule(cls.id, `${newDate}T${newTime}`))
  }

  const minDate = new Date().toISOString().split('T')[0]

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-gray-800">
            {date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', ...tzOpt })}
          </p>
          <p className="text-sm text-gray-400 mt-0.5">
            {date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', ...tzOpt })} · {cls.duration || 60} min
          </p>
          {cls.lessonNotes && <p className="text-xs text-gray-500 mt-2 italic">"{cls.lessonNotes}"</p>}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[cls.status]}`}>
          {cls.status === 'pending' ? 'Awaiting confirmation' : cls.status}
        </span>
      </div>

      {/* Reschedule form */}
      {reschedule ? (
        <div className="mt-4 space-y-3 border-t border-gray-50 pt-4">
          <p className="text-xs font-medium text-gray-600">Pick a new date & time</p>
          <div className="grid grid-cols-2 gap-3">
            <input type="date" value={newDate} min={minDate} onChange={e => setNewDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <p className="text-xs text-gray-400">Your teacher will need to re-confirm the new time.</p>
          <div className="flex gap-2">
            <button onClick={() => setReschedule(false)} className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-xs hover:bg-gray-50">Back</button>
            <button onClick={handleReschedule} disabled={loading || !newDate || !newTime}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg py-2 text-xs font-medium disabled:opacity-50">
              {loading ? 'Sending...' : 'Request Reschedule'}
            </button>
          </div>
        </div>
      ) : (cls.status === 'scheduled' || cls.status === 'pending') && (
        <div className="flex gap-2 mt-4 flex-wrap">
          {cls.status === 'scheduled' && (
            <button onClick={() => handle(() => markClassDone(cls.id, 'student'))} disabled={loading}
              className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs hover:bg-green-100 transition-colors disabled:opacity-50">
              Mark Done
            </button>
          )}
          {cls.status === 'scheduled' && (
            <button onClick={() => setReschedule(true)} disabled={loading}
              className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs hover:bg-amber-100 transition-colors disabled:opacity-50">
              Reschedule
            </button>
          )}
          <button onClick={() => handle(() => cancelClass(cls.id))} disabled={loading}
            className="px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs hover:bg-red-100 transition-colors disabled:opacity-50">
            {cls.status === 'pending' ? 'Cancel Request' : 'Cancel'}
          </button>
        </div>
      )}
    </div>
  )
}
