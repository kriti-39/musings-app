import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { RiCloseLine, RiCheckLine, RiErrorWarningLine } from 'react-icons/ri'
import { getTeaching, saveTeaching, WEEKDAYS, fmtMinutes } from '../../firebase/teaching'
import { DEFAULT_DAY } from '../../utils/availability'
import { LOCAL_TZ } from '../../utils/timezone'

// ─── When the studio teaches ─────────────────────────────────────────────────
// The hours set here are what makes a day AVAILABLE on the booking calendar.
// Before this existed the app knew only what was booked, so it could not say a
// time was free — it could only show a day full of other people's classes and
// leave the student to work it out.
//
// Per weekday, so Sundays off or a short Saturday needs nothing but a different
// value here. Stored in the studio's own timezone: a student in New York is
// shown the same instants on their own clock.
//
// Times are typed as plain `time` inputs and kept as minutes from midnight. A
// close of 12:00 am means the end of that day, never the start — the last class
// begins before midnight, which is what the booking screen enforces.
const CLOSE_AT_MIDNIGHT = 24 * 60

export default function TeachingHoursModal({ teacherId = null, onClose, onSaved }) {
  const [hours, setHours] = useState(null)
  const [timezone, setTimezone] = useState(LOCAL_TZ)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    getTeaching(LOCAL_TZ).then(t => {
      if (!live) return
      setHours(t.hours)
      setTimezone(t.timezone)
    })
    return () => { live = false }
  }, [])

  function setDay(n, patch) {
    setHours(h => ({ ...h, [n]: patch === null ? null : { ...(h[n] || DEFAULT_DAY), ...patch } }))
  }

  const broken = hours
    ? WEEKDAYS.filter(w => hours[w.n] && hours[w.n].close <= hours[w.n].open)
    : []

  async function save() {
    if (broken.length) { setError('A closing time must come after the opening one.'); return }
    setSaving(true)
    setError('')
    try {
      await saveTeaching({ hours, timezone, teacherId })
      onSaved?.()
      onClose()
    } catch (e) {
      console.error('Could not save the teaching hours:', e)
      setError('Could not save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90dvh] overflow-y-auto">

        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-gray-100 sticky top-0 bg-white">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Teaching hours</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Students can book any free time inside these.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close"
            className="shrink-0 -mr-2 -mt-1 p-2 text-gray-400 hover:text-gray-700 transition-colors">
            <RiCloseLine size={20} />
          </button>
        </div>

        {!hours ? (
          <p className="px-5 py-10 text-center text-sm text-gray-400">Loading…</p>
        ) : (
          <div className="px-5 py-4">
            <div className="flex flex-col gap-2.5">
              {WEEKDAYS.map(w => {
                const open = hours[w.n]
                return (
                  <div key={w.n} className="flex items-center gap-2.5">
                    <label className="flex items-center gap-2 w-28 shrink-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!open}
                        onChange={e => setDay(w.n, e.target.checked ? { ...DEFAULT_DAY } : null)}
                        className="w-4 h-4 accent-amber-500"
                      />
                      <span className={`text-sm ${open ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                        {w.label}
                      </span>
                    </label>

                    {open ? (
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <input type="time" value={toValue(open.open)}
                          onChange={e => setDay(w.n, { open: toMinutes(e.target.value) })}
                          aria-label={`${w.label} opens`}
                          className="flex-1 min-w-0 h-9 px-2 rounded-lg border border-gray-200 text-[13px] text-gray-800 tabular-nums" />
                        <span className="text-xs text-gray-400">to</span>
                        <input type="time" value={toValue(open.close)}
                          onChange={e => setDay(w.n, { close: toMinutes(e.target.value) })}
                          aria-label={`${w.label} closes`}
                          className="flex-1 min-w-0 h-9 px-2 rounded-lg border border-gray-200 text-[13px] text-gray-800 tabular-nums" />
                      </div>
                    ) : (
                      <span className="flex-1 text-xs text-gray-400">No classes</span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* 00:00 typed as a closing time means the end of the day, not the
                start of it — otherwise a day that runs to midnight would read
                as eighteen hours of nothing. */}
            <button
              onClick={() => setHours(h => {
                const next = { ...h }
                for (const w of WEEKDAYS) if (next[w.n]) next[w.n] = { ...next[w.n], close: CLOSE_AT_MIDNIGHT }
                return next
              })}
              className="mt-3 text-[11px] font-semibold text-amber-600 hover:text-amber-700"
            >
              Set every open day to finish at midnight
            </button>

            {broken.length > 0 && (
              <p className="mt-3 text-xs text-red-600 flex items-start gap-1.5">
                <RiErrorWarningLine size={14} className="shrink-0 mt-px" />
                {broken.map(w => w.label).join(', ')}: the closing time must come after the opening one.
              </p>
            )}

            <p className="mt-4 rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5 text-[11.5px] leading-relaxed text-gray-500">
              Kept in <strong className="text-gray-700">{timezone}</strong>. A student abroad sees the same
              hours on their own clock. Today that is{' '}
              {hours[new Date().getDay()]
                ? <>{fmtMinutes(hours[new Date().getDay()].open)} to {fmtMinutes(hours[new Date().getDay()].close)}</>
                : <>a day with no classes</>}.
            </p>

            {error && (
              <p className="mt-3 text-xs text-red-600 flex items-start gap-1.5">
                <RiErrorWarningLine size={14} className="shrink-0 mt-px" />{error}
              </p>
            )}

            <button onClick={save} disabled={saving || broken.length > 0}
              className="w-full h-11 mt-4 rounded-xl bg-amber-500 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:bg-gray-200 disabled:text-gray-400 transition-colors">
              {saving ? 'Saving…' : <><RiCheckLine size={16} /> Save hours</>}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

function toValue(mins) {
  // A close of exactly midnight has no 24:00 in an input, so it shows as
  // 23:59 — one minute short, and the booking screen still treats the stored
  // value as midnight.
  const m = mins >= CLOSE_AT_MIDNIGHT ? CLOSE_AT_MIDNIGHT - 1 : mins
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

function toMinutes(value) {
  const [h, m] = String(value || '0:00').split(':').map(Number)
  const mins = (h || 0) * 60 + (m || 0)
  // 23:59 typed back means they meant midnight.
  return mins === CLOSE_AT_MIDNIGHT - 1 ? CLOSE_AT_MIDNIGHT : mins
}
