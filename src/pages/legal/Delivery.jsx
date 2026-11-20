import LegalPage from './LegalPage'
import { STUDIO } from './studio'

// ─── "Shipping" policy, for a studio that ships nothing ──────────────────────
// Razorpay's checklist asks for a shipping policy because it was written for
// shops. For a service the real question is the same: once somebody pays, what
// do they get, how soon, and how? Re-checked against the app on 20 November
// 2026, including the bank-transfer route, where credits arrive only after the
// studio has seen the money land.
export default function Delivery() {
  return (
    <LegalPage title="Service delivery" updated="20 November 2026">
      <h2>Nothing is shipped</h2>
      <p>
        {STUDIO.name} provides <strong>online music lessons</strong>. There are no physical goods, so
        nothing is posted or delivered to an address.
      </p>

      <h2>What happens when you pay</h2>
      <p>Payment buys class credits, which appear in your account:</p>
      <ul>
        <li><strong>Online payments</strong> — as soon as the payment is confirmed, usually within a
          few seconds. Your balance updates on its own; there is no need to refresh.</li>
        <li><strong>Bank transfers</strong> — once you have requested credits in the app and the
          studio has seen the payment arrive. A transfer from another country can take a few days to
          reach the studio's bank.</li>
      </ul>
      <p>
        If an online payment succeeds but your balance has not changed within a few minutes, please do
        not pay again. Write to <a href={`mailto:${STUDIO.email}`}>{STUDIO.email}</a> and we will
        sort it out.
      </p>

      <h2>How lessons are delivered</h2>
      <ul>
        <li>You book each class yourself in the app, choosing any free time.</li>
        <li>Lessons are taught <strong>online, over a video call</strong>. Guruji shares the joining
          details with you.</li>
        <li>Where a lesson is recorded, the recording appears under <strong>Recordings</strong> in your
          account.</li>
      </ul>

      <h2>When lessons are available</h2>
      <p>
        The studio sets its teaching hours, and the app shows them in <strong>your own
        timezone</strong>, so you never have to convert anything yourself. Classes can be booked up to a
        week ahead. Days the studio is closed are marked on the calendar.
      </p>

      <h2>If a class cannot go ahead</h2>
      <p>
        If Guruji has to cancel, you are told in the app and your credit returns to your account. See
        our <a href="/refunds">refunds and cancellations</a> page.
      </p>
    </LegalPage>
  )
}
