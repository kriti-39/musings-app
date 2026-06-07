import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import TeacherLayout from '../../components/teacher/TeacherLayout'
import { useAuth } from '../../context/AuthContext'
import {
  getUser, getStudentAllClasses, getStudentPayments, getStudentRecurringSchedules,
  cancelRecurringSchedule, confirmPayment, rejectPayment,
} from '../../firebase/db'
import {
  RiArrowLeftLine, RiRepeatLine, RiCheckLine, RiCloseLine, RiImageLine,
} from 'react-icons/ri'
import ReceiptModal from '../../components/shared/ReceiptModal'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const STATUS_STYLES = {
  scheduled:  'bg-green-50 text-green-700',
  pending:    'bg-amber-50 text-amber-700',
  completed:  'bg-gray-100 text-gray-500',
  cancelled:  'bg-red-50 text-red-500',
  rejected:   'bg-red-50 text-red-500',
}

function monthsLabel(months) {
  return (months || []).map(m => {
    const [y, mo] = m.split('-')
    return `${MONTHS[parseInt(mo) - 1]} ${y}`
  }).join(', ')
}

export default function StudentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { role, user } = useAuth()
  const isTeacher = role === 'teacher'
  const Layout = isTeacher ? TeacherLayout : AdminLayout
  const backPath = isTeacher ? '/teacher/students' : '/admin/students'

  const [student, setStudent] = useState(null)
  const [classes, setClasses] = useState([])
  const [payments, setPayments] = useState([])
  const [recurring, setRecurring] = useState([])
  const [section, setSection] = useState('upcoming') // upcoming | done | payments
  const [receiptUrl, setReceiptUrl] = useState(null)
  const [loading, setLoading] = useState(true)

  async function fetchAll() {
    const [s, c, p, r] = await Promise.all([
      getUser(id),
      getStudentAllClasses(id),
      getStudentPayments(id),
      getStudentRecurringSchedules(id),
    ])
    setStudent(s)
    setClasses(c)
    setPayments(p)
    setRecurring(r)
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [id])

  async function handleEndSeries(recurringId) {
    if (!window.confirm('End this recurring series? All future classes in it will be cancelled.')) return
    await cancelRecurringSchedule(recurringId)
    fetchAll()
  }

  async function handleConfirmPayment(paymentId) {
    await confirmPayment(paymentId, user.id, id)
    fetchAll()
  }
  async function handleDeclinePayment(paymentId) {
    await rejectPayment(paymentId, id)
    fetchAll()
  }

  const now = new Date()
  const completed = classes.filter(c => c.status === 'completed')
  const upcoming = classes
    .filter(c => c.status === 'pending' || (c.status === 'scheduled' && (c.scheduledAt?.toDate?.() ?? new Date()) >= now))
    .sort((a, b) => (a.scheduledAt?.seconds ?? 0) - (b.scheduledAt?.seconds ?? 0))
  const confirmedPayments = payments.filter(p => p.status === 'confirmed')

  if (loading) return <Layout><p className="text-gray-400 text-sm">Loading...</p></Layout>

  const cards = [
    { key: 'upcoming', label: 'Upcoming', value: upcoming.length },
    { key: 'done', label: 'Classes Done', value: completed.length },
    { key: 'payments', label: 'Payments', value: confirmedPayments.length },
  ]

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <button onClick={() => navigate(backPath)} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-5 transition-colors">
          <RiArrowLeftLine size={16} /> Back to Students
        </button>

        {/* Profile */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-5">
          <h1 className="text-xl font-semibold text-gray-800">{student?.name}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{student?.email}</p>
          <div className="flex gap-x-6 gap-y-3 mt-4 flex-wrap">
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

        {/* Clickable mini-dashboard — also acts as the section selector */}
        <div className="grid grid-cols-3 gap-4 mb-5">
          {cards.map(c => (
            <button key={c.key} onClick={() => setSection(c.key)}
              className={`bg-white rounded-xl border px-5 py-4 text-left transition-all ${
                section === c.key ? 'border-amber-400 shadow-sm' : 'border-gray-100 hover:border-amber-200'
              }`}>
              <p className="text-xs text-gray-400">{c.label}</p>
              <p className="text-2xl font-semibold text-gray-800 mt-1">{c.value}</p>
            </button>
          ))}
        </div>

        {/* Recurring series */}
        {recurring.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-5 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <RiRepeatLine size={16} className="text-amber-500" />
              <h2 className="text-sm font-semibold text-gray-800">Recurring Classes</h2>
            </div>
            <div className="space-y-2">
              {recurring.map(r => (
                <div key={r.id} className="flex items-center justify-between bg-amber-50 rounded-lg px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      Every {r.frequency === 'biweekly' ? '2 weeks' : 'week'} · {DAYS[r.dayOfWeek] ?? ''} {r.time}
                    </p>
                    <p className="text-xs text-gray-500">{r.duration || 60} min</p>
                  </div>
                  <button onClick={() => handleEndSeries(r.id)}
                    className="text-xs text-red-500 border border-red-100 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors">
                    End series
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Section content ── */}

        {/* Class lists (Upcoming or Done) */}
        {(section === 'upcoming' || section === 'done') && (
          <ClassTable classes={section === 'upcoming' ? upcoming : completed}
            emptyText={section === 'upcoming' ? 'No upcoming classes.' : 'No completed classes yet.'} />
        )}

        {/* Payments — with inline Confirm / Decline */}
        {section === 'payments' && (
          <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
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
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p, i) => {
                    const isPending = p.status !== 'confirmed' && p.status !== 'rejected'
                    return (
                      <tr key={p.id} className={i !== payments.length - 1 ? 'border-b border-gray-50' : ''}>
                        <td className="px-5 py-3.5 text-gray-700">{monthsLabel(p.months)}</td>
                        <td className="px-5 py-3.5 text-gray-700 font-medium">₹{p.amount}</td>
                        <td className="px-5 py-3.5 text-gray-500 capitalize">{p.method?.replace('_', ' ')}</td>
                        <td className="px-5 py-3.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            p.status === 'confirmed' ? 'bg-green-50 text-green-700'
                            : p.status === 'rejected' ? 'bg-red-50 text-red-500'
                            : 'bg-amber-50 text-amber-700'
                          }`}>
                            {p.status === 'confirmed' ? 'Confirmed' : p.status === 'rejected' ? 'Declined' : 'Pending'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex gap-2">
                            {p.screenshotUrl && (
                              <button onClick={() => setReceiptUrl(p.screenshotUrl)}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-xs hover:bg-gray-100 transition-colors">
                                <RiImageLine size={13} /> Receipt
                              </button>
                            )}
                            {isPending && (
                              <>
                                <button onClick={() => handleConfirmPayment(p.id)}
                                  className="flex items-center gap-1 px-2.5 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs hover:bg-green-100 transition-colors">
                                  <RiCheckLine size={13} /> Confirm
                                </button>
                                <button onClick={() => handleDeclinePayment(p.id)}
                                  className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs hover:bg-red-100 transition-colors">
                                  <RiCloseLine size={13} /> Decline
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {receiptUrl && <ReceiptModal url={receiptUrl} onClose={() => setReceiptUrl(null)} />}
    </Layout>
  )
}

function ClassTable({ classes, emptyText }) {
  if (classes.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100">
        <p className="text-sm text-gray-400 text-center py-10">{emptyText}</p>
      </div>
    )
  }
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
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
                    {c.status === 'pending' ? 'Awaiting confirmation' : c.status}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-gray-400 text-xs">{c.lessonNotes || '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
