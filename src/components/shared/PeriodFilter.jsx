// Month / year filter for long class lists. The totals shown elsewhere on the
// page stay unfiltered — this only narrows the list underneath, so the
// overview stays an overview.

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export const ALL_PERIOD = { year: 'all', month: 'all' }

export function filterByPeriod(items, period, getDate) {
  if (!period || (period.year === 'all' && period.month === 'all')) return items
  return items.filter(item => {
    const d = getDate(item)
    if (!d) return false
    if (period.year !== 'all' && d.getFullYear() !== Number(period.year)) return false
    if (period.month !== 'all' && d.getMonth() !== Number(period.month)) return false
    return true
  })
}

export default function PeriodFilter({ dates, value, onChange, showing, total, noun = 'classes' }) {
  const years = [...new Set(dates.filter(Boolean).map(d => d.getFullYear()))].sort((a, b) => b - a)
  const active = value.year !== 'all' || value.month !== 'all'

  const select = 'border border-gray-200 rounded-lg px-3 py-1.5 text-xs bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-400'

  return (
    <div className="flex items-center gap-2 flex-wrap mb-3">
      <select value={value.year} onChange={e => onChange({ ...value, year: e.target.value })} className={select}>
        <option value="all">All years</option>
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>

      <select value={value.month} onChange={e => onChange({ ...value, month: e.target.value })} className={select}>
        <option value="all">All months</option>
        {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
      </select>

      {active && (
        <button onClick={() => onChange(ALL_PERIOD)}
          className="text-xs text-amber-600 hover:underline px-1">
          Clear
        </button>
      )}

      <span className="text-xs text-gray-400 ml-auto tabular-nums">
        {active ? `${showing} of ${total}` : total} {noun}
      </span>
    </div>
  )
}
