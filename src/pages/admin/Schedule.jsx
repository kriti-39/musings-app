import { useState, useEffect, useCallback } from 'react'
import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { enUS } from 'date-fns/locale/en-US'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import AdminLayout from '../../components/admin/AdminLayout'
import ScheduleClassModal from '../../components/admin/ScheduleClassModal'
import ClassDetailModal from '../../components/admin/ClassDetailModal'
import { getTeacherClassesForMonth, getAllStudents, getPendingRequests } from '../../firebase/db'
import { useAuth } from '../../context/AuthContext'
import { RiAddLine } from 'react-icons/ri'

const localizer = dateFnsLocalizer({
  format,
  parse,
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

export default function AdminSchedule() {
  const { user } = useAuth()
  const [classes, setClasses] = useState([])
  const [students, setStudents] = useState({})
  const [pendingCount, setPendingCount] = useState(0)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showSchedule, setShowSchedule] = useState(false)
  const [showDetail, setShowDetail] = useState(null)
  const [clickedSlot, setClickedSlot] = useState(null)
  const [loading, setLoading] = useState(true)

  async function fetchData(date) {
    setLoading(true)
    const [allClasses, allStudents, pending] = await Promise.all([
      getTeacherClassesForMonth(user.id, date.getFullYear(), date.getMonth()),
      getAllStudents(),
      getPendingRequests(user.id),
    ])

    const studentMap = {}
    allStudents.forEach(s => { studentMap[s.id] = s })
    setStudents(studentMap)
    setClasses(allClasses)
    setPendingCount(pending.length)
    setLoading(false)
  }

  useEffect(() => { fetchData(currentDate) }, [currentDate])

  const events = classes.map(cls => {
    const start = cls.scheduledAt?.toDate?.() ?? new Date(cls.scheduledAt)
    const end = new Date(start.getTime() + (cls.duration || 60) * 60000)
    return {
      id: cls.id,
      title: students[cls.studentId]?.name || 'Student',
      start,
      end,
      resource: cls,
    }
  })

  function handleSelectSlot({ start }) {
    setClickedSlot(start)
    setShowSchedule(true)
  }

  function handleSelectEvent(event) {
    setShowDetail(event.resource)
  }

  function eventStyleGetter(event) {
    const color = STATUS_COLORS[event.resource.status] || '#f59e0b'
    return {
      style: {
        backgroundColor: color,
        borderRadius: '6px',
        border: 'none',
        color: event.resource.status === 'completed' ? '#fff' : '#fff',
        fontSize: '12px',
        padding: '2px 6px',
      }
    }
  }

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">Schedule</h1>
            {pendingCount > 0 && (
              <p className="text-sm text-amber-600 mt-0.5">
                {pendingCount} pending booking {pendingCount === 1 ? 'request' : 'requests'}
              </p>
            )}
          </div>
          <button
            onClick={() => { setClickedSlot(new Date()); setShowSchedule(true) }}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <RiAddLine size={18} />
            Schedule Class
          </button>
        </div>

        {/* Legend */}
        <div className="flex gap-4 mb-4 flex-wrap">
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <div key={status} className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="capitalize">{status}</span>
            </div>
          ))}
        </div>

        {/* Calendar */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <style>{`
            .rbc-calendar { font-family: inherit; }
            .rbc-header { padding: 8px; font-size: 12px; font-weight: 500; color: #6b7280; border-color: #f3f4f6; }
            .rbc-today { background-color: #fffbeb; }
            .rbc-off-range-bg { background-color: #f9fafb; }
            .rbc-toolbar button { font-size: 13px; border-radius: 8px; border-color: #e5e7eb; color: #374151; }
            .rbc-toolbar button.rbc-active { background-color: #f59e0b; border-color: #f59e0b; color: white; }
            .rbc-toolbar button:hover { background-color: #fef3c7; }
            .rbc-event { cursor: pointer; }
            .rbc-slot-selection { background-color: rgba(245,158,11,0.2); }
          `}</style>
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: 600 }}
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            onNavigate={date => setCurrentDate(date)}
            selectable
            eventPropGetter={eventStyleGetter}
            views={['month', 'week', 'day']}
            defaultView="week"
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

      {showDetail && (
        <ClassDetailModal
          cls={showDetail}
          studentName={students[showDetail.studentId]?.name || 'Student'}
          onClose={() => setShowDetail(null)}
          onUpdate={() => fetchData(currentDate)}
        />
      )}
    </AdminLayout>
  )
}
