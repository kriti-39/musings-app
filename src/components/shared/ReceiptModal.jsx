import { useState, useEffect } from 'react'
import { RiCloseLine } from 'react-icons/ri'
import { getReceipt } from '../../firebase/db'

// Shows an uploaded payment receipt. `paymentId` points to the receipt doc.
// `directUrl` is a fallback for any legacy Storage-hosted receipt.
export default function ReceiptModal({ paymentId, directUrl, onClose }) {
  const [url, setUrl] = useState(directUrl || null)
  const [loading, setLoading] = useState(!directUrl)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (directUrl || !paymentId) return
    let active = true
    getReceipt(paymentId)
      .then(d => { if (active) { setUrl(d); setError(!d); setLoading(false) } })
      .catch(() => { if (active) { setError(true); setLoading(false) } })
    return () => { active = false }
  }, [paymentId, directUrl])

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">Payment Receipt</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <RiCloseLine size={20} />
          </button>
        </div>
        <div className="p-2 bg-gray-50 max-h-[75dvh] overflow-auto">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-10">Loading…</p>
          ) : error || !url ? (
            <p className="text-sm text-gray-400 text-center py-10">Receipt not available.</p>
          ) : (
            <img src={url} alt="Payment receipt" className="w-full rounded-lg" />
          )}
        </div>
      </div>
    </div>
  )
}
