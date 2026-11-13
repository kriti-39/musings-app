import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { RiCloseLine, RiCheckLine, RiBankLine, RiFileCopyLine, RiTimeLine } from 'react-icons/ri'
import {
  submitCreditRequest, getTransferDetails, requestProblem, fmtAsk, CURRENCIES, MAX_NOTE,
} from '../../firebase/creditRequests'

// ─── A student who pays bank to bank asks for their credits ──────────────────
// They say how much they sent, and that is all. There is deliberately no
// "how many classes" here: what a transfer is worth is for the studio to
// decide once the money has actually arrived, and a quantity typed by the
// student would only be a number for someone to wave through.
//
// Nothing on this screen grants anything. It files a request; the credits
// appear when the office has matched the transfer against the bank.
export default function RequestCreditsModal({ student, pending = null, onClose }) {
  const [details, setDetails] = useState(null)      // null = still loading
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let live = true
    getTransferDetails().then(d => { if (live) setDetails(d) })
    return () => { live = false }
  }, [])

  const problem = requestProblem({ amount, currency, note })

  async function send() {
    if (problem) { setError(problem); return }
    setBusy(true)
    setError('')
    try {
      await submitCreditRequest(student, { amount, currency, note })
      setSent(true)
    } catch (e) {
      console.error('Credit request failed:', e)
      setError(
        e?.code === 'permission-denied'
          ? 'You already have a request waiting. The studio will answer that one first.'
          : e?.message || 'Could not send the request. Please try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(details)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard unavailable — the text is on screen to copy by hand */ }
  }

  // ── Already waiting, or just sent ──────────────────────────────────────────
  if (sent || pending) {
    const ask = pending || { amount: Number(amount), currency }
    return (
      <Shell onClose={onClose}>
        <div className="text-center py-2">
          <div className="mx-auto w-14 h-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
            {sent ? <RiCheckLine size={30} /> : <RiTimeLine size={28} />}
          </div>
          <h2 className="text-lg font-semibold text-gray-800">
            {sent ? 'Request sent' : 'Waiting for the studio'}
          </h2>
          <p className="text-sm text-gray-500 mt-2">
            You told us you sent <span className="font-semibold text-gray-700">{fmtAsk(ask)}</span>.
            Your credits will appear here once the studio has seen the transfer arrive —
            a bank transfer from abroad can take a few days.
          </p>
          <button onClick={onClose}
            className="w-full mt-6 bg-amber-500 hover:bg-amber-600 text-white rounded-lg py-2.5 text-sm font-medium">
            Done
          </button>
        </div>
      </Shell>
    )
  }

  // ── Ask ────────────────────────────────────────────────────────────────────
  return (
    <Shell title="Request credits" onClose={busy ? undefined : onClose}>
      <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
            <RiBankLine size={14} /> Pay by bank transfer
          </p>
          {details ? (
            <button onClick={copy} className="text-[11px] font-semibold text-amber-600 flex items-center gap-1">
              <RiFileCopyLine size={12} /> {copied ? 'Copied' : 'Copy'}
            </button>
          ) : null}
        </div>
        {details === null ? (
          <p className="text-xs text-gray-400">Loading…</p>
        ) : details ? (
          <p className="text-xs text-gray-600 whitespace-pre-wrap break-words leading-relaxed">{details}</p>
        ) : (
          <p className="text-xs text-gray-500">
            Ask Guruji for the account details if you do not have them already.
          </p>
        )}
      </div>

      <p className="text-xs text-gray-500 mt-4 leading-relaxed">
        Once you have sent the money, tell us how much. The studio checks the transfer and adds your credits.
      </p>

      <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
        <div>
          <label htmlFor="ask-amount" className="block text-xs font-medium text-gray-600 mb-1">Amount you sent</label>
          <input id="ask-amount" type="number" inputMode="decimal" min="0" value={amount}
            onChange={e => setAmount(e.target.value)} disabled={busy} placeholder="e.g. 120"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50" />
        </div>
        <div>
          <label htmlFor="ask-currency" className="block text-xs font-medium text-gray-600 mb-1">Currency</label>
          <select id="ask-currency" value={currency} onChange={e => setCurrency(e.target.value)} disabled={busy}
            className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50">
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="mt-3">
        <label htmlFor="ask-note" className="block text-xs font-medium text-gray-600 mb-1">
          Reference or note (optional)
        </label>
        <input id="ask-note" value={note} onChange={e => setNote(e.target.value)} disabled={busy}
          maxLength={MAX_NOTE} placeholder="e.g. sent on 12 Nov from my Chase account"
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50" />
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mt-4">{error}</p>
      )}

      <button onClick={send} disabled={busy || !!problem}
        className="w-full mt-5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg py-3 text-sm font-semibold disabled:bg-gray-200 disabled:text-gray-400 transition-colors">
        {busy ? 'Sending…' : 'Request credits'}
      </button>
      <p className="text-[11px] text-gray-400 text-center mt-2.5">
        The studio decides how many classes your payment covers.
      </p>
    </Shell>
  )
}

// A portal, for the same reason BuyCreditsModal uses one: this opens from
// inside the credit card, whose own rules would otherwise trap the backdrop.
function Shell({ title, onClose, children }) {
  return createPortal(
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl max-h-[90dvh] overflow-y-auto">
        {(title || onClose) && (
          <div className="flex items-center justify-between px-5 pt-4">
            <h2 className="text-base font-semibold text-gray-800">{title}</h2>
            {onClose && (
              <button onClick={onClose} aria-label="Close"
                className="-mr-2 p-2 text-gray-400 hover:text-gray-700 transition-colors">
                <RiCloseLine size={20} />
              </button>
            )}
          </div>
        )}
        <div className="px-5 pb-5 pt-3">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
