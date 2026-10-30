// Timezone helpers. All class times are stored as one absolute instant (UTC).
// These helpers display that instant in any IANA timezone, and shift Date
// objects so react-big-calendar (which renders in browser-local time) can
// visually show a chosen timezone.

export const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone

// ─── Every timezone, not a shortlist ─────────────────────────────────────────
// This used to be thirteen hand-picked zones, which was fine while every
// student was in one of them and wrong the moment one wasn't — there was no
// way to say Asia/Karachi or America/Sao_Paulo, and a student in the wrong
// zone sees every class time wrong.
//
// The browser already knows all ~418 IANA zones, so the list comes from there.
// The handful the studio actually uses stay pinned at the top of the picker,
// because scrolling past Africa/Abidjan to reach Kolkata would be worse than
// the short list ever was.
export const COMMON_TIMEZONES = [
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney',
  'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Chicago',
  'America/Los_Angeles', 'America/Toronto', 'America/Vancouver', 'Pacific/Auckland',
]

function allZones() {
  try {
    const all = Intl.supportedValuesOf?.('timeZone')
    if (Array.isArray(all) && all.length > 0) return all
  } catch {
    // Intl.supportedValuesOf is recent; an older browser just gets the
    // shortlist rather than an empty picker.
  }
  return COMMON_TIMEZONES
}

export const ALL_TIMEZONES = allZones()

// The common ones first, then everything else alphabetically. A zone already
// on the profile is included even if this browser has never heard of it — an
// older alias like Asia/Calcutta must not silently vanish from someone's
// profile just because the picker was opened.
export function timezoneChoices(current = null) {
  const seen = new Set()
  const out = []
  const add = (tz) => {
    if (!tz || seen.has(tz)) return
    seen.add(tz)
    out.push(tz)
  }
  if (current) add(current)
  COMMON_TIMEZONES.forEach(add)
  ALL_TIMEZONES.forEach(add)
  return out
}

// "+5:30", "-4:00", "+0:00" — what a person actually recognises a zone by.
export function tzOffsetLabel(tz, date = new Date()) {
  const mins = tzOffsetMinutes(tz, date)
  if (!Number.isFinite(mins)) return ''
  const sign = mins < 0 ? '-' : '+'
  const abs = Math.abs(mins)
  return `GMT${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`
}

// "Kolkata · Asia/Kolkata · GMT+5:30" — searchable by city, region or offset.
export function tzSearchText(tz) {
  return `${tzCity(tz)} ${tz.replace(/[/_]/g, ' ')} ${tzOffsetLabel(tz)}`.toLowerCase()
}

// Short, friendly label for a timezone, e.g. "Asia/Kolkata" -> "Kolkata"
export function tzCity(tz) {
  if (!tz) return ''
  const parts = tz.split('/')
  return parts[parts.length - 1].replace(/_/g, ' ')
}

// Offset (in minutes) to ADD to a UTC instant to get the wall-clock time in tz.
// e.g. Asia/Kolkata -> +330, Europe/London (summer) -> +60
export function tzOffsetMinutes(tz, date = new Date()) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const map = {}
  for (const p of dtf.formatToParts(date)) map[p.type] = p.value
  // 'hour' can come back as '24' at midnight in some engines
  const hour = map.hour === '24' ? '00' : map.hour
  const asUTC = Date.UTC(+map.year, +map.month - 1, +map.day, +hour, +map.minute, +map.second)
  return Math.round((asUTC - date.getTime()) / 60000)
}

// Format just the time in a given tz, e.g. "6:00 PM"
export function fmtTime(date, tz) {
  if (!date) return ''
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: tz })
}

// Plain 12-hour time, e.g. "6:00 PM" — no leading zero, uppercase AM/PM.
// Used where the time is the thing being checked, like the booking confirmation.
export function fmtTime12(date, tz) {
  if (!date) return ''
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz })
}

// Format a long date in a given tz, e.g. "Tuesday, 3 June"
export function fmtLongDate(date, tz) {
  if (!date) return ''
  return date.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: tz,
  })
}

// The same date for a CARD, where it shares its line with a status badge.
// "Wednesday, 28 October" and a badge do not both fit across a phone, and the
// loser was whichever wrapped — usually both. The short weekday buys the room
// without giving up the month, which is the part people actually read.
export function fmtCardDate(date, tz) {
  if (!date) return ''
  return date.toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'long', timeZone: tz,
  })
}

// Shift a real instant so that, when rendered in browser-local time by the
// calendar, it visually shows the wall-clock time of `tz`.
export function shiftToTz(date, tz) {
  if (!tz || tz === LOCAL_TZ) return date
  const diff = tzOffsetMinutes(tz, date) - tzOffsetMinutes(LOCAL_TZ, date)
  return new Date(date.getTime() + diff * 60000)
}

// Inverse of shiftToTz: given a slot Date picked on the shifted calendar,
// recover the real instant.
export function unshiftFromTz(shifted, tz) {
  if (!tz || tz === LOCAL_TZ) return shifted
  const diff = tzOffsetMinutes(tz, shifted) - tzOffsetMinutes(LOCAL_TZ, shifted)
  return new Date(shifted.getTime() - diff * 60000)
}

// Do these two zones call the same instant the same calendar day?
//
// Los Angeles to Kolkata is twelve and a half hours, so a late evening class
// for the student is the following morning for Guruji. A panel that shows one
// date above two times is then saying something untrue — and the person most
// likely to act on it is the one who has to be awake for it.
//
// Compared as YYYY-MM-DD ('en-CA') because that sorts and compares as a string
// without parsing anything back into a Date.
export function sameCalendarDay(date, tzA, tzB) {
  if (!date || !tzA || !tzB) return true
  const day = tz => date.toLocaleDateString('en-CA', { timeZone: tz })
  return day(tzA) === day(tzB)
}

// Weekday and date for a zone, e.g. "Sat, 31 Oct" — short enough to sit beside
// a time when the two sides fall on different days.
export function fmtDayInTz(date, tz) {
  if (!date) return ''
  return date.toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: tz,
  })
}

// Compact date for table columns, e.g. "15-Aug-26"
export function fmtShortDate(date, tz) {
  if (!date) return ''
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: '2-digit', timeZone: tz,
  }).formatToParts(date)
  const get = t => parts.find(p => p.type === t)?.value || ''
  return `${get('day')}-${get('month')}-${get('year')}`
}
