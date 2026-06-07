import { useState, useEffect } from 'react'
import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay, isBefore } from 'date-fns'
import { enUS } from 'date-fns/locale/en-US'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import AdminLayout from '../../components/admin/AdminLayout'
import ScheduleClassModal from '../../components/admin/ScheduleClassModal'
import ClassDetailModal from '../../components/admin/ClassDetailModal'
import { getAllClassesForMonth, getAllStudents, getAllPendingRequests } from '../../firebase/db'
import { useAuth } from '../../context/AuthContext'
import ManageAvailabilityModal from '../../components/shared/ManageAvailabilityModal'
import { RiAddLine, RiArrowLeftSLine, RiArrowRightSLine, RiCalendarCheckLine } from 'react-icons/ri'

const localizer = dateFnsLocalizer({
  format, parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { 'en-US': enUS },
})

const STATUS_COLORS = {
  scheduled: '#f59e0b',
  pending:   '#fb923c',
  completed: '#9ca3af',
  cancelled: '#f87171',
  rejected:  '#f87171',
}

// Day-column header for week/day views — day name on top, date below
function DayColumnHeader({ date }) {
  return (
    <div className="py-1 leading-tight text-center">
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{format(date, 'EEE')}</div>
      <div className="text-sm font-semibold text-gray-700">{format(date, 'd')}</div>
    </div>
  )
}

