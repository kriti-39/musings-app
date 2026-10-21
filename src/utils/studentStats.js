// ─── What one student adds up to ─────────────────────────────────────────────
// The figures Guruji wants when he opens somebody: what they've paid, how many
// classes they've actually had, and how regular they are. Pure functions of the
// classes and payments already on screen, so the numbers can be checked without
// a database and can't drift from what the lists show.

import { toMillis } from './credits'

const DAY = 86400000

// Only confirmed money counts. Pending and declined payments are not income.
export function totalPaid(payments) {
  return (payments || [])
    .filter(p => p.status === 'confirmed')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
}

// A class that actually happened. A class marked 'missed' is NOT one of these —
// nobody turned up, so counting it as a lesson taught would flatter the number.
export function classesDone(classes) {
  return (classes || []).filter(c => c.status === 'completed' && !c.missed).length
}

export function classesMissed(classes) {
  return (classes || []).filter(c => c.missed).length
}

export function classesCancelled(classes) {
  return (classes || []).filter(c => c.status === 'cancelled' || c.status === 'rejected').length
}

// How often they actually come, as classes per month.
//
// Measured from their FIRST completed class to today rather than from the day
// they joined — someone who signed up in January and started in June shouldn't
// look half as regular as they are. Returns null until there's enough history
// to say anything honest (fewer than two classes, or less than a fortnight).
export function frequencyPerMonth(classes, now = Date.now()) {
  const done = (classes || [])
    .filter(c => c.status === 'completed' && !c.missed)
    .map(c => toMillis(c.scheduledAt))
    .filter(Boolean)
    .sort((a, b) => a - b)

  if (done.length < 2) return null

  const first = done[0]
  const spanDays = (now - first) / DAY
  if (spanDays < 14) return null

  return (done.length / spanDays) * 30
}

export function frequencyLabel(perMonth) {
  if (perMonth === null || perMonth === undefined) return 'Not enough history yet'
  const n = Math.round(perMonth * 10) / 10
  if (n >= 3.5) return `About ${Math.round(n)} a month · weekly`
  if (n >= 1.5) return `About ${n} a month · fortnightly`
  if (n >= 0.7) return `About ${n} a month`
  return 'Less than monthly'
}

// When they were last taught, and how long ago — the quickest way to spot
// someone who has quietly drifted away.
export function lastClass(classes) {
  const done = (classes || [])
    .filter(c => c.status === 'completed' && !c.missed)
    .map(c => toMillis(c.scheduledAt))
    .filter(Boolean)
  if (!done.length) return null
  return new Date(Math.max(...done))
}

export function daysSince(date, now = Date.now()) {
  if (!date) return null
  return Math.floor((now - date.getTime()) / DAY)
}

// A student nobody has taught for a while. Not a hard rule — it just puts a
// quiet word on the profile so they aren't forgotten.
export function isDrifting(classes, now = Date.now()) {
  const last = lastClass(classes)
  if (!last) return false
  const gap = daysSince(last, now)
  const freq = frequencyPerMonth(classes, now)
  // Roughly double their usual gap, with a 30-day floor so a monthly student
  // isn't flagged the moment they're a week late.
  const usualGap = freq ? 30 / freq : 30
  return gap > Math.max(usualGap * 2, 30)
}

export function buildStudentStats(classes, payments, now = Date.now()) {
  const freq = frequencyPerMonth(classes, now)
  const last = lastClass(classes)
  return {
    totalPaid: totalPaid(payments),
    paymentCount: (payments || []).filter(p => p.status === 'confirmed').length,
    done: classesDone(classes),
    missed: classesMissed(classes),
    cancelled: classesCancelled(classes),
    frequency: freq,
    frequencyLabel: frequencyLabel(freq),
    lastClass: last,
    daysSinceLast: daysSince(last, now),
    drifting: isDrifting(classes, now),
  }
}
