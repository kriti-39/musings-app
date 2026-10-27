import { paymentDate, paymentMonth } from './feeReport.js'
import { creditSummary } from './credits.js'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// The day the money went in. `paymentDate` is the same rule the monthly report
// uses, so the date a student reads, the date the office reads, and the date on
// the PDF cannot drift apart.
//
// Rows from before those timestamps existed show a dash rather than a guess: on
// a payment record an invented day is worse than an honest gap.
export function fmtPaidOn(payment) {
  const d = paymentDate(payment)
  if (!d) return '—'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

// "3 credits left" per student, worked out once when the list loads rather than
// on every render — `creditSummary` needs the time, and reading the clock while
// rendering is impure. The figure only moves when the data is fetched again,
// which is exactly when this is rebuilt.
//
// The cap and expiry are per student, so each summary is built with that
// student in hand rather than from a shared constant.
export function creditLabels(students, byStudent, now = Date.now()) {
  const out = {}
  for (const student of students || []) {
    const n = creditSummary(byStudent[student.id] || [], now, student).available
    out[student.id] = n ? `${n} ${n === 1 ? 'credit' : 'credits'} left` : 'no credits'
  }
  return out
}

// The most recent money actually in, as "₹1,500 · Nov 2026". Only confirmed
// payments count: one still sitting unresolved has not arrived. `list` is the
// student's own payments, newest first.
export function lastPaidLabel(list) {
  const p = (list || []).find(x => x.status === 'confirmed')
  if (!p) return null
  const month = fmtPaidMonth(p)
  return `₹${Number(p.amount || 0).toLocaleString('en-IN')}${month ? ` · ${month}` : ''}`
}

// Just the month it went in, for "last paid" on a profile — the day is more
// precision than that line needs. Same `paymentDate` rule as everywhere else.
export function fmtPaidMonth(payment) {
  const d = paymentDate(payment)
  if (!d) return null
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

// The months a payment settles, but ONLY when they are not simply the month it
// was paid in — otherwise the date already says it and repeating it is noise.
// Returns null when there is nothing worth adding.
//
// This is what lets the Month column go: for almost every payment the date
// carries the month, and the exceptions — paid in late October for November, or
// two months settled at once — say so for themselves.
export function coveredMonths(payment) {
  const months = (payment?.months || []).filter(Boolean)
  if (!months.length) return null
  if (months.length === 1 && months[0] === paymentMonth(payment)) return null
  return months.map(m => {
    const [y, mo] = m.split('-')
    return `${MONTHS[parseInt(mo, 10) - 1]} ${y}`
  }).join(', ')
}

// Human label describing how many months a payment covers, e.g.
// "3 months · Jun, Jul, Aug" (or a range like "Jun–Oct" for 4+).
// Returns '' for single-month payments — no extra context needed there.
export function paymentCoverage(months) {
  const arr = [...(months || [])].sort()
  if (arr.length <= 1) return ''
  const name = (m) => MONTHS[parseInt(m.split('-')[1], 10) - 1] || m
  const list = arr.length <= 3
    ? arr.map(name).join(', ')
    : `${name(arr[0])}–${name(arr[arr.length - 1])}`
  return `${arr.length} months · ${list}`
}
