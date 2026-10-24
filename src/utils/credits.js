// ─── CLASS CREDITS — the rules, with no Firestore in sight ───────────────────
// A credit is one class, paid for in advance. Credits are granted in batches
// (normally 4 at a time) and each batch carries its OWN expiry date, because a
// batch bought in March has nothing to do with one bought in April.
//
// Everything in this file is a pure function of the data it's handed, so the
// arithmetic — balances, expiry dates, the 4-at-a-time cap — can be tested
// without a database and never disagrees between screens.

// ─── How many, and for how long ───────────────────────────────────────────────
// A cap on the BALANCE, not a monthly allowance: spend one and room opens up
// again straight away. A student who uses three classes in a fortnight can buy
// three more that afternoon — which is why everybody ends up on their own
// timeline rather than a shared calendar month.
//
// Indian students take up to three classes a period; students abroad up to
// twelve, because they tend to buy in blocks around a visit or a stretch of
// leave rather than weekly.
export const INDIA_CAP = 3
export const FOREIGN_CAP = 12

export function creditCap(student) {
  return isIndianStudent(student) ? INDIA_CAP : FOREIGN_CAP
}

// What a student is offered when buying. Asked in CLASSES, never in "credits" —
// a credit is our word for it, and a student booking a lesson is thinking about
// lessons. One is always offered so somebody can top up a single class instead
// of buying another whole block.
export function classOptions(student) {
  return isIndianStudent(student) ? [1, 2, 3] : [1, 3, 4, 12]
}

// ─── How long a purchase lasts ───────────────────────────────────────────────
// In India, any purchase runs for four weeks. A student there books around an
// ordinary week and the studio is in the same city, so the size of the block
// makes no difference to how long it takes to get through.
export const INDIA_VALIDITY_WEEKS = 4

// Abroad, the window depends on how many classes were bought: a single
// top-up is meant to be used soon, while twelve is a term's worth of lessons
// bought around a visit or a stretch of leave and needs room to breathe.
const FOREIGN_WEEKS = { 1: 2, 3: 4, 4: 5, 12: 15 }

// Weeks for a purchase of `quantity` classes by this student.
//
// The sizes above are the ones actually offered. Staff can grant any number,
// so anything else takes the window of the largest size at or below it, plus a
// week for each extra class — monotonic, and erring long. Erring long can only
// give a student more time; erring short loses them a class they paid for.
export function validityWeeks(student, quantity) {
  if (isIndianStudent(student)) return INDIA_VALIDITY_WEEKS

  const n = Math.max(Math.floor(Number(quantity) || 0), 1)
  if (FOREIGN_WEEKS[n]) return FOREIGN_WEEKS[n]

  const sizes = Object.keys(FOREIGN_WEEKS).map(Number).sort((a, b) => a - b)
  const below = sizes.filter(s => s <= n).pop()
  if (below === undefined) return FOREIGN_WEEKS[sizes[0]]
  return FOREIGN_WEEKS[below] + (n - below)
}

export function validityDays(student, quantity) {
  return validityWeeks(student, quantity) * 7
}

// Credits only apply to students put on the credit system. Everyone already on
// the books keeps booking the way they always have until they're moved over —
// an absent field means "the old way", so nothing changes for them by default.
export function usesCredits(student) {
  return student?.billingMode === 'credits'
}

// India or abroad. Read from the country on the profile; if that was left blank
// the timezone is a good second guess, and failing both we assume India, where
// the studio and most of its students are.
//
// This decides the validity window only. It is deliberately never shown to the
// student — they see their country, not a label that sorts them.
export function isIndianStudent(student) {
  const country = (student?.country || '').trim().toLowerCase()
  if (country) return ['india', 'in', 'ind', 'bharat'].includes(country)
  const tz = student?.timezone || ''
  if (tz) return tz === 'Asia/Kolkata' || tz === 'Asia/Calcutta'
  return true
}

// The window for a specific purchase, e.g. "5 weeks".
export function validityLabel(student, quantity = null) {
  const w = validityWeeks(student, quantity ?? creditCap(student))
  return `${w} ${w === 1 ? 'week' : 'weeks'}`
}

