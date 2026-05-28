import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import { getUser, getStudentAllClasses, getStudentPayments } from '../../firebase/db'
import { RiArrowLeftLine, RiCalendarLine, RiMoneyDollarCircleLine } from 'react-icons/ri'

const STATUS_STYLES = {
  scheduled:  'bg-green-50 text-green-700',
  pending:    'bg-amber-50 text-amber-700',
  completed:  'bg-gray-100 text-gray-500',
  cancelled:  'bg-red-50 text-red-500',
  rejected:   'bg-red-50 text-red-500',
}

export default function StudentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [student, setStudent] = useState(null)
  const [classes, setClasses] = useState([])
  const [payments, setPayments] = useState([])
  const [tab, setTab] = useState('classes')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const [s, c, p] = await Promise.all([
        getUser(id),
        getStudentAllClasses(id),
        getStudentPayments(id),
      ])
      setStudent(s)
      setClasses(c)
      setPayments(p)
      setLoading(false)
    }
    fetch()
  }, [id])

  const completedCount = classes.filter(c => c.status === 'completed').length
  const scheduledCount = classes.filter(c => c.status === 'scheduled').length
  const confirmedPayments = payments.filter(p => p.status === 'confirmed')

  if (loading) return <AdminLayout><p className="text-gray-400 text-sm">Loading...</p></AdminLayout>

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto">
        <button onClick={() => navigate('/admin/students')} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-5 transition-colors">
          <RiArrowLeftLine size={16} /> Back to Students
        </button>

        {/* Profile */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-5">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-800">{student?.name}</h1>
              <p className="text-sm text-gray-400 mt-0.5">{student?.email}</p>
              <div className="flex gap-4 mt-4">
                {[
                  { label: 'Country', value: student?.country || '—' },
                  { label: 'Timezone', value: student?.timezone || '—' },
                  { label: 'Phone', value: student?.phone || '—' },
                  { label: 'Fee', value: student?.feeAmount ? `₹${student.feeAmount}` : '—' },
                ].map(item => (
                  <div key={item.label}>
                    <p className="text-xs text-gray-400">{item.label}</p>
                    <p className="text-sm text-gray-700 font-medium">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-5">
          {[
            { label: 'Classes Done', value: completedCount, icon: RiCalendarLine },
            { label: 'Upcoming', value: scheduledCount, icon: RiCalendarLine },
            { label: 'Payments', value: confirmedPayments.length, icon: RiMoneyDollarCircleLine },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 px-5 py-4">
              <p className="text-xs text-gray-400">{s.label}</p>
              <p className="text-2xl font-semibold text-gray-800 mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
          {['classes', 'payments'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                tab === t ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Classes */}
        {tab === 'classes' && (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {classes.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">No classes yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Date & Time</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Duration</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.map((c, i) => {
                    const date = c.scheduledAt?.toDate?.() ?? new Date()
                    return (
                      <tr key={c.id} className={i !== classes.length - 1 ? 'border-b border-gray-50' : ''}>
                        <td className="px-5 py-3.5 text-gray-700">
                          {date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          <span className="text-gray-400 ml-2 text-xs">
                            {date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-gray-500">{c.duration || 60}m</td>
                        <td className="px-5 py-3.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[c.status] || ''}`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-gray-400 text-xs">{c.lessonNotes || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Payments */}
        {tab === 'payments' && (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {payments.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">No payment records.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Months</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Amount</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Method</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p, i) => (
                    <tr key={p.id} className={i !== payments.length - 1 ? 'border-b border-gray-50' : ''}>
                      <td className="px-5 py-3.5 text-gray-700">
                        {(p.months || []).map(m => {
                          const [y, mo] = m.split('-')
                          return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(mo)-1]} ${y}`
                        }).join(', ')}
                      </td>
                      <td className="px-5 py-3.5 text-gray-700 font-medium">₹{p.amount}</td>
                      <td className="px-5 py-3.5 text-gray-500 capitalize">{p.method?.replace('_', ' ')}</td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          p.status === 'confirmed' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {p.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
