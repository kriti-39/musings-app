import { useState, useMemo } from 'react'
import { RiCloseLine, RiDownload2Line } from 'react-icons/ri'
import { buildFeeReport, monthKey, monthLabel, periodLabel } from '../../utils/feeReport'

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Pick any months — one, a few, or a whole year — and download the fee report
// as a PDF to pass on to whoever is collecting.
export default function FeeReportModal({ students, payments, onClose }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [selected, setSelected] = useState([monthKey(now)])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Offer every year that has payment records, plus this one
  const years = useMemo(() => {
    const set = new Set([now.getFullYear()])
    Object.values(payments || {}).forEach(list =>
      (list || []).forEach(p => (p.months || []).forEach(m => set.add(Number(String(m).split('-')[0]))))
    )
    return [...set].filter(Boolean).sort((a, b) => b - a)
  }, [payments, now])

  const report = useMemo(
    () => buildFeeReport(students, payments, selected),
    [students, payments, selected],
  )

  function toggle(monthIndex) {
    const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}`
    setSelected(s => (s.includes(key) ? s.filter(m => m !== key) : [...s, key].sort()))
  }

  function selectYear() {
    const all = MON.map((_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
    setSelected(all)
  }

  function selectLast(n) {
    const out = []
    for (let i = 0; i < n; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      out.push(monthKey(d))
    }
    setSelected(out.sort())
  }

  async function handleDownload() {
    if (!selected.length) return
    setBusy(true)
    setError('')
    try {
      const { downloadFeeReport } = await import('../../utils/feePdf')
      await downloadFeeReport(report)
    } catch (e) {
      console.error('Fee report failed:', e)
      setError("Couldn't create the PDF. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  const chip = 'py-2 rounded-lg text-xs font-medium border transition-colors'
  const t = report.totals

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Download fee report</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <RiCloseLine size={20} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Quick picks */}
          <div className="flex gap-2 flex-wrap">
            {[
              { label: 'This month', run: () => selectLast(1) },
              { label: 'Last 3 months', run: () => selectLast(3) },
              { label: 'Last 6 months', run: () => selectLast(6) },
              { label: `All ${year}`, run: selectYear },
            ].map(p => (
              <button key={p.label} onClick={p.run}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:border-amber-300 transition-colors">
                {p.label}
              </button>
            ))}
          </div>

          {/* Year */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Year</p>
            <div className="flex gap-1.5 flex-wrap">
              {years.map(y => (
                <button key={y} onClick={() => setYear(y)}
                  className={`px-3 ${chip} ${
                    year === y ? 'bg-amber-500 text-white border-amber-500'
                               : 'border-gray-200 text-gray-600 hover:border-amber-300'
                  }`}>
                  {y}
                </button>
              ))}
            </div>
          </div>

          {/* Months */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-500">Months</p>
              {selected.length > 0 && (
                <button onClick={() => setSelected([])} className="text-xs text-amber-600 hover:underline">
                  Clear
                </button>
              )}
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {MON.map((m, i) => {
                const key = `${year}-${String(i + 1).padStart(2, '0')}`
                const on = selected.includes(key)
                return (
                  <button key={m} onClick={() => toggle(i)}
                    className={`${chip} ${
                      on ? 'bg-amber-500 text-white border-amber-500'
                         : 'border-gray-200 text-gray-600 hover:border-amber-300'
                    }`}>
                    {m}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {selected.length === 0
                ? 'Pick at least one month.'
                : `Selected: ${selected.map(monthLabel).join(', ')}`}
            </p>
          </div>

          {/* What the PDF will contain */}
          {selected.length > 0 && (
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <p className="text-xs font-medium text-gray-500 mb-2">{periodLabel(report.period)}</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'To collect', value: t.withDues, color: 'text-red-500' },
                  { label: 'Awaiting', value: t.awaiting, color: 'text-amber-600' },
                  { label: 'Paid', value: t.fullyPaid, color: 'text-green-600' },
                ].map(c => (
                  <div key={c.label}>
                    <p className={`text-xl font-semibold tabular-nums ${c.color}`}>{c.value}</p>
                    <p className="text-xs text-gray-400">{c.label}</p>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-3 pt-3 border-t border-gray-200">
                <span>Received</span>
                <span className="font-medium text-gray-700 tabular-nums">
                  ₹{t.received.toLocaleString('en-IN')}
                </span>
              </div>
              {t.outstanding > 0 && (
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Outstanding{t.outstandingUnknown ? ' (monthly fees only)' : ''}</span>
                  <span className="font-medium text-red-500 tabular-nums">
                    ₹{t.outstanding.toLocaleString('en-IN')}
                  </span>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2.5 text-sm hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleDownload} disabled={busy || selected.length === 0}
            className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50 transition-colors">
            <RiDownload2Line size={16} />
            {busy ? 'Preparing...' : 'Download PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}
