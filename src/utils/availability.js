// ─── When can a class actually happen? ───────────────────────────────────────
// The booking calendar used to answer this backwards. It knew what was TAKEN —
// other students' classes — and drew those, so a day with one class at 5pm
// looked occupied although eleven hours of it were free. The student had to
// open the day to find that out, and in a hurry nobody does.
//
// This file answers it the other way round: the studio teaches a known window
// every day, and whatever is not booked or blocked inside that window is free.
// A day is AVAILABLE unless something makes it otherwise, which is both the
// truth and the thing a student wants to hear.
//
// Everything here is pure. No Firestore, no React, no clock of its own — the
// caller passes the time. That is what makes the ranges testable, because the
// arithmetic (timezones, midnights, gaps between classes) is the part that goes
// wrong, and it is the part nobody can check by looking at a screen.
// The extension is required: this module is exercised directly by Node in the
// tests, and Node's ESM resolver will not guess it the way Vite does.
import { tzOffsetMinutes } from './timezone.js'

// The quarter hour is not a style choice. `granuleKeys` in utils/slots.js
// locks a class to fifteen-minute granules, so a 4:07 start would claim from
// 4:00 and block seven minutes it never uses. Offering only quarter hours keeps
// what the student picks and what the lock reserves exactly the same thing.
export const STEP_MIN = 15

// What the studio teaches. Thirty, forty-five or an hour — no ninety-minute
// classes. Kept here rather than in the picker so the range maths and the UI
// cannot drift apart about what fits.
export const DURATIONS = [30, 45, 60]
export const MIN_DURATION = 30

// A gap bounded by a class on BOTH sides, and short, is not really a range —
// it is one slot, and saying "choose any start" about it is noise. At or under
// this, it gets named as the single opening it is.
const SQUEEZE_MAX_MIN = 60

// Teaching hours, as minutes from midnight in the TEACHER's timezone. Six in
// the morning to midnight is eighteen hours, which looks odd until you
// remember the students abroad: a Californian evening is an Indian dawn.
//
// `end` is 24:00 — midnight as a CLOSING time, never an opening one. The last
// class starts before it, not at it.
export const DEFAULT_DAY = { open: 6 * 60, close: 24 * 60 }

// Per weekday (0 = Sunday), so Sundays off, or a short Saturday, needs no
// migration later — only a different value in this same shape. `null` closes
// the day entirely.
export function defaultTeaching() {
  return { 0: { ...DEFAULT_DAY }, 1: { ...DEFAULT_DAY }, 2: { ...DEFAULT_DAY },
           3: { ...DEFAULT_DAY }, 4: { ...DEFAULT_DAY }, 5: { ...DEFAULT_DAY },
           6: { ...DEFAULT_DAY } }
}

// The instant at which a given wall-clock minute falls on a given date in a
// given zone. Built from the offset AT that moment rather than from the
// browser's own zone, so it is right for a student in London reading a window
// that belongs to Kolkata.
export function instantInTz(year, month, day, minutes, tz) {
  const guess = Date.UTC(year, month, day) + minutes * 60000
  const offset = tzOffsetMinutes(tz, new Date(guess))
  return new Date(guess - offset * 60000)
}

