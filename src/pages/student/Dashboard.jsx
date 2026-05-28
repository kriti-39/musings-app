import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StudentLayout from '../../components/student/StudentLayout'
import { useAuth } from '../../context/AuthContext'
import { getStudentUpcomingClasses, getStudentAllClasses, markClassDone, cancelClass } from '../../firebase/db'
import { RiCalendarLine, RiAddLine } from 'react-icons/ri'

const STATUS_STYLES = {
  scheduled: 'bg-green-50 text-green-700',
  pending:   'bg-amber-50 text-amber-700',
  completed: 'bg-gray-100 text-gray-500',
  cancelled: 'bg-red-50 text-red-500',
  rejected:  'bg-red-50 text-red-500',
}

export default function StudentDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [upcoming, setUpcoming] = useState([])
  const [past, setPast] = useState([])
  const [tab, setTab] = useState('upcoming')
  const [loading, setLoading] = useState(true)

  async function fetchClasses() {
    const [up, all] = await Promise.all([
      getStudentUpcomingClasses(user.id),
      getStudentAllClasses(user.id),
    ])
    setUpcoming(up)
    setPast(all.filter(c => c.status === 'completed' || c.status === 'cancelled'))
    setLoading(false)
  }

  useEffect(() => { if (user?.id) fetchClasses() }, [user])

  const completedCount = past.filter(c => c.status === 'completed').length

  return (
    <StudentLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">My Classes</h1>
            <p className="text-sm text-gray-400 mt-0.5">{completedCount} classes completed</p>
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
          {['upcoming', 'history'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                tab === t ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'upcoming' ? `Upcoming (${upcoming.length})` : 'History'}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-10">Loading...</p>
        ) : tab === 'upcoming' ? (
          upcoming.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
              <RiCalendarLine size={36} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-400 text-sm">No upcoming classes.</p>
              <button onClick={() => navigate('/student/book')} className="mt-3 text-amber-600 text-sm hover:underline">Book one now</button>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map(cls => <ClassCard key={cls.id} cls={cls} onAction={fetchClasses} userId={user.id} />)}
            </div>
          )
        ) : (
          past.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No past classes yet.</p>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Date</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Duration</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {past.map((c, i) => {
                    const date = c.scheduledAt?.toDate?.() ?? new Date()
                    return (
                      <tr key={c.id} className={i !== past.length - 1 ? 'border-b border-gray-50' : ''}>
                        <td className="px-5 py-3.5 text-gray-700">
                          {date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          <span className="ml-2 text-xs text-gray-400">{date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                        </td>
                        <td className="px-5 py-3.5 text-gray-500">{c.duration || 60}m</td>
                        <td className="px-5 py-3.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[c.status]}`}>{c.status}</span>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-gray-400">{c.lessonNotes || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </StudentLayout>
  )
}

function ClassCard({ cls, onAction, userId }) {
  const [loading, setLoading] = useState(false)
  const date = cls.scheduledAt?.toDate?.() ?? new Date()

  async function handle(fn) {
    setLoading(true)
    try { await fn(); onAction() }
    finally { setLoading(false) }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-gray-800">
            {date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <p className="text-sm text-gray-400 mt-0.5">
            {date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {cls.duration || 60} min
          </p>
          {cls.lessonNotes && <p className="text-xs text-gray-500 mt-2 italic">"{cls.lessonNotes}"</p>}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[cls.status]}`}>
          {cls.status === 'pending' ? 'Awaiting confirmation' : cls.status}
        </span>
      </div>

      {cls.status === 'scheduled' && (
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => handle(() => markClassDone(cls.id, 'student'))}
            disabled={loading}
            className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs hover:bg-green-100 transition-colors disabled:opacity-50"
          >
            Mark Done
          </button>
          <button
            onClick={() => handle(() => cancelClass(cls.id))}
            disabled={loading}
            className="px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
