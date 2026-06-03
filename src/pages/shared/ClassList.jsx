import { useState, useEffect } from 'react'
import { getTeacherAllClasses, getAllStudents } from '../../firebase/db'
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

export default function ClassList({ teacherId, Layout }) {
  const [classes, setClasses] = useState([])
  const [students, setStudents] = useState({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('upcoming')
  const [detail, setDetail] = useState(null)

  async function fetchAll() {
    if (!teacherId) return
    try {
      const [allClasses, allStudents] = await Promise.all([
        getTeacherAllClasses(teacherId),
        getAllStudents(),
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

  useEffect(() => { fetchAll() }, [teacherId])

  const now = new Date()
  const filtered = classes.filter(c => {
    const date = c.scheduledAt?.toDate?.() ?? new Date()
    // treat missing/null status as 'scheduled' for legacy classes
    const status = c.status || 'scheduled'
    if (tab === 'upcoming') return (status === 'scheduled' || status === 'pending') && date >= now
    if (tab === 'completed') return status === 'completed'
    if (tab === 'cancelled') return status === 'cancelled' || status === 'rejected'
    return false
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
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Student</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Date & Time</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Duration</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((cls, i) => {
                  const date = cls.scheduledAt?.toDate?.() ?? new Date()
                  const student = students[cls.studentId]
                  return (
                    <tr key={cls.id}
                      onClick={() => setDetail(cls)}
                      className={`cursor-pointer hover:bg-amber-50 transition-colors ${i !== filtered.length - 1 ? 'border-b border-gray-50' : ''}`}>
                      <td className="px-5 py-3.5 font-medium text-gray-800">{student?.name || '—'}</td>
                      <td className="px-5 py-3.5 text-gray-600">
                        {date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        <span className="ml-2 text-xs text-gray-400">
                          {date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">{cls.duration || 60}m</td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[cls.status] || ''}`}>
                          {cls.status === 'pending' ? 'Awaiting confirmation' : cls.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detail && (
        <ClassDetailModal
          cls={detail}
          studentName={students[detail.studentId]?.name || 'Student'}
          onClose={() => setDetail(null)}
          onUpdate={fetchAll}
        />
      )}
    </Layout>
  )
}
