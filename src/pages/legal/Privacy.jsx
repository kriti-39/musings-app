import LegalPage from './LegalPage'
import { STUDIO } from './studio'

// ─── Privacy ─────────────────────────────────────────────────────────────────
// Written from what the app actually stores, and re-checked against it on
// 18 November 2026: the fields on a user document, classes and their notes,
// credits, payments and transfer requests, notifications, push tokens, the
// studio's own attendance notes, and the per-account counters used to stop
// abuse. Everything listed here can be pointed at in the code, and nothing the
// code keeps is left off.
//
// Facts it relies on, so they can be checked again when things change:
//   • Firestore lives in asia-south1 (Mumbai).
//   • The website and its server functions run on Vercel, which by default
//     serves them from outside India.
//   • From Razorpay the webhook keeps the amount, the method and Razorpay's own
//     payment and order ids — never a card number, UPI id or bank account.
//   • Students can read their own notes and recordings, and staff can read
//     everyone's. No student can read another's notes, recordings, payments,
//     contact details or photo. Class TIMES are visible to other signed-in
//     users, without names, so the calendar can show what is taken.
//
// It names no person to contact. The studio's email is the address for
// questions about data; whoever answers it may change, and the policy should
// not have to.
export default function Privacy() {
  return (
    <LegalPage title="Privacy policy" updated="18 November 2026">
      <p>
        {STUDIO.name} keeps only what it needs to teach you, run your account and keep track of
        fees. This page sets out exactly what that is, where it is kept, who else can see it, and
        how to have it changed or removed.
      </p>

      <h2>What we hold</h2>
      <ul>
        <li><strong>Your account</strong> — your name, User ID, phone number, country and
          timezone, and your gender if you choose to give it. Your timezone is used so that class
          times appear correctly on your own clock.</li>
        <li><strong>Your classes</strong> — when they are, whether they took place, and lesson
          notes written for you.</li>
        <li><strong>Recordings</strong> of lessons, where a lesson was recorded, with their link
          and passcode.</li>
        <li><strong>Your credits and payments</strong> — what you bought and when, the amount, how
          it was paid (for example card, UPI or bank transfer) and the payment provider's reference
          for it.</li>
        <li><strong>Bank transfer requests</strong> — if you pay by bank transfer, the amount,
          currency and any note you send with your request.</li>
        <li><strong>Notes the studio keeps for planning</strong>, such as how regularly lessons
          are attended.</li>
        <li><strong>A profile photo</strong>, if you add one.</li>
        <li><strong>Notifications and reminders</strong> — the messages sent to you in the app,
          your reminder settings, and, if you turn on notifications, a token that lets them reach
          your device.</li>
        <li><strong>Security records</strong> — limited technical information, such as how often
          an account has used certain features, which helps us prevent misuse.</li>
      </ul>

      <h2>What we never hold</h2>
      <p>
        <strong>We never see or store your card number, UPI ID or bank account details.</strong>{' '}
        Online payments are taken by Razorpay on their own secure page. We receive confirmation
        that the payment succeeded, the amount, the type of payment and Razorpay's reference, and
        nothing more.
      </p>
      <p>We do not sell your information, and we do not use it for advertising.</p>

      <h2>Who can see it</h2>
      <ul>
        <li><strong>The studio</strong> — Guruji and the staff who run the studio can see your
          account, classes, notes, credits and payments, so that lessons can be taught and fees
          kept in order.</li>
        <li><strong>Other students cannot</strong> see your notes, recordings, payments, contact
          details or photo. The booking calendar shows other students which times are already
          taken, but never who has taken them.</li>
        <li><strong>Service providers</strong> that run parts of the app for us, and only for that
          purpose:
          <ul>
            <li><strong>Google Firebase</strong> — stores your records, handles signing in, and
              delivers notifications.</li>
            <li><strong>Vercel</strong> — hosts the website and the services behind it.</li>
            <li><strong>Razorpay</strong> — processes online payments and keeps its own record of
              them under its own privacy policy.</li>
          </ul>
        </li>
        <li><strong>WhatsApp</strong>, only if you choose to contact the studio through the
          WhatsApp button. That conversation takes place on WhatsApp and is covered by WhatsApp's
          own privacy policy.</li>
      </ul>
      <p>We share information with anyone else only where the law requires it.</p>

      <h2>Where it is kept</h2>
      <p>
        Your records are stored in <strong>India</strong>, on Google's servers in Mumbai. The
        website and the services that connect to them are run by Vercel, whose servers may be
        located outside India, so your information may pass through them on its way to and from
        your device.
      </p>

      <h2>Students under 18</h2>
      <p>
        Where a student is a child, the account is expected to be set up and overseen by a parent
        or guardian, who may ask to see anything held about their child and ask for it to be
        corrected or removed. If you believe a child's account has been created without a parent's
        knowledge, write to us and we will remove it.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep your records while you are a student and for a reasonable time afterwards, so that
        past lessons and payments can still be looked up. Payment records are kept for as long as
        tax and accounting rules require. You can ask us to delete your account at any time and we
        will, apart from records we are required by law to keep.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>Change your name, phone number, photo or timezone yourself in <strong>Settings</strong>.</li>
        <li>Turn notifications and reminders off in <strong>Settings → Notifications</strong>.</li>
        <li>Ask for a copy of what we hold about you, or ask us to correct or delete it, by writing
          to <a href={`mailto:${STUDIO.email}`}>{STUDIO.email}</a>.</li>
      </ul>

      <h2>Keeping it safe</h2>
      <p>
        Access is controlled by your own login and enforced on our servers, not merely hidden in
        the app. Lesson notes and recordings are kept separately from the class timetable, so only
        you and the studio can open them.
      </p>

      <h2>Questions or concerns</h2>
      <p>
        If you have a question or a concern about how your information is handled, write to{' '}
        <a href={`mailto:${STUDIO.email}`}>{STUDIO.email}</a>. We will look into it and reply.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If this policy changes in a way that affects you, we will say so in the app. The date at
        the top is always the date of the current version.
      </p>
    </LegalPage>
  )
}
