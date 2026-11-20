import LegalPage from './LegalPage'
import { STUDIO } from './studio'

// ─── Terms ───────────────────────────────────────────────────────────────────
// Re-checked against the app on 20 November 2026. Every rule stated here is
// enforced by the code, most of it by the security rules themselves:
//   • classes of 30, 45 or 60 minutes, on the quarter hour, inside teaching
//     hours, up to seven days ahead (firestore.rules → studentBooking)
//   • two ways to pay: online through Razorpay, or bank transfer followed by a
//     request in the app, where the studio decides what the payment covers
//   • a student's cancellation returns the credit, from the server
//     (api/classes/cancel.js); a class that has started cannot be cancelled
//   • a reschedule the studio cannot accept is called off and refunded
//
// Deliberately generic about who pays which way: nothing here tells a student
// which group they are in or why.
export default function Terms() {
  return (
    <LegalPage title="Terms and conditions" updated="20 November 2026">
      <p>
        These terms cover the use of {STUDIO.name}, the app for booking and managing music lessons
        with Guruji. Using the app means accepting them, together with our{' '}
        <a href="/privacy">privacy policy</a> and our{' '}
        <a href="/refunds">refunds and cancellations</a> policy.
      </p>

      <h2>Your account</h2>
      <p>
        Accounts are created by the studio for students who have agreed to take lessons with Guruji;
        there is no public sign-up. You are given a User ID and a password, and the first time you sign
        in you are asked to agree to these terms. Keep your login to yourself, and tell us if you think
        someone else has it. Anything booked on your account is treated as booked by you.
      </p>
      <p>
        Where the student is a child, the account is set up for, held and used by a parent or guardian,
        who agrees to these terms on the child's behalf.
      </p>

      <h2>Credits</h2>
      <ul>
        <li>Lessons are paid for in advance with <strong>credits</strong>. One credit books one class.</li>
        <li>Credits are valid for a set period. The date yours run until is shown before you buy and
          with your balance. Buying more while you still hold some adds the new time on after the old,
          so nothing is lost by topping up early.</li>
        <li>There is a limit on how many unused credits you can hold at once. The app shows yours, and
          using a credit makes room to buy again straight away.</li>
      </ul>

      <h2>Paying</h2>
      <p>
        Fees are agreed directly between you and Guruji, and so is how any bank or transfer charges
        are shared. Payments are made on that basis. Credits are given for the fee agreed; if anything
        is different, it is settled between you and Guruji.
      </p>
      <p>Depending on how you pay, you will see one of two ways to buy credits in the app:</p>
      <ul>
        <li><strong>Online</strong>, by card, UPI or netbanking, through Razorpay. You enter the
          amount you are paying, and your credits are added as soon as the payment is confirmed.
          We never see your card or bank details.</li>
        <li><strong>By bank transfer.</strong> You send the payment from your bank, then request
          credits in the app, saying how much you sent. The studio checks that the payment has
          arrived and then adds the credits it covers.</li>
      </ul>

      <h2>Booking</h2>
      <ul>
        <li>You can book any free time within the studio's teaching hours, up to a week ahead.</li>
        <li>Classes last 30, 45 or 60 minutes and start on the quarter hour.</li>
        <li>Times are shown in your own timezone, as set in your profile. Keeping it up to date is
          your responsibility.</li>
        <li>A time already taken by another student cannot be booked.</li>
      </ul>

      <h2>Changing, cancelling and missing a class</h2>
      <ul>
        <li><strong>Cancelling:</strong> you may cancel a class at any time before it starts, and the
          credit returns to your account. Please give at least 24 hours' notice so the time can be
          offered to someone else. A class that has already started cannot be cancelled.</li>
        <li><strong>Rescheduling:</strong> you may ask to move a class to another free time. The studio
          confirms the new time; if it cannot be arranged, the class is called off and your credit is
          returned.</li>
        <li><strong>Missing a class:</strong> a class missed without cancelling normally uses its
          credit. If something unexpected stopped you, contact the studio and it will be looked at.</li>
        <li><strong>If the studio cancels</strong>, or is unavailable, your credit is returned in full.</li>
      </ul>

      <h2>Lessons, notes and recordings</h2>
      <p>
        Lessons take place online. Where a lesson is recorded, it is recorded by Guruji with the
        student's agreement and shared with that student. Lesson notes and recordings are provided{' '}
        <strong>for your own study only</strong>. They remain the property of the studio and must not
        be shared, published, sold or reposted. Not every lesson is recorded; those that are stay
        available in your account.
      </p>

      <h2>Conduct</h2>
      <p>
        Please be on time and treat Guruji and the studio with courtesy. We may pause or close an
        account for abusive behaviour, repeated missed classes, or any attempt to interfere with the
        app or other students' information. If an account is closed, any unused credits are settled
        directly between the student and Guruji.
      </p>

      <h2>What we can and cannot promise</h2>
      <p>
        We work to keep the app available and lessons running, but cannot promise it will never be
        unavailable: internet failures, power cuts and illness happen. Where a lesson cannot go ahead
        for a reason on the studio's side, your credit is returned; beyond that, the studio's
        responsibility is limited to the amount you paid for the lessons affected. A lesson missed for a
        reason on your side, including your own connection, is treated as a missed class.
      </p>
      <p>
        The app is for booking and managing lessons. Please do not rely on it for anything urgent.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We may update these terms. If a change affects you, we will say so in the app, and for a
        significant change you will be asked to agree again when you next sign in. Continuing to use the
        app after a change means you accept the updated terms. The date at the top is always the date of
        the current version.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of India, and the courts of {STUDIO.jurisdiction} have
        jurisdiction over any dispute.
      </p>
    </LegalPage>
  )
}
