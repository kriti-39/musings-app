import { useState, useEffect, useCallback } from 'react'
import {
  RiAddLine, RiTimeLine, RiCloseLine, RiCalendarCheckLine, RiAlertLine, RiHistoryLine,
} from 'react-icons/ri'
import { useAuth } from '../../context/AuthContext'
import {
  loadCredits, extendCredits, revokeCredits,
} from '../../firebase/credits'
import { grantCreditsWithPayment } from '../../firebase/db'
import {
  creditSummary, validityLabel, isIndianStudent, usesCredits,
  batchRemaining, daysLeft, creditsWord, daysWord, expiresWord, fmtExpiry, toDate, creditExpiry,
  creditsNeedPayment, paymentProblem,
} from '../../utils/credits'
import ConfirmDialog from './ConfirmDialog'

// How long an extension adds. Offered as taps because an admin on a phone
// shouldn't have to work out a date.
const EXTEND_PRESETS = [
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '1 month', months: 1 },
]

// ─── The studio's view of one student's credits ──────────────────────────────
// Guruji and admins both see the balance and the history; only an admin can
// grant, extend or take back — that control was asked to sit in one pair of
// hands.
export default function CreditsCard({ student, onChange, openGrantSignal = 0 }) {
  const { user, role } = useAuth()
  const isAdmin = role === 'admin'

  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showGrant, setShowGrant] = useState(false)
  const [extending, setExtending] = useState(null)   // the batch being extended
  const [revoking, setRevoking] = useState(null)
  const [showHistory, setShowHistory] = useState(false)

  const studentId = student?.id

  const refresh = useCallback(async () => {
    if (!studentId) return
    try {
      // Staff devices sweep lapsed batches but never notify — the student's own
      // app tells them, so they hear it once.
      const { batches: list } = await loadCredits(studentId)
      setBatches(list)
    } catch (e) {
      console.error('Credits failed to load:', e)
      setError('Could not load credits.')
    } finally {
      setLoading(false)
    }
  }, [studentId])

  useEffect(() => { refresh() }, [refresh])

  // The Payments section lower down the page can ask for this dialog, so both
  // places lead to the same grant flow instead of two that drift apart.
  useEffect(() => {
    if (openGrantSignal > 0 && isAdmin) { setShowGrant(true); setError('') }
  }, [openGrantSignal, isAdmin])

  // The student decides the cap, so it is passed in — without it this reads
  // India's limit of three for everybody.
  const summary = creditSummary(batches, Date.now(), student)
  const live = summary.liveBatches
  const past = batches
    .filter(b => !live.some(l => l.id === b.id))
    .sort((a, b) => (b.grantedAt?.seconds ?? 0) - (a.grantedAt?.seconds ?? 0))

  async function run(fn) {
    setBusy(true)
    setError('')
    try {
      await fn()
      await refresh()
      onChange?.()
      return true
    } catch (e) {
      console.error(e)
      // The payment may already be on the books even though the credits aren't —
      // say so, or someone will record it twice.
      setError(e?.paymentRecorded
        ? `${e.message} The ₹${e.paymentRecorded} payment HAS been recorded — don't enter it again, just add the credits once there's room.`
        : (e?.message || 'That did not work. Please try again.'))
      return false
    } finally {
      setBusy(false)
    }
  }

  // A student who was never put on the credit system books the old way, so
  // showing them a balance of zero would just be confusing.
  if (!usesCredits(student)) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-5 mb-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Class credits</h2>
            <p className="text-xs text-gray-400 mt-1">
              This student is on the earlier arrangement and books without credits.
              Switch them over from Edit when they're ready.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-5 mb-5">
        <p className="text-sm text-gray-400">Loading credits…</p>
      </div>
    )
  }

  const toneRing = summary.available === 0
    ? 'border-red-100'
    : summary.expiringSoon ? 'border-amber-200' : 'border-gray-100'

  return (
    <div className={`bg-white rounded-xl border ${toneRing} mb-5`}>
      {/* Balance */}
      <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-800">Class credits</h2>
          <div className="flex items-baseline gap-1.5 mt-1.5">
            <span className={`text-3xl font-semibold leading-none tabular-nums ${
              summary.available === 0 ? 'text-red-500' : 'text-gray-800'
            }`}>
              {summary.available}
            </span>
            <span className="text-sm text-gray-400">/ {summary.cap} held</span>
          </div>

          {summary.nextExpiry ? (
            <p className={`text-xs mt-2 flex items-center gap-1 ${
              summary.expiringSoon ? 'text-amber-600 font-medium' : 'text-gray-400'
            }`}>
              <RiTimeLine size={12} className="shrink-0" />
              {summary.nextExpiryCount} {creditsWord(summary.nextExpiryCount)}{' '}
              {expiresWord(summary.nextExpiryCount)} {fmtExpiry(summary.nextExpiry)}
              {summary.nextExpiryDays === 0
                ? ' — today'
                : summary.nextExpiryDays > 0
                  ? ` · ${summary.nextExpiryDays} ${daysWord(summary.nextExpiryDays)} left`
                  : ''}
            </p>
          ) : (
            <p className="text-xs text-gray-400 mt-2">Nothing live — add credits when they pay.</p>
          )}

          {/* India / abroad decides the window. Staff-side only, by design. */}
          <p className="text-[11px] text-gray-400 mt-1.5">
            {isIndianStudent(student) ? 'India' : 'Overseas'} · credits last {validityLabel(student)}
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => { setShowGrant(true); setError('') }}
            disabled={summary.atCap}
            title={summary.atCap ? `Already holding the most allowed (${summary.cap})` : 'Add credits'}
            className="shrink-0 flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 disabled:text-gray-400 text-white px-3.5 py-2 rounded-lg text-xs font-medium transition-colors"
          >
            <RiAddLine size={14} /> Add
          </button>
        )}
      </div>

      {error && (
        <p className="mx-5 mb-4 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Live batches */}
      {live.length > 0 && (
        <div className="border-t border-gray-50">
          {live.map(b => {
            const left = batchRemaining(b)
            const dl = daysLeft(b)
            return (
              <div key={b.id} className="px-5 py-3.5 border-t border-gray-50 first:border-t-0 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-gray-800">
                    <span className="font-medium tabular-nums">{left}</span> of {b.quantity} left
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Until {fmtExpiry(toDate(b.expiresAt))}
                    {dl === 0 ? ' · today' : ` · ${dl} ${daysWord(dl)}`}
                    {b.extensions?.length ? ` · extended ${b.extensions.length}×` : ''}
                  </p>
                  {b.reason && <p className="text-[11px] text-gray-400 mt-0.5 italic truncate">{b.reason}</p>}
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => { setExtending(b); setError('') }}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors">
                      <RiCalendarCheckLine size={13} /> Extend
                    </button>
                    <button onClick={() => { setRevoking(b); setError('') }}
                      title="Take this grant back"
                      className="p-1.5 text-gray-300 hover:text-red-500 transition-colors">
                      <RiCloseLine size={16} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Footnote + history */}
      <div className="px-5 py-3 border-t border-gray-50 flex items-center justify-between gap-3">
        <p className="text-[11px] text-gray-400">
          {summary.totalUsed} used · {summary.totalGranted} granted
          {summary.totalLapsed > 0 && ` · ${summary.totalLapsed} expired unused`}
        </p>
        {past.length > 0 && (
          <button onClick={() => setShowHistory(h => !h)}
            className="flex items-center gap-1 text-[11px] font-medium text-gray-400 hover:text-gray-700 transition-colors">
            <RiHistoryLine size={12} /> {showHistory ? 'Hide' : `History (${past.length})`}
          </button>
        )}
      </div>

      {showHistory && past.length > 0 && (
        <div className="border-t border-gray-50">
          {past.map(b => (
            <div key={b.id} className="px-5 py-2.5 border-t border-gray-50 first:border-t-0 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-gray-500">
                  {b.quantity} {creditsWord(b.quantity)} · {b.used} used
                  {b.source === 'refund' && <span className="text-gray-400"> · refund</span>}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {STATUS_WORD[b.status] || b.status} · {fmtExpiry(toDate(b.expiresAt))}
                </p>
              </div>
              {/* An expired batch with credits still in it can be revived — that
                  is exactly what "extendable" is for. */}
              {isAdmin && b.status === 'expired' && batchRemaining(b) > 0 && (
                <button onClick={() => { setExtending(b); setError('') }}
                  className="shrink-0 px-2.5 py-1 text-[11px] text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors">
                  Revive
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showGrant && (
        <GrantModal
          student={student}
          summary={summary}
          busy={busy}
          onClose={() => setShowGrant(false)}
          onGrant={async (qty, reason, amount, method) => {
            const ok = await run(() => grantCreditsWithPayment({
              studentId, student, quantity: qty, amount, method, note: reason,
              staffId: user?.id, staffName: user?.name || '',
            }))
            if (ok) setShowGrant(false)
          }}
        />
      )}

      {extending && (
        <ExtendModal
          batch={extending}
          busy={busy}
          onClose={() => setExtending(null)}
          onExtend={async (opts, reason) => {
            const ok = await run(() => extendCredits(extending.id, opts, user?.id, reason))
            if (ok) setExtending(null)
          }}
        />
      )}

      {revoking && (
        <ConfirmDialog
          title="Take these credits back?"
          message={`${batchRemaining(revoking)} unused ${creditsWord(batchRemaining(revoking))} will be removed. Use this for a grant made by mistake, or a payment that never arrived. The record is kept.`}
          confirmLabel="Take back"
          variant="danger"
          loading={busy}
          onConfirm={async () => {
            const ok = await run(() => revokeCredits(revoking.id, user?.id, 'Removed by admin'))
            if (ok) setRevoking(null)
          }}
          onCancel={() => setRevoking(null)}
        />
      )}
    </div>
  )
}

const STATUS_WORD = {
  exhausted: 'All used',
  expired: 'Expired',
  revoked: 'Taken back',
  active: 'Active',
}

// ─── Add credits ─────────────────────────────────────────────────────────────

const METHODS = ['cash', 'upi', 'bank_transfer', 'other']

function GrantModal({ student, summary, busy, onClose, onGrant }) {
  // Default to filling them up to the cap — the usual case is a month's fees.
  const [qty, setQty] = useState(summary.canHold || 1)
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState(false)
  // What this student is meant to pay, filled in for you and still editable —
  // the agreed fee isn't always the amount actually handed over.
  const [amount, setAmount] = useState(student?.feeAmount ? String(student.feeAmount) : '')
  const [method, setMethod] = useState('cash')

  const expiry = creditExpiry(new Date(), student)
  const options = Array.from({ length: summary.canHold }, (_, i) => i + 1)
  const paid = Number(amount) || 0
  // Payment before credits, unless this student is one the studio settles with
  // outside the app. The data layer refuses either way; this is so the office
  // sees why before they tap.
  const exempt = !creditsNeedPayment(student)
  const payBlocked = paymentProblem(student, amount)

  return (
    <Modal title="Add credits" onClose={onClose}>
      <p className="text-xs text-gray-500">
        {student?.name} holds {summary.available} of {summary.cap}.
        {summary.canHold < summary.cap && ` You can add up to ${summary.canHold}.`}
      </p>

      <div className="mt-4">
        <label className="block text-xs font-medium text-gray-600 mb-2">How many</label>
        <div className="flex gap-2">
          {options.map(n => (
            <button key={n} type="button" onClick={() => setQty(n)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                qty === n ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-200 text-gray-600 hover:border-amber-300'
              }`}>
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Amount paid (₹)</label>
          <input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="0"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Method</label>
          <select value={method} onChange={e => setMethod(e.target.value)} disabled={paid <= 0}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50">
            {METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
          </select>
        </div>
      </div>
      <p className="text-[11px] text-gray-400 mt-1.5">
        {student?.feeAmount
          ? `${student.name?.split(' ')[0] || 'This student'}'s fee is ₹${student.feeAmount}. `
          : 'No fee set on this profile. '}
        {paid > 0
          ? 'This is recorded as a confirmed payment against this month.'
          : exempt
            ? 'This student is set up to be given credits without a payment recorded here.'
            : 'Credits are added once the money is in — enter what was paid.'}
      </p>

      {payBlocked && (
        <p className="text-[11px] text-red-600 mt-1.5">{payBlocked}</p>
      )}

      <div className="mt-4">
        <label className="block text-xs font-medium text-gray-600 mb-1">Note (optional)</label>
        <input value={reason} onChange={e => setReason(e.target.value)}
          placeholder="e.g. October fees"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
      </div>

      <div className="mt-4 bg-amber-50 rounded-lg px-3 py-2.5">
        <p className="text-xs text-amber-800">
          Valid for {validityLabel(student)} — until <span className="font-semibold">{fmtExpiry(expiry)}</span>
        </p>
        <p className="text-[11px] text-amber-700/70 mt-0.5">
          The student is told straight away. You can extend this later.
        </p>
      </div>

      <Actions busy={busy} onClose={onClose} disabled={!!payBlocked}
        label={paid > 0 ? `Add ${qty} · ₹${paid}` : `Add ${qty} ${creditsWord(qty)}`}
        onGo={() => { if (!payBlocked) setConfirming(true) }} />

      {/* A deliberate second look. Granting credits takes money and hands over
          classes in one step, and the quantity and amount are both a tap away
          from being wrong. */}
      {confirming && (
        <ConfirmDialog
          title={`Add ${qty} ${creditsWord(qty)} for ${student?.name?.split(' ')[0] || 'this student'}?`}
          message={
            (paid > 0
              ? `₹${paid.toLocaleString('en-IN')} will be recorded as received by ${method.replace('_', ' ')}, already confirmed. `
              : 'No payment is being recorded — this student is settled with outside the app. ') +
            `The credits are valid until ${fmtExpiry(expiry)}, and the student is told straight away.`
          }
          confirmLabel={paid > 0 ? `Add ${qty} · ₹${paid}` : `Add ${qty}`}
          variant="primary"
          loading={busy}
          onConfirm={() => onGrant(qty, reason, paid, method)}
          onCancel={() => setConfirming(false)}
        />
      )}
    </Modal>
  )
}

// ─── Extend a batch ──────────────────────────────────────────────────────────

function ExtendModal({ batch, busy, onClose, onExtend }) {
  const [preset, setPreset] = useState(0)        // index, or -1 for a chosen date
  const [until, setUntil] = useState('')
  const [reason, setReason] = useState('')

  const current = toDate(batch.expiresAt)
  const lapsed = batch.status === 'expired'
  const left = batchRemaining(batch)

  // The earliest a date can be set to is tomorrow — anything else wouldn't be
  // an extension.
  const minDate = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()

  const opts = preset === -1
    ? { until }
    : EXTEND_PRESETS[preset].months
      ? { months: EXTEND_PRESETS[preset].months }
      : { days: EXTEND_PRESETS[preset].days }

  const ready = preset !== -1 || !!until

  return (
    <Modal title={lapsed ? 'Revive these credits' : 'Extend the period'} onClose={onClose}>
      <p className="text-xs text-gray-500">
        {left} {creditsWord(left)} · {lapsed ? 'expired' : 'expires'} {fmtExpiry(current)}
      </p>

      {lapsed && (
        <p className="mt-3 text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2 flex items-start gap-1.5">
          <RiAlertLine size={13} className="shrink-0 mt-0.5" />
          These had already lapsed. Extending brings them back and the student is told.
        </p>
      )}

      <div className="mt-4">
        <label className="block text-xs font-medium text-gray-600 mb-2">
          Add time {lapsed && <span className="text-gray-400 font-normal">from today</span>}
        </label>
        <div className="flex gap-2">
          {EXTEND_PRESETS.map((p, i) => (
            <button key={p.label} type="button" onClick={() => setPreset(i)}
              className={`flex-1 py-2.5 rounded-lg text-xs font-medium border transition-colors ${
                preset === i ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-200 text-gray-600 hover:border-amber-300'
              }`}>
              + {p.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setPreset(-1)}
          className={`mt-2 w-full py-2 rounded-lg text-xs font-medium border transition-colors ${
            preset === -1 ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-200 text-gray-600 hover:border-amber-300'
          }`}>
          Pick a date
        </button>
        {preset === -1 && (
          <input type="date" value={until} min={minDate} onChange={e => setUntil(e.target.value)}
            className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        )}
      </div>

      <div className="mt-4">
        <label className="block text-xs font-medium text-gray-600 mb-1">Why (optional)</label>
        <input value={reason} onChange={e => setReason(e.target.value)}
          placeholder="e.g. Guruji was travelling"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
      </div>

      {/* Past extensions, so an admin can see this isn't the fifth time */}
      {batch.extensions?.length > 0 && (
        <div className="mt-4 border-t border-gray-50 pt-3">
          <p className="text-[11px] font-medium text-gray-400 mb-1.5">
            Extended {batch.extensions.length} time{batch.extensions.length > 1 ? 's' : ''} already
          </p>
          {batch.extensions.slice(-3).map((x, i) => (
            <p key={i} className="text-[11px] text-gray-400">
              → {fmtExpiry(toDate(x.to))}{x.reason ? ` · ${x.reason}` : ''}
            </p>
          ))}
        </div>
      )}

      <Actions busy={busy} onClose={onClose} disabled={!ready}
        label={lapsed ? 'Revive' : 'Extend'}
        onGo={() => onExtend(opts, reason)} />
    </Modal>
  )
}

// ─── Shared modal chrome ─────────────────────────────────────────────────────

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <RiCloseLine size={20} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

function Actions({ busy, disabled, onClose, onGo, label }) {
  return (
    <div className="flex gap-3 mt-5">
      <button type="button" onClick={onClose} disabled={busy}
        className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2.5 text-sm hover:bg-gray-50 disabled:opacity-50">
        Cancel
      </button>
      <button type="button" onClick={onGo} disabled={busy || disabled}
        className="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50">
        {busy ? 'Saving…' : label}
      </button>
    </div>
  )
}