function ScheduleToolbar({ label, onNavigate, onView, view }) {
  return (
    <div className="mb-3 px-3 pt-3 space-y-2">
      <p className="text-base font-semibold text-gray-800">{label}</p>
      <div className="flex items-center gap-1">
        <button onClick={() => onNavigate('PREV')}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
          <RiArrowLeftSLine size={18} />
        </button>
        <button onClick={() => onNavigate('TODAY')}
          className="px-3 h-8 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors font-medium">
          Today
        </button>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {['month', 'week', 'day'].map(v => (
            <button key={v} onClick={() => onView(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                view === v ? 'bg-amber-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {v}
            </button>
          ))}
        </div>
        <button onClick={() => onNavigate('NEXT')}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
          <RiArrowRightSLine size={18} />
        </button>
      </div>
    </div>
  )
}

export default function AdminSchedule() {
  const { user } = useAuth()
  const [classes, setClasses] = useState([])
  const [students, setStudents] = useState({})
  const [pendingCount, setPendingCount] = useState(0)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [currentView, setCurrentView] = useState('week')
  const [showSchedule, setShowSchedule] = useState(false)
  const [showDetail, setShowDetail] = useState(null)
  const [showAvailability, setShowAvailability] = useState(false)
  const [clickedSlot, setClickedSlot] = useState(null)
  const [pendingSlot, setPendingSlot] = useState(null)

  async function fetchData(date) {
    if (!user?.id) return
    const [allClasses, allStudents, pending] = await Promise.all([
      getAllClassesForMonth(date.getFullYear(), date.getMonth()),
      getAllStudents(),
      getAllPendingRequests(),
    ])
    const map = {}
    allStudents.forEach(s => { map[s.id] = s })
    setStudents(map)
    setClasses(allClasses)
    setPendingCount(pending.length)
  }

  useEffect(() => { fetchData(currentDate) }, [user, currentDate])

  const events = [
    ...classes.map(cls => {
      const start = cls.scheduledAt?.toDate?.() ?? new Date()
      return {
        id: cls.id,
        title: students[cls.studentId]?.name || 'Student',
        start,
        end: new Date(start.getTime() + (cls.duration || 60) * 60000),
        resource: cls,
      }
    }),
    // Highlighted slot (tap again to schedule)
    ...(pendingSlot ? [{
      id: '__sel__', title: 'Tap again to schedule',
      start: pendingSlot, end: new Date(pendingSlot.getTime() + 60 * 60000), type: 'selection',
    }] : []),
  ]

  // Month: whole cell → open that day. Week/Day: 1st tap highlights, 2nd opens modal.
  function handleSelectSlot({ start }) {
    if (currentView === 'month') {
      const today = new Date(); today.setHours(0, 0, 0, 0)
      if (start < today) return
      setPendingSlot(null)
      setCurrentDate(start)
      setCurrentView('day')
      return
    }
    if (isBefore(start, new Date())) return
    setPendingSlot(start)
  }

  function handleSelectEvent(event) {
    if (event.type === 'selection') {
      setClickedSlot(event.start)
      setShowSchedule(true)
      return
    }
    setShowDetail(event.resource)
  }

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-800">Schedule</h1>
          {pendingCount > 0 && (
            <p className="text-sm text-amber-600 mt-0.5">{pendingCount} pending request{pendingCount > 1 ? 's' : ''}</p>
          )}
          <div className="flex gap-2 mt-3">
            <button onClick={() => setShowAvailability(true)}
              className="flex items-center gap-2 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
              <RiCalendarCheckLine size={18} /> Availability
            </button>
            <button onClick={() => { setClickedSlot(new Date()); setShowSchedule(true) }}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <RiAddLine size={18} /> Schedule Class
            </button>
          </div>
        </div>

        <div className="flex gap-4 mb-4 flex-wrap">
          {[
            { label: 'Upcoming', color: '#f59e0b' },
            { label: 'Busy', color: '#fb923c' },
            { label: 'Done', color: '#9ca3af' },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span>{label}</span>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <style>{`
            /* Subtle neutral borders that read well on both light and dark */
            .rbc-time-view, .rbc-month-view { border-color: rgba(128,128,128,0.2); }
            .rbc-header { border-color: rgba(128,128,128,0.2) !important; font-weight: 500; color: #9ca3af; padding: 4px; }
            .rbc-header + .rbc-header { border-color: rgba(128,128,128,0.14) !important; }
            .rbc-day-bg + .rbc-day-bg { border-color: rgba(128,128,128,0.14) !important; }
            .rbc-month-row + .rbc-month-row { border-color: rgba(128,128,128,0.14) !important; }
            .rbc-timeslot-group { border-color: rgba(128,128,128,0.14) !important; }
            .rbc-time-slot { border-color: transparent !important; }
            .rbc-time-content { border-top-color: rgba(128,128,128,0.14) !important; }
            .rbc-time-content > * + * { border-left-color: rgba(128,128,128,0.14) !important; }
            .rbc-time-header-content { border-left-color: rgba(128,128,128,0.14) !important; }
            .rbc-time-header-content > * + * { border-left-color: rgba(128,128,128,0.14) !important; }
            .rbc-time-header.rbc-overflowing { border-right-color: rgba(128,128,128,0.14) !important; }
            .rbc-day-slot .rbc-time-slot { border-top: none !important; }
            /* Remove the empty all-day row (we don't use all-day events) */
            .rbc-allday-cell { display: none !important; }
            /* Today highlight — subtle tint, not a bright block */
            .rbc-today { background-color: rgba(245,158,11,0.07) !important; }
            .rbc-off-range-bg { background: rgba(128,128,128,0.06); }
            .rbc-date-cell a { cursor: pointer; }
            .rbc-date-cell a:hover { color: #f59e0b; font-weight: 600; }
            .rbc-day-slot .rbc-time-slot:hover { background: rgba(245,158,11,0.07); cursor: pointer; }
            .rbc-slot-selection { background: rgba(245,158,11,0.18) !important; }
            .rbc-event { cursor: pointer; }
            .rbc-label { font-size: 11px; color: #9ca3af; }
            .rbc-current-time-indicator { background: #f59e0b; height: 2px; }
          `}</style>
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: 600 }}
            view={currentView}
            onView={v => { setPendingSlot(null); setCurrentView(v) }}
            onNavigate={date => { setPendingSlot(null); setCurrentDate(date) }}
            onDrillDown={(date) => { setPendingSlot(null); setCurrentDate(date); setCurrentView('day') }}
            drilldownView="day"
            selectable
            longPressThreshold={10}
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            dayPropGetter={date => {
              const today = new Date(); today.setHours(0,0,0,0)
              if (date < today) return { style: { opacity: 0.45 } }
              return {}
            }}
            slotPropGetter={date => {
              if (isBefore(date, new Date())) return { style: { cursor: 'not-allowed' } }
              return {}
            }}
            components={{ toolbar: ScheduleToolbar, week: { header: DayColumnHeader }, day: { header: DayColumnHeader } }}
            eventPropGetter={e => {
              if (e.type === 'selection') {
                return { style: {
                  backgroundColor: '#f59e0b', border: '2px solid #d97706', color: '#fff',
                  borderRadius: '6px', fontSize: '12px', fontWeight: 600, padding: '2px 6px',
                } }
              }
              return { style: {
                backgroundColor: STATUS_COLORS[e.resource.status] || '#f59e0b',
                borderRadius: '6px', border: 'none', color: '#fff',
                fontSize: '12px', padding: '2px 6px',
              } }
            }}
            views={['month', 'week', 'day']}
            popup
          />
        </div>
      </div>

      {/* Floating confirm bar when a slot is selected */}
      {pendingSlot && !showSchedule && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-gray-800 truncate">
            {format(pendingSlot, 'EEE, d MMM')} · {format(pendingSlot, 'h:mm a')}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setPendingSlot(null)}
              className="px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={() => { setClickedSlot(pendingSlot); setShowSchedule(true) }}
              className="px-4 py-2 text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-lg">Schedule here</button>
          </div>
        </div>
      )}

      {showSchedule && (
        <ScheduleClassModal
          onClose={() => { setShowSchedule(false); setClickedSlot(null); setPendingSlot(null) }}
          onSuccess={() => { fetchData(currentDate); setPendingSlot(null) }}
          defaultDate={clickedSlot}
        />
      )}
      {showAvailability && (
        <ManageAvailabilityModal onClose={() => setShowAvailability(false)} />
      )}

      {showDetail && (
        <ClassDetailModal
          cls={showDetail}
          studentName={students[showDetail.studentId]?.name || 'Student'}
          studentTimezone={students[showDetail.studentId]?.timezone}
          onClose={() => setShowDetail(null)}
          onUpdate={() => fetchData(currentDate)}
        />
      )}
    </AdminLayout>
  )
}
