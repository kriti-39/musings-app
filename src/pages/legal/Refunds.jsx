import LegalPage from './LegalPage'
import { STUDIO } from './studio'

// ─── Refunds and cancellations ───────────────────────────────────────────────
// This page is read more carefully than the other three, by Razorpay and by
// anyone disputing a charge. So it says what the SYSTEM ACTUALLY DOES, checked
// against the code rather than written from a template:
//
//   • classOptions / creditCap  — 1, 2 or 3 classes in India; 1, 4 or 12 abroad
//   • VALIDITY_WEEKS            — 2 weeks for one, 5 for four, 15 for twelve
//   • cancelClassByStudent      — the class credit returns, always
//   • there is NO money-refund path in the code at all
//
// That last point is the one that matters here. A credit coming back is not a
// refund; money leaving the studio's account is, and today that can only
// happen by hand in the Razorpay dashboard. Saying otherwise on this page
// would promise something the app cannot do.
export default function Refunds() {
  return (
    <LegalPage title="Refunds and cancellations" updated="10 November 2026">
      <h2>What you are buying</h2>
      <p>
        Payments on {STUDIO.name} buy <strong>class credits</strong>. One credit books one
        lesson with Guruji. Credits are bought in fixed sizes and are valid for a limited
        period from the date of purchase.
      </p>

      <h2>Cancelling a class</h2>
      <p>
        You may cancel a booked class from your dashboard at any time before it starts.
        <strong> The credit returns to your account</strong> and can be used for another lesson
        within its validity period.
      </p>
      <p>
        We ask for at least <strong>24 hours' notice</strong> so the time can be offered to
        another student. Repeated last-minute cancellations may be discussed with you.
      </p>
      <p>
        If Guruji cancels or cannot take a class, the credit returns to your account in full.
        If your original credit has expired by then, a replacement credit is issued instead.
      </p>

      <h2>How long credits last</h2>
      <ul>
        <li><strong>1 class</strong> — valid 2 weeks</li>
        <li><strong>2 classes</strong> — valid 3 weeks</li>
        <li><strong>3 classes</strong> — valid 4 weeks</li>
        <li><strong>4 classes</strong> — valid 5 weeks</li>
        <li><strong>12 classes</strong> — valid 15 weeks</li>
      </ul>
      <p>
        Validity runs to the end of the final week. Buying more classes while you still hold
        some extends the new ones from the date your current credits run out, so nothing is
        lost by topping up early.
      </p>
      <p>
        <strong>Unused credits expire at the end of their validity period</strong> and are not
        refunded in money. If illness or travel means you cannot use them in time, write to us
        before they expire and we will try to help.
      </p>

      <h2>Refunds in money</h2>
      <p>
        Class credits are generally <strong>not refundable in money</strong> once bought, because
        they can be used for any lesson within their validity and are returned to you whenever a
        class is cancelled.
      </p>
      <p>We will refund a payment in money where:</p>
      <ul>
        <li>you were charged more than once for the same purchase, or charged in error;</li>
        <li>the payment succeeded but the credits never appeared in your account and we cannot
          correct it;</li>
        <li>the studio cannot provide the lessons you have paid for at all.</li>
      </ul>
      <p>
        Write to <a href={`mailto:${STUDIO.email}`}>{STUDIO.email}</a> with the date and amount.
        We respond within <strong>3 working days</strong>. An approved refund is returned to the
        card or account used for the original payment within <strong>5 to 7 working days</strong>,
        and we cannot send it anywhere else.
      </p>
      <p>
        For international cards, your bank's currency conversion means the amount you receive may
        differ slightly from the amount you paid. That difference is set by your bank, not by us.
      </p>

      <h2>If something has gone wrong</h2>
      <p>
        Please write to us before raising a dispute with your bank — almost everything is quicker
        to fix directly. Contact details are at the foot of this page.
      </p>
    </LegalPage>
  )
}
