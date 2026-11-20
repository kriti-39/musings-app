import { useState } from 'react'
import { signOut } from 'firebase/auth'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'

// ─── Agreeing to the terms, once ─────────────────────────────────────────────
// A student is shown this before anything else, the first time they sign in
// and again whenever the terms change in a way worth re-reading (bump
// TERMS_VERSION). Before it existed the Terms said "using the app means
// accepting them" — the weakest kind of agreement there is, because nobody had
// actually been asked.
//
// The same tick carries a parent's consent. Children do not use their own
// accounts here; a parent signs in on their behalf, so the person ticking the
// box is the one able to agree for the child.
//
// The date and the version are written to the student's own profile. The
// security rules accept exactly those two fields and insist the date is the
// server's own clock, so nobody can backdate an agreement.
export const TERMS_VERSION = '2026-11-20'

export default function AgreeToTerms() {
  const { user, refreshUser } = useAuth()
  const [ticked, setTicked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function agree() {
    if (!ticked) return
    setBusy(true)
    setError('')
    try {
      await updateDoc(doc(db, 'users', user.id), {
        termsVersion: TERMS_VERSION,
        termsAcceptedAt: serverTimestamp(),
      })
      await refreshUser()
    } catch (e) {
      console.error('Could not record agreement:', e)
      setError('That did not save. Please check your connection and try again.')
      setBusy(false)
    }
  }

  const link = 'font-medium text-amber-600 underline underline-offset-2 hover:text-amber-700'

  return (
    <div className="min-h-dvh bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm w-full max-w-md p-6">
        <h1 className="text-lg font-semibold text-gray-800">Before you start</h1>
        <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
          Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''}. Please read how the app works and
          how your information is looked after. Each opens in a new tab.
        </p>

        <ul className="mt-4 space-y-2 text-sm">
          <li><a href="/terms" target="_blank" rel="noopener noreferrer" className={link}>Terms and conditions</a></li>
          <li><a href="/privacy" target="_blank" rel="noopener noreferrer" className={link}>Privacy policy</a></li>
          <li><a href="/refunds" target="_blank" rel="noopener noreferrer" className={link}>Refunds and cancellations</a></li>
        </ul>

        <label className="flex items-start gap-3 mt-5 p-3 rounded-xl bg-gray-50 border border-gray-100 cursor-pointer">
          <input type="checkbox" checked={ticked} onChange={e => setTicked(e.target.checked)}
            disabled={busy} className="mt-0.5 w-4 h-4 shrink-0 accent-amber-500" />
          <span className="text-[13px] text-gray-600 leading-relaxed">
            I have read and agree to the Terms and Conditions and the Privacy Policy. If this account is
            for a child, I am their parent or guardian and I agree on their behalf.
          </span>
        </label>

        {error && <p className="text-xs text-red-600 mt-3">{error}</p>}

        <button onClick={agree} disabled={!ticked || busy}
          className="w-full mt-5 h-11 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold disabled:bg-gray-200 disabled:text-gray-400 transition-colors">
          {busy ? 'Saving…' : 'Agree and continue'}
        </button>
        <button onClick={() => signOut(auth)} disabled={busy}
          className="w-full mt-2 h-10 text-[13px] font-medium text-gray-500 hover:text-gray-700">
          Sign out
        </button>
      </div>
    </div>
  )
}
