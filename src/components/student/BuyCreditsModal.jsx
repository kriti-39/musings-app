import { useState } from 'react'
import { RiCloseLine, RiCheckLine, RiSecurePaymentLine, RiErrorWarningLine } from 'react-icons/ri'
import { auth } from '../../firebase/config'
import { openCheckout, paymentsAvailableHere } from '../../utils/razorpayCheckout'
import { MAX_CREDITS, creditsWord, validityLabel } from '../../utils/credits'
import { priceFor, priceProblem } from '../../utils/pricing'

// ─── A student buys credits ──────────────────────────────────────────────────
// Deliberately does NOT claim the credits have arrived when the payment sheet
// says it worked. The browser's word isn't proof — the webhook grants them,
// and the balance on the page is live, so it updates by itself the moment that
// lands. Until then this says "received, appearing shortly", which is the
// truth.
export default function BuyCreditsModal({ student, canHold, onClose }) {
  const [qty, setQty] = useState(Math.min(canHold || 1, MAX_CREDITS))
  const [stage, setStage] = useState('choose')   // choose | working | paid
  const [error, setError] = useState('')

  const options = Array.from({ length: Math.max(canHold, 0) }, (_, i) => i + 1)
  const price = priceFor(student, qty)
  const problem = priceProblem(student, qty)

  async function handlePay() {
    setError('')
    if (!paymentsAvailableHere()) {
      setError('Online payment only works on the deployed app, not the local dev server.')
      return
    }

    setStage('working')
    try {
      // The server decides the price. We send only how many.
      const token = await auth.currentUser.getIdToken()
      const res = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ quantity: qty }),
      })
      const order = await res.json()
      if (!res.ok) throw new Error(order?.error || 'Could not start the payment')

      await openCheckout({
        keyId: order.keyId,
        orderId: order.orderId,
        amountPaise: order.amount,
        studentName: order.studentName,
        description: `${qty} class ${creditsWord(qty)}`,
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
            Your {qty} {creditsWord(qty)} will appear on this page in a moment — we wait for
            the bank to confirm rather than taking the app's word for it.
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
  if (canHold <= 0) {
    return (
      <Shell title="Buy credits" onClose={onClose}>
        <p className="text-sm text-gray-500">
          You already hold the maximum of {MAX_CREDITS} credits. You can buy more once
          you've used some.
        </p>
        <button onClick={onClose}
          className="w-full mt-5 border border-gray-200 text-gray-600 rounded-lg py-2.5 text-sm hover:bg-gray-50">
          Close
        </button>
      </Shell>
    )
  }

  // ── Can't price it ─────────────────────────────────────────────────────────
  if (problem) {
    return (
      <Shell title="Buy credits" onClose={onClose}>
        <p className="text-sm text-gray-600 flex items-start gap-2">
          <RiErrorWarningLine size={16} className="shrink-0 mt-0.5 text-amber-500" />
          {problem}
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
    <Shell title="Buy credits" onClose={busy ? undefined : onClose}>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">How many classes</label>
        <div className="flex gap-2">
          {options.map(n => (
            <button key={n} type="button" onClick={() => setQty(n)} disabled={busy}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50 ${
                qty === n ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-200 text-gray-600 hover:border-amber-300'
              }`}>
              {n}
            </button>
          ))}
        </div>
        {canHold < MAX_CREDITS && (
          <p className="text-[11px] text-gray-400 mt-1.5">
            You can hold {canHold} more right now.
          </p>
        )}
      </div>

      <div className="mt-5 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-gray-600">{qty} {creditsWord(qty)}</span>
          <span className="text-xl font-semibold text-gray-800 tabular-nums">
            ₹{price.toLocaleString('en-IN')}
          </span>
        </div>
        <p className="text-[11px] text-gray-400 mt-1">
          Valid for {validityLabel(student)} from the moment they're added.
        </p>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mt-4">
          {error}
        </p>
      )}

      <button onClick={handlePay} disabled={busy}
        className="w-full mt-5 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg py-3 text-sm font-semibold disabled:opacity-50 transition-colors">
        <RiSecurePaymentLine size={17} />
        {busy ? 'Opening payment…' : `Pay ₹${price.toLocaleString('en-IN')}`}
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
