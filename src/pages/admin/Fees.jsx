import { useState, useEffect } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import MarkPaidModal from '../../components/shared/MarkPaidModal'
import { getAllStudents, getStudentPayments, confirmPayment, rejectPayment } from '../../firebase/db'
import { useAuth } from '../../context/AuthContext'
import { RiCheckLine, RiAddLine, RiCloseLine } from 'react-icons/ri'

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
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr())
  const [loading, setLoading] = useState(true)
  const [addModal, setAddModal] = useState(null) // studentId
  const [receiptModal, setReceiptModal] = useState(null) // { paymentId, studentId }

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
          <h1 className="text-xl font-semibold text-gray-800 mb-3">Fees</h1>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {months.map(m => (
              <button
                key={m}
                onClick={() => setSelectedMonth(m)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedMonth === m ? 'bg-amber-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-amber-300'
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
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex gap-2">
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
                              onClick={() => setAddModal(s.id)}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs hover:bg-amber-100 transition-colors"
                            >
                              <RiAddLine size={13} /> Mark Paid
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
        )}
      </div>

      {addModal && (
        <MarkPaidModal
          studentId={addModal}
          selectedMonth={selectedMonth}
          staffId={user.id}
          onClose={() => setAddModal(null)}
          onSuccess={fetchAll}
        />
      )}
    </AdminLayout>
  )
}
