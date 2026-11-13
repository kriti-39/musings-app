import LegalPage from './LegalPage'
import { STUDIO } from './studio'

// ─── Privacy ─────────────────────────────────────────────────────────────────
// Written from what the app actually stores, not from a template: the fields
// on a user document, the class and credit records, the push tokens, the
// recordings. Anything listed here can be pointed at in the code.
//
// Two things it says that a generic policy would not. Card details genuinely
// never reach this studio — Razorpay's checkout takes them directly — and that
// is worth stating plainly because it is the question people actually have.
// And the students include children, so consent and parental access get a
// section of their own rather than a clause.
export default function Privacy() {
  return (
    <LegalPage title="Privacy policy" updated="10 November 2026">
      <p>
        {STUDIO.name} keeps the smallest amount of information needed to teach you and to keep
        your account working. This page says exactly what that is, who else sees it, and how to
        have it removed.
      </p>

      <h2>What we hold</h2>
      <ul>
        <li><strong>Your account</strong> — name, User ID, contact number, country and timezone.
          Your timezone is used so class times show correctly on your own clock.</li>
        <li><strong>Your classes</strong> — when they are, whether they happened, and Guruji's
          notes on your lessons.</li>
        <li><strong>Your credits and payments</strong> — what was bought, when, and the amount.</li>
        <li><strong>Recordings</strong>, where a lesson was recorded, with the link and passcode.</li>
        <li><strong>A profile photo</strong>, if you add one.</li>
        <li><strong>A device token</strong>, if you turn on notifications, so reminders can reach
          your phone.</li>
      </ul>

      <h2>What we never hold</h2>
      <p>
        <strong>We never see or store your card or bank details.</strong> Payments are taken by
        Razorpay on their own checkout; we receive only confirmation that a payment succeeded and
        the amount. Nothing identifying your card reaches this studio.
      </p>
      <p>We do not sell your information, and we do not use it for advertising.</p>

      <h2>Who else sees it</h2>
      <ul>
        <li><strong>Guruji and the studio office</strong> — your account, classes, credits and
          payments, so lessons can be taught and fees kept straight.</li>
        <li><strong>Other students — no.</strong> Lesson notes, recordings, contact details and
          photographs are not visible to anyone but you and the studio.</li>
        <li><strong>Google Firebase</strong> hosts the app and its database on our behalf.</li>
        <li><strong>Razorpay</strong> processes payments and holds its own record of them.</li>
      </ul>
      <p>
        We share information with anyone else only where the law requires it.
      </p>

      <h2>Students under 18</h2>
      <p>
        Where a student is a child, the account is expected to be set up and overseen by a parent
        or guardian, who may ask to see anything held about their child and may ask for it to be
        corrected or removed. If you believe a child's account has been created without a
        parent's knowledge, write to us and we will remove it.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Account and class records are kept while you are a student and for a reasonable period
        afterwards, so past lessons and payments can still be looked up. Payment records are kept
        as long as tax and accounting rules require. You can ask us to delete your account at any
        time, and we will, apart from records we are obliged to keep.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>Change your name, contact number, photograph or timezone yourself in
          <strong> Settings</strong>.</li>
        <li>Turn class reminders off in <strong>Settings → Notifications</strong>.</li>
        <li>Ask for a copy of what we hold, or ask us to correct or delete it, by writing to
          <a href={`mailto:${STUDIO.email}`}> {STUDIO.email}</a>.</li>
      </ul>

      <h2>Keeping it safe</h2>
      <p>
        Access is protected by your own login and enforced on the server, not merely hidden in the
        app — one student cannot read another's records even deliberately. Lesson notes and
        recordings are held separately from scheduling information so that only you and the studio
        can open them.
      </p>

      <h2>Changes</h2>
      <p>
        If this policy changes in a way that affects you, we will say so in the app. The date at
        the top is always the date of the current version.
      </p>
    </LegalPage>
  )
}
