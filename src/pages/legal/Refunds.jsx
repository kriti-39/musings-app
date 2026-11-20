import LegalPage from './LegalPage'
import { STUDIO } from './studio'

// ─── Refunds and cancellations ───────────────────────────────────────────────
// Read more carefully than the other pages, by Razorpay and by anyone
// disputing a charge, so it states what the SYSTEM ACTUALLY DOES. Re-checked
// against the code on 20 November 2026:
//
//   • a student's cancellation returns the credit into its batch; if that
//     batch has expired since booking, ONE replacement is issued, valid until
//     the cancelled class was due to start (api/classes/cancel.js)
//   • a class that has started cannot be cancelled
//   • the studio cancelling, or a reschedule it cannot accept, returns the
//     credit; an expired one is replaced (refundCreditForClass)
//   • a missed class is flagged for staff to decide
//   • there is NO money-refund path in the code: money only ever goes back by
//     hand, from the Razorpay dashboard or the studio's bank
//
// No credit sizes or validity periods are listed. They differ between
// students, and the page is written so nobody reading it learns which group
// they or anyone else is in. Each student's own dates are shown in the app
// before they buy.
export default function Refunds() {
  return (
    <LegalPage title="Refunds and cancellations" updated="20 November 2026">
      <h2>What you are buying</h2>
      <p>
        Payments to {STUDIO.name} buy <strong>class credits</strong>. One credit books one lesson.
        Each purchase is valid for a set period; the exact date is shown in the app before you pay,
        and again with your balance.
      </p>

      <h2>Cancelling a class</h2>
      <p>
        You can cancel a booked class from your dashboard at any time before it starts.
        <strong> The credit returns to your account</strong> and can be used for another lesson. If
        that credit had already passed its use-by date in the meantime, you receive a replacement that
        lasts until the time of the class you cancelled.
      </p>
      <p>
        We ask for at least <strong>24 hours' notice</strong>, so the time can be offered to another
        student. A class that has already started cannot be cancelled, and its credit counts as used.
      </p>

      <h2>Rescheduling</h2>
      <p>
        If you ask to move a class and the new time cannot be arranged, the class is called off and
        your credit is returned.
      </p>

      <h2>Missed classes</h2>
      <p>
        A class missed without cancelling normally uses its credit. If something unexpected stopped
        you from attending, contact the studio and it will be looked at.
      </p>

      <h2>If the studio cancels</h2>
      <p>
        If Guruji cancels a class, or is unavailable, your credit is returned in full. If the original
        credit has expired by then, a fresh one is issued instead.
      </p>

      <h2>Unused credits</h2>
      <p>
        Credits that are not used before their use-by date <strong>expire</strong> and are not refunded
        in money. If illness, travel or anything else means you cannot use them in time, please contact
        the studio before they expire.
      </p>

      <h2>Refunds in money</h2>
      <p>
        Credits are generally <strong>not refundable in money</strong> once bought, because they are
        returned to you whenever a class is cancelled and can be used for any lesson while they are
        valid. We will refund a payment in money where:
      </p>
      <ul>
        <li>you were charged more than once for the same purchase, or charged in error;</li>
        <li>your payment arrived but no credits were added, and we cannot put that right;</li>
        <li>the studio is unable to provide the lessons you paid for.</li>
      </ul>
      <p>
        To ask for a refund, write to <a href={`mailto:${STUDIO.email}`}>{STUDIO.email}</a> with the
        date and amount of the payment. A refund is always returned to the card or account the payment
        came from, and cannot be sent anywhere else.
      </p>
      <ul>
        <li><strong>Online payments:</strong> once a refund is approved, it usually reaches your account
          within 5 to 7 working days, depending on your bank.</li>
        <li><strong>Bank transfers:</strong> the refund is sent back to the account the payment came
          from, and can take longer. Charges made by banks for sending money between countries, and
          differences in exchange rates, are outside our control and may mean the amount you receive
          differs from the amount you sent.</li>
      </ul>

      <h2>If something has gone wrong</h2>
      <p>
        Please contact us before raising a dispute with your bank; almost everything is quicker to put
        right directly.
      </p>
    </LegalPage>
  )
}
