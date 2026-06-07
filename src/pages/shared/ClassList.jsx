import { useState, useEffect } from 'react'
import { getTeacherAllClasses, getAllClassesDesc, getAllStudentsIncludingInactive } from '../../firebase/db'
import { RiCalendarLine } from 'react-icons/ri'
import ClassDetailModal from '../../components/admin/ClassDetailModal'

const STATUS_STYLES = {
  scheduled:  'bg-green-50 text-green-700',
  pending:    'bg-amber-50 text-amber-700',
  completed:  'bg-gray-100 text-gray-500',
  cancelled:  'bg-red-50 text-red-500',
  rejected:   'bg-red-50 text-red-500',
}

const TABS = [
  { key: 'upcoming',  label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled / Rejected' },
]

export default function ClassList({ teacherId, Layout, showAll = false }) {
  const [classes, setClasses] = useState([])
  const [students, setStudents] = useState({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('upcoming')
  const [detail, setDetail] = useState(null)

  async function fetchAll() {
    if (!showAll && !teacherId) return
    try {
      const [allClasses, allStudents] = await Promise.all([
        showAll ? getAllClassesDesc() : getTeacherAllClasses(teacherId),
        getAllStudentsIncludingInactive(),
      ])
      const map = {}
      allStudents.forEach(s => { map[s.id] = s })
      setStudents(map)
      setClasses(allClasses)
    } catch (e) {
      console.error('ClassList fetch failed:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [teacherId, showAll])

  const now = new Date()
  const filtered = classes.filter(c => {
    const date = c.scheduledAt?.toDate?.() ?? new Date()
    // treat missing/null status as 'scheduled' for legacy classes
    const status = c.status || 'scheduled'
    if (tab === 'upcoming') return status === 'pending' || (status === 'scheduled' && date >= now)
    if (tab === 'completed') return status === 'completed'
    if (tab === 'cancelled') return status === 'cancelled' || status === 'rejected'
    return false
  }).sort((a, b) => {
    const ta = a.scheduledAt?.seconds ?? 0, tb = b.scheduledAt?.seconds ?? 0
    // Upcoming: soonest first (ascending). Past tabs: most recent first (descending).
    return tab === 'upcoming' ? ta - tb : tb - ta
  })

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-xl font-semibold text-gray-800 mb-5">Classes</h1>

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                tab === t.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-16">Loading...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <RiCalendarLine size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400 text-sm">No classes in this category.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(cls => {
              const date = cls.scheduledAt?.toDate?.() ?? new Date()
              const student = students[cls.studentId]
              const status = cls.status || 'scheduled'
              return (
                <button key={cls.id}
                  onClick={() => setDetail(cls)}
                  className="w-full text-left bg-white rounded-xl border border-gray-100 p-4 hover:border-amber-200 hover:shadow-sm transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 truncate">{student?.name || '—'}</p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {cls.duration || 60} min
                      </p>
                    </div>
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[status] || ''}`}>
                      {status === 'pending' ? 'Awaiting confirmation' : status}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {detail && (
        <ClassDetailModal
          cls={detail}
          studentName={students[detail.studentId]?.name || 'Student'}
          studentTimezone={students[detail.studentId]?.timezone}
          onClose={() => setDetail(null)}
          onUpdate={fetchAll}
        />
      )}
    </Layout>
  )
}
