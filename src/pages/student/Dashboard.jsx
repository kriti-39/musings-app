import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import StudentLayout from '../../components/student/StudentLayout'
import { useAuth } from '../../context/AuthContext'
import { getStudentAllClasses, markClassDone, cancelClassByStudent, requestReschedule, getTeacher, sweepPastClasses, hasRecording } from '../../firebase/db'
import { Timestamp } from 'firebase/firestore'
import { RiCalendarLine, RiAddLine, RiVideoLine } from 'react-icons/ri'
import { LOCAL_TZ, tzCity, fmtTime, fmtLongDate } from '../../utils/timezone'
import ConfirmDialog from '../../components/shared/ConfirmDialog'

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
  const [teacherTz, setTeacherTz] = useState(null)

  async function fetchClasses() {
    try {
      setAll(sweepPastClasses(await getStudentAllClasses(user.id)))
    } catch (e) {
      console.error('Failed to fetch classes:', e)
    } finally {
      setLoading(false)
    }
  }

  // Optimistic local update so an action reflects instantly, before the refetch.
  function patchClass(id, patch) {
    setAll(prev => prev.map(c => (c.id === id ? { ...c, ...patch } : c)))
  }

  useEffect(() => {
    if (user?.id) fetchClasses()
    else if (user !== undefined) setLoading(false)
    getTeacher().then(t => { if (t) setTeacherTz(t.timezone || LOCAL_TZ) })
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
  const tz = user?.timezone || LOCAL_TZ

  return (
    <StudentLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-gray-800">My Classes</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {completedCount} completed · times in {tzCity(tz)}
            </p>
          </div>
          <button
            onClick={() => navigate('/student/book')}
            className="shrink-0 inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap shadow-sm transition-colors"
          >
            <RiAddLine size={18} className="shrink-0" /> Book a Class
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
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
            {visible.map(cls => <ClassCard key={cls.id} cls={cls} onAction={fetchClasses} onPatch={patchClass} tz={tz} teacherTz={teacherTz} />)}
          </div>
        )}
      </div>
    </StudentLayout>
  )
}

function ClassCard({ cls, onAction, onPatch, tz, teacherTz }) {
  const [loading, setLoading] = useState(false)
  const [reschedule, setReschedule] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('')
  const [confirm, setConfirm] = useState(null)
  const date = cls.scheduledAt?.toDate?.() ?? new Date()
  const showTeacher = teacherTz && teacherTz !== tz

  async function handle(fn) {
    setLoading(true)
    try { await fn(); onAction() }
    finally { setLoading(false) }
  }

  async function runConfirm() {
    if (!confirm) return
    const { action, optimistic } = confirm
    setConfirm(null)
    if (optimistic) onPatch?.(cls.id, optimistic) // reflect instantly
    await handle(action)
  }

  function askReschedule() {
    if (!newDate || !newTime) return
    const when = new Date(`${newDate}T${newTime}`).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    setConfirm({
      title: 'Send reschedule request?',
      message: `You're asking to move this class to ${when}. Your teacher will need to confirm it.`,
      confirmLabel: 'Send Request',
      variant: 'primary',
      action: () => requestReschedule(cls.id, `${newDate}T${newTime}`),
      optimistic: { status: 'pending', scheduledAt: Timestamp.fromDate(new Date(`${newDate}T${newTime}`)) },
    })
  }

  const minDate = new Date().toISOString().split('T')[0]

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-gray-800">
            {fmtLongDate(date, tz)}
          </p>
          <p className="text-sm text-gray-400 mt-0.5">
            {fmtTime(date, tz)} <span className="text-gray-300">({tzCity(tz)})</span> · {cls.duration || 60} min
          </p>
          {showTeacher && (
            <p className="text-xs text-gray-400 mt-0.5">
              Teacher's time: {fmtTime(date, teacherTz)} ({tzCity(teacherTz)})
            </p>
          )}
          {cls.lessonNotes && <p className="text-xs text-gray-500 mt-2 italic">"{cls.lessonNotes}"</p>}
          {cls.status === 'completed' && hasRecording(cls) && (
            // Goes to Recordings rather than straight to the link — the
            // passcode lives there too.
            <Link to="/student/recordings"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 hover:text-amber-700">
              <RiVideoLine size={14} /> Recording available
            </Link>
          )}
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
            <button onClick={askReschedule} disabled={loading || !newDate || !newTime}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg py-2 text-xs font-medium disabled:opacity-50">
              {loading ? 'Sending...' : 'Request Reschedule'}
            </button>
          </div>
        </div>
      ) : (cls.status === 'scheduled' || cls.status === 'pending') && (
        <div className="flex gap-2 mt-4 flex-wrap">
          {cls.status === 'scheduled' && (
            <button onClick={() => setConfirm({
              title: 'Mark this class as done?',
              message: 'This marks the class completed.',
              confirmLabel: 'Mark Done',
              variant: 'primary',
              action: () => markClassDone(cls.id, 'student'),
              optimistic: { status: 'completed' },
            })} disabled={loading}
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
          <button onClick={() => setConfirm({
            title: cls.status === 'pending' ? 'Cancel this request?' : 'Cancel this class?',
            message: cls.status === 'pending'
              ? 'Your booking request will be withdrawn.'
              : 'This cancels your class. Your teacher will be notified.',
            confirmLabel: cls.status === 'pending' ? 'Cancel Request' : 'Cancel Class',
            variant: 'danger',
            action: () => cancelClassByStudent(cls.id),
            optimistic: { status: 'cancelled' },
          })} disabled={loading}
            className="px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs hover:bg-red-100 transition-colors disabled:opacity-50">
            {cls.status === 'pending' ? 'Cancel Request' : 'Cancel'}
          </button>
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          variant={confirm.variant}
          loading={loading}
          onConfirm={runConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
