import { Link } from 'react-router-dom'
import { RiArrowLeftLine } from 'react-icons/ri'
import { STUDIO } from './studio'

// ─── The shell every policy page shares ──────────────────────────────────────
// These four pages exist because Razorpay's banking partners will not enable
// international card payments without them, and they check by OPENING them —
// so unlike every other page in this app they must work signed out. They are
// deliberately plain: no layout chrome, no role, nothing that needs a user.
//
// They are also the only pages a stranger ever reads, so they say who the
// studio is and how to reach it, which is the other half of what the review
// looks for. The way to reach it is the studio's own address and email, never
// a person's number: these are formal documents, and the person answering
// enquiries changes. Their number lives on the login screen and in Help.
export default function LegalPage({ title, updated, children }) {
  return (
    <div className="min-h-dvh bg-gray-50">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center gap-3">
          <Link to="/login" className="p-2 -ml-2 text-gray-400 hover:text-gray-700 transition-colors" aria-label="Back to sign in">
            <RiArrowLeftLine size={18} />
          </Link>
          <span className="text-sm font-semibold text-gray-800">{STUDIO.name}</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-8">
        <h1 className="text-2xl font-semibold text-gray-800">{title}</h1>
        <p className="text-xs text-gray-400 mt-1 mb-8">Last updated {updated}</p>

        <div className="legal-body text-[14.5px] leading-relaxed">
          {children}
        </div>

        <footer className="mt-12 pt-6 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-700 mb-2">Contact</p>
          <address className="text-xs text-gray-500 not-italic leading-relaxed">
            {STUDIO.legalName}<br />
            {STUDIO.address}<br />
            <a href={`mailto:${STUDIO.email}`} className="text-amber-600 hover:underline">{STUDIO.email}</a>
          </address>

          <nav className="flex flex-wrap gap-x-4 gap-y-1 mt-5 text-xs">
            <Link to="/terms" className="text-gray-500 hover:text-amber-600">Terms</Link>
            <Link to="/privacy" className="text-gray-500 hover:text-amber-600">Privacy</Link>
            <Link to="/refunds" className="text-gray-500 hover:text-amber-600">Refunds &amp; cancellations</Link>
            <Link to="/delivery" className="text-gray-500 hover:text-amber-600">Service delivery</Link>
          </nav>
        </footer>
      </main>

      {/* Theme colours only, never fixed ones. The headings and bold words
          used to be hard-coded dark greys, which on a phone in dark mode came
          out dark on dark and all but vanished.

          The text sits on a softly shaded card so it reads as a document, with
          the section headings in the app's own blue for structure. Body text is
          the full ink colour softened a little — comfortable for a long read,
          and still well above the contrast needed in both themes. */}
      <style>{`
        .legal-body {
          color: color-mix(in srgb, var(--color-ink) 86%, var(--color-surface));
          background: var(--color-surface);
          border: 1px solid var(--color-line);
          border-radius: 16px;
          padding: 22px 20px;
        }
        @media (min-width: 640px) { .legal-body { padding: 30px 32px; } }
        .legal-body h2 {
          font-size: 16px; font-weight: 650; color: var(--color-accent);
          margin: 30px 0 10px; padding-top: 22px; border-top: 1px solid var(--color-line);
        }
        .legal-body h2:first-child { margin-top: 0; padding-top: 0; border-top: 0; }
        .legal-body p { margin: 0 0 12px; }
        .legal-body p:last-child { margin-bottom: 0; }
        .legal-body ul { margin: 0 0 12px; padding-left: 20px; list-style: disc; }
        .legal-body ul ul { margin: 6px 0 0; list-style: circle; }
        .legal-body li { margin: 0 0 8px; }
        .legal-body li::marker { color: var(--color-accent); }
        .legal-body strong { color: var(--color-ink); font-weight: 650; }
        .legal-body a { color: var(--color-accent); text-decoration: underline; text-underline-offset: 2px; }
        .legal-body a:hover { text-decoration-thickness: 2px; }
      `}</style>
    </div>
  )
}
