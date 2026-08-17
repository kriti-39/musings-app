import { useState, useRef, useEffect } from 'react'
import { RiFilter3Line, RiCloseLine } from 'react-icons/ri'

// Month / year filter for long class lists. Collapsed to a single chip so it
// costs no vertical space; months are multi-select, so a whole term can be
// picked in one go. Totals shown elsewhere on the page stay unfiltered — this
// only narrows the list underneath.

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const ALL_PERIOD = { year: 'all', months: [] }

export function filterByPeriod(items, period, getDate) {
  const year = period?.year ?? 'all'
  const months = period?.months ?? []
  if (year === 'all' && months.length === 0) return items
  return items.filter(item => {
    const d = getDate(item)
    if (!d) return false
    if (year !== 'all' && d.getFullYear() !== Number(year)) return false
    if (months.length && !months.includes(d.getMonth())) return false
    return true
  })
}

export default function PeriodFilter({ dates, value, onChange, showing, total, noun = 'classes' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    function onKey(e) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const years = [...new Set(dates.filter(Boolean).map(d => d.getFullYear()))].sort((a, b) => b - a)
  const months = value?.months ?? []
  const year = value?.year ?? 'all'
  const active = year !== 'all' || months.length > 0

  // "Aug · 2026", "3 months · 2026", "2026", or "All time"
  const label = !active
    ? 'All time'
    : [
        months.length === 0 ? '' : months.length <= 2 ? months.map(i => MON[i]).join(', ') : `${months.length} months`,
        year === 'all' ? '' : String(year),
      ].filter(Boolean).join(' · ')

  function toggleMonth(i) {
    onChange({
      ...value,
      months: months.includes(i) ? months.filter(m => m !== i) : [...months, i].sort((a, b) => a - b),
    })
  }

  const chip = 'py-1.5 rounded-lg text-xs font-medium border transition-colors'

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
          active
            ? 'bg-amber-500 text-white border-amber-500'
            : 'border-gray-200 text-gray-600 hover:border-amber-300'
        }`}
      >
        <RiFilter3Line size={14} />
        {label}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-40 w-72 max-w-[85vw] bg-white rounded-xl shadow-lg border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-500">Year</p>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
              <RiCloseLine size={16} />
            </button>
          </div>
          <div className="flex gap-1.5 flex-wrap mb-4">
            {['all', ...years].map(y => (
              <button key={y} onClick={() => onChange({ ...value, year: y === 'all' ? 'all' : y })}
                className={`px-3 ${chip} ${
                  String(year) === String(y)
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'border-gray-200 text-gray-600 hover:border-amber-300'
                }`}>
                {y === 'all' ? 'All years' : y}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-500">Months</p>
            {months.length > 0 && (
              <button onClick={() => onChange({ ...value, months: [] })}
                className="text-xs text-amber-600 hover:underline">
                All months
              </button>
            )}
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {MON.map((m, i) => (
              <button key={m} onClick={() => toggleMonth(i)}
                className={`${chip} ${
                  months.includes(i)
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'border-gray-200 text-gray-600 hover:border-amber-300'
                }`}>
                {m}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">Tap more than one to combine months.</p>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-500 tabular-nums">
              {active ? `${showing} of ${total}` : total} {noun}
            </span>
            <div className="flex gap-2">
              {active && (
                <button onClick={() => onChange(ALL_PERIOD)}
                  className="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                  Clear
                </button>
              )}
              <button onClick={() => setOpen(false)}
                className="px-3 py-1.5 text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-lg">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
