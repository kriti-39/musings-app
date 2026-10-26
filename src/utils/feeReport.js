// Builds the fee report shown in the modal and written to the PDF. Kept free of
// React and Firebase so the numbers are easy to follow: it takes the students
// and payments the Fees page already loaded, plus the months staff picked, and
// works out what came in.
//
// ─── Money belongs to the month it ARRIVED ───────────────────────────────────
// This used to work off a `months` array on each payment — "which months is
// this fee for" — and split a multi-month payment evenly across them. That made
// sense while students were billed in arrears and could owe for a month they
// had already been taught.
//
// On credits nobody can owe anything: classes are paid for before they are
// booked. So "due", "unpaid", "to collect" and "outstanding" no longer describe
// anything that can happen, and the only honest question is what money came in
// and when. A fee taken on 28 September is September's, whatever months the
// classes fall in.
//
// `months` is still written on a payment, because it records what was agreed
// and is worth having on a receipt. Nothing in this file totals by it.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

// "2026-08" -> "Aug 2026"
export function monthLabel(m) {
  const [y, mo] = String(m).split('-')
  return `${MONTHS[parseInt(mo, 10) - 1] || mo} ${y}`
}

// "Aug, Sep 2026" style list for a table cell

// ─── When did this money arrive? ─────────────────────────────────────────────
// `submittedAt` is a server timestamp written on every payment the app has ever
// created, so it is the real date. `confirmedAt` is the fallback for anything
// odd, and the old `months` array is the last resort so a legacy row still
// lands somewhere sensible rather than disappearing from every total.
// One month or many. A bare string is accepted because spreading one gives
// its CHARACTERS — '2026-09' becomes ['2','0','2','6','-','0','9'] — which
// matches nothing and silently reports zero. A total that reads 0 rather than
// failing is the worst kind of wrong, so the shape is normalised here instead
// of trusted at every call site.
function toMonths(months) {
  if (typeof months === 'string') return months ? [months] : []
  return [...(months || [])].filter(Boolean)
}

export function paymentDate(payment) {
  for (const field of ['submittedAt', 'confirmedAt']) {
    const v = payment?.[field]
    const d = v?.toDate?.() ?? (v ? new Date(v) : null)
    if (d && !Number.isNaN(d.getTime())) return d
  }
  return null
}

export function paymentMonth(payment) {
  const d = paymentDate(payment)
  if (d) return monthKey(d)
  // Pre-dates the timestamp, or a hand-written row: fall back to the earliest
  // month it was tagged with.
  const tagged = (payment?.months || []).filter(Boolean).sort()
  return tagged[0] || null
}

// Did this payment land in any of the months being looked at?
export function paidWithin(payment, months) {
  const m = paymentMonth(payment)
  return !!m && (months || []).includes(m)
}

// Does this payment count towards money received? Rejected never does; a
// payment still awaiting confirmation is money the studio has not agreed it
// has, so it is reported separately rather than in the total.
export function isReceived(payment) {
  return payment?.status === 'confirmed'
}

// ─── WHAT CAME IN, OVER ONE MONTH OR SEVERAL ─────────────────────────────────
// `months` is an array, so the same function answers "September" and
// "September + October" without a second code path. A payment is counted ONCE,
// at its full amount, in the month the money arrived — never split, because
// splitting would mean no single month matched the bank statement.
//
// There is no `expected` and no `unpaid`. On credits a student pays before
// booking, so there is nothing to be owed and nothing to chase; a student with
// no payment this month simply did not buy classes this month.
export function monthlyCollection(students, paymentsMap, months) {
  const period = toMonths(months).sort()

  const rows = (students || []).map(s => {
    const list = paymentsMap?.[s.id] || []
    let received = 0
    let awaiting = 0
    const counted = []

    for (const p of list) {
      if (p.status === 'rejected') continue
      if (!paidWithin(p, period)) continue
      const amount = Number(p.amount) || 0
      if (isReceived(p)) { received += amount; counted.push(p) }
      else awaiting += amount
    }

    return {
      id: s.id,
      name: s.name || '—',
      received,
      awaiting,
      payments: counted,
      feeAmount: Number(s.feeAmount) || 0,
      feeType: s.feeType || '',
      // "paid" here means "paid something in this period", not "settled up" —
      // there is no such thing as settled up any more.
      status: received > 0 ? 'paid' : awaiting > 0 ? 'awaiting' : 'none',
    }
  })

  const sum = (key) => rows.reduce((t, r) => t + r[key], 0)

  return {
    months: period,
    rows,
    received: Math.round(sum('received')),
    awaiting: Math.round(sum('awaiting')),
    paidCount: rows.filter(r => r.status === 'paid').length,
    awaitingCount: rows.filter(r => r.status === 'awaiting').length,
    students: rows.length,
  }
}

