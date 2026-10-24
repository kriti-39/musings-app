import { useState } from 'react'
import { RiCloseLine, RiCheckLine, RiSecurePaymentLine } from 'react-icons/ri'
import { auth } from '../../firebase/config'
import { openCheckout, paymentsAvailableHere } from '../../utils/razorpayCheckout'
import { classOptions, creditExpiry, fmtExpiry, validityLabel } from '../../utils/credits'

// ─── A student buys classes ──────────────────────────────────────────────────
// Asked in CLASSES, not "credits": a credit is the studio's word for it, and
// somebody booking a lesson is thinking about lessons. The options come from
// the student's own account — three for an Indian student, up to twelve for one
// abroad — so nobody is offered a number they cannot have.
//
// The AMOUNT is typed by the student. The studio agrees each fee privately, so
// the app does not know what a class costs and does not guess; it records what
// the student says they are paying. Nothing here can tell a right figure from a
// wrong one, which is why the office reads the monthly report.
//
// It deliberately does NOT claim the credits have arrived when the payment
// sheet says it worked. The browser's word isn't proof — the webhook grants
// them, and the balance on the page is live, so it updates by itself the moment
// that lands. Until then this says "received, appearing shortly", which is the
// truth.
const MIN_RUPEES = 1
const MAX_RUPEES = 200000

export default function BuyCreditsModal({ student, canHold, onClose }) {
  // Only what this student may actually buy, and only what still fits.
  const offered = classOptions(student).filter(n => n <= canHold)

  const [qty, setQty] = useState(offered[0] ?? 1)
  const [amount, setAmount] = useState('')
  const [stage, setStage] = useState('choose')   // choose | working | paid
  const [error, setError] = useState('')

  const rupees = Number(amount)
  const amountOk = Number.isInteger(rupees) && rupees >= MIN_RUPEES && rupees <= MAX_RUPEES

  // The real date, worked out the same way the server will: four weeks for an
  // Indian student, six abroad, then out to the end of that week. Shown before
  // they pay, because "4 weeks" and "until Sunday 22 November" are not equally
  // useful to someone planning lessons.
  const expiry = creditExpiry(new Date(), student, qty)

  async function handlePay() {
    setError('')
    if (!amountOk) {
      setError(`Enter the amount you are paying, in whole rupees (₹${MIN_RUPEES}–₹${MAX_RUPEES.toLocaleString('en-IN')}).`)
      return
    }
    if (!paymentsAvailableHere()) {
      setError('Online payment only works on the deployed app, not the local dev server.')
      return
    }

    setStage('working')
    try {
      // How many, and what they are paying. Who comes from the token.
      const token = await auth.currentUser.getIdToken()
      const res = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ quantity: qty, amountRupees: rupees }),
      })
      const order = await res.json()
      if (!res.ok) throw new Error(order?.error || 'Could not start the payment')

      await openCheckout({
        keyId: order.keyId,
        orderId: order.orderId,
        amountPaise: order.amount,
        studentName: order.studentName,
        description: `${qty} ${qty === 1 ? 'class' : 'classes'}`,
      })

      setStage('paid')
    } catch (e) {
      if (e.cancelled) { setStage('choose'); return }     // they closed the sheet
      console.error('Payment failed:', e)
      setError(e.message || 'That payment did not go through.')
      setStage('choose')
    }
  }

  // ── Paid ───────────────────────────────────────────────────────────────────
  if (stage === 'paid') {
    return (
      <Shell onClose={onClose}>
        <div className="text-center py-2">
          <div className="mx-auto w-14 h-14 rounded-full bg-green-50 text-green-600 flex items-center justify-center mb-4">
            <RiCheckLine size={30} />
          </div>
          <h2 className="text-lg font-semibold text-gray-800">Payment received</h2>
          <p className="text-sm text-gray-500 mt-2">
            Your {qty === 1 ? 'class' : `${qty} classes`} will appear on this page in a
            moment — we wait for the bank to confirm rather than taking the app's word for it.
          </p>
          <button onClick={onClose}
            className="w-full mt-6 bg-amber-500 hover:bg-amber-600 text-white rounded-lg py-2.5 text-sm font-medium">
            Done
          </button>
        </div>
      </Shell>
    )
  }

  // ── Nothing to sell ────────────────────────────────────────────────────────
  if (offered.length === 0) {
    return (
      <Shell title="Buy classes" onClose={onClose}>
        <p className="text-sm text-gray-500">
          You are holding as many classes as you can at once. Use one and you can
          buy more straight away — there is no need to wait for the month to end.
        </p>
        <button onClick={onClose}
          className="w-full mt-5 border border-gray-200 text-gray-600 rounded-lg py-2.5 text-sm hover:bg-gray-50">
          Close
        </button>
      </Shell>
    )
  }

  // ── Choose ─────────────────────────────────────────────────────────────────
  const busy = stage === 'working'
  return (
    <Shell title="Buy classes" onClose={busy ? undefined : onClose}>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">
          How many classes this month?
        </label>
        <div className="flex flex-wrap gap-2">
          {offered.map(n => (
            <button key={n} type="button" onClick={() => setQty(n)} disabled={busy}
              className={`flex-1 min-w-[56px] py-2.5 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50 ${
                qty === n ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-200 text-gray-600 hover:border-amber-300'
              }`}>
              {n}
            </button>
          ))}
        </div>
        {canHold < Math.max(...classOptions(student)) && (
          <p className="text-[11px] text-gray-400 mt-1.5">
            You can hold {canHold} more {canHold === 1 ? 'class' : 'classes'} right now.
          </p>
        )}
      </div>

      <div className="mt-5">
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Amount you are paying (₹)
        </label>
        <input
          type="number" inputMode="numeric" min={MIN_RUPEES} max={MAX_RUPEES}
          value={amount} onChange={e => setAmount(e.target.value)} disabled={busy}
          placeholder="e.g. 1500"
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50"
        />
        <p className="text-[11px] text-gray-400 mt-1.5">
          Whatever you agreed with Guruji for {qty === 1 ? 'this class' : `these ${qty} classes`}.
          If you are unsure of the amount, ask the office before paying.
        </p>
      </div>

      {/* The date, not just the length. Someone planning lessons needs the day
          they run out, and "4 weeks" is not that. */}
      <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
        <p className="text-xs text-amber-900">
          Use {qty === 1 ? 'it' : 'them'} by <span className="font-semibold">{fmtExpiry(expiry)}</span>
        </p>
        <p className="text-[11px] text-amber-700/80 mt-0.5">
          {qty === 1 ? 'This class is' : `These ${qty} classes are`} valid {validityLabel(student, qty)} from today, to the end of that week.
          Use them all sooner and you can buy more right away.
        </p>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mt-4">
          {error}
        </p>
      )}

      <button onClick={handlePay} disabled={busy || !amountOk}
        className="w-full mt-5 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg py-3 text-sm font-semibold disabled:bg-gray-200 disabled:text-gray-400 transition-colors">
        <RiSecurePaymentLine size={17} />
        {busy
          ? 'Opening payment…'
          : amountOk ? `Pay ₹${rupees.toLocaleString('en-IN')}` : 'Enter an amount'}
      </button>

      <p className="text-[11px] text-gray-400 text-center mt-2.5">
        Card, UPI or netbanking. Handled by Razorpay — the studio never sees your card details.
      </p>
    </Shell>
  )
}

function Shell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl max-h-[90dvh] overflow-y-auto">
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">{title}</h2>
            {onClose && (
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <RiCloseLine size={20} />
              </button>
            )}
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
