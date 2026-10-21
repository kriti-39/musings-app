import { useState, useEffect } from 'react'
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
  const full = summary.canHold === 0

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
    <div className={`credit-card ${tone} rounded-2xl px-4 py-3`}>
      {/* The count and the actions share a line, and the "Class credits"
          eyebrow is gone — "3 credits left" already says it. That removes two
          rows from what was the tallest thing on the page. */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-1.5 min-w-0">
          <RiTicketLine size={15} className="c-note shrink-0 self-center" />
          <span className="c-value text-2xl font-semibold leading-none tabular-nums">
            {summary.available}
          </span>
          <span className="c-label text-sm truncate">
            {creditsWord(summary.available)} left
          </span>
        </div>

        {/* No Book button here. Every screen that shows this card already has
            one directly above it, and two of the same button stacked is just
            a question about which one is the real one.

            Buy always keeps its place — it used to disappear at the cap,
            which left this side of the card blank and gave no hint why. */}
        <button
          onClick={() => setBuying(true)}
          disabled={full}
          title={full ? `You already hold the maximum of ${MAX_CREDITS} credits` : undefined}
          className={`shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-opacity ${
            full ? 'c-btn--off' : `hover:opacity-90 ${none ? 'c-btn' : 'c-btn--ghost'}`
          }`}
        >
          Buy credits
        </button>
      </div>

      {/* Pips and the use-by date share the last row: four pips is the whole
          allowance, so it reads at a glance, and the date earns no line of
          its own. */}
      <div className="flex items-center gap-2.5 mt-2.5">
        {!none && (
          <div className="flex gap-1 shrink-0 w-20">
            {Array.from({ length: MAX_CREDITS }, (_, i) => (
              <span key={i} className={`c-pip h-1 flex-1 rounded-full ${
                i < summary.available ? 'c-pip--on' : ''
              }`} />
            ))}
          </div>
        )}

        {none ? (
          <p className="c-note text-[11px] flex items-center gap-1.5 min-w-0">
            <RiErrorWarningLine size={12} className="shrink-0" />
            <span className="truncate">You'll need credits before you can book.</span>
          </p>
        ) : (
          <p className={`c-note text-[11px] flex items-center gap-1 min-w-0 ${soon ? 'font-semibold' : ''}`}>
            <RiTimeLine size={11} className="shrink-0" />
            <span className="truncate">
              {summary.nextExpiryCount === summary.available
                ? `Use by ${fmtExpiry(summary.nextExpiry)}`
                : `${summary.nextExpiryCount} by ${fmtExpiry(summary.nextExpiry)}`}
              {summary.nextExpiryDays === 0 && ' — today'}
              {/* Says why Buy is unavailable, so a greyed button isn't a puzzle */}
              {full && ` · ${MAX_CREDITS} is the most you can hold`}
            </span>
          </p>
        )}
      </div>

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