// For somewhere there is no particular purchase in view — the Help page, or a
// hint on a profile. In India it is one number; abroad it is a range, and
// saying "6 weeks" there would be wrong for three of the four sizes.
export function validityRangeLabel(student) {
  if (isIndianStudent(student)) return `${INDIA_VALIDITY_WEEKS} weeks`
  const sizes = classOptions(student)
  const weeks = sizes.map(n => validityWeeks(student, n))
  return `${Math.min(...weeks)} to ${Math.max(...weeks)} weeks, depending on how many you buy`
}

// Adding "a month" to the 31st is undefined — there is no 31st of February.
// We clamp to the last day of the target month (31 Jan → 28 Feb), which is what
// every bank and subscription does, and never silently jumps into the month
// after next.
export function addCalendarMonth(date) {
  const d = new Date(date)
  const wanted = d.getDate()
  d.setDate(1)                                    // so the month bump can't overflow
  d.setMonth(d.getMonth() + 1)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(wanted, lastDay))
  return d
}

export function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

// Credits die at the END of their last day, not at the minute they were bought.
// A student granted credits at 9am on the 10th keeps them all of the 10th next
// month — losing a paid class to the clock would be indefensible.
export function endOfDay(date) {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

// The Sunday on or after a date. A date that is already a Sunday stays put.
//
// Credits expire at the end of a WEEK rather than on whatever weekday they
// happened to be bought on. A student who buys on a Wednesday would otherwise
// be counting to a Wednesday four weeks later, which nobody does — people
// think in weeks, and a week ends on Sunday. It always rounds forward, so the
// rounding can only ever give a student more time, never less.
export function nextSunday(date) {
  const d = new Date(date)
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7))
  return d
}

// When a batch of `quantity` classes granted at `from` runs out, for this
// student. The quantity matters abroad, where the window grows with the size
// of the purchase.
export function creditExpiry(from, student, quantity = null) {
  const days = validityDays(student, quantity ?? creditCap(student))
  return endOfDay(nextSunday(addDays(new Date(from), days)))
}

// ─── READING A BATCH ─────────────────────────────────────────────────────────

// Firestore Timestamps, Dates and raw millis all turn up here depending on
// whether the data came from the server, from a local write, or from a test.
export function toMillis(v) {
  if (!v) return 0
  if (typeof v === 'number') return v
  if (v instanceof Date) return v.getTime()
  if (typeof v.toDate === 'function') return v.toDate().getTime()
  if (typeof v.seconds === 'number') return v.seconds * 1000
  return 0
}

export function toDate(v) {
  const ms = toMillis(v)
  return ms ? new Date(ms) : null
}

export function batchRemaining(batch) {
  const qty = Number(batch?.quantity) || 0
  const used = Number(batch?.used) || 0
  return Math.max(qty - used, 0)
}

export function isExpired(batch, now = Date.now()) {
  return toMillis(batch?.expiresAt) <= now
}

// A credit you could actually spend right now: still active, not all used up,
// and not past its date.
export function isSpendable(batch, now = Date.now()) {
  if (!batch) return false
  if (batch.status !== 'active') return false     // exhausted / expired / revoked
  if (batchRemaining(batch) <= 0) return false
  return !isExpired(batch, now)
}

// Spend the credit that dies first, so nothing expires while a later batch sits
// unused. Ties broken by grant time, oldest first.
export function spendOrder(batches, now = Date.now()) {
  return (batches || [])
    .filter(b => isSpendable(b, now))
    .sort((a, b) =>
      toMillis(a.expiresAt) - toMillis(b.expiresAt) ||
      toMillis(a.grantedAt) - toMillis(b.grantedAt)
    )
}

// Whole days left before a batch lapses — 0 means "today is the last day".
export function daysLeft(batch, now = Date.now()) {
  const ms = toMillis(batch?.expiresAt) - now
  if (ms <= 0) return -1
  return Math.floor(ms / 86400000)
}

// Batches that have run out of time but haven't been marked expired yet. The
// sweep (see firebase/credits.js) tidies these up.
export function staleBatches(batches, now = Date.now()) {
  return (batches || []).filter(b => b.status === 'active' && isExpired(b, now))
}

// ─── THE BALANCE ─────────────────────────────────────────────────────────────

const SOON_DAYS = 7