// The report behind the modal and the PDF. Same basis as the summary above:
// what arrived, in the months picked.
//
// It no longer has a "to collect" section or an outstanding figure. Those
// existed to chase a student who had been taught and not yet paid, which the
// credit system makes impossible — a class cannot be booked until it is paid
// for. Reporting a debt that cannot exist would be worse than reporting
// nothing.
export function buildFeeReport(students, paymentsMap, months, classes = null) {
  const period = toMonths(months).sort()
  const taught = classes ? classesInMonths(classes, period) : null

  const rows = (students || []).map(s => {
    const list = paymentsMap?.[s.id] || []

    let received = 0
    let awaiting = 0
    const paidOn = []

    for (const p of list) {
      if (p.status === 'rejected') continue
      if (!paidWithin(p, period)) continue
      const amount = Number(p.amount) || 0
      if (isReceived(p)) {
        received += amount
        paidOn.push({ month: paymentMonth(p), date: paymentDate(p), amount, method: p.method || '' })
      } else {
        awaiting += amount
      }
    }

    paidOn.sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0))

    return {
      id: s.id,
      name: s.name || '—',
      phone: s.phone || '',
      country: s.country || '',
      feeAmount: Number(s.feeAmount) || 0,
      feeType: s.feeType || '',
      received,
      awaiting,
      paidOn,
      classesDone: taught ? (taught.byStudent[s.id]?.done || 0) : null,
    }
  })

  const byName = (a, b) => String(a.name).localeCompare(String(b.name))
  const paid = rows.filter(r => r.received > 0)
    .sort((a, b) => b.received - a.received || byName(a, b))
  const awaiting = rows.filter(r => r.awaiting > 0).sort(byName)
  const quiet = rows.filter(r => r.received === 0 && r.awaiting === 0).sort(byName)

  return {
    period,
    rows,
    paid,
    awaiting,
    quiet,
    totals: {
      students: rows.length,
      paidCount: paid.length,
      awaitingCount: awaiting.length,
      quietCount: quiet.length,
      received: rows.reduce((sum, r) => sum + r.received, 0),
      awaiting: rows.reduce((sum, r) => sum + r.awaiting, 0),
      classesDone: taught ? taught.done : null,
    },
  }
}

// Classes taught across a set of months, for the report. Same rule as
// monthlyClasses below: completed only, missed counted apart.
function classesInMonths(classes, period) {
  const set = new Set(period)
  const byStudent = {}
  let done = 0
  for (const c of classes || []) {
    const when = c.scheduledAt?.toDate?.() ?? (c.scheduledAt ? new Date(c.scheduledAt) : null)
    if (!when || Number.isNaN(when.getTime())) continue
    if (!set.has(monthKey(when))) continue
    const status = c.status || 'scheduled'
    if (status !== 'completed' || c.missed) continue
    done++
    byStudent[c.studentId] = byStudent[c.studentId] || { done: 0 }
    byStudent[c.studentId].done++
  }
  return { done, byStudent }
}

// Short label for the period, used in headings and the file name
export function periodLabel(period) {
  if (!period.length) return ''
  if (period.length === 1) return monthLabel(period[0])
  return `${monthLabel(period[0])} to ${monthLabel(period[period.length - 1])}`
}

export function reportFileName(period) {
  if (!period.length) return 'Fee-Report.pdf'
  const clean = s => s.replace(/\s+/g, '-')
  return period.length === 1
    ? `Fee-Report-${clean(monthLabel(period[0]))}.pdf`
    : `Fee-Report-${clean(monthLabel(period[0]))}-to-${clean(monthLabel(period[period.length - 1]))}.pdf`
}

// ─── Classes actually taught in a calendar month ─────────────────────────────
// Credits now run on each student's own clock: somebody who buys three classes
// on the 10th has until the Sunday four weeks later, and somebody who finishes
// them early buys again the same week. So no two students share a "month", and
// counting credit periods would never add up to anything the studio could use.
//
// This counts by the CALENDAR month a class was scheduled in, which is the one
// timeline everybody shares — the answer to "how many classes did we do in
// November, and what came in for them".
//
// A class counts as done when it was completed. A class marked missed is
// deliberately excluded: the lesson did not happen, whatever became of the
// credit. Cancelled and rejected classes never count.
export function monthlyClasses(classes, month, students = null) {
  const byStudent = {}
  let done = 0, missed = 0, upcoming = 0

  const nameOf = (id) => (students || []).find(s => s.id === id)?.name || '—'

  for (const c of classes || []) {
    const when = c.scheduledAt?.toDate?.() ?? (c.scheduledAt ? new Date(c.scheduledAt) : null)
    if (!when || Number.isNaN(when.getTime())) continue
    if (monthKey(when) !== month) continue

    const status = c.status || 'scheduled'
    if (status === 'cancelled' || status === 'rejected') continue

    const row = byStudent[c.studentId] || (byStudent[c.studentId] = {
      id: c.studentId, name: nameOf(c.studentId), done: 0, missed: 0, upcoming: 0,
    })

    if (c.missed) { missed++; row.missed++ }
    else if (status === 'completed') { done++; row.done++ }
    else { upcoming++; row.upcoming++ }
  }

  return {
    month,
    done,
    missed,
    upcoming,
    students: Object.keys(byStudent).length,
    rows: Object.values(byStudent).sort((a, b) =>
      b.done - a.done || String(a.name).localeCompare(String(b.name))),
  }
}
