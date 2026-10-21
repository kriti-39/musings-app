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

  // The card's gradient carries the state: cerulean while there is room,
  // warm when they are nearly out, neon red at zero. The red appears often
  // this way and still means the same thing every time.
  const tone = none ? 'credit-card--empty' : soon ? 'credit-card--soon' : ''

  if (compact) {
    return (
      <div className={`credit-card ${tone} flex items-center gap-2 rounded-xl px-3 py-2`}>
        <RiTicketLine size={15} className="c-note shrink-0" />
        <span className="c-value text-xs font-semibold tabular-nums">
          {summary.available} {creditsWord(summary.available)}
        </span>
        {summary.nextExpiry && (
          <span className="c-label text-[11px]">· use by {fmtExpiry(summary.nextExpiry)}</span>
        )}
      </div>
    )
  }

  return (
    <div className={`credit-card ${tone} rounded-2xl p-4`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="c-label text-xs font-medium flex items-center gap-1.5">
            <RiTicketLine size={13} /> Class credits
          </p>

          <div className="flex items-baseline gap-1.5 mt-1.5">
            <span className="c-value text-4xl font-semibold leading-none tabular-nums">
              {summary.available}
            </span>
            <span className="c-label text-sm">
              {creditsWord(summary.available)} left
            </span>
          </div>

          {none ? (
            <p className="c-note text-xs mt-2 flex items-start gap-1.5">
              <RiErrorWarningLine size={13} className="shrink-0 mt-0.5" />
              You'll need credits before you can book.
            </p>
          ) : (
            <p className={`c-note text-xs mt-2 flex items-center gap-1.5 ${soon ? 'font-medium' : ''}`}>
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
              className="c-btn px-4 py-2 rounded-lg text-xs font-semibold text-center transition-opacity hover:opacity-90">
              Book
            </Link>
          )}
          {summary.canHold > 0 && (
            <button onClick={() => setBuying(true)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-opacity hover:opacity-90 ${
                none ? 'c-btn' : 'c-btn--ghost'
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
            <span key={i} className={`c-pip h-1.5 flex-1 rounded-full ${
              i < summary.available ? 'c-pip--on' : ''
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
