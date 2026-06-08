const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

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