// One object with everything a screen needs to talk about a student's credits.
//
// `student` decides the cap, so it is passed in and handed back as `cap`.
// Screens read `summary.cap` rather than a constant: the cap is three for an
// Indian student and twelve for one abroad, and a single shared number was
// quietly wrong for everybody the moment that became true.
export function creditSummary(batches, now = Date.now(), student = null) {
  const cap = creditCap(student)
  const list = batches || []
  const live = list.filter(b => isSpendable(b, now))
  const available = live.reduce((sum, b) => sum + batchRemaining(b), 0)

  // The batch that will lapse first decides the headline "use them by" date.
  const next = spendOrder(live, now)[0] || null

  const lapsed = list.filter(b => b.status === 'expired' || (b.status === 'active' && isExpired(b, now)))

  return {
    available,
    cap,
    canHold: Math.max(cap - available, 0),   // how many more may be granted
    atCap: available >= cap,
    nextExpiry: next ? toDate(next.expiresAt) : null,
    nextExpiryDays: next ? daysLeft(next, now) : null,
    nextExpiryCount: next ? batchRemaining(next) : 0,
    expiringSoon: next ? daysLeft(next, now) <= SOON_DAYS : false,
    liveBatches: spendOrder(live, now),
    totalGranted: list.reduce((s, b) => s + (Number(b.quantity) || 0), 0),
    totalUsed: list.reduce((s, b) => s + (Number(b.used) || 0), 0),
    totalLapsed: lapsed.reduce((s, b) => s + batchRemaining(b), 0),
  }
}

// Whether `quantity` more credits may be granted right now, and why not.
// `student` decides the cap, so leaving it out would judge an Indian student
// against a cap of twelve.
export function canGrant(batches, quantity, now = Date.now(), student = null) {
  const { available, canHold, cap } = creditSummary(batches, now, student)
  const qty = Number(quantity) || 0
  if (qty < 1) return { ok: false, reason: 'Choose how many classes.', available, canHold, cap }
  if (qty > canHold) {
    return {
      ok: false,
      available,
      canHold,
      cap,
      reason: canHold === 0
        ? `Already holding the most allowed (${cap}). Once a class is used, more can be added.`
        : `That would go over the limit of ${cap} — ${canHold} more can be added.`,
    }
  }
  return { ok: true, available, canHold, cap }
}

// ─── WORDING ─────────────────────────────────────────────────────────────────

export function creditsWord(n) {
  return n === 1 ? 'credit' : 'credits'
}

export function daysWord(n) {
  return n === 1 ? 'day' : 'days'
}

// "1 credit expires" / "3 credits expire"
export function expiresWord(n) {
  return n === 1 ? 'expires' : 'expire'
}

export function fmtExpiry(date) {
  if (!date) return ''
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

// "3 left · use by 14 Nov" — the one line that tells a student where they stand.
export function balanceLine(summary) {
  if (!summary || summary.available === 0) return 'No credits left'
  const by = summary.nextExpiry ? ` · use by ${fmtExpiry(summary.nextExpiry)}` : ''
  return `${summary.available} ${creditsWord(summary.available)} left${by}`
}

// How urgently to say it. Drives the colour on the student's dashboard.
export function balanceTone(summary) {
  if (!summary || summary.available === 0) return 'empty'
  if (summary.expiringSoon) return 'soon'
  return 'ok'
}

// ─── Must money be recorded before credits are? ──────────────────────────────
// Yes, for everyone except the students the studio settles with outside the
// app. Credits are classes already paid for, so a grant with no payment behind
// it is either a mistake or a gift — and an app that lets one happen silently
// cannot be reconciled afterwards.
//
// The exemption is a flag on the student, set by an admin: for a student on a
// flexible arrangement, or one whose fees are handled in a way the app does not
// model, the office adds credits directly and records the money elsewhere.
// It lives on the profile, which students cannot edit.
export function creditsNeedPayment(student) {
  return student?.creditsWithoutPayment !== true
}

export function paymentProblem(student, amount) {
  if (!creditsNeedPayment(student)) return null
  const paid = Number(amount)
  if (!Number.isFinite(paid) || paid <= 0) {
    return 'Record the amount paid — credits are only added once the money is in.'
  }
  return null
}
