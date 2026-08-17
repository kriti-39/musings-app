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
  RiArrowLeftLine, RiRepeatLine, RiCheckLine, RiCloseLine, RiImageLine, RiAddLine, RiEdit2Line,
} from 'react-icons/ri'
import { displayId } from '../../utils/auth'
import ReceiptModal from '../../components/shared/ReceiptModal'
import MarkPaidModal from '../../components/shared/MarkPaidModal'
import EditStudentModal from '../../components/shared/EditStudentModal'
import ClassDetailModal from '../../components/admin/ClassDetailModal'
import PeriodFilter, { ALL_PERIOD, filterByPeriod } from '../../components/shared/PeriodFilter'
import { fmtShortDate } from '../../utils/timezone'

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
  const [receiptId, setReceiptId] = useState(null)
  const [showRecord, setShowRecord] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)   // class opened from the table
  const [period, setPeriod] = useState(ALL_PERIOD)

  const thisMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

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

  // Single-word labels so every card is one line and the numbers align
  const cards = [
    { key: 'upcoming', label: 'Upcoming', value: upcoming.length },
    { key: 'done', label: 'Completed', value: completed.length },
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
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-gray-800">{student?.name}</h1>
              <p className="text-sm text-gray-400 mt-0.5">{displayId(student)}</p>
            </div>
            <button onClick={() => setShowEdit(true)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors">
              <RiEdit2Line size={14} /> Edit
            </button>
          </div>
          {/* Contact and fee first — the details actually needed day to day */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-4">
            {[
              { label: 'Phone', value: student?.phone || '—' },
              { label: 'Fee', value: student?.feeAmount ? `₹${student.feeAmount}` : '—' },
              { label: 'Country', value: student?.country || '—' },
              { label: 'Timezone', value: student?.timezone || '—' },
            ].map(item => (
              <div key={item.label} className="min-w-0">
                <p className="text-xs text-gray-400">{item.label}</p>
                <p className="text-sm text-gray-700 font-medium truncate">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Clickable mini-dashboard — also acts as the section selector */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {cards.map(c => (
            <button key={c.key} onClick={() => { setSection(c.key); setPeriod(ALL_PERIOD) }}
              className={`bg-white rounded-xl border px-4 py-4 text-left transition-all ${
                section === c.key ? 'border-amber-400 shadow-sm' : 'border-gray-100 hover:border-amber-200'
              }`}>
              <p className="text-xs text-gray-400 truncate">{c.label}</p>
              <p className="text-2xl font-semibold text-gray-800 mt-1 tabular-nums leading-none">{c.value}</p>
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
        {(section === 'upcoming' || section === 'done') && (() => {
          const list = section === 'upcoming' ? upcoming : completed
          const shown = filterByPeriod(list, period, c => c.scheduledAt?.toDate?.())
          return (
            <>
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-sm font-semibold text-gray-800">
                  {section === 'upcoming' ? 'Upcoming classes' : 'Completed classes'}
                </h2>
                {list.length > 0 && (
                  <PeriodFilter
                    dates={list.map(c => c.scheduledAt?.toDate?.())}
                    value={period} onChange={setPeriod}
                    showing={shown.length} total={list.length}
                  />
                )}
              </div>
              <ClassTable
                classes={shown}
                onSelect={setDetail}
                emptyText={
                  list.length === 0
                    ? (section === 'upcoming' ? 'No upcoming classes.' : 'No completed classes yet.')
                    : 'No classes in this period.'
                }
              />
            </>
          )
        })()}

        {/* Payments — with inline Confirm / Decline */}
        {section === 'payments' && (
          <>
          <div className="flex justify-end mb-3">
            <button onClick={() => setShowRecord(true)}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <RiAddLine size={16} /> Record Payment
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
            {payments.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">No payment records yet.</p>
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
                            {(p.hasReceipt || p.screenshotUrl) ? (
                              <button onClick={() => setReceiptId({ id: p.id, url: p.screenshotUrl })}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-xs hover:bg-gray-100 transition-colors">
                                <RiImageLine size={13} /> Receipt
                              </button>
                            ) : p.method !== 'cash' ? (
                              <span className="text-xs text-gray-400 self-center">No receipt</span>
                            ) : null}
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
          </>
        )}
      </div>

      {receiptId && <ReceiptModal paymentId={receiptId.id} directUrl={receiptId.url} onClose={() => setReceiptId(null)} />}
      {showRecord && (
        <MarkPaidModal
          studentId={id}
          selectedMonth={thisMonth}
          staffId={user.id}
          onClose={() => setShowRecord(false)}
          onSuccess={fetchAll}
        />
      )}
      {showEdit && student && (
        <EditStudentModal
          student={student}
          onClose={() => setShowEdit(false)}
          onSuccess={fetchAll}
        />
      )}
      {detail && (
        <ClassDetailModal
          cls={detail}
          studentName={student?.name || 'Student'}
          studentTimezone={student?.timezone}
          onClose={() => setDetail(null)}
          onUpdate={fetchAll}
        />
      )}
    </Layout>
  )
}

// Rows open the same Class Details popup as the Classes page, so a recording
// link can be added straight from the student you're already looking at.
function ClassTable({ classes, emptyText, onSelect }) {
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
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Date</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Duration</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Notes</th>
          </tr>
        </thead>
        <tbody>
          {classes.map((c, i) => {
            const date = c.scheduledAt?.toDate?.() ?? new Date()
            return (
              <tr key={c.id}
                onClick={() => onSelect?.(c)}
                className={`cursor-pointer hover:bg-amber-50 transition-colors ${
                  i !== classes.length - 1 ? 'border-b border-gray-50' : ''
                }`}>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="block text-gray-700 tabular-nums">{fmtShortDate(date)}</span>
                  <span className="block text-xs text-gray-400 tabular-nums mt-0.5">
                    {date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 tabular-nums whitespace-nowrap">{c.duration || 60}m</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize whitespace-nowrap ${STATUS_STYLES[c.status] || ''}`}>
                    {c.status === 'pending' ? 'Awaiting confirmation' : c.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {c.recordingUrl && <span className="text-amber-600 mr-1">▶</span>}
                  {c.lessonNotes || (c.recordingUrl ? 'Recording added' : '—')}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
