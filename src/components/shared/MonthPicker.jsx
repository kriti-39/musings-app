import { useState } from 'react'
import { RiArrowLeftSLine, RiArrowRightSLine } from 'react-icons/ri'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function label(m) {
  const [y, mo] = m.split('-')
  return `${MONTHS[parseInt(mo) - 1]} ${y}`
}

// Multi-select month picker with year navigation (covers any month, past or future)
export default function MonthPicker({ value = [], onChange }) {
  const [year, setYear] = useState(new Date().getFullYear())

  function toggle(m) {
    onChange(value.includes(m) ? value.filter(x => x !== m) : [...value, m])
  }

  return (
    <div>
      {/* Year navigator */}
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={() => setYear(y => y - 1)}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
          <RiArrowLeftSLine size={16} />
        </button>
        <span className="text-sm font-semibold text-gray-800">{year}</span>
        <button type="button" onClick={() => setYear(y => y + 1)}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
          <RiArrowRightSLine size={16} />
        </button>
      </div>

      {/* 12-month grid */}
      <div className="grid grid-cols-4 gap-2">
        {MONTHS.map((mName, i) => {
          const m = `${year}-${String(i + 1).padStart(2, '0')}`
          const selected = value.includes(m)
          return (
            <button key={m} type="button" onClick={() => toggle(m)}
              className={`py-2 rounded-lg text-xs font-medium border transition-colors ${
                selected ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-200 text-gray-600 hover:border-amber-300'
              }`}>
              {mName}
            </button>
          )
        })}
      </div>

      {/* Selected summary */}
      {value.length > 0 && (
        <p className="text-xs text-gray-500 mt-3">
          Selected: <span className="font-medium text-gray-700">{value.slice().sort().map(label).join(', ')}</span>
        </p>
      )}
    </div>
  )
}
