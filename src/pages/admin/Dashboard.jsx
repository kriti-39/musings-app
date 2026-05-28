import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import { useAuth } from '../../context/AuthContext'
import { getDashboardStats, getTeacherId } from '../../firebase/db'

export default function AdminDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    if (!user?.id) return
    getTeacherId().then(teacherId => {
      if (teacherId) getDashboardStats(teacherId).then(setStats)
    })
  }, [user])

  const cards = [
    { label: 'Total Students', value: stats?.totalStudents ?? '—', link: '/admin/students' },
    { label: "Today's Classes", value: stats?.todayClasses ?? '—', link: '/admin/schedule' },
    { label: 'Pending Requests', value: stats?.pendingRequests ?? '—', link: '/admin/schedule' },
    { label: 'Classes This Month', value: stats?.monthClasses ?? '—', link: '/admin/schedule' },
  ]

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto">
        <h1 className="text-xl font-semibold text-gray-800">
          Good to see you, {user?.name || 'Admin'}
        </h1>
        <p className="text-sm text-gray-400 mt-1">Here's what's happening today.</p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {cards.map(card => (
            <button
              key={card.label}
              onClick={() => navigate(card.link)}
              className="bg-white rounded-xl border border-gray-100 px-5 py-4 text-left hover:border-amber-200 hover:shadow-sm transition-all"
            >
              <p className="text-xs text-gray-400">{card.label}</p>
              <p className="text-2xl font-semibold text-gray-800 mt-1">{card.value}</p>
            </button>
          ))}
        </div>
      </div>
    </AdminLayout>
  )
}
