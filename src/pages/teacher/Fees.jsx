import { useState, useEffect } from 'react'
import TeacherLayout from '../../components/teacher/TeacherLayout'
import { getAllStudents, getStudentPayments, getAllClassesForMonth } from '../../firebase/db'
import { paymentCoverage, fmtPaidOn } from '../../utils/payment'
import FeeReportModal from '../../components/shared/FeeReportModal'
import FeeMonthSummary from '../../components/shared/FeeMonthSummary'
import { RiFileDownloadLine, RiEyeLine, RiEyeOffLine } from 'react-icons/ri'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function monthLabel(m) {
  const [y, mo] = m.split('-')
  return `${MONTHS[parseInt(mo) - 1]} ${y}`
}

function currentMonthStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function TeacherFees() {
  const [students, setStudents] = useState([])
  const [payments, setPayments] = useState({})
  // One month or several — the totals follow the whole selection. Never empty.
  const [selectedMonths, setSelectedMonths] = useState([currentMonthStr()])
  const selectedMonth = selectedMonths[selectedMonths.length - 1] || currentMonthStr()

  function toggleMonth(m) {
    setSelectedMonths(prev => {
      if (prev.includes(m)) {
        const next = prev.filter(x => x !== m)
        return next.length ? next : prev      // never clear the last one
      }
      return [...prev, m].sort()
    })
  }
  const [filter, setFilter] = useState('all') // all | paid | pending | unpaid
  const [loading, setLoading] = useState(true)
  const [showReport, setShowReport] = useState(false)
  // Amount and method, off by default: the status is the answer this page is
  // opened for.
  const [details, setDetails] = useState(false)

  // Classes for the selected calendar month, so the summary can say how many
  // were actually taught. By calendar month and not by anyone's credit period:
  // every student runs on their own now, and the shared month is the only
  // thing that totals.
  const [monthClasses, setMonthClasses] = useState([])
  useEffect(() => {
    let live = true
    Promise.all(selectedMonths.map(mk => {
      const [y, m] = mk.split('-').map(Number)
      return getAllClassesForMonth(y, m - 1)
    }))
      .then(lists => { if (live) setMonthClasses(lists.flat()) })
      .catch(e => { console.error('Classes for the months failed to load:', e); if (live) setMonthClasses([]) })
    return () => { live = false }
  }, [selectedMonths.join(',')])   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function fetch() {
      const allStudents = await getAllStudents()
      setStudents(allStudents)
      const map = {}
      await Promise.all(allStudents.map(async s => {
        map[s.id] = await getStudentPayments(s.id)
      }))
      setPayments(map)
      setLoading(false)
    }
    fetch()
  }, [])

  function getStatus(studentId, month) {
    const list = payments[studentId] || []
    const found = list.find(p => p.months?.includes(month) && p.status !== 'rejected')
    if (!found) return 'unpaid'
    return found.status === 'confirmed' ? 'paid' : 'pending'
  }

  function getPayment(studentId, month) {
    return (payments[studentId] || []).find(p => p.months?.includes(month) && p.status !== 'rejected')
  }

  // The Action column holds one thing — Confirm/Decline on a payment waiting to
  // be vetted — and nothing creates one of those any more: every payment the app
  // writes is already confirmed, because it comes from the office or from the
  // gateway. Students stopped submitting payments for approval.
  //
  // So the column is shown only when there is actually something pending. In
  // normal use that is never, and the header stops standing over an empty strip
  // of table. It is kept rather than deleted because a row left pending from the
  // old flow would otherwise have no way to be resolved.
  const visibleStudents = students.filter(
    s => filter === 'all' || getStatus(s.id, selectedMonth) === filter,
  )

  const months = []
  for (let i = -2; i <= 2; i++) {
    const d = new Date()
    d.setMonth(d.getMonth() + i)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const paid = students.filter(s => getStatus(s.id, selectedMonth) === 'paid').length
  const pending = students.filter(s => getStatus(s.id, selectedMonth) === 'pending').length
  const unpaid = students.filter(s => getStatus(s.id, selectedMonth) === 'unpaid').length

  return (
    <TeacherLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h1 className="text-xl font-semibold text-gray-800">Fees</h1>
            <button onClick={() => setShowReport(true)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:border-amber-300 transition-colors">
              <RiFileDownloadLine size={14} /> Report
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {months.map(m => (
              <button key={m} onClick={() => toggleMonth(m)}
                aria-pressed={selectedMonths.includes(m)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedMonths.includes(m) ? 'bg-amber-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-amber-300'
                }`}
              >
                {monthLabel(m)}
              </button>
            ))}
          </div>
        </div>

        {/* What the month actually brought in */}
        {!loading && <FeeMonthSummary students={students} payments={payments} classes={monthClasses} months={selectedMonths} />}

        {/* Summary — click a card to filter the list */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { key: 'paid', label: 'Paid', value: paid, color: 'text-green-600' },
            { key: 'pending', label: 'Pending', value: pending, color: 'text-amber-600' },
            { key: 'unpaid', label: 'Unpaid', value: unpaid, color: 'text-red-500' },
          ].map(c => (
            <button key={c.key}
              onClick={() => setFilter(filter === c.key ? 'all' : c.key)}
              className={`bg-white rounded-xl border px-5 py-4 text-left transition-all ${
                filter === c.key ? 'border-amber-400 shadow-sm' : 'border-gray-100 hover:border-amber-200'
              }`}
            >
              <p className="text-xs text-gray-400">{c.label}</p>
              <p className={`text-2xl font-semibold mt-1 ${c.color}`}>{c.value}</p>
            </button>
          ))}
        </div>
        {filter !== 'all' && (
          <p className="text-xs text-gray-400 mb-3">
            Showing <span className="font-medium text-gray-600 capitalize">{filter}</span> students ·{' '}
            <button onClick={() => setFilter('all')} className="text-amber-600 hover:underline">show all</button>
          </p>
        )}

        {loading ? (
          <p className="text-gray-400 text-sm text-center py-16">Loading...</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Student</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Country</th>
                  {/* The month column carries the status, and the amount and
                      method sit under it only when asked for. The status is
                      what this page is read for; the rest is detail you go
                      looking for once, not every time you open it. */}
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">
                    <span className="inline-flex items-center gap-1.5">
                      {monthLabel(selectedMonth)}
                      <button
                        onClick={() => setDetails(d => !d)}
                        aria-pressed={details}
                        title={details ? 'Hide amount and method' : 'Show amount and method'}
                        aria-label={details ? 'Hide amount and method' : 'Show amount and method'}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {details ? <RiEyeOffLine size={14} /> : <RiEyeLine size={14} />}
                      </button>
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleStudents
                  .map((s, i, arr) => {
                  const status = getStatus(s.id, selectedMonth)
                  const payment = getPayment(s.id, selectedMonth)
                  return (
                    <tr key={s.id}
                      className={`transition-colors ${i !== arr.length - 1 ? 'border-b border-gray-50' : ''}`}
                    >
                      <td className="px-5 py-3.5 font-medium text-gray-800">{s.name}</td>
                      <td className="px-5 py-3.5 text-gray-500">{s.country || '—'}</td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          status === 'paid' ? 'bg-green-50 text-green-700' :
                          status === 'pending' ? 'bg-amber-50 text-amber-700' :
                          'bg-red-50 text-red-500'
                        }`}>
                          {status === 'paid' ? 'Paid' : status === 'pending' ? 'Pending confirmation' : 'Unpaid'}
                        </span>
                        {details && payment && (
                          <span className="block text-xs text-gray-400 mt-1 capitalize">
                            {fmtPaidOn(payment)} · ₹{payment.amount} · {payment.method?.replace('_', ' ')}
                          </span>
                        )}
                        {details && payment?.months?.length > 1 && (
                          <span className="block text-[11px] text-amber-600 mt-0.5">
                            covers {paymentCoverage(payment.months)}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showReport && (
        <FeeReportModal students={students} payments={payments} onClose={() => setShowReport(false)} />
      )}
    </TeacherLayout>
  )
}
