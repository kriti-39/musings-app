// POST /api/payments/create-order
//
// A student asks to buy credits. The browser sends only WHO (via their Firebase
// ID token) and HOW MANY — never an amount. The price is worked out here from
// the student's own profile, and the studentId and quantity are written into
// the order's `notes` so the webhook can trust them later without believing
// anything the browser says.
import { getAdmin } from '../_lib/firebaseAdmin.js'
import { createOrder, keyId, gatewayReady, isTestMode } from '../_lib/razorpay.js'
import { priceFor, priceProblem, toPaise } from '../../src/utils/pricing.js'
import { canGrant, usesCredits } from '../../src/utils/credits.js'

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

    // Would these credits even fit? Taking money for credits they can't hold
    // would be the worst kind of bug.
    const held = await db.collection('credits').where('studentId', '==', uid).get()
    const batches = held.docs.map(d => ({ id: d.id, ...d.data() }))
    const verdict = canGrant(batches, quantity)
    if (!verdict.ok) return res.status(409).json({ error: verdict.reason })

    const problem = priceProblem(student, quantity)
    if (problem) return res.status(409).json({ error: problem })

    const rupees = priceFor(student, quantity)
    const amountPaise = toPaise(rupees)

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
