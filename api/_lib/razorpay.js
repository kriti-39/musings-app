// ─── Razorpay, behind a seam ─────────────────────────────────────────────────
// Everything that talks to the gateway lives here, so the endpoints stay about
// the studio's rules and can be tested without a network or an account.
//
// Two separate secrets, easily confused:
//   RAZORPAY_KEY_SECRET     — signs the browser's payment callback
//   RAZORPAY_WEBHOOK_SECRET — signs Razorpay's server-to-server webhook
// They are different strings and are NOT interchangeable.
import crypto from 'node:crypto'

const API = 'https://api.razorpay.com/v1'

export function keyId() {
  return process.env.RAZORPAY_KEY_ID || ''
}

// True when the gateway is configured at all. Lets the app show "payment isn't
// set up yet" rather than failing with a stack trace.
export function gatewayReady() {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
}

// Test keys are prefixed rzp_test_; live ones rzp_live_. Worth surfacing so
// nobody discovers in production that they shipped test keys, or vice versa.
export function isTestMode() {
  return keyId().startsWith('rzp_test_')
}

function authHeader() {
  const pair = `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
  return `Basic ${Buffer.from(pair).toString('base64')}`
}

// ─── Orders ──────────────────────────────────────────────────────────────────

// Create an order for an exact amount in paise. `notes` ride along with the
// payment and come back on the webhook — that's how we know, server-side, who
// the money was for and what it was meant to buy, without trusting the browser.
export async function createOrder({ amountPaise, receipt, notes = {} }) {
  if (!Number.isInteger(amountPaise) || amountPaise < 100) {
    throw new Error(`Refusing to create an order for ${amountPaise} paise`)
  }

  const res = await fetch(`${API}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
    body: JSON.stringify({
      amount: amountPaise,
      currency: 'INR',
      receipt: String(receipt).slice(0, 40),   // Razorpay caps this at 40 chars
      notes,
      payment_capture: 1,
    }),
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = body?.error?.description || `Razorpay returned ${res.status}`
    const err = new Error(msg)
    err.status = res.status
    err.razorpay = body?.error || null
    throw err
  }
  return body
}

// ─── Signatures ──────────────────────────────────────────────────────────────

// Constant-time compare. A plain === leaks, through timing, how much of a
// forged signature was correct, which is enough to guess one byte at a time.
function sameSecret(a, b) {
  const x = Buffer.from(String(a), 'utf8')
  const y = Buffer.from(String(b), 'utf8')
  if (x.length !== y.length) return false
  return crypto.timingSafeEqual(x, y)
}

export function hmacHex(payload, secret) {
  return crypto.createHmac('sha256', String(secret)).update(payload).digest('hex')
}

// The browser's success callback. Razorpay signs `orderId|paymentId` with the
// KEY SECRET. Worth checking, but it is NOT proof of payment on its own —
// only the webhook is. Treat a pass here as "probably fine, show a tick".
export function verifyPaymentSignature({ orderId, paymentId, signature }, secret) {
  if (!orderId || !paymentId || !signature || !secret) return false
  return sameSecret(hmacHex(`${orderId}|${paymentId}`, secret), signature)
}

// The webhook. Razorpay signs the EXACT raw request body with the WEBHOOK
// SECRET. The body must be the untouched bytes — parsing and re-serialising
// JSON changes key order and whitespace, and the signature then never matches.
export function verifyWebhookSignature(rawBody, signature, secret) {
  if (!rawBody || !signature || !secret) return false
  return sameSecret(hmacHex(rawBody, secret), signature)
}

// Vercel parses JSON bodies by default, which destroys the bytes the signature
// was computed over. Endpoints that verify a signature must disable that and
// read the stream themselves.
export async function readRawBody(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}
