import { useState } from 'react'
import { RiCloseLine, RiUploadLine } from 'react-icons/ri'
import { createPayment, saveReceipt } from '../../firebase/db'
import { compressImage } from '../../utils/image'
import MonthPicker from './MonthPicker'

// Staff records a payment (e.g. cash received). Saved as already-confirmed.
export default function MarkPaidModal({ studentId, selectedMonth, staffId, onClose, onSuccess }) {
  const [form, setForm] = useState({
    amount: '',
    method: 'cash',
    months: [selectedMonth],
    note: '',
  })
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const METHODS = ['cash', 'bank_transfer', 'upi', 'other']

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.amount || Number(form.amount) <= 0) { setError('Enter a valid amount.'); return }
    if (form.months.length === 0) { setError('Select at least one month.'); return }
    setLoading(true)
    try {
      // Compress receipt locally and store it in Firestore (no Storage dependency).
      let dataUrl = null
      if (file) {
        try { dataUrl = await compressImage(file) } catch (e) { console.error('Compress failed:', e) }
      }
      const newPayment = await createPayment({
        studentId,
        amount: Number(form.amount),
        method: form.method,
        months: form.months,
        note: form.note,
        submittedBy: 'staff',
        status: 'confirmed',
        confirmedBy: staffId,
        hasReceipt: !!dataUrl,
      })
      if (dataUrl) await saveReceipt(newPayment.id, dataUrl)
      onSuccess()
      onClose()
    } catch (err) {
      console.error(err)
      setError('Could not save the payment. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Record Payment</h2>
          <button onClick={onClose}><RiCloseLine size={20} className="text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Covers months (select one or more)</label>
            <MonthPicker value={form.months} onChange={months => setForm(f => ({ ...f, months }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Amount (₹)</label>
              <input type="number" min="1" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="2000"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Method</label>
              <select value={form.method} onChange={e => { if (e.target.value === 'cash') setFile(null); setForm(f => ({ ...f, method: e.target.value })) }}
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
              placeholder="e.g. Cash received in person"
            />
          </div>
          {form.method !== 'cash' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Receipt (optional)</label>
              <label className="flex items-center gap-2 border border-dashed border-gray-200 rounded-lg px-3 py-3 cursor-pointer hover:border-amber-300 transition-colors">
                <RiUploadLine size={16} className="text-gray-400" />
                <span className="text-sm text-gray-500">{file ? file.name : 'Upload screenshot'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={e => setFile(e.target.files[0])} />
              </label>
            </div>
          )}
          {error && <p className="text-red-500 text-sm">{error}</p>}
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
