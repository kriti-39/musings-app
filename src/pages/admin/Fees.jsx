import { useState, useEffect } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { getAllStudents, getStudentPayments, confirmPayment, createPayment, updatePaymentScreenshot } from '../../firebase/db'
import { uploadFeeReceipt } from '../../firebase/storage'
import { useAuth } from '../../context/AuthContext'
import { RiCheckLine, RiUploadLine, RiCloseLine, RiAddLine } from 'react-icons/ri'

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
    const found = list.find(p => p.months?.includes(month))
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
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-800">Fees</h1>
          <div className="flex gap-2">
            {months.map(m => (
              <button
                key={m}
                onClick={() => setSelectedMonth(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
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
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
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
                  const monthPayment = (payments[s.id] || []).find(p => p.months?.includes(selectedMonth))
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
                            <button
                              onClick={async () => {
                                await confirmPayment(monthPayment.id, user.id, s.id)
                                fetchAll()
                              }}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs hover:bg-green-100 transition-colors"
                            >
                              <RiCheckLine size={13} /> Confirm
                            </button>
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
          onClose={() => setAddModal(null)}
          onSuccess={fetchAll}
          adminId={user.id}
        />
      )}
    </AdminLayout>
  )
}

function MarkPaidModal({ studentId, selectedMonth, onClose, onSuccess, adminId }) {
  const [form, setForm] = useState({
    amount: '',
    method: 'bank_transfer',
    months: [selectedMonth],
    note: '',
  })
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)

  const METHODS = ['bank_transfer', 'upi', 'cash', 'other']

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const paymentData = {
        studentId,
        amount: Number(form.amount),
        method: form.method,
        months: form.months,
        note: form.note,
        submittedBy: 'admin',
        status: 'confirmed',
        confirmedBy: adminId,
      }
      const newPayment = await createPayment(paymentData)
      if (file) {
        const url = await uploadFeeReceipt(file, studentId)
        await updatePaymentScreenshot(newPayment.id, url)
      }
      onSuccess()
      onClose()
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  function toggleMonth(m) {
    setForm(f => ({
      ...f,
      months: f.months.includes(m) ? f.months.filter(x => x !== m) : [...f.months, m]
    }))
  }

  const nearbyMonths = []
  for (let i = -3; i <= 3; i++) {
    const d = new Date()
    d.setMonth(d.getMonth() + i)
    nearbyMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Mark Payment</h2>
          <button onClick={onClose}><RiCloseLine size={20} className="text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Covers months</label>
            <div className="flex flex-wrap gap-2">
              {nearbyMonths.map(m => (
                <button key={m} type="button" onClick={() => toggleMonth(m)}
                  className={`px-3 py-1 rounded-lg text-xs border transition-colors ${
                    form.months.includes(m) ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-200 text-gray-600 hover:border-amber-300'
                  }`}
                >
                  {monthLabel(m)}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Amount (₹)</label>
              <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="2000"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Method</label>
              <select value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                {METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Note (optional)</label>
            <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="Cash received in person"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Receipt (optional)</label>
            <label className="flex items-center gap-2 border border-dashed border-gray-200 rounded-lg px-3 py-3 cursor-pointer hover:border-amber-300 transition-colors">
              <RiUploadLine size={16} className="text-gray-400" />
              <span className="text-sm text-gray-500">{file ? file.name : 'Upload screenshot'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={e => setFile(e.target.files[0])} />
            </label>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2.5 text-sm hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50">
              {loading ? 'Saving...' : 'Mark as Paid'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
