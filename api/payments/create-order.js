// POST /api/payments/create-order
//
// A student asks to buy classes. WHO comes from their Firebase ID token and is
// never taken from the browser. HOW MANY must be one of the options that
// student is actually offered.
//
// THE AMOUNT IS THE STUDENT'S OWN. The studio agrees each fee privately, so the
// app no longer computes a price — it records what the student says they are
// paying. That is a deliberate choice and it means an underpayment is possible:
// nothing here can tell ₹1500 from ₹1, only that both are numbers. The amount
// is checked for range, written into the order's `notes` server-side, and the
// webhook later confirms the captured payment matches the order it belongs to —
// so the figure cannot be altered between checkout and capture, even though
// nobody is checking whether it was the RIGHT figure to begin with.
import { getAdmin } from '../_lib/firebaseAdmin.js'
import { createOrder, keyId, gatewayReady, isTestMode } from '../_lib/razorpay.js'
import { toPaise } from '../../src/utils/pricing.js'
import { canGrant, usesCredits, classOptions } from '../../src/utils/credits.js'

// Sanity bounds on a hand-typed amount. Not a price — the studio settles fees
// privately and the app does not know them — just the range beyond which a
// number is a typo rather than a payment.
const MIN_RUPEES = 1
const MAX_RUPEES = 200000

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })

  if (!gatewayReady()) {
    return res.status(503).json({ error: 'Online payment is not set up yet.' })
  }

  // No token at all is a 401 whatever else is wrong — checked before anything
  // is initialised, so an unauthenticated probe can't be answered with a 500
  // about the server's own configuration.
  const authz = req.headers.authorization || ''
  const idToken = authz.startsWith('Bearer ') ? authz.slice(7) : null
  if (!idToken) return res.status(401).json({ error: 'unauthorized' })

  try {
    const admin = getAdmin()

    let decoded
    try { decoded = await admin.auth().verifyIdToken(idToken) }
    catch { return res.status(401).json({ error: 'unauthorized' }) }
    const uid = decoded.uid

    const quantity = req.body?.quantity
    if (typeof quantity !== 'number' || !Number.isInteger(quantity)) {
      return res.status(400).json({ error: 'quantity must be a whole number' })
    }

    // The student now says what they are paying. The studio settles each fee
    // privately, so the app no longer knows what a class should cost and does
    // not pretend to — but the number still has to be a sane amount of money,
    // or a typo becomes a ₹1 payment or a ₹900,000 one.
    const rupees = req.body?.amountRupees
    if (typeof rupees !== 'number' || !Number.isInteger(rupees)) {
      return res.status(400).json({ error: 'Enter the amount in whole rupees.' })
    }
    if (rupees < MIN_RUPEES) {
      return res.status(400).json({ error: `The amount must be at least ₹${MIN_RUPEES}.` })
    }
    if (rupees > MAX_RUPEES) {
      return res.status(400).json({ error: `That amount looks wrong — ₹${MAX_RUPEES.toLocaleString('en-IN')} is the most this can take. Please check with the office.` })
    }

    const db = admin.firestore()
    const snap = await db.doc(`users/${uid}`).get()
    if (!snap.exists) return res.status(404).json({ error: 'no such student' })
    const student = { id: uid, ...snap.data() }

    if (student.role !== 'student') {
      return res.status(403).json({ error: 'only students buy their own credits' })
    }
    if (student.isActive === false) {
      return res.status(403).json({ error: 'This account is paused. Please contact the studio.' })
    }
    if (!usesCredits(student)) {
      return res.status(403).json({ error: 'This account does not use credits.' })
    }

    // Only the options this student is actually offered — three classes for an
    // Indian student, up to twelve for one abroad. The browser sends a number,
    // and a number it was never shown is not one to take money for.
    if (!classOptions(student).includes(quantity)) {
      return res.status(400).json({
        error: `${quantity} ${quantity === 1 ? 'class is' : 'classes are'} not an option for this account.`,
      })
    }

    // Would these credits even fit? Taking money for credits they can't hold
    // would be the worst kind of bug. The cap depends on the student, so the
    // profile is passed in.
    const held = await db.collection('credits').where('studentId', '==', uid).get()
    const batches = held.docs.map(d => ({ id: d.id, ...d.data() }))
    const verdict = canGrant(batches, quantity, Date.now(), student)
    if (!verdict.ok) return res.status(409).json({ error: verdict.reason })

    const amountPaise = toPaise(rupees)
    if (amountPaise === null) {
      return res.status(400).json({ error: 'That amount could not be read.' })
    }

    const order = await createOrder({
      amountPaise,
      receipt: `cr_${uid.slice(0, 10)}_${Date.now()}`,
      // The webhook reads these back. They are set here, server-side, which is
      // the whole reason the webhook can believe them.
      notes: {
        studentId: uid,
        quantity: String(quantity),
        studentName: student.name || '',
        rupees: String(rupees),
      },
    })

    return res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      rupees,
      quantity,
      keyId: keyId(),          // public, and the browser needs it to open checkout
      testMode: isTestMode(),
      studentName: student.name || '',
    })
  } catch (e) {
    console.error('create-order failed:', e)
    return res.status(500).json({ error: 'Could not start the payment. Please try again.' })
  }
}
