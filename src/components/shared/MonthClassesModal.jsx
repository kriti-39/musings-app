import { RiCloseLine, RiCalendarLine, RiArrowRightLine } from 'react-icons/ri'

function statusBadge(status) {
  const s = status || 'scheduled'
  if (s === 'completed') return { label: 'Done', cls: 'bg-gray-100 text-gray-500' }
  if (s === 'pending') return { label: 'Pending', cls: 'bg-amber-50 text-amber-700' }
  if (s === 'cancelled' || s === 'rejected') return { label: s === 'cancelled' ? 'Cancelled' : 'Rejected', cls: 'bg-red-50 text-red-500' }
  return { label: 'Upcoming', cls: 'bg-green-50 text-green-700' }
}

// Lists a month's classes as a simple, scannable list grouped by day.
// classes: array of class docs · students: map of studentId -> student
export default function MonthClassesModal({ classes = [], students = {}, monthLabel, onClose, onViewCalendar }) {
  // Exclude cancelled/rejected so the list matches the "This Month" count.
  const visible = classes
    .filter(c => c.status !== 'cancelled' && c.status !== 'rejected')
    .sort((a, b) => (a.scheduledAt?.seconds ?? 0) - (b.scheduledAt?.seconds ?? 0))

  // Group by calendar day
  const groups = []
  let lastKey = null
  visible.forEach(cls => {
    const d = cls.scheduledAt?.toDate?.() ?? new Date()
    const key = d.toDateString()
    if (key !== lastKey) {
      groups.push({ key, date: d, items: [] })
      lastKey = key
    }
    groups[groups.length - 1].items.push(cls)
  })

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Classes · {monthLabel}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{visible.length} class{visible.length === 1 ? '' : 'es'} this month</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 cursor-pointer">
            <RiCloseLine size={20} />
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-5 py-16 text-gray-400">
              <RiCalendarLine size={26} />
              <p className="text-sm">No classes this month.</p>
            </div>
          ) : (
            groups.map(g => (
              <div key={g.key}>
                <div className="px-5 py-2 bg-gray-50 sticky top-0">
                  <p className="text-xs font-medium text-gray-500">
                    {g.date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <div>
                  {g.items.map(cls => {
                    const d = cls.scheduledAt?.toDate?.() ?? new Date()
                    const b = statusBadge(cls.status)
                    return (
                      <div key={cls.id} className="px-5 py-3 flex items-center justify-between border-t border-gray-100 first:border-t-0">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{students[cls.studentId]?.name || 'Student'}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {cls.duration || 60}m
                          </p>
                        </div>
                        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${b.cls}`}>{b.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {onViewCalendar && (
          <div className="px-5 py-3 border-t border-gray-100 shrink-0">
            <button
              onClick={onViewCalendar}
              className="w-full flex items-center justify-center gap-1.5 text-sm text-amber-600 hover:underline cursor-pointer"
            >
              View full calendar <RiArrowRightLine size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
