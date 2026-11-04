import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { RiCloseLine, RiTimeLine, RiErrorWarningLine } from 'react-icons/ri'
import { startsIn, DURATIONS, STEP_MIN } from '../../utils/availability'
import { fmtTime12 } from '../../utils/timezone'

// ─── The exact minute ────────────────────────────────────────────────────────
// A range says a stretch is free; this says when inside it the class begins.
//
// It deliberately offers no list of start times. Presenting 3:00, 4:00, 5:00
// would put the hour back as the only real choice, and the whole reason the
// day is shown as ranges is that any quarter hour inside one is available —
// 3:30 and 4:15 included.
//
// So it uses the browser's own time control, which on a phone opens the clock
// the student already knows. `step` holds it to quarter hours, because
// `granuleKeys` in utils/slots.js locks in fifteen-minute granules and a 4:07
// start would reserve from 4:00 and block seven minutes nobody is using.
//
// WHAT IS TYPED IS NOT TRUSTED AS A TIME. `min`/`max` on a time input are
// advisory — some browsers let a value through and merely mark it invalid — and
// the wall clock the student sees belongs to THEIR timezone, not the browser's.
// So the real instants are computed first, by startsIn(), and the typed value
// is only ever looked UP among them. Anything not in that table is refused.
// That also means no timezone arithmetic happens here, which is where this
// kind of screen usually goes wrong.
export default function TimePickerSheet({ range, tz, now, closesDay = false, onCancel, onPick }) {
  const [duration, setDuration] = useState(60)

  // Wall-clock label → the instant it means, for every start this range can
  // still take at the chosen length.
  const options = useMemo(() => {
    const map = new Map()
    for (const when of startsIn(range, duration, now)) {
      map.set(wallClock(when, tz), when)
    }
    return map
  }, [range, duration, now, tz])

  const keys = [...options.keys()]
  const [value, setValue] = useState(() => keys[0] ?? '')

  const chosen = options.get(value) || null
  const ends = chosen ? new Date(chosen.getTime() + duration * 60000) : null

  const nothingFits = keys.length === 0

  return createPortal(
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92dvh] overflow-y-auto">

        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-800">Set your start time</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {closesDay
                ? `Anywhere from ${fmtTime12(range.start, tz)}, as long as the class ends by midnight.`
                : `Anywhere from ${fmtTime12(range.start, tz)}, as long as it ends by ${fmtTime12(range.end, tz)}.`}
            </p>
          </div>
          <button onClick={onCancel} aria-label="Close"
            className="shrink-0 -mr-2 -mt-1 p-2 text-gray-400 hover:text-gray-700 transition-colors">
            <RiCloseLine size={20} />
          </button>
        </div>

        <div className="px-5 pb-5">
          <label htmlFor="start-time" className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">
            Start at
          </label>
          <input
            id="start-time"
            type="time"
            value={value}
            onChange={e => setValue(e.target.value)}
            step={STEP_MIN * 60}
            min={keys[0] || undefined}
            max={keys[keys.length - 1] || undefined}
            disabled={nothingFits}
            className="w-full h-14 px-4 rounded-xl border border-gray-200 bg-white text-xl font-semibold text-gray-800 tabular-nums disabled:bg-gray-200 disabled:text-gray-400"
          />

          <p className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mt-4 mb-2">
            How long
          </p>
          <div className="flex gap-2">
            {DURATIONS.map(d => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                aria-pressed={d === duration}
                className={`flex-1 h-11 rounded-xl text-sm font-semibold transition-colors ${
                  d === duration
                    ? 'bg-amber-500 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {d} min
              </button>
            ))}
          </div>

          {/* The answer, before they commit to it. A student who mistyped sees
              it here rather than on the confirmation screen. */}
          <div className="mt-4 rounded-xl px-4 py-3 bg-amber-50 border border-amber-100 flex items-center justify-between gap-3">
            <span className="text-xs text-amber-800 flex items-center gap-1.5">
              <RiTimeLine size={14} /> Your class
            </span>
            <span className="text-sm font-semibold text-amber-900 tabular-nums">
              {chosen ? `${fmtTime12(chosen, tz)} – ${fmtTime12(ends, tz)}` : '—'}
            </span>
          </div>

          {nothingFits && (
            <p className="mt-3 text-xs text-red-600 flex items-start gap-1.5">
              <RiErrorWarningLine size={14} className="shrink-0 mt-px" />
              A {duration}-minute class no longer fits in this stretch. Try a shorter one.
            </p>
          )}
          {!nothingFits && !chosen && (
            <p className="mt-3 text-xs text-red-600 flex items-start gap-1.5">
              <RiErrorWarningLine size={14} className="shrink-0 mt-px" />
              Classes start on the quarter hour — {keys[0]} to {keys[keys.length - 1]}.
            </p>
          )}

          <button
            onClick={() => chosen && onPick({ start: chosen, duration })}
            disabled={!chosen}
            className="w-full h-12 mt-4 rounded-xl bg-amber-500 text-white text-sm font-semibold disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// 24-hour "HH:mm" as that instant reads in the student's own timezone — the
// shape a time input uses, whatever the browser's locale.
function wallClock(date, tz) {
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz,
  })
}
