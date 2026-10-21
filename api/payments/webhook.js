// POST /api/payments/webhook
//
// Razorpay tells us, server to server, that money actually arrived. THIS is
// what grants credits — never the browser. A "payment succeeded" callback in
// the browser is a claim anyone can make; a signed webhook is evidence.
//
// Three things protect this endpoint, and all three matter:
//   1. The signature, checked against the RAW bytes before anything parses them
//   2. Idempotency, so Razorpay's retries can't pay out twice
//   3. Re-checking the amount against what we would have charged
import { getAdmin } from '../_lib/firebaseAdmin.js'
import { verifyWebhookSignature, readRawBody } from '../_lib/razorpay.js'
import { priceFor, toPaise } from '../../src/utils/pricing.js'
import { creditExpiry, validityLabel } from '../../src/utils/credits.js'

// Vercel would otherwise parse the JSON body for us, and parsing destroys the
// exact bytes the signature was computed over.
export const config = { api: { bodyParser: false } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })

  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret) {
    console.error('RAZORPAY_WEBHOOK_SECRET is not set — refusing to trust this webhook')
    return res.status(503).json({ error: 'not configured' })
  }

  let raw
  try { raw = await readRawBody(req) }
  catch (e) {
    console.error('Could not read the webhook body:', e)
    return res.status(400).json({ error: 'bad request' })
  }

  const signature = req.headers['x-razorpay-signature']
  if (!verifyWebhookSignature(raw, signature, secret)) {
    // Not an error on our side — someone sent us something unsigned.
    console.warn('Webhook signature did not verify; ignoring')
    return res.status(400).json({ error: 'bad signature' })
  }

  let event
  try { event = JSON.parse(raw) }
  catch { return res.status(400).json({ error: 'bad json' }) }

  // Only a captured payment means money has actually moved.
  if (event?.event !== 'payment.captured') {
    return res.status(200).json({ ignored: event?.event || 'unknown' })
  }

  const payment = event?.payload?.payment?.entity
  if (!payment?.id) return res.status(200).json({ ignored: 'no payment entity' })

  try {
    const result = await grantForPayment(payment)
    return res.status(200).json(result)
  } catch (e) {
    // A 500 makes Razorpay retry, which is what we want for a transient
    // failure — the idempotency guard makes the retry safe.
    console.error('Webhook handling failed for', payment.id, e)
    return res.status(500).json({ error: 'could not process' })
  }
}

async function grantForPayment(payment) {
  const admin = getAdmin()
  const db = admin.firestore()

  const paymentId = payment.id
  const studentId = payment.notes?.studentId
  const quantity = Number(payment.notes?.quantity)

  if (!studentId || !Number.isInteger(quantity) || quantity < 1) {
    // Someone's payment, but not one of ours — a payment link, say. Recording
    // it as seen stops us looking at it again.
    await db.doc(`gatewayEvents/${paymentId}`).set({
      paymentId, status: 'ignored', reason: 'not a credit purchase',
      seenAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    return { ignored: 'not a credit purchase' }
  }

  // ── Idempotency ────────────────────────────────────────────────────────────
  // Razorpay retries on any non-2xx, and can deliver the same event twice even
  // on success. Claiming the payment id in a transaction means exactly one
  // caller proceeds, however many arrive at once.
  const claimRef = db.doc(`gatewayEvents/${paymentId}`)
  const claimed = await db.runTransaction(async (tx) => {
    const existing = await tx.get(claimRef)
    if (existing.exists) return false
    tx.set(claimRef, {
      paymentId,
      studentId,
      quantity,
      amount: payment.amount,
      status: 'processing',
      seenAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    return true
  })

  if (!claimed) {
    const prior = (await claimRef.get()).data()
    return { duplicate: true, status: prior?.status || 'unknown' }
  }

  const studentSnap = await db.doc(`users/${studentId}`).get()
  if (!studentSnap.exists) {
    await claimRef.update({ status: 'orphaned', reason: 'no such student' })
    return { ignored: 'no such student' }
  }
  const student = { id: studentId, ...studentSnap.data() }

  // ── Did they pay what we asked? ────────────────────────────────────────────
  // The order was created with a server-computed amount, so this should always
  // match. It is checked anyway: if it ever doesn't, something is wrong enough
  // that handing over credits would be the worse mistake.
  const expectedPaise = toPaise(priceFor(student, quantity))
  if (expectedPaise === null || payment.amount < expectedPaise) {
    await claimRef.update({
      status: 'underpaid',
      expected: expectedPaise,
      received: payment.amount,
    })
    console.error(`Payment ${paymentId}: expected ${expectedPaise} paise, got ${payment.amount}`)
    return { ignored: 'amount mismatch' }
  }

  // ── Grant ──────────────────────────────────────────────────────────────────
  const now = new Date()
  const expiresAt = creditExpiry(now, student)
  const rupees = payment.amount / 100

  const paymentRef = db.collection('payments').doc()
  const creditRef = db.collection('credits').doc()
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const batch = db.batch()

  batch.set(paymentRef, {
    studentId,
    amount: rupees,
    method: payment.method || 'online',
    months: [monthKey],
    note: `${quantity} class ${quantity === 1 ? 'credit' : 'credits'} — paid online`,
    status: 'confirmed',
    submittedBy: 'gateway',
    confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
    forCredits: quantity,
    creditBatchId: creditRef.id,
    gatewayPaymentId: paymentId,
    gatewayOrderId: payment.order_id || null,
    hasReceipt: false,
    submittedAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  batch.set(creditRef, {
    studentId,
    quantity,
    used: 0,
    status: 'active',
    expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    validity: validityLabel(student),
    source: 'purchase',
    reason: 'Paid online',
    paymentId: paymentRef.id,
    gatewayPaymentId: paymentId,
    grantedBy: 'gateway',
    grantedByName: 'Online payment',
    grantedAt: admin.firestore.FieldValue.serverTimestamp(),
    extensions: [],
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  batch.update(claimRef, {
    status: 'granted',
    creditBatchId: creditRef.id,
    paymentDocId: paymentRef.id,
    grantedAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  await batch.commit()

  // Telling the student is nice to have; it must never fail the grant, which
  // has already committed by this point.
  try {
    await db.collection('notifications').add({
      userId: studentId,
      type: 'credits_granted',
      title: 'Payment received',
      message: `${quantity} class ${quantity === 1 ? 'credit' : 'credits'} added. Use ${quantity === 1 ? 'it' : 'them'} by ${expiresAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.`,
      relatedClassId: null,
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })
  } catch (e) {
    console.error('Credits granted, notification failed:', e)
  }

  return { granted: quantity, creditBatchId: creditRef.id, paymentId: paymentRef.id }
}
