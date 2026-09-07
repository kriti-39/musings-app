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
