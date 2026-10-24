import { RiArrowDownSLine } from 'react-icons/ri'
import { useState } from 'react'
import { monthlyCollection, monthlyClasses, monthLabel } from '../../utils/feeReport'

const money = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`

// ─── What one month brought in ───────────────────────────────────────────────
// Staff-only: the headline figure for the selected month, with the per-student
// breakdown a tap away. Students never see this — their own Fees page shows
// only their own payments, deliberately.
export default function FeeMonthSummary({ students, payments, classes = [], month }) {
  const [open, setOpen] = useState(false)
  const s = monthlyCollection(students, payments, month)
  // Counted by calendar month, not by anyone's credit period — see
  // monthlyClasses. This is the one timeline every student shares.
  const taught = monthlyClasses(classes, month, students)

  if (s.students === 0) return null

  // Labels are kept short on purpose: three figures sit side by side even on a
  // phone, and "Awaiting confirmation" would truncate to nonsense at 375px.
  //
  // "Still due" used to sit in the third slot, worked out from each student's
  // feeAmount. Students set their own amount when they pay now, so that figure
  // would be a guess dressed up as a total — classes taught is both true and
  // the thing actually being asked.
  const cards = [
    { key: 'received', label: 'Received', value: money(s.received), tone: 'text-green-700',
      sub: `${s.paidCount} of ${s.students} paid` },
    { key: 'classes', label: 'Classes done', value: String(taught.done), tone: 'text-gray-800',
      sub: taught.upcoming
        ? `${taught.upcoming} still to come`
        : taught.missed ? `${taught.missed} missed` : 'none upcoming' },
    { key: 'pending', label: 'To confirm', value: money(s.pending), tone: 'text-amber-600',
      sub: s.pendingCount ? `${s.pendingCount} to review` : 'none waiting' },
  ]

  return (
    <div className="bg-white rounded-xl border border-gray-100 mb-4">
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-800">{monthLabel(month)}</h2>
          {/* The explanation is worth having, but not worth two lines on a phone */}
          <span className="hidden sm:block text-[11px] text-gray-400">
            a payment covering several months is split across them
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-3">
          {cards.map(c => (
            <div key={c.key} className="min-w-0">
              <p className="text-xs text-gray-400 truncate">{c.label}</p>
              {/* A five-figure total has to fit in a third of a phone screen */}
              <p className={`text-base sm:text-xl font-semibold tabular-nums leading-tight mt-0.5 ${c.tone}`}>
                {c.value}
              </p>
              <p className="text-[11px] text-gray-400 truncate mt-0.5">{c.sub}</p>
            </div>
          ))}
        </div>

        {taught.missed > 0 && (
          <p className="text-[11px] text-gray-400 mt-2.5">
            {taught.missed} class{taught.missed > 1 ? 'es' : ''} marked missed this month —
            not counted as done.
          </p>
        )}
      </div>

      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full px-5 py-2.5 border-t border-gray-50 flex items-center justify-between text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors"
      >
        Per student
        <RiArrowDownSLine size={16} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-gray-50 max-h-72 overflow-y-auto">
          {/* Paid first, then awaiting, then the ones to chase */}
          {['paid', 'pending', 'unpaid'].flatMap(status =>
            s.rows.filter(r => r.status === status).map(r => (
              <div key={r.id} className="px-5 py-2 border-t border-gray-50 first:border-t-0 flex items-center justify-between gap-3">
                <span className="text-sm text-gray-700 truncate">{r.name}</span>
                <span className={`text-sm tabular-nums shrink-0 ${
                  r.status === 'paid' ? 'text-green-700 font-medium'
                  : r.status === 'pending' ? 'text-amber-600'
                  : 'text-gray-300'
                }`}>
                  {r.status === 'paid' ? money(r.received)
                    : r.status === 'pending' ? `${money(r.pending)} pending`
                    : '—'}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
