import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TeacherLayout from '../../components/teacher/TeacherLayout'
import { useAuth } from '../../context/AuthContext'
import { getDashboardStats, getTeacherClassesForDay, getAllStudents, getPendingRequests, confirmClass, rejectClass } from '../../firebase/db'
import { RiCheckLine, RiCloseLine, RiCalendarLine } from 'react-icons/ri'

export default function TeacherDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [todayClasses, setTodayClasses] = useState([])
  const [pending, setPending] = useState([])
  const [students, setStudents] = useState({})

  async function fetchAll() {
    if (!user?.id) return
    const [s, t, p, allStudents] = await Promise.all([
      getDashboardStats(user.id),
      getTeacherClassesForDay(user.id, new Date()),
      getPendingRequests(user.id),
      getAllStudents(),
    ])
    setStats(s)
    setTodayClasses(t)
    setPending(p)
    const map = {}
    allStudents.forEach(st => { map[st.id] = st })
    setStudents(map)
  }

  useEffect(() => { fetchAll() }, [user])

  return (
    <TeacherLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Good to see you, {user?.name || 'Deva'}</h1>
          <p className="text-sm text-gray-400 mt-1">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Students', value: stats?.totalStudents ?? '—' },
            { label: "Today's Classes", value: stats?.todayClasses ?? '—' },
            { label: 'Pending Requests', value: stats?.pendingRequests ?? '—' },
            { label: 'This Month', value: stats?.monthClasses ?? '—' },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-xl border border-gray-100 px-5 py-4">
              <p className="text-xs text-gray-400">{c.label}</p>
              <p className="text-2xl font-semibold text-gray-800 mt-1">{c.value}</p>
            </div>
          ))}
        </div>

        {/* Pending requests */}
        {pending.length > 0 && (
          <div className="bg-white rounded-xl border border-amber-100">
            <div className="px-5 py-4 border-b border-gray-50">
              <h2 className="text-sm font-semibold text-gray-800">Booking Requests</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {pending.map(cls => {
                const date = cls.scheduledAt?.toDate?.() ?? new Date()
                const studentName = students[cls.studentId]?.name || 'Student'
                return (
                  <div key={cls.id} className="px-5 py-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{studentName}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} · {date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {cls.duration || 60}m
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={async () => { await confirmClass(cls.id, cls.studentId); fetchAll() }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs hover:bg-green-100 transition-colors"
                      >
                        <RiCheckLine size={13} /> Confirm
                      </button>
                      <button onClick={async () => { await rejectClass(cls.id, cls.studentId); fetchAll() }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs hover:bg-red-100 transition-colors"
                      >
                        <RiCloseLine size={13} /> Reject
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Today's classes */}
        <div className="bg-white rounded-xl border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">Today's Classes</h2>
            <button onClick={() => navigate('/teacher/schedule')} className="text-xs text-amber-600 hover:underline">View Schedule</button>
          </div>
          {todayClasses.length === 0 ? (
            <div className="flex items-center gap-3 px-5 py-8 text-gray-400">
              <RiCalendarLine size={20} />
              <p className="text-sm">No classes scheduled for today.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {todayClasses.map(cls => {
                const date = cls.scheduledAt?.toDate?.() ?? new Date()
                return (
                  <div key={cls.id} className="px-5 py-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{students[cls.studentId]?.name || 'Student'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {cls.duration || 60}m
                        {cls.lessonNotes && <span className="ml-2 text-gray-500">· {cls.lessonNotes}</span>}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium capitalize">{cls.status}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </TeacherLayout>
  )
}
