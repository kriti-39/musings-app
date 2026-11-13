import LegalPage from './LegalPage'
import { STUDIO } from './studio'

export default function Terms() {
  return (
    <LegalPage title="Terms and conditions" updated="10 November 2026">
      <p>
        These terms cover the use of {STUDIO.name}, the booking app for music lessons with Guruji.
        Using the app means accepting them.
      </p>

      <h2>Your account</h2>
      <p>
        Accounts are created by the studio, not by signing up. You are given a User ID and a
        password; keep them to yourself, and tell us if you think someone else has them. Lessons
        booked on your account are treated as booked by you.
      </p>
      <p>
        Where the student is a child, the account is held and overseen by a parent or guardian.
      </p>

      <h2>Booking lessons</h2>
      <ul>
        <li>One credit books one lesson. Credits must be bought before booking.</li>
        <li>You can book any free time inside the studio's teaching hours, up to a week ahead.</li>
        <li>A time already taken by another student cannot be booked — one lesson per slot.</li>
        <li>Times are shown in your own timezone.</li>
      </ul>

      <h2>Paying</h2>
      <p>
        Fees are agreed with you privately and entered when you buy. Payments are taken by
        Razorpay; we do not see your card details. Credits are added to your account as soon as
        the payment is confirmed.
      </p>
      <p>
        How long credits last, and when money is returned, are set out on our
        <a href="/refunds"> refunds and cancellations</a> page, which forms part of these terms.
      </p>

      <h2>Changing or cancelling</h2>
      <p>
        You may cancel a class before it starts; the credit returns to your account. We ask for at
        least 24 hours' notice. You may also ask to move a class, which Guruji confirms if the new
        time is free.
      </p>
      <p>
        If the studio has to cancel, your credit returns in full.
      </p>

      <h2>Lessons, notes and recordings</h2>
      <p>
        Lesson notes and any recordings are provided <strong>for your own study only</strong>. They
        remain the property of the studio and must not be shared, published, sold or reposted. A
        recording is made only where Guruji chooses to make one; none is guaranteed.
      </p>

      <h2>Conduct</h2>
      <p>
        Please attend on time and treat Guruji and the studio with courtesy. We may pause or close
        an account for abusive behaviour, repeated no-shows, or attempts to interfere with the app
        or other students' information. Where an account is closed by us, unused credits are dealt
        with under the refunds policy.
      </p>

      <h2>What we can and cannot promise</h2>
      <p>
        We work to keep the app available and the lessons running, but we cannot promise it will
        never be unavailable — internet failures, power cuts and illness happen. Where a lesson
        cannot go ahead for any reason, your credit is returned; beyond that, the studio's
        responsibility is limited to the amount you have paid for the lessons affected.
      </p>
      <p>
        The app is for booking and managing lessons. It is not a general communication service and
        should not be relied on for anything urgent.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We may update these terms. Where a change affects you, we will say so in the app. The date
        at the top is always the date of the current version.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of India, and the courts of {STUDIO.jurisdiction} have
        jurisdiction over any dispute.
      </p>
    </LegalPage>
  )
}
