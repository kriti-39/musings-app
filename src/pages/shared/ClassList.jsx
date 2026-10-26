import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getTeacherAllClasses, getAllClassesDesc, getAllStudentsIncludingInactive, sweepPastClasses } from '../../firebase/db'
import { RiCalendarLine } from 'react-icons/ri'
import ClassDetailModal from '../../components/admin/ClassDetailModal'
import PeriodFilter, { ALL_PERIOD, filterByPeriod } from '../../components/shared/PeriodFilter'

const STATUS_STYLES = {
  scheduled:  'bg-green-50 text-green-700',
  pending:    'bg-amber-50 text-amber-700',
  completed:  'bg-gray-100 text-gray-500',
  cancelled:  'bg-red-50 text-red-500',
  rejected:   'bg-red-50 text-red-500',
}

const TABS = [
  { key: 'upcoming',  label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
]

// Which tab a class belongs on, from its own status.
function tabForClass(cls) {
  const status = cls.status || 'scheduled'
  const date = cls.scheduledAt?.toDate?.() ?? new Date()
  if (status === 'cancelled' || status === 'rejected') return 'cancelled'
  if (status === 'completed') return 'completed'
  if (status === 'pending' || date >= new Date()) return 'upcoming'
  return 'completed'
}

export default function ClassList({ teacherId, Layout, showAll = false }) {
  const [classes, setClasses] = useState([])
  const [students, setStudents] = useState({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('upcoming')
  const [detail, setDetail] = useState(null)
  const [period, setPeriod] = useState(ALL_PERIOD)
  const [searchParams, setSearchParams] = useSearchParams()

  async function fetchAll() {
    if (!showAll && !teacherId) return
    try {
      const [allClasses, allStudents] = await Promise.all([
        showAll ? getAllClassesDesc() : getTeacherAllClasses(teacherId),
        getAllStudentsIncludingInactive(),
      ])
      const map = {}
      allStudents.forEach(s => { map[s.id] = s })
      setStudents(map)
      setClasses(sweepPastClasses(allClasses))
    } catch (e) {
      console.error('ClassList fetch failed:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [teacherId, showAll])

  // ?class=<id> — a notification pointing at one particular class.
  //
  // Read straight off the URL rather than copied into state by an effect. The
  // URL is already the source of truth, and mirroring it meant a render that
  // showed the wrong tab before a second one corrected it. Derived this way
  // there is only ever one answer, and arriving from a notification while
  // ALREADY on this page works too — there is no mount to hang the effect on.
  const focusId = searchParams.get('class')
  const focused = focusId ? classes.find(c => c.id === focusId) || null : null

  // While a class is being pointed at, the list shows the tab that class
  // actually lives on and drops the period filter. A cancelled class is not in
  // Upcoming, and an old one is filtered out by period — either way the class
  // would be missing from the list behind the dialog, which reads as "it's
  // gone" rather than "it's on another tab".
  const activeTab = focused ? tabForClass(focused) : tab
  const activePeriod = focused ? ALL_PERIOD : period
  const openClass = focused || detail

  // Closing the class, or choosing a tab by hand, hands control back to the
  // list: the parameter goes, and with it the forced tab.
  function release(next = {}) {
    setDetail(null)
    if (next.tab) setTab(next.tab)
    if (focusId) {
      const params = new URLSearchParams(searchParams)
      params.delete('class')
      setSearchParams(params, { replace: true })
    }
  }

  const now = new Date()
  const filtered = classes.filter(c => {
    const date = c.scheduledAt?.toDate?.() ?? new Date()
    // treat missing/null status as 'scheduled' for legacy classes
    const status = c.status || 'scheduled'
    if (activeTab === 'upcoming') return status === 'pending' || (status === 'scheduled' && date >= now)
    if (activeTab === 'completed') return status === 'completed'
    if (activeTab === 'cancelled') return status === 'cancelled' || status === 'rejected'
    return false
  }).sort((a, b) => {
    const ta = a.scheduledAt?.seconds ?? 0, tb = b.scheduledAt?.seconds ?? 0
    // Upcoming: soonest first (ascending). Past tabs: most recent first (descending).
    return activeTab === 'upcoming' ? ta - tb : tb - ta
  })

  const visible = filterByPeriod(filtered, activePeriod, c => c.scheduledAt?.toDate?.())

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Filter sits on the heading row so it costs no vertical space */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <h1 className="text-xl font-semibold text-gray-800">Classes</h1>
          {!loading && filtered.length > 0 && (
            <PeriodFilter
              dates={filtered.map(c => c.scheduledAt?.toDate?.())}
              value={period} onChange={setPeriod}
              showing={visible.length} total={filtered.length}
            />
          )}
        </div>

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
          {TABS.map(t => (
            <button key={t.key} onClick={() => { release({ tab: t.key }); setPeriod(ALL_PERIOD) }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === t.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-16">Loading...</p>
        ) : visible.length === 0 ? (
          <div className="text-center py-16">
            <RiCalendarLine size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400 text-sm">
              {filtered.length === 0 ? 'No classes in this category.' : 'No classes in this period.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map(cls => {
              const date = cls.scheduledAt?.toDate?.() ?? new Date()
              const student = students[cls.studentId]
              const status = cls.status || 'scheduled'
              return (
                <button key={cls.id}
                  onClick={() => setDetail(cls)}
                  className="w-full text-left bg-white rounded-xl border border-gray-100 p-5 hover:border-amber-200 hover:shadow-sm transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 truncate">{student?.name || '—'}</p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {cls.duration || 60} min
                      </p>
                      {/* Record of whether the student was spoken to about it */}
                      {status === 'cancelled' && cls.followUpNeeded && (
                        <p className="text-xs text-amber-600 mt-1">Student not contacted yet</p>
                      )}
                      {status === 'cancelled' && cls.followUpDoneAt && (
                        <p className="text-xs text-green-600 mt-1">
                          ✓ Contacted{cls.followUpVia === 'whatsapp' ? ' on WhatsApp' : ''}
                        </p>
                      )}
                      {status === 'cancelled' && cls.followUpLapsedAt && !cls.followUpDoneAt && (
                        <p className="text-xs text-gray-400 mt-1">Not contacted — the day passed</p>
                      )}
                      {/* A credit waiting on a decision — open the class to make it */}
                      {cls.creditReviewNeeded && (
                        <p className="text-xs text-amber-600 mt-1">Credit decision needed</p>
                      )}
                    </div>
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                      cls.missed ? 'bg-orange-50 text-orange-600' : STATUS_STYLES[status] || ''
                    }`}>
                      {cls.missed ? 'Missed' : status === 'pending' ? 'Awaiting confirmation' : status}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {openClass && (
        <ClassDetailModal
          cls={openClass}
          studentName={students[openClass.studentId]?.name || 'Student'}
          studentTimezone={students[openClass.studentId]?.timezone}
          onClose={() => release()}
          onUpdate={fetchAll}
        />
      )}
    </Layout>
  )
}
