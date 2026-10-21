// ─── Razorpay Checkout, loaded on demand ─────────────────────────────────────
// The script is ~100KB and most people never buy credits in a given session,
// so it's fetched the first time someone actually opens the payment sheet
// rather than on every page load.

const SRC = 'https://checkout.razorpay.com/v1/checkout.js'
let loading = null

export function loadCheckout() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay)
  if (loading) return loading

  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SRC
    script.async = true
    script.onload = () => {
      if (window.Razorpay) resolve(window.Razorpay)
      else reject(new Error('Razorpay loaded but did not register'))
    }
    script.onerror = () => {
      loading = null                 // let a later attempt retry
      reject(new Error('Could not reach the payment provider'))
    }
    document.head.appendChild(script)
  })
  return loading
}

// Open the payment sheet. Resolves with what the browser was told, which is
// NOT proof of payment — the webhook decides that. Resolving here only means
// "the sheet closed saying it worked", which is enough to show a tick and
// start waiting for the credits to appear.
export async function openCheckout({
  keyId, orderId, amountPaise, studentName, description, onDismiss,
}) {
  const Razorpay = await loadCheckout()

  return new Promise((resolve, reject) => {
    const rzp = new Razorpay({
      key: keyId,
      order_id: orderId,
      amount: amountPaise,
      currency: 'INR',
      name: "Deva's Classes",
      description,
      prefill: { name: studentName || '' },
      theme: { color: '#f59e0b' },     // the studio's amber
      handler: (response) => resolve(response),
      modal: {
        ondismiss: () => {
          onDismiss?.()
          reject(Object.assign(new Error('Payment cancelled'), { cancelled: true }))
        },
      },
    })

    // A declined card or a failed UPI mandate — the sheet stays open for
    // another go, so this is reported without closing anything.
    rzp.on('payment.failed', (response) => {
      reject(Object.assign(
        new Error(response?.error?.description || 'That payment did not go through'),
        { failed: true, code: response?.error?.code },
      ))
    })

    rzp.open()
  })
}

// The dev server has no /api functions, so there is nothing to create an order
// with. Saying so beats a confusing network error.
export function paymentsAvailableHere() {
  return !!import.meta.env.PROD
}
