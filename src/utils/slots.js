// ─── Slot locks ──────────────────────────────────────────────────────────────
// Two classes must never share a time. Checking for a clash and then writing
// the class are two separate round trips, so two people tapping the same slot
// in the same second can both be told it is free. The gap is small and it will
// never show up in testing, but with 92 students it only has to happen once.
//
// So a booking also claims a lock on every quarter hour it covers, in the same
// transaction that writes the class. A lock is a document whose id is derived
// from the teacher and the time, which means two bookings for the same slot try
// to create the SAME id — and Firestore will only let one of them win.
//
// Quarter hours rather than exact times, because a clash is not an equality
// test: an hour from 10:00 and a half hour from 10:30 are different times that
// cannot both happen. Granules turn an overlap question into a set of exact
// ids, which is the only shape a transaction can check.

export const GRANULE_MIN = 15

// Durations are clamped to 15–180 minutes before they get here, so the worst
// case is a three-hour class straddling a boundary: 13 granules.
export const MAX_GRANULES = 13

function epochMinutes(date) {
  return Math.floor(date.getTime() / 60000)
}

// The granule a moment falls in. Floor for the start and ceiling for the end,
// so a class that begins at 10:05 claims from 10:00 and a class that ends at
// 10:50 claims to 11:00. That over-claims by a few minutes at each end, which
// is the right way to be wrong: it can refuse a booking that would just about
// have fitted, but it can never let two classes overlap.
function granuleOf(date, round) {
  return round(epochMinutes(date) / GRANULE_MIN)
}

// Every granule a class occupies, as lock ids. Returns [] for anything that
// isn't a usable time or duration, and the caller treats that as "cannot
// claim" rather than "nothing to claim" — an unparseable time must not slip
// through unlocked.
export function granuleKeys(teacherId, startDate, durationMin) {
  if (!teacherId || typeof teacherId !== 'string') return []

  const start = startDate instanceof Date ? startDate : new Date(startDate)
  if (Number.isNaN(start.getTime())) return []

  const dur = Number(durationMin)
  if (!Number.isFinite(dur) || dur <= 0) return []

  const end = new Date(start.getTime() + dur * 60000)

  const from = granuleOf(start, Math.floor)
  const to = granuleOf(end, Math.ceil)        // exclusive
  if (to <= from) return []

  // A duration big enough to blow past this was already clamped upstream; if
  // one ever arrives, refusing beats writing hundreds of locks.
  if (to - from > MAX_GRANULES) return []

  const keys = []
  for (let g = from; g < to; g++) keys.push(`${teacherId}_${g}`)
  return keys
}

// Do two classes collide? Used by the tests and by the lazy reclaim, so the
// granule rule and the plain overlap rule can be checked against each other.
export function overlaps(aStart, aDur, bStart, bDur) {
  const aS = aStart instanceof Date ? aStart : new Date(aStart)
  const bS = bStart instanceof Date ? bStart : new Date(bStart)
  const aE = new Date(aS.getTime() + Number(aDur) * 60000)
  const bE = new Date(bS.getTime() + Number(bDur) * 60000)
  return aS < bE && aE > bS
}

// A class occupies its slot only while it is still going to happen. Anything
// cancelled, rejected or finished leaves the time free again, which is what
// lets a lock be reclaimed rather than having to be deleted.
const LIVE = new Set(['scheduled', 'pending'])

export function holdsSlot(cls) {
  if (!cls) return false
  return LIVE.has(cls.status || 'scheduled')
}
