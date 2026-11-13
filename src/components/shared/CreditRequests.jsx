import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { RiBankLine, RiCloseLine, RiCheckLine } from 'react-icons/ri'
import { useAuth } from '../../context/AuthContext'
import { getUser, grantCreditsWithPayment } from '../../firebase/db'
import { loadCredits } from '../../firebase/credits'
import {
  getPendingCreditRequests, resolveCreditRequest, fmtAsk,
} from '../../firebase/creditRequests'
import {
  creditSummary, creditExpiry, fmtExpiry, validityLabel, creditsWord, paymentProblem,
} from '../../utils/credits'
import ConfirmDialog from './ConfirmDialog'

// ─── Transfers waiting to be matched ─────────────────────────────────────────
// A student abroad has said "I sent this much". Nothing has been granted and
// nothing is on the books yet. Whoever answers checks the bank, then decides
// how many credits it covers — the student never names a number.
//
// Shown to Guruji and the office alike, because either may be the one who sees
// the money arrive. Renders nothing at all when no request is waiting, so a
// studio with only Indian students never sees this.
export default function CreditRequests({ onChange }) {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [allotting, setAllotting] = useState(null)
  const [declining, setDeclining] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const reqs = await getPendingCreditRequests()
      const withStudents = await Promise.all(reqs.map(async r => ({
        ...r, student: await getUser(r.studentId).catch(() => null),
      })))
      setRows(withStudents)
    } catch (e) {
      console.error('Credit requests failed to load:', e)
    }
  }, [])

  useEffect(() => {
    let live = true
    getPendingCreditRequests()
      .then(reqs => Promise.all(reqs.map(async r => ({
        ...r, student: await getUser(r.studentId).catch(() => null),
      }))))
      .then(list => { if (live) setRows(list) })
      .catch(e => console.error('Credit requests failed to load:', e))
    return () => { live = false }
  }, [])

  async function decline() {
    setBusy(true)
    setError('')
    try {
      await resolveCreditRequest(declining.studentId, { status: 'declined', staffId: user?.id })
      setDeclining(null)
      await load()
      onChange?.()
    } catch (e) {
      console.error('Could not decline the request:', e)
      setError('Could not decline. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (rows.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-amber-100">
      <div className="px-5 py-4 border-b border-gray-50">
        <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <RiBankLine size={15} className="text-amber-600" /> Bank transfers to check
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Check the bank first, then decide how many credits the payment covers.
        </p>
      </div>

      {error && <p className="px-5 py-2 text-xs text-red-600">{error}</p>}

      <div>
        {rows.map(r => (
          <div key={r.id} className="px-4 py-3 flex items-center justify-between gap-3 border-t border-gray-100 first:border-t-0">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{r.student?.name || 'Student'}</p>
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                Says they sent <span className="font-semibold text-gray-700">{fmtAsk(r)}</span>
              </p>
              {r.note && <p className="text-xs text-gray-400 truncate">{r.note}</p>}
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => setAllotting(r)}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs hover:bg-green-100 transition-colors">
                <RiCheckLine size={13} /> <span className="whitespace-nowrap">Allot credits</span>
              </button>
              <button onClick={() => setDeclining(r)}
                className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs hover:bg-red-100 transition-colors">
                <RiCloseLine size={13} /> <span className="whitespace-nowrap">Not received</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {allotting && (
        <AllotModal
          request={allotting}
          staff={user}
          onClose={() => setAllotting(null)}
          onDone={async () => { setAllotting(null); await load(); onChange?.() }}
        />
      )}

      {declining && (
        <ConfirmDialog
          title={`Tell ${declining.student?.name?.split(' ')[0] || 'this student'} it has not arrived?`}
          message={`No credits are added. They are told the studio could not match a transfer of ${fmtAsk(declining)}, and they can send a new request once it has been sorted out.`}
          confirmLabel="Not received"
          loading={busy}
          onConfirm={decline}
          onCancel={() => setDeclining(null)}
        />
      )}
    </div>
  )
}

// ─── Deciding what a transfer is worth ───────────────────────────────────────
// The number of credits is chosen HERE, by staff, and nowhere else. The amount
// recorded is the rupees that actually reached the bank, typed by whoever
// checked — not the figure the student reported, which is in another currency
// and is only a claim until the statement agrees with it.
function AllotModal({ request, staff, onClose, onDone }) {
  const student = request.student
  const [summary, setSummary] = useState(null)
  const [qty, setQty] = useState(1)
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    loadCredits(request.studentId)
      .then(({ batches }) => { if (live) setSummary(creditSummary(batches, Date.now(), student)) })
      .catch(e => { console.error('Credits failed to load:', e); if (live) setError('Could not load this student’s credits.') })
    return () => { live = false }
  }, [request.studentId, student])

  const canHold = summary?.canHold ?? 0
  const options = Array.from({ length: canHold }, (_, i) => i + 1)
  const paid = Number(amount) || 0
  const payBlocked = paymentProblem(student, amount)
  const expiry = summary ? creditExpiry(summary.topUpFrom || new Date(), student, qty) : null

  async function go() {
    if (payBlocked || !summary || qty < 1 || qty > canHold) return
    setBusy(true)
    setError('')
    try {
      // Credits first, the request marked answered second. The other order
      // could leave a student told "granted" and holding nothing.
      await grantCreditsWithPayment({
        studentId: request.studentId, student, quantity: qty, amount: paid,
        method: 'bank_transfer',
        note: `Bank transfer — student reported ${fmtAsk(request)}${request.note ? ` (${request.note})` : ''}`,
        staffId: staff?.id, staffName: staff?.name || '',
      })
      await resolveCreditRequest(request.studentId, { status: 'granted', quantity: qty, staffId: staff?.id })
      await onDone()
    } catch (e) {
      console.error('Could not allot credits:', e)
      setError(e?.message || 'Could not add the credits. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 px-5 pt-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-800">Allot credits</h2>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {student?.name || 'Student'} says they sent {fmtAsk(request)}
            </p>
          </div>
          <button onClick={busy ? undefined : onClose} aria-label="Close"
            className="-mr-2 -mt-1 p-2 text-gray-400 hover:text-gray-700 transition-colors">
            <RiCloseLine size={20} />
          </button>
        </div>

        <div className="px-5 pb-5 pt-3">
          {request.note && (
            <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 mb-3 break-words">
              {request.note}
            </p>
          )}

          {!summary ? (
            <p className="text-sm text-gray-400 py-6 text-center">{error || 'Loading…'}</p>
          ) : canHold === 0 ? (
            <p className="text-sm text-gray-500 py-2">
              {student?.name?.split(' ')[0] || 'This student'} is already holding as many credits as they can
              ({summary.cap}). Credits can be added once they have used one.
            </p>
          ) : (
            <>
              <label className="block text-xs font-medium text-gray-600 mb-2">How many credits does this cover?</label>
              <div className="flex flex-wrap gap-2">
                {options.map(n => (
                  <button key={n} type="button" onClick={() => setQty(n)} disabled={busy}
                    className={`flex-1 min-w-[44px] py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                      qty === n ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-200 text-gray-600 hover:border-amber-300'
                    }`}>
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5">
                Holding {summary.available} of {summary.cap}.
              </p>

              <label htmlFor="allot-amount" className="block text-xs font-medium text-gray-600 mt-4 mb-1">
                Amount received in the bank (₹)
              </label>
              <input id="allot-amount" type="number" min="0" value={amount} disabled={busy}
                onChange={e => setAmount(e.target.value)} placeholder="What actually arrived, in rupees"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              <p className="text-[11px] text-gray-400 mt-1.5">
                Recorded as a confirmed bank transfer. Enter the rupees on the statement, not the figure the student gave.
              </p>
              {payBlocked && <p className="text-[11px] text-red-600 mt-1.5">{payBlocked}</p>}

              {expiry && (
                <p className="mt-4 text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2.5">
                  Valid for {validityLabel(student, qty)} — until <span className="font-semibold">{fmtExpiry(expiry)}</span>.
                  The student is told straight away.
                </p>
              )}

              {error && <p className="text-xs text-red-600 mt-3">{error}</p>}

              <button onClick={go} disabled={busy || !!payBlocked}
                className="w-full mt-4 bg-amber-500 hover:bg-amber-600 text-white rounded-lg py-3 text-sm font-semibold disabled:bg-gray-200 disabled:text-gray-400 transition-colors">
                {busy ? 'Adding…' : `Add ${qty} ${creditsWord(qty)}${paid > 0 ? ` · ₹${paid.toLocaleString('en-IN')}` : ''}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
