// Timezone helpers. All class times are stored as one absolute instant (UTC).
// These helpers display that instant in any IANA timezone, and shift Date
// objects so react-big-calendar (which renders in browser-local time) can
// visually show a chosen timezone.

export const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone

export const TIMEZONES = [
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney',
  'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Chicago',
  'America/Los_Angeles', 'America/Toronto', 'America/Vancouver', 'Pacific/Auckland',
]

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

// Format date + time in a given tz, e.g. "3 Jun, 6:00 PM"
export function fmtDateTime(date, tz) {
  if (!date) return ''
  return date.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: tz,
  })
}

// Format a long date in a given tz, e.g. "Tuesday, 3 June"
export function fmtLongDate(date, tz) {
  if (!date) return ''
  return date.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: tz,
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

// Compact date for table columns, e.g. "15-Aug-26"
export function fmtShortDate(date, tz) {
  if (!date) return ''
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: '2-digit', timeZone: tz,
  }).formatToParts(date)
  const get = t => parts.find(p => p.type === t)?.value || ''
  return `${get('day')}-${get('month')}-${get('year')}`
}

// "6:00 PM Kolkata" — time + city, for compact dual-timezone display
export function fmtTimeCity(date, tz) {
  return `${fmtTime(date, tz)} ${tzCity(tz)}`
}
