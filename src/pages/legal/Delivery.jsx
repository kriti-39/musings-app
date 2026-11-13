import LegalPage from './LegalPage'
import { STUDIO } from './studio'

// ─── "Shipping" policy, for a studio that ships nothing ──────────────────────
// Razorpay's checklist asks for a shipping policy because it was written for
// shops. For a service there is nothing to ship, and the reviewer is really
// asking the same underlying question: once somebody pays, what do they get,
// how soon, and how do they get it? That is what this answers — and saying so
// plainly reads better than a shipping policy pretending lessons come by post.
export default function Delivery() {
  return (
    <LegalPage title="Service delivery" updated="10 November 2026">
      <h2>Nothing is shipped</h2>
      <p>
        {STUDIO.name} provides <strong>online music lessons</strong>. There are no physical goods,
        so nothing is posted or delivered to an address.
      </p>

      <h2>What happens when you pay</h2>
      <p>
        Payment buys class credits. Credits are added to your account
        <strong> immediately after the payment is confirmed</strong> — usually within a few
        seconds. You will see the new balance on your dashboard without needing to refresh.
      </p>
      <p>
        If a payment succeeds but your balance has not changed within a few minutes, do not pay
        again. Write to <a href={`mailto:${STUDIO.email}`}>{STUDIO.email}</a> and we will sort it
        out.
      </p>

      <h2>How lessons are delivered</h2>
      <ul>
        <li>You book a class yourself from the app, choosing any free time.</li>
        <li>The lesson is taught <strong>online, over a video call</strong>. The joining details
          are shared with you before the class.</li>
        <li>Where a recording is made, it appears under <strong>Recordings</strong> in your
          account, with its passcode.</li>
      </ul>

      <h2>When lessons are available</h2>
      <p>
        Teaching hours are set by the studio and shown in the app in <strong>your own
        timezone</strong>, so you never have to convert them yourself. Students outside India see
        the same lessons at their local times.
      </p>
      <p>
        Classes can be booked up to a week ahead. Days the studio is closed are marked on the
        calendar.
      </p>

      <h2>If a class cannot go ahead</h2>
      <p>
        If Guruji has to cancel, you are told in the app and your credit returns to your account
        for use another time. See our <a href="/refunds">refunds and cancellations</a> page.
      </p>
    </LegalPage>
  )
}
