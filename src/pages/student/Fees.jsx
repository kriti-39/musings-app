import { useState, useEffect } from 'react'
import StudentLayout from '../../components/student/StudentLayout'
import { useAuth } from '../../context/AuthContext'
import { getStudentPayments } from '../../firebase/db'
import { loadCredits } from '../../firebase/credits'
import { usesCredits, creditsWord, MAX_CREDITS } from '../../utils/credits'
import BuyCreditsModal from '../../components/student/BuyCreditsModal'
import { RiTicketLine } from 'react-icons/ri'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function monthLabel(m) {
  const [y, mo] = m.split('-')
  return `${MONTHS[parseInt(mo) - 1]} ${y}`
}

export default function StudentFees() {
  const { user } = useAuth()
  const [payments, setPayments] = useState([])
  const [buying, setBuying] = useState(false)
  const [credits, setCredits] = useState(null)
  const [loading, setLoading] = useState(true)

  // Students on credits buy them; students on the earlier arrangement still
  // submit a payment for staff to confirm. Two different pages, really.
  const onCredits = usesCredits(user)

  async function fetchPayments() {
    const data = await getStudentPayments(user.id)
    setPayments(data)
    setLoading(false)
  }

  async function refresh() {
    await fetchPayments()
    if (onCredits) {
      try { setCredits((await loadCredits(user.id)).summary) }
      catch (e) { console.error('Credits failed to load:', e) }
    }
  }

  useEffect(() => { if (user?.id) refresh() }, [user])   // eslint-disable-line react-hooks/exhaustive-deps

  const full = credits?.canHold === 0

  return (
    <StudentLayout>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-6">
          <h1 className="text-xl font-semibold text-gray-800">Fees</h1>

          {onCredits && (
            <button
              onClick={() => setBuying(true)}
              disabled={full}
              title={full ? `You already hold the maximum of ${MAX_CREDITS} credits` : undefined}
              className="shrink-0 flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 disabled:text-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <RiTicketLine size={17} /> Buy credits
            </button>
          )}
        </div>

        <p className="text-xs text-gray-400 mb-5 bg-gray-50 rounded-lg px-4 py-3">
          {onCredits
            ? `Every payment here buys class credits. ${
                credits ? `You hold ${credits.available} of ${MAX_CREDITS} right now.` : ''
              }`
            : 'Payments recorded by Guruji or the office appear here.'}
        </p>

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-10">Loading...</p>
        ) : payments.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">Your submitted payments will appear here.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Month</th>
                  {onCredits && (
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Credits</th>
                  )}
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Paid</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Method</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p, i) => (
                  <tr key={p.id} className={i !== payments.length - 1 ? 'border-b border-gray-50' : ''}>
                    <td className="px-5 py-3.5 text-gray-700 whitespace-nowrap">
                      {(p.months || []).map(m => monthLabel(m)).join(', ') || '—'}
                    </td>
                    {/* `forCredits` is on every payment that bought credits —
                        set by the webhook, and by staff when they record one.
                        A dash means money that wasn't for credits. */}
                    {onCredits && (
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {p.forCredits ? (
                          <span className="inline-flex items-center gap-1.5 text-gray-700 font-medium">
                            <RiTicketLine size={13} className="text-amber-600 shrink-0" />
                            {p.forCredits} {creditsWord(p.forCredits)}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    )}
                    <td className="px-5 py-3.5 text-gray-700 font-medium tabular-nums whitespace-nowrap">
                      ₹{Number(p.amount || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 capitalize whitespace-nowrap">
                      {p.method?.replace('_', ' ') || '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        p.status === 'confirmed' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {p.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {buying && (
        <BuyCreditsModal
          student={user}
          canHold={credits?.canHold ?? MAX_CREDITS}
          onClose={() => { setBuying(false); refresh() }}
        />
      )}
    </StudentLayout>
  )
}
