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
// looks for.
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

        <div className="legal-body text-sm text-gray-600 leading-relaxed">
          {children}
        </div>

        <footer className="mt-12 pt-6 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-700 mb-2">Contact</p>
          <address className="text-xs text-gray-500 not-italic leading-relaxed">
            {STUDIO.legalName}<br />
            {STUDIO.address}<br />
            <a href={`mailto:${STUDIO.email}`} className="text-amber-600 hover:underline">{STUDIO.email}</a>
            {STUDIO.phone && <> · {STUDIO.phone}</>}
          </address>

          <nav className="flex flex-wrap gap-x-4 gap-y-1 mt-5 text-xs">
            <Link to="/terms" className="text-gray-500 hover:text-amber-600">Terms</Link>
            <Link to="/privacy" className="text-gray-500 hover:text-amber-600">Privacy</Link>
            <Link to="/refunds" className="text-gray-500 hover:text-amber-600">Refunds &amp; cancellations</Link>
            <Link to="/delivery" className="text-gray-500 hover:text-amber-600">Service delivery</Link>
          </nav>
        </footer>
      </main>

      <style>{`
        .legal-body h2 { font-size: 15px; font-weight: 600; color: #1f2937; margin: 28px 0 8px; }
        .legal-body h2:first-child { margin-top: 0; }
        .legal-body p { margin: 0 0 12px; }
        .legal-body ul { margin: 0 0 12px; padding-left: 20px; list-style: disc; }
        .legal-body li { margin: 0 0 6px; }
        .legal-body strong { color: #374151; font-weight: 600; }
      `}</style>
    </div>
  )
}