// Which weekday a date key belongs to. The key is a plain 'YYYY-MM-DD' in the
// teacher's zone, never a Date, so no zone can shift it to the day before.
export function weekdayOf(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export function dateKeyInTz(date, tz) {
  return date.toLocaleDateString('en-CA', { timeZone: tz })
}

// The teaching window for one date, as real instants. Returns null for a day
// the studio does not teach at all.
export function dayWindow(dateKey, teaching, teacherTz) {
  const hours = (teaching || {})[weekdayOf(dateKey)]
  if (!hours) return null
  const [y, m, d] = dateKey.split('-').map(Number)
  return {
    start: instantInTz(y, m - 1, d, hours.open, teacherTz),
    end: instantInTz(y, m - 1, d, hours.close, teacherTz),
  }
}

// The teaching windows that fall inside ONE day of the viewer's own calendar.
//
// A day belongs to whoever is reading it. Guruji's Tuesday, 6am to midnight in
// Kolkata, is Monday evening through Tuesday lunchtime in New York — so a
// student there asking for "Tuesday the 10th" is asking about parts of two
// teaching days, and a screen that answered with one of them would hide half
// the times they could have had.
//
// Returns the overlapping windows clipped to the viewer's day, in order. For
// a student in the studio's own zone this is simply the one window, unclipped,
// which is the common case and costs nothing extra.
export function windowsForLocalDay(dayKey, teaching, teacherTz, viewerTz) {
  const [y, m, d] = dayKey.split('-').map(Number)
  const from = instantInTz(y, m - 1, d, 0, viewerTz)
  const to = instantInTz(y, m - 1, d, 24 * 60, viewerTz)

  // The teaching days this span can touch: the one the span starts in, the one
  // it ends in, and anything between (there is at most one, since a day is
  // never longer than two).
  const keys = new Set([dateKeyInTz(from, teacherTz), dateKeyInTz(to, teacherTz)])
  const mid = new Date((from.getTime() + to.getTime()) / 2)
  keys.add(dateKeyInTz(mid, teacherTz))

  return [...keys]
    .sort()
    .map(k => dayWindow(k, teaching, teacherTz))
    .filter(Boolean)
    .map(w => ({
      start: new Date(Math.max(w.start.getTime(), from.getTime())),
      end: new Date(Math.min(w.end.getTime(), to.getTime())),
    }))
    .filter(w => w.start < w.end)
}

// Every piece of a viewer's day, across however many teaching windows it spans.
export function localDayPieces(windows, busy = [], blocked = []) {
  return windows.flatMap(w => dayPieces(w, busy, blocked))
}

export function localFreeRanges(windows, busy = [], blocked = [], minDuration = MIN_DURATION) {
  return localDayPieces(windows, busy, blocked)
    .filter(p => p.kind === 'free' && p.minutes >= minDuration)
}

// One word for a viewer's day, the same vocabulary dayStatus uses.
export function localDayStatus({ windows, busy = [], blocked = [], now = new Date(), durations = DURATIONS }) {
  if (!windows || windows.length === 0) return 'closed'
  if (windows.every(w => w.end <= now)) return 'past'

  const statuses = windows.map(w => dayStatus({ window: w, busy, blocked, now, durations }))
  if (statuses.includes('available')) return 'available'
  if (statuses.every(s => s === 'past')) return 'past'
  // Blocked beats full for the same reason it does within a single day: it is
  // the reason Guruji would give.
  if (statuses.includes('blocked')) return 'blocked'
  return 'full'
}

// ─── Merging ─────────────────────────────────────────────────────────────────

function overlaps(a, b) { return a.start < b.end && a.end > b.start }

// Sort and fuse touching or overlapping intervals, so two back-to-back classes
// read as one solid block rather than two that happen to share an edge.
function merge(intervals) {
  const sorted = intervals
    .filter(i => i && i.start < i.end)
    .map(i => ({ ...i, start: new Date(i.start), end: new Date(i.end) }))
    .sort((a, b) => a.start - b.start)

  const out = []
  for (const cur of sorted) {
    const last = out[out.length - 1]
    // Only fuse intervals of the SAME kind: a booked class and a blocked hour
    // are both unavailable but are told to the student differently.
    if (last && last.kind === cur.kind && cur.start <= last.end) {
      if (cur.end > last.end) last.end = cur.end
    } else {
      out.push(cur)
    }
  }
  return out
}

// ─── The day, as a sequence ──────────────────────────────────────────────────
// Returns the window split into alternating pieces, in clock order:
//   { kind: 'free' | 'busy' | 'blocked', start, end, minutes, squeezed }
//
// `busy` and `blocked` may stretch past the window at either end (a class that
// began before opening, a block covering the whole day); both are clipped to
// it, because the window is what can be offered.
export function dayPieces(window, busy = [], blocked = []) {
  if (!window) return []

  const taken = merge([
    ...busy.map(b => ({ ...b, kind: 'busy' })),
    ...blocked.map(b => ({ ...b, kind: 'blocked' })),
  ])
    .filter(t => overlaps(t, window))
    .map(t => ({
      kind: t.kind,
      start: new Date(Math.max(t.start.getTime(), window.start.getTime())),
      end: new Date(Math.min(t.end.getTime(), window.end.getTime())),
    }))

  const pieces = []
  let cursor = window.start

  for (const t of taken) {
    if (t.start > cursor) {
      pieces.push({ kind: 'free', start: cursor, end: t.start })
    }
    pieces.push(t)
    if (t.end > cursor) cursor = t.end
  }
  if (cursor < window.end) {
    pieces.push({ kind: 'free', start: cursor, end: window.end })
  }

  return pieces.map((p, i) => {
    const minutes = Math.round((p.end - p.start) / 60000)
    // Squeezed only when a class sits on BOTH sides. A short opening at the
    // start or end of the day is simply the edge of the day, and saying it is
    // "between two classes" would be a lie the student can see.
    const before = pieces[i - 1]
    const after = pieces[i + 1]
    const wedged = !!before && !!after && before.kind === 'busy' && after.kind === 'busy'
    return { ...p, minutes, squeezed: p.kind === 'free' && wedged && minutes <= SQUEEZE_MAX_MIN }
  })
}

// Just the bookable stretches, long enough to hold the shortest class offered.
// A twenty-minute gap is real but unofferable, and listing it would only invite
// a tap that ends in a refusal.
export function freeRanges(window, busy = [], blocked = [], minDuration = MIN_DURATION) {
  return dayPieces(window, busy, blocked)
    .filter(p => p.kind === 'free' && p.minutes >= minDuration)
}

// The valid start times inside one range for a class of `duration`, on the
// quarter hour. The last start is the one that still FINISHES inside the
// range — which is how midnight stays a closing time and never becomes an
// opening one.
export function startsIn(range, duration, now = null) {
  const out = []
  const last = range.end.getTime() - duration * 60000
  const step = STEP_MIN * 60000
  // Round the opening up to the next quarter hour, so a range beginning at
  // 10:07 (a class that overran) offers 10:15 rather than 10:07.
  let t = Math.ceil(range.start.getTime() / step) * step
  while (t <= last) {
    const when = new Date(t)
    if (!now || when > now) out.push(when)
    t += step
  }
  return out
}

// Can anything at all still be booked in this range?
export function rangeIsBookable(range, durations = DURATIONS, now = null) {
  return durations.some(d => startsIn(range, d, now).length > 0)
}

// ─── A day, for the month grid ───────────────────────────────────────────────
// One word per day, which is all the month view needs:
//   'past' | 'closed' | 'blocked' | 'full' | 'available'
// `mine` is tracked separately, because a student's own class is worth showing
// on a day that is also still bookable.
export function dayStatus({ window, busy = [], blocked = [], now = new Date(), durations = DURATIONS }) {
  if (!window) return 'closed'
  if (window.end <= now) return 'past'

  const pieces = dayPieces(window, busy, blocked)
  const free = pieces.filter(p => p.kind === 'free')

  // Blocked wins over full: if the studio closed the day, that is the reason,
  // and it is the one Guruji would give if asked.
  const blockedMin = pieces.filter(p => p.kind === 'blocked').reduce((n, p) => n + p.minutes, 0)
  const windowMin = Math.round((window.end - window.start) / 60000)
  if (blockedMin >= windowMin) return 'blocked'

  const bookable = free.some(r => rangeIsBookable(r, durations, now))
  if (!bookable) return blockedMin > 0 && free.length === 0 ? 'blocked' : 'full'
  return 'available'
}

// How far ahead a student may book. Mirrors BOOKING_WINDOW_DAYS in db.js and
// the same bound in the security rules — a day past it is not refused so much
// as not open yet, and the month view says so rather than offering it.
export function withinBookingWindow(window, now, windowDays) {
  if (!window) return false
  return window.start.getTime() < now.getTime() + windowDays * 86400000
}

// ─── Words ───────────────────────────────────────────────────────────────────

export function fmtRangeLabel(range, tz) {
  const opts = { hour: 'numeric', minute: '2-digit', timeZone: tz }
  const from = range.start.toLocaleTimeString('en-US', opts)
  const to = range.end.toLocaleTimeString('en-US', opts)
  // "3:00 – 6:00 PM" rather than "3:00 PM – 6:00 PM" when the half of the day
  // does not change; the repeated meridiem is just noise on a phone.
  const half = s => s.slice(-2)
  const bare = s => s.slice(0, -3)
  return half(from) === half(to) ? `${bare(from)} – ${to}` : `${from} – ${to}`
}

export function describeRange(range, { closesDay = false } = {}) {
  if (range.squeezed) return 'One slot free between two classes'
  const hours = range.minutes / 60
  const amount = Number.isInteger(hours)
    ? `${hours} hour${hours === 1 ? '' : 's'}`
    : `${Math.floor(hours)}h ${range.minutes % 60}m`
  if (closesDay) return `${amount} free — must finish by midnight`
  return `${amount} free`
}
