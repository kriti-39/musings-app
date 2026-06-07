import { useState, useEffect } from 'react'
import StudentLayout from '../../components/student/StudentLayout'
import { useAuth } from '../../context/AuthContext'
import { getStudentPayments, createPayment, saveReceipt } from '../../firebase/db'
import { compressImage } from '../../utils/image'
import MonthPicker from '../../components/shared/MonthPicker'
import { RiAddLine, RiCloseLine, RiUploadLine } from 'react-icons/ri'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function monthLabel(m) {
  const [y, mo] = m.split('-')
  return `${MONTHS[parseInt(mo) - 1]} ${y}`
}

export default function StudentFees() {
  const { user } = useAuth()
  const [payments, setPayments] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(true)

  async function fetchPayments() {
    const data = await getStudentPayments(user.id)
    setPayments(data)
    setLoading(false)
  }

  useEffect(() => { if (user?.id) fetchPayments() }, [user])

  return (
    <StudentLayout>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-800">Fees</h1>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <RiAddLine size={18} /> Submit Payment
          </button>
        </div>

        <p className="text-xs text-gray-400 mb-5 bg-gray-50 rounded-lg px-4 py-3">
          You can upload a screenshot or note cash payments here. Your teacher/admin will confirm once verified.
        </p>

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-10">Loading...</p>
        ) : payments.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">No payment records yet.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
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
                      {(p.months || []).map(m => monthLabel(m)).join(', ')}
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
          </div>
        )}
      </div>

      {showAdd && (
        <SubmitPaymentModal
          studentId={user.id}
          onClose={() => setShowAdd(false)}
          onSuccess={fetchPayments}
        />
      )}
    </StudentLayout>
  )
}

function SubmitPaymentModal({ studentId, onClose, onSuccess }) {
  const [form, setForm] = useState({
    amount: '',
    method: 'bank_transfer',
    months: [`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`],
    note: '',
  })
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.amount) return setError('Please enter the amount.')
    if (form.months.length === 0) return setError('Select at least one month.')
    setError('')
    setLoading(true)
    try {
      const paymentData = {
        studentId,
        amount: Number(form.amount),
        method: form.method,
        months: form.months,
        note: form.note,
        submittedBy: 'student',
        status: 'pending',
      }
      // Compress the receipt locally (no Storage dependency) and store it in Firestore.
      let dataUrl = null
      if (file) {
        try { dataUrl = await compressImage(file) } catch (e) { console.error('Compress failed:', e) }
      }
      const newPayment = await createPayment({ ...paymentData, hasReceipt: !!dataUrl })
      if (dataUrl) await saveReceipt(newPayment.id, dataUrl)
      onSuccess()
      onClose()
    } catch (e) {
      console.error(e)
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const METHODS = [
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'upi', label: 'UPI' },
    { value: 'cash', label: 'Cash' },
    { value: 'other', label: 'Other' },
  ]

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Submit Payment</h2>
          <button onClick={onClose}><RiCloseLine size={20} className="text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Paying for which months? (select one or more)</label>
            <MonthPicker value={form.months} onChange={months => setForm(f => ({ ...f, months }))} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Amount (₹) *</label>
              <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="2000"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Payment Method</label>
              <select value={form.method} onChange={e => { if (e.target.value === 'cash') setFile(null); setForm(f => ({ ...f, method: e.target.value })) }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                {METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>

          {form.method === 'cash' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Note</label>
              <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="e.g. Paid to Deva sir on 5th May"
              />
            </div>
          )}

          {form.method !== 'cash' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Upload Screenshot (optional)</label>
              <label className="flex items-center gap-2 border border-dashed border-gray-200 rounded-lg px-3 py-3 cursor-pointer hover:border-amber-300 transition-colors">
                <RiUploadLine size={16} className="text-gray-400" />
                <span className="text-sm text-gray-500">{file ? file.name : 'Attach payment proof'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={e => setFile(e.target.files[0])} />
              </label>
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2.5 text-sm hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50">
              {loading ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
