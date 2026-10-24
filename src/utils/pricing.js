// ─── What credits cost ───────────────────────────────────────────────────────
// Deliberately free of imports so the Vercel functions can use the exact same
// file the app does. The SERVER is the authority: the browser never sends an
// amount, only a student and a number of credits, and this works out the rest.
// Anything else and a student could edit the price on the way through.

// Explicit .js extension, unlike the rest of src/ — this file is imported by
// the Vercel functions too, and Node's ESM loader doesn't guess extensions the
// way Vite does. Vite is happy with either.
// Deliberately NOT the credit cap any more. The cap is per student (three in
// India, twelve abroad) while "what a month costs" is still four classes for
// the studio's own arithmetic. Tying the two together made one of them wrong.

// A month's fee buys a month's classes. The studio charges per month and caps
// credits at four, so one credit is a quarter of the monthly fee.
export const CREDITS_PER_MONTH = 4

// Price in whole rupees for `quantity` credits, for this student.
// Returns null when it can't be worked out — which must be treated as "ask an
// admin", never as "free".
export function priceFor(student, quantity) {
  // Strict about the type, not just the value. A string would coerce — and
  // '0x10' coerces to 16 — which is not a surprise worth having in the one
  // function that decides what to charge someone.
  if (typeof quantity !== 'number' || !Number.isInteger(quantity)) return null
  const qty = quantity
  if (qty < 1 || qty > CREDITS_PER_MONTH) return null

  const fee = Number(student?.feeAmount)
  if (!Number.isFinite(fee) || fee <= 0) return null

  switch (student?.feeType) {
    case 'monthly':
      // Rounded on the total, not per credit, so buying 1+3 costs the same as 4
      return Math.round((fee * qty) / CREDITS_PER_MONTH)
    case 'per_class':
      return Math.round(fee * qty)
    default:
      // 'flexible' and anything unrecognised have no formula — a human decides
      return null
  }
}

// Razorpay counts in paise, and only in whole paise.
export function toPaise(rupees) {
  const n = Number(rupees)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

export function fromPaise(paise) {
  const n = Number(paise)
  if (!Number.isFinite(n)) return null
  return n / 100
}

// Razorpay rejects very small amounts; ₹1 is the practical floor. The studio's
// minimum concession was set at ₹1, so this is also the lowest real price.
export const MIN_RUPEES = 1

export function priceProblem(student, quantity) {
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) {
    return 'Choose how many credits to buy.'
  }
  if (quantity > CREDITS_PER_MONTH) return `You can hold at most ${CREDITS_PER_MONTH} credits.`

  const fee = Number(student?.feeAmount)
  if (!Number.isFinite(fee) || fee <= 0) {
    return 'No fee is set on this profile yet — please contact the studio.'
  }
  if (student?.feeType !== 'monthly' && student?.feeType !== 'per_class') {
    return 'This student’s fee is arranged individually — please contact the studio.'
  }
  const price = priceFor(student, quantity)
  if (price === null || price < MIN_RUPEES) {
    return 'That amount cannot be charged — please contact the studio.'
  }
  return null
}

// "4 credits · ₹1,500"
export function priceLabel(student, quantity) {
  const price = priceFor(student, quantity)
  if (price === null) return ''
  return `₹${price.toLocaleString('en-IN')}`
}
