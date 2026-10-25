import { useState, useEffect } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import MarkPaidModal from '../../components/shared/MarkPaidModal'
import ReceiptModal from '../../components/shared/ReceiptModal'
import { getAllStudents, getStudentPayments, confirmPayment, rejectPayment, getAllClassesForMonth } from '../../firebase/db'
import { paymentCoverage } from '../../utils/payment'
import { useAuth } from '../../context/AuthContext'
import FeeReportModal from '../../components/shared/FeeReportModal'
import FeeMonthSummary from '../../components/shared/FeeMonthSummary'
import { RiCheckLine, RiAddLine, RiCloseLine, RiImageLine, RiFileDownloadLine, RiEdit2Line } from 'react-icons/ri'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function monthLabel(m) {
  const [y, mo] = m.split('-')
  return `${MONTHS[parseInt(mo) - 1]} ${y}`
}

function currentMonthStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function AdminFees() {
  const { user } = useAuth()
  const [students, setStudents] = useState([])
  const [payments, setPayments] = useState({})
  // One month or several. Tapping toggles; the totals and the table both
  // follow the whole selection, so "Sep and Oct together" is one tap away.
  // Never empty — an empty selection would show nothing and look broken.
  const [selectedMonths, setSelectedMonths] = useState([currentMonthStr()])
  // The single month the table header and Mark Paid default to: the latest one
  // picked, which is what somebody recording a payment almost always means.
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
  const [loading, setLoading] = useState(true)
  const [addModal, setAddModal] = useState(null) // { studentId, defaultAmount } | { payment }
  const [receiptId, setReceiptId] = useState(null)
  const [showReport, setShowReport] = useState(false)

  async function fetchAll() {
    setLoading(true)
    const allStudents = await getAllStudents()
    setStudents(allStudents)
    const paymentMap = {}
    await Promise.all(allStudents.map(async s => {
      paymentMap[s.id] = await getStudentPayments(s.id)
    }))
    setPayments(paymentMap)
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  // Classes for the selected calendar month, so the summary can say how many
  // were actually taught. Deliberately by calendar month and not by anyone's
  // credit period — every student is on their own now, and the shared month is
  // the only thing that totals.
  const [monthClasses, setMonthClasses] = useState([])
  const monthsKey = selectedMonths.join(',')
  useEffect(() => {
    let live = true
    Promise.all(selectedMonths.map(mk => {
      const [y, m] = mk.split('-').map(Number)
      return getAllClassesForMonth(y, m - 1)
    }))
      .then(lists => { if (live) setMonthClasses(lists.flat()) })
      .catch(e => { console.error('Classes for the months failed to load:', e); if (live) setMonthClasses([]) })
    return () => { live = false }
  }, [monthsKey])   // eslint-disable-line react-hooks/exhaustive-deps


  function getStatusForMonth(studentId, month) {
    const list = payments[studentId] || []
    const found = list.find(p => p.months?.includes(month) && p.status !== 'rejected')
    if (!found) return 'unpaid'
    if (found.status === 'confirmed') return 'paid'
    return 'pending'
  }

  const months = []
  for (let i = -2; i <= 2; i++) {
    const d = new Date()
    d.setMonth(d.getMonth() + i)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto">
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
              <button
                key={m}
                onClick={() => toggleMonth(m)}
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

        {loading ? (
          <p className="text-gray-400 text-sm text-center py-16">Loading...</p>
        ) : (
          <>
          <FeeMonthSummary students={students} payments={payments} classes={monthClasses} months={selectedMonths} />
          <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Student</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Fee</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">{monthLabel(selectedMonth)}</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => {
                  const status = getStatusForMonth(s.id, selectedMonth)
                  const monthPayment = (payments[s.id] || []).find(p => p.months?.includes(selectedMonth) && p.status !== 'rejected')
                  return (
                    <tr key={s.id} className={`${i !== students.length - 1 ? 'border-b border-gray-50' : ''}`}>
                      <td className="px-5 py-3.5 font-medium text-gray-800">{s.name}</td>
                      <td className="px-5 py-3.5 text-gray-500">
                        {s.feeAmount ? `₹${s.feeAmount}` : '—'}
                        {s.feeType && <span className="ml-1 text-xs text-gray-400">({s.feeType === 'monthly' ? '/mo' : s.feeType === 'per_class' ? '/class' : 'flex'})</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          status === 'paid' ? 'bg-green-50 text-green-700' :
                          status === 'pending' ? 'bg-amber-50 text-amber-700' :
                          'bg-red-50 text-red-500'
                        }`}>
                          {status === 'paid' ? 'Paid' : status === 'pending' ? 'Pending confirmation' : 'Unpaid'}
                        </span>
                        {monthPayment && (
                          <span className="block text-xs text-gray-400 mt-1 capitalize">
                            ₹{monthPayment.amount} · {monthPayment.method?.replace('_', ' ')}
                          </span>
                        )}
                        {monthPayment?.months?.length > 1 && (
                          <span className="block text-[11px] text-amber-600 mt-0.5">
                            covers {paymentCoverage(monthPayment.months)}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex gap-2">
                          {(monthPayment?.hasReceipt || monthPayment?.screenshotUrl) ? (
                            <button
                              onClick={() => setReceiptId({ id: monthPayment.id, url: monthPayment.screenshotUrl })}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-xs hover:bg-gray-100 transition-colors"
                            >
                              <RiImageLine size={13} /> Receipt
                            </button>
                          ) : monthPayment && monthPayment.method !== 'cash' ? (
                            <span className="text-xs text-gray-400 self-center">No receipt</span>
                          ) : null}
                          {status === 'pending' && monthPayment && (
                            <>
                              <button
                                onClick={async () => { await confirmPayment(monthPayment.id, user.id, s.id); fetchAll() }}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs hover:bg-green-100 transition-colors"
                              >
                                <RiCheckLine size={13} /> Confirm
                              </button>
                              <button
                                onClick={async () => { await rejectPayment(monthPayment.id, s.id); fetchAll() }}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs hover:bg-red-100 transition-colors"
                              >
                                <RiCloseLine size={13} /> Decline
                              </button>
                            </>
                          )}
                          {status === 'unpaid' && (
                            <button
                              // Prefilled with what this student is meant to pay
                              onClick={() => setAddModal({ studentId: s.id, defaultAmount: s.feeAmount })}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs hover:bg-amber-100 transition-colors"
                            >
                              <RiAddLine size={13} /> Mark Paid
                            </button>
                          )}
                          {monthPayment && (
                            <button
                              onClick={() => setAddModal({ studentId: s.id, payment: monthPayment })}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-xs hover:bg-gray-100 transition-colors"
                            >
                              <RiEdit2Line size={13} /> Edit
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {addModal && (
        <MarkPaidModal
          studentId={addModal.studentId}
          payment={addModal.payment || null}
          defaultAmount={addModal.defaultAmount || null}
          selectedMonth={selectedMonth}
          staffId={user.id}
          onClose={() => setAddModal(null)}
          onSuccess={fetchAll}
        />
      )}

      {receiptId && <ReceiptModal paymentId={receiptId.id} directUrl={receiptId.url} onClose={() => setReceiptId(null)} />}

      {showReport && (
        <FeeReportModal students={students} payments={payments} onClose={() => setShowReport(false)} />
      )}
    </AdminLayout>
  )
}
