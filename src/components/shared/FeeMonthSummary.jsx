import { RiArrowDownSLine } from 'react-icons/ri'
import { useState } from 'react'
import { monthlyCollection, monthlyClasses, periodLabel } from '../../utils/feeReport'

const money = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`

// ─── What came in, and what was taught ───────────────────────────────────────
// Staff-only: the headline figures for the months selected, with the
// per-student breakdown a tap away. Students never see this — their own Fees
// page shows only their own payments, deliberately.
//
// `months` is an array, so one month and a run of months are the same screen.
//
// Two things used to sit here and no longer can. "Still due" came from each
// student's feeAmount, which stopped deciding anything once students type their
// own amount. "To confirm" counted payments awaiting review — but nothing
// creates those any more: the gateway and the office both write a confirmed
// payment, and students cannot write one at all. It sat at ₹0 forever, which is
// worse than absent. It reappears below only if real unconfirmed money exists,
// which on this database means something left over from the old flow.
export default function FeeMonthSummary({ students, payments, classes = [], months = [] }) {
  const [open, setOpen] = useState(false)
  const s = monthlyCollection(students, payments, months)

  // Classes are counted by CALENDAR month. Credits run from the day each
  // student buys, so no two students share a "month" — the calendar is the one
  // timeline that totals across all of them.
  const taught = months.reduce((acc, m) => {
    const t = monthlyClasses(classes, m, students)
    return { done: acc.done + t.done, missed: acc.missed + t.missed, upcoming: acc.upcoming + t.upcoming }
  }, { done: 0, missed: 0, upcoming: 0 })

  if (s.students === 0 || months.length === 0) return null

  const cards = [
    {
      key: 'received', label: 'Received', value: money(s.received), tone: 'text-green-700',
      sub: `${s.paidCount} of ${s.students} paid`,
    },
    {
      key: 'classes', label: 'Classes done', value: String(taught.done), tone: 'text-gray-800',
      sub: taught.upcoming
        ? `${taught.upcoming} still to come`
        : taught.missed ? `${taught.missed} missed` : 'none upcoming',
    },
    // Only when there is genuinely something unconfirmed to look at.
    ...(s.awaiting > 0 ? [{
      key: 'awaiting', label: 'To confirm', value: money(s.awaiting), tone: 'text-amber-600',
      sub: `${s.awaitingCount} to review`,
    }] : []),
  ]

  return (
    <div className="bg-white rounded-xl border border-gray-100 mb-4">
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-800">{periodLabel(s.months)}</h2>
          {/* Worth saying once, where the figure is: this is cash in, by the
              date it arrived, not fees attributed to a teaching month. */}
          <span className="hidden sm:block text-[11px] text-gray-400">
            counted by the date the money arrived
          </span>
        </div>

        <div className={`grid gap-3 mt-3 ${cards.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
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
            {taught.missed} class{taught.missed > 1 ? 'es' : ''} marked missed — not counted as done.
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
          {/* Biggest payers first, then anything unconfirmed, then the students
              who simply did not buy classes in this period. That last group is
              not a list to chase — on credits nobody can be in arrears. */}
          {['paid', 'awaiting', 'none'].flatMap(status =>
            s.rows.filter(r => r.status === status)
              .sort((a, b) => status === 'paid'
                ? b.received - a.received
                : String(a.name).localeCompare(String(b.name)))
              .map(r => (
                <div key={r.id} className="px-5 py-2 border-t border-gray-50 first:border-t-0 flex items-center justify-between gap-3">
                  <span className="text-sm text-gray-700 truncate">{r.name}</span>
                  <span className={`text-sm tabular-nums shrink-0 ${
                    r.status === 'paid' ? 'text-green-700 font-medium'
                      : r.status === 'awaiting' ? 'text-amber-600'
                        : 'text-gray-300'
                  }`}>
                    {r.status === 'paid' ? money(r.received)
                      : r.status === 'awaiting' ? `${money(r.awaiting)} to confirm`
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
