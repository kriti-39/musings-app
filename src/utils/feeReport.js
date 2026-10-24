// Builds the fee-collection report shown in the modal and written to the PDF.
// Kept free of React and Firebase so the numbers are easy to follow: it takes
// the students and payments the Fees page already loaded, plus the months the
// staff picked, and works out who owes what.

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
export function monthsLabel(list) {
  return (list || []).map(monthLabel).join(', ')
}

// A month counts as paid once a payment covering it is confirmed; a submitted
// but unconfirmed payment is 'pending' — that needs staff action, not chasing.
export function monthStatus(payments, month) {
  const found = (payments || []).find(p => p.months?.includes(month) && p.status !== 'rejected')
  if (!found) return 'unpaid'
  return found.status === 'confirmed' ? 'paid' : 'pending'
}

// ─── WHAT ONE MONTH BROUGHT IN ───────────────────────────────────────────────
// A payment can cover several months at one total. For a per-month figure that
// is SPLIT evenly across the months it covers — ₹6000 for Jun–Aug counts ₹2000
// in each — so the twelve monthly figures add up to the year instead of
// counting the same ₹6000 three times.
//
// (The period report above deliberately does the opposite: there the whole
// payment is counted once across the whole selected range, which is right when
// you're asking "what came in for these months together".)
export function paymentMonthShare(payment, month) {
  const months = (payment?.months || []).filter(Boolean)
  if (!months.includes(month)) return 0
  const amount = Number(payment.amount) || 0
  return months.length > 1 ? amount / months.length : amount
}

export function monthlyCollection(students, paymentsMap, month) {
  const rows = (students || []).map(s => {
    const list = paymentsMap?.[s.id] || []
    let received = 0
    let pending = 0
    for (const p of list) {
      if (p.status === 'rejected') continue
      const share = paymentMonthShare(p, month)
      if (!share) continue
      if (p.status === 'confirmed') received += share
      else pending += share
    }
    // Only a monthly fee can be turned into an expected amount; per-class and
    // flexible students depend on classes taken, so they're left out of the
    // target rather than guessed at.
    const expected = s.feeType === 'monthly' ? Number(s.feeAmount) || 0 : 0
    return {
      id: s.id,
      name: s.name || '—',
      received, pending, expected,
      feeType: s.feeType || '',
      status: received > 0 ? 'paid' : pending > 0 ? 'pending' : 'unpaid',
    }
  })

  const sum = (key) => rows.reduce((t, r) => t + r[key], 0)

  return {
    month,
    rows,
    received: Math.round(sum('received')),
    pending: Math.round(sum('pending')),
    expected: Math.round(sum('expected')),
    paidCount: rows.filter(r => r.status === 'paid').length,
    pendingCount: rows.filter(r => r.status === 'pending').length,
    unpaidCount: rows.filter(r => r.status === 'unpaid').length,
    students: rows.length,
    // Students whose fee can't be turned into a number, so the target is a
    // floor rather than the whole truth.
    expectedUnknown: rows.filter(r => r.feeType && r.feeType !== 'monthly').length,
  }
}

export function buildFeeReport(students, paymentsMap, months) {
  const period = [...(months || [])].sort()

  const rows = (students || []).map(s => {
    const list = paymentsMap?.[s.id] || []
    const paid = []
    const pending = []
    const unpaid = []

    for (const m of period) {
      const st = monthStatus(list, m)
      if (st === 'paid') paid.push(m)
      else if (st === 'pending') pending.push(m)
      else unpaid.push(m)
    }

    // Money actually received for this period. A single payment can cover
    // several months, so each payment is counted once at its full amount.
    let received = 0
    const counted = new Set()
    for (const p of list) {
      if (p.status !== 'confirmed') continue
      if (!p.months?.some(m => period.includes(m))) continue
      if (counted.has(p.id)) continue
      counted.add(p.id)
      received += Number(p.amount) || 0
    }

    // Only a monthly fee can be turned into an amount owed; per-class and
    // flexible students depend on classes taken, so those are left blank
    // rather than guessed at.
    const monthlyFee = s.feeType === 'monthly' ? Number(s.feeAmount) || 0 : 0
    const due = monthlyFee ? monthlyFee * unpaid.length : null

    return {
      id: s.id,
      name: s.name || '—',
      phone: s.phone || '',
      country: s.country || '',
      feeAmount: Number(s.feeAmount) || 0,
      feeType: s.feeType || '',
      paid, pending, unpaid,
      received,
      due,
    }
  })

  const toCollect = rows.filter(r => r.unpaid.length > 0)
    .sort((a, b) => b.unpaid.length - a.unpaid.length || a.name.localeCompare(b.name))
  const awaiting = rows.filter(r => r.pending.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name))
  const settled = rows.filter(r => r.unpaid.length === 0 && r.pending.length === 0 && r.paid.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name))

  return {
    period,
    rows,
    toCollect,
    awaiting,
    settled,
    totals: {
      students: rows.length,
      fullyPaid: settled.length,
      withDues: toCollect.length,
      awaiting: awaiting.length,
      received: rows.reduce((sum, r) => sum + r.received, 0),
      // Only students on a monthly fee contribute a figure here
      outstanding: rows.reduce((sum, r) => sum + (r.due || 0), 0),
      outstandingUnknown: toCollect.filter(r => r.due === null).length,
    },
  }
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
