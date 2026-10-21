import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { RiTicketLine, RiTimeLine, RiErrorWarningLine } from 'react-icons/ri'
import { useAuth } from '../../context/AuthContext'
import { subscribeStudentCredits, expireStaleCredits } from '../../firebase/credits'
import {
  creditSummary, usesCredits, creditsWord, fmtExpiry, MAX_CREDITS,
} from '../../utils/credits'
import BuyCreditsModal from './BuyCreditsModal'

// ─── A student's own credit balance ──────────────────────────────────────────
// Live, because credits change from the other side: Guruji's office adds them
// after a payment, returns one when a class is called off, or extends the date.
// A stale number here is the one thing that would make a student doubt the
// whole arrangement.
//
// What a student never sees: the India/overseas label behind their validity
// window. They see their dates; they don't see themselves sorted into a group.
export default function CreditBalance({ compact = false, onCount }) {
  const { user } = useAuth()
  // null until the first snapshot lands, so nothing renders a misleading zero
  const [batches, setBatches] = useState(null)
  const [buying, setBuying] = useState(false)
  const onCredits = usesCredits(user)

  useEffect(() => {
    if (!user?.id || !onCredits) return
    return subscribeStudentCredits(
      user.id,
      // This is the student's own device, so this is where an expiry
      // notification belongs — they hear it once, from here.
      list => setBatches(expireStaleCredits(list, { notifyStudentId: user.id })),
      e => { console.error('Credits failed to load:', e); setBatches([]) },
    )
  }, [user, onCredits])

  const ready = !onCredits || batches !== null
  const summary = creditSummary(batches || [])

  // Let the page above react (Book a Class is disabled at zero)
  useEffect(() => {
    if (ready) onCount?.(summary.available)
  }, [ready, summary.available, onCount])

  // Students on the earlier arrangement have no balance to show.
  if (!onCredits || !ready) return null

  const none = summary.available === 0
  const soon = summary.expiringSoon

  const tone = none
    ? 'bg-red-50 border-red-100'
    : soon ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'

  if (compact) {
    return (
      <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${tone}`}>
        <RiTicketLine size={15} className={none ? 'text-red-500' : 'text-amber-600'} />
        <span className="text-xs font-medium text-gray-800 tabular-nums">
          {summary.available} {creditsWord(summary.available)}
        </span>
        {summary.nextExpiry && (
          <span className="text-[11px] text-gray-400">· use by {fmtExpiry(summary.nextExpiry)}</span>
        )}
      </div>
    )
  }

  return (
    <div className={`rounded-xl border p-4 ${tone}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
            <RiTicketLine size={13} /> Class credits
          </p>

          <div className="flex items-baseline gap-1.5 mt-1.5">
            <span className={`text-3xl font-semibold leading-none tabular-nums ${
              none ? 'text-red-500' : 'text-gray-800'
            }`}>
              {summary.available}
            </span>
            <span className="text-sm text-gray-400">
              {creditsWord(summary.available)} left
            </span>
          </div>

          {none ? (
            <p className="text-xs text-red-600 mt-2 flex items-start gap-1.5">
              <RiErrorWarningLine size={13} className="shrink-0 mt-0.5" />
              You'll need credits before you can book.
            </p>
          ) : (
            <p className={`text-xs mt-2 flex items-center gap-1.5 ${
              soon ? 'text-amber-700 font-medium' : 'text-gray-400'
            }`}>
              <RiTimeLine size={12} className="shrink-0" />
              {summary.nextExpiryCount === summary.available
                ? `Use by ${fmtExpiry(summary.nextExpiry)}`
                : `${summary.nextExpiryCount} of them by ${fmtExpiry(summary.nextExpiry)}`}
              {summary.nextExpiryDays === 0 && ' — today'}
            </p>
          )}
        </div>

        <div className="shrink-0 flex flex-col gap-2">
          {!none && (
            <Link to="/student/book"
              className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-xs font-semibold text-center transition-colors">
              Book
            </Link>
          )}
          {summary.canHold > 0 && (
            <button onClick={() => setBuying(true)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                none
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : 'border border-amber-200 text-amber-700 hover:bg-amber-50'
              }`}>
              Buy credits
            </button>
          )}
        </div>
      </div>

      {/* A quiet row of pips — four is the whole allowance, so it reads at a glance */}
      {!none && (
        <div className="flex gap-1.5 mt-3">
          {Array.from({ length: MAX_CREDITS }, (_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${
              i < summary.available ? (soon ? 'bg-amber-400' : 'bg-amber-500') : 'bg-gray-200'
            }`} />
          ))}
        </div>
      )}

      {/* The balance above is live, so credits appear here by themselves the
          moment the webhook grants them — no refresh, no polling. */}
      {buying && (
        <BuyCreditsModal
          student={user}
          canHold={summary.canHold}
          onClose={() => setBuying(false)}
        />
      )}
    </div>
  )
}
