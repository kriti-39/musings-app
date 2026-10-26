import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import TeacherLayout from '../../components/teacher/TeacherLayout'
import { useAuth } from '../../context/AuthContext'
import {
  getUser, getStudentAllClasses, getStudentPayments, getStudentRecurringSchedules,
  cancelRecurringSchedule, hasRecording, hasNotes, getPhoto,
} from '../../firebase/db'
import Avatar from '../../components/shared/Avatar'
import { buildStudentStats, attendanceFrom, attendance } from '../../utils/studentStats'
import {
  RiArrowLeftLine, RiRepeatLine, RiAddLine, RiEdit2Line,
  RiTicketLine,
} from 'react-icons/ri'
import { displayId } from '../../utils/auth'
import { fmtPaidOn, coveredMonths } from '../../utils/payment'
import MarkPaidModal from '../../components/shared/MarkPaidModal'
import EditStudentModal from '../../components/shared/EditStudentModal'
import ClassDetailModal from '../../components/admin/ClassDetailModal'
import CreditsCard from '../../components/shared/CreditsCard'
import { usesCredits } from '../../utils/credits'
import AttendanceTag from '../../components/shared/AttendanceTag'
import { loadAttendanceFor, saveComputedAttendance } from '../../firebase/attendance'
import PeriodFilter, { ALL_PERIOD, filterByPeriod } from '../../components/shared/PeriodFilter'
import { fmtShortDate } from '../../utils/timezone'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
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
  const { role, user } = useAuth()
  const isTeacher = role === 'teacher'
  const Layout = isTeacher ? TeacherLayout : AdminLayout
  const backPath = isTeacher ? '/teacher/students' : '/admin/students'

  const [student, setStudent] = useState(null)
  const [classes, setClasses] = useState([])
  const [payments, setPayments] = useState([])
  const [recurring, setRecurring] = useState([])
  const [section, setSection] = useState('upcoming') // upcoming | done | payments
  const [showRecord, setShowRecord] = useState(false)
  // Bumped to ask the credits card above to open its Add dialog, so there is
  // one grant flow on this page rather than two that can drift apart.
  const [grantSignal, setGrantSignal] = useState(0)
  const [showEdit, setShowEdit] = useState(false)
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)   // class opened from the table
  const [period, setPeriod] = useState(ALL_PERIOD)
  const [photo, setPhoto] = useState(null)
  // The student's entry in the staff-only attendance document.
  const [attMeta, setAttMeta] = useState(null)

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
    // The picture lives in its own document and is only fetched here, never
    // once per row in a list. Its failure must never hold up the profile.
    if (s?.hasPhoto) getPhoto(id).then(setPhoto).catch(e => console.error('Photo failed to load:', e))
    else setPhoto(null)

    // The tag lives in the staff-only attendance document, never on the
    // student's own profile — a student can read their profile, and this is
    // written about them rather than for them.
    const att = await loadAttendanceFor(id)
    setAttMeta(att)

    // Cache what the arithmetic says, so the Students list can show and sort
    // by it without reading every class for every student. Same lazy habit as
    // the past-class and credit-expiry sweeps: whoever opens a student tidies
    // it for everyone.
    const computed = attendanceFrom(c)
    if (computed && att?.computed !== computed) {
      saveComputedAttendance(id, computed)
        .catch(e => console.error('Could not store the attendance tag:', e))
    }
  }

  useEffect(() => { fetchAll() }, [id])

  async function handleEndSeries(recurringId) {
    if (!window.confirm('End this recurring series? All future classes in it will be cancelled.')) return
    await cancelRecurringSchedule(recurringId)
    fetchAll()
  }

  const now = new Date()
  const completed = classes.filter(c => c.status === 'completed')
  const upcoming = classes
    .filter(c => c.status === 'pending' || (c.status === 'scheduled' && (c.scheduledAt?.toDate?.() ?? new Date()) >= now))
    .sort((a, b) => (a.scheduledAt?.seconds ?? 0) - (b.scheduledAt?.seconds ?? 0))
  const confirmedPayments = payments.filter(p => p.status === 'confirmed')
  const stats = buildStudentStats(classes, payments)
  const attendanceNow = attendance(attMeta, classes)

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
          <div className="flex items-start gap-4">
            {/* The ring says it at a glance; the label under it says it in
                words, and for an admin the label is how you change it. */}
            <div className="shrink-0 relative pb-2.5">
              <Avatar name={student?.name} src={photo} gender={student?.gender}
                size="lg" attendance={attendanceNow.tag} />
              {/* Always here, even before there are classes to judge. It used
                  to appear only once the arithmetic had an opinion, which meant
                  a brand-new student could not be marked at all — the one case
                  where staff know something the numbers cannot. */}
              <div className="absolute inset-x-0 -bottom-0.5 flex justify-center">
                <AttendanceTag student={student} meta={attMeta} classes={classes} onChange={fetchAll} editable pill />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              {/* Wraps rather than truncates — this is the person's own
                  profile, so their whole name belongs on it. */}
              <h1 className="text-xl font-semibold text-gray-800 leading-tight break-words">
                {student?.name}
              </h1>
              <p className="text-sm text-gray-400 mt-0.5">{displayId(student)}</p>
              {stats.drifting && (
                <p className="text-xs text-amber-600 mt-1.5">
                  No class for {stats.daysSinceLast} days — worth a word?
                </p>
              )}
            </div>
            <button onClick={() => setShowEdit(true)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors">
              <RiEdit2Line size={14} /> Edit
            </button>
          </div>

          {/* What they add up to — the figures Guruji asks for when he opens someone */}
          <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-gray-50">
            {/* Three figures side by side even on a phone, so the numbers step
                down a size on narrow screens rather than wrapping. */}
            <div className="min-w-0">
              <p className="text-xs text-gray-400 truncate">Paid</p>
              <p className="text-base sm:text-lg font-semibold text-gray-800 tabular-nums leading-tight mt-0.5 truncate">
                ₹{stats.totalPaid.toLocaleString('en-IN')}
              </p>
              <p className="text-[11px] text-gray-400 truncate">
                {stats.paymentCount} payment{stats.paymentCount === 1 ? '' : 's'}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-400 truncate">Classes done</p>
              <p className="text-base sm:text-lg font-semibold text-gray-800 tabular-nums leading-tight mt-0.5">
                {stats.done}
              </p>
              <p className="text-[11px] text-gray-400 truncate">
                {stats.missed > 0 ? `${stats.missed} missed` : stats.cancelled > 0 ? `${stats.cancelled} cancelled` : 'none missed'}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-400 truncate">How often</p>
              <p className="text-base sm:text-lg font-semibold text-gray-800 leading-tight mt-0.5 truncate">
                {stats.frequency ? `${Math.round(stats.frequency * 10) / 10}/mo` : '—'}
              </p>
              <p className="text-[11px] text-gray-400 truncate">
                {stats.lastClass ? `last ${fmtShortDate(stats.lastClass)}` : 'none yet'}
              </p>
            </div>
          </div>

          {/* Contact and fee — the details actually needed day to day */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-5 pt-5 border-t border-gray-50">
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

        {/* Credits sit directly under the profile: it's the first thing staff
            need when a student rings up about booking. */}
        <CreditsCard student={student} onChange={fetchAll} openGrantSignal={grantSignal} />

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
          {/* Guruji sees the history but takes no action on money — granting
              credits and recording payments are the office's job.

              For a student on credits "Record Payment" is the wrong verb
              anyway: money and credits now arrive together, so the admin
              grants credits and the payment is written as part of it. Only a
              student still on the earlier arrangement gets a bare payment. */}
          {!isTeacher && (
            <div className="flex justify-end mb-3">
              {usesCredits(student) ? (
                <button onClick={() => setGrantSignal(n => n + 1)}
                  className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                  <RiTicketLine size={16} /> Add credits
                </button>
              ) : (
                <button onClick={() => setShowRecord(true)}
                  className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                  <RiAddLine size={16} /> Record Payment
                </button>
              )}
            </div>
          )}
          <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
            {payments.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">No payment records yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {/* The day it was paid, the same date the student sees on
                        their own Fees page. No Month column: for almost every
                        payment the date carries it, and the exceptions say so
                        underneath. */}
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Paid on</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Credits</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Paid</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Method</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p, i) => {
                    return (
                      <tr key={p.id} className={i !== payments.length - 1 ? 'border-b border-gray-50' : ''}>
                        <td className="px-5 py-3.5 text-gray-700 whitespace-nowrap tabular-nums">
                          {fmtPaidOn(p)}
                          {coveredMonths(p) && (
                            <span className="block text-[11px] text-gray-400 font-normal">
                              for {coveredMonths(p)}
                            </span>
                          )}
                        </td>
                        {/* What the money actually bought. A dash is a payment
                            that wasn't for credits — a legacy monthly fee, or
                            an admission fee. */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          {p.forCredits ? (
                            <span className="inline-flex items-center gap-1.5 text-gray-700 font-medium">
                              <RiTicketLine size={13} className="text-amber-600 shrink-0" />
                              {p.forCredits}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-gray-700 font-medium tabular-nums whitespace-nowrap">
                          ₹{Number(p.amount || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-5 py-3.5 text-gray-500 capitalize whitespace-nowrap">
                          {p.method?.replace('_', ' ') || '—'}
                          {p.submittedBy === 'gateway' && (
                            <span className="block text-[11px] text-gray-400">online</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            p.status === 'confirmed' ? 'bg-green-50 text-green-700'
                            : p.status === 'rejected' ? 'bg-red-50 text-red-500'
                            : 'bg-amber-50 text-amber-700'
                          }`}>
                            {p.status === 'confirmed' ? 'Confirmed' : p.status === 'rejected' ? 'Declined' : 'Pending'}
                          </span>
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
          photo={photo}
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
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize whitespace-nowrap ${
                    c.missed ? 'bg-orange-50 text-orange-600' : STATUS_STYLES[c.status] || ''
                  }`}>
                    {c.missed ? 'Missed' : c.status === 'pending' ? 'Awaiting confirmation' : c.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {hasRecording(c) && <span className="text-amber-600 mr-1">▶</span>}
                  {hasNotes(c) ? 'Has notes' : (hasRecording(c) ? 'Recording added' : '—')}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
