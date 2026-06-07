import { useState, useEffect } from 'react'
import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay, isBefore } from 'date-fns'
import { enUS } from 'date-fns/locale/en-US'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import TeacherLayout from '../../components/teacher/TeacherLayout'
import ScheduleClassModal from '../../components/admin/ScheduleClassModal'
import ClassDetailModal from '../../components/admin/ClassDetailModal'
import { getTeacherClassesForMonth, getAllStudents, getPendingRequests } from '../../firebase/db'
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

function ScheduleToolbar({ label, onNavigate, onView, view }) {
  return (
    <div className="mb-4 px-1 space-y-2">
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

export default function TeacherSchedule() {
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

  async function fetchData(date) {
    if (!user?.id) return
    const [allClasses, allStudents, pending] = await Promise.all([
      getTeacherClassesForMonth(user.id, date.getFullYear(), date.getMonth()),
      getAllStudents(),
      getPendingRequests(user.id),
    ])
    const map = {}
    allStudents.forEach(s => { map[s.id] = s })
    setStudents(map)
    setClasses(allClasses)
    setPendingCount(pending.length)
  }

  useEffect(() => { fetchData(currentDate) }, [user, currentDate])

  const events = classes.map(cls => {
    const start = cls.scheduledAt?.toDate?.() ?? new Date()
    return {
      id: cls.id,
      title: students[cls.studentId]?.name || 'Student',
      start,
      end: new Date(start.getTime() + (cls.duration || 60) * 60000),
      resource: cls,
    }
  })

  function handleSelectSlot({ start }) {
    if (isBefore(start, new Date())) return
    setClickedSlot(start)
    setShowSchedule(true)
  }

  return (
    <TeacherLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-800">Schedule</h1>
          {pendingCount > 0 && <p className="text-sm text-amber-600 mt-0.5">{pendingCount} pending request{pendingCount > 1 ? 's' : ''}</p>}
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
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <div key={status} className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="capitalize">{status}</span>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <style>{`
            .rbc-month-view, .rbc-time-view { border-color: rgba(0,0,0,0.07); }
            .rbc-header { border-color: rgba(0,0,0,0.07) !important; font-size: 12px; font-weight: 500; color: #6b7280; padding: 8px 4px; }
            .rbc-day-bg + .rbc-day-bg { border-color: rgba(0,0,0,0.07); }
            .rbc-month-row + .rbc-month-row { border-color: rgba(0,0,0,0.07); }
            .rbc-timeslot-group { border-color: rgba(0,0,0,0.07); }
            .rbc-time-slot { border-color: rgba(0,0,0,0.07); }
            .rbc-time-content { border-color: rgba(0,0,0,0.07); }
            .rbc-time-header-content { border-color: rgba(0,0,0,0.07); }
            .rbc-today { background-color: #fffbeb !important; }
            .rbc-off-range-bg { background: rgba(0,0,0,0.02); }
            .rbc-date-cell a { cursor: pointer; }
            .rbc-date-cell a:hover { color: #f59e0b; font-weight: 600; }
            .rbc-day-slot .rbc-time-slot:hover { background: rgba(245,158,11,0.07); cursor: pointer; }
            .rbc-slot-selection { background: rgba(245,158,11,0.15) !important; }
            .rbc-event { cursor: pointer; }
            .rbc-label { font-size: 11px; color: #9ca3af; }
          `}</style>
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: 600 }}
            view={currentView}
            onView={setCurrentView}
            onNavigate={date => setCurrentDate(date)}
            onDrillDown={(date) => { setCurrentDate(date); setCurrentView('day') }}
            drilldownView="day"
            selectable
            longPressThreshold={10}
            onSelectSlot={handleSelectSlot}
            onSelectEvent={e => setShowDetail(e.resource)}
            dayPropGetter={date => {
              const today = new Date(); today.setHours(0,0,0,0)
              if (date < today) return { style: { opacity: 0.45 } }
              return {}
            }}
            slotPropGetter={date => {
              if (isBefore(date, new Date())) return { style: { cursor: 'not-allowed' } }
              return {}
            }}
            components={{ toolbar: ScheduleToolbar }}
            eventPropGetter={e => ({
              style: {
                backgroundColor: STATUS_COLORS[e.resource.status] || '#f59e0b',
                borderRadius: '6px', border: 'none', color: '#fff',
                fontSize: '12px', padding: '2px 6px',
              }
            })}
            views={['month', 'week', 'day']}
            popup
          />
        </div>
      </div>

      {showSchedule && (
        <ScheduleClassModal
          onClose={() => { setShowSchedule(false); setClickedSlot(null) }}
          onSuccess={() => fetchData(currentDate)}
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
    </TeacherLayout>
  )
}
