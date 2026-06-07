import { RiAlertLine, RiCheckLine } from 'react-icons/ri'

// Reusable "Are you sure?" dialog so destructive/important actions always need
// a deliberate second tap (prevents accidental cancel/reschedule/delete).
// variant: 'danger' (red) | 'primary' (amber, default)
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}) {
  const danger = variant === 'danger'
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${danger ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-600'}`}>
            <RiAlertLine size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-800">{title}</h2>
            {message && <p className="text-sm text-gray-500 mt-1">{message}</p>}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 rounded-lg py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 ${
              danger ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600'
            }`}
          >
            {loading ? 'Working…' : (<><RiCheckLine size={16} /> {confirmLabel}</>)}
          </button>
        </div>
      </div>
    </div>
  )
}
