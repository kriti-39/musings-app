import { useState, useRef, useEffect, useMemo } from 'react'
import { RiSearchLine, RiCloseLine, RiCheckLine } from 'react-icons/ri'
import {
  timezoneChoices, COMMON_TIMEZONES, tzCity, tzOffsetLabel, tzSearchText, LOCAL_TZ,
} from '../../utils/timezone'

// ─── Pick a timezone out of all of them ──────────────────────────────────────
// There are 418, so this is a search box rather than a dropdown: a <select>
// with 418 options is a mile of scrolling on a phone, and the one you want is
// never near the top.
//
// Type a city ("kolkata"), a region ("europe") or an offset ("+5:30"). The
// zones the studio actually uses sit at the top before you type anything, so
// the common case is still one tap.
export default function TimezonePicker({ value, onChange, disabled = false, id }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const box = useRef(null)
  const input = useRef(null)

  useEffect(() => {
    function away(e) { if (box.current && !box.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [])

  useEffect(() => { if (open) input.current?.focus() }, [open])

  // The whole list is static, and searching 418 strings on every keystroke is
  // cheap — but building the search text for all of them is not, so it is
  // built once.
  const choices = useMemo(() => {
    return timezoneChoices(value).map(tz => ({
      tz,
      label: tzCity(tz),
      region: tz.split('/')[0].replace(/_/g, ' '),
      offset: tzOffsetLabel(tz),
      search: tzSearchText(tz),
    }))
  }, [value])

  const q = query.trim().toLowerCase()
  const matches = q
    ? choices.filter(c => c.search.includes(q)).slice(0, 80)
    : choices.filter(c => c.tz === value || COMMON_TIMEZONES.includes(c.tz))

  function choose(tz) {
    onChange(tz)
    setQuery('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        type="button" id={id} disabled={disabled} onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between gap-2 border border-gray-200 rounded-lg px-3 py-2 text-left hover:border-amber-300 transition-colors disabled:opacity-50"
      >
        <span className="min-w-0">
          {value ? (
            <>
              <span className="block text-sm text-gray-800 truncate">{tzCity(value)}</span>
              <span className="block text-[11px] text-gray-400 truncate">
                {value.replace(/_/g, ' ')} · {tzOffsetLabel(value)}
              </span>
            </>
          ) : (
            <span className="text-sm text-gray-400">Choose a timezone</span>
          )}
        </span>
        <RiSearchLine size={15} className="shrink-0 text-gray-400" />
      </button>
    )
  }

  return (
    <div ref={box} className="relative">
      <div className="flex items-center gap-2 border border-amber-400 rounded-lg px-3 py-2">
        <RiSearchLine size={15} className="shrink-0 text-gray-400" />
        <input
          ref={input} value={query} onChange={e => setQuery(e.target.value)}
          placeholder="City, region or offset — e.g. Kolkata, Europe, +5:30"
          className="flex-1 min-w-0 text-sm focus:outline-none bg-transparent"
        />
        <button type="button" onClick={() => { setQuery(''); setOpen(false) }}
          className="shrink-0 text-gray-400 hover:text-gray-600">
          <RiCloseLine size={16} />
        </button>
      </div>

      <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
        {!q && (
          <p className="px-3 pt-2 pb-1 text-[11px] font-medium text-gray-400 uppercase tracking-wide">
            Commonly used
          </p>
        )}

        {matches.length === 0 && (
          <p className="px-3 py-3 text-sm text-gray-400">
            Nothing matches “{query}”. Try a city, or an offset like +5:30.
          </p>
        )}

        {matches.map(c => (
          <button
            key={c.tz} type="button" onClick={() => choose(c.tz)}
            className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-amber-50 transition-colors ${
              c.tz === value ? 'bg-amber-50' : ''
            }`}
          >
            <span className="min-w-0">
              <span className="block text-sm text-gray-800 truncate">
                {c.label}
                {c.tz === LOCAL_TZ && (
                  <span className="ml-1.5 text-[10px] text-amber-700">this device</span>
                )}
              </span>
              <span className="block text-[11px] text-gray-400 truncate">{c.region}</span>
            </span>
            <span className="shrink-0 flex items-center gap-1.5">
              <span className="text-[11px] text-gray-500 tabular-nums">{c.offset}</span>
              {c.tz === value && <RiCheckLine size={14} className="text-amber-600" />}
            </span>
          </button>
        ))}

        {q && matches.length >= 80 && (
          <p className="px-3 py-2 text-[11px] text-gray-400 border-t border-gray-50">
            Showing the first 80 — keep typing to narrow it down.
          </p>
        )}
      </div>
    </div>
  )
}
