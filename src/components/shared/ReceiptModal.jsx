import { RiCloseLine, RiExternalLinkLine } from 'react-icons/ri'

// Shows an uploaded payment receipt screenshot
export default function ReceiptModal({ url, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">Payment Receipt</h2>
          <div className="flex items-center gap-3">
            <a href={url} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-amber-600" title="Open full size">
              <RiExternalLinkLine size={16} />
            </a>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <RiCloseLine size={20} />
            </button>
          </div>
        </div>
        <div className="p-2 bg-gray-50 max-h-[75vh] overflow-auto">
          <img src={url} alt="Payment receipt" className="w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}
