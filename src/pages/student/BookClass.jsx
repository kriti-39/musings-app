import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay, addMinutes, isBefore } from 'date-fns'
import { enUS } from 'date-fns/locale/en-US'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import StudentLayout from '../../components/student/StudentLayout'
import { useAuth } from '../../context/AuthContext'
import { getTeacherCalendarForMonth, createClass, getTeacherId } from '../../firebase/db'
import { Timestamp } from 'firebase/firestore'
import {
  RiCloseLine, RiCalendarLine,
  RiArrowLeftSLine, RiArrowRightSLine
} from 'react-icons/ri'

const localizer = dateFnsLocalizer({
  format, parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { 'en-US': enUS },
})

// ── Custom calendar toolbar — Month + Day only for students ─────────────────
function CalendarToolbar({ label, onNavigate, onView, view }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4 px-1">
      {/* Period label — month name or selected day */}
      <span className="text-sm font-semibold text-gray-800">{label}</span>

      {/* ‹  [Month | Day]  › */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onNavigate('PREV')}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors"
        >
          <RiArrowLeftSLine size={18} />
        </button>

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {['month', 'day'].map(v => (
            <button
              key={v}
              onClick={() => onView(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                view === v
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        <button
          onClick={() => onNavigate('NEXT')}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors"
        >
          <RiArrowRightSLine size={18} />
        </button>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────

export default function BookClass() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [teacherId, setTeacherId] = useState(null)
  const [calendarData, setCalendarData] = useState({ bookedSlots: [], blockedSlots: [] })
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showPicker, setShowPicker] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [duration, setDuration] = useState(60)
  const [note, setNote] = useState('')
  const [bookingLoading, setBookingLoading] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [currentView, setCurrentView] = useState('month')

  useEffect(() => {
    getTeacherId().then(id => { if (id) setTeacherId(id) })
  }, [])

  useEffect(() => {
    if (teacherId) {
      getTeacherCalendarForMonth(teacherId, currentDate.getFullYear(), currentDate.getMonth())
        .then(setCalendarData)
    }
  }, [teacherId, currentDate])

  const events = [
    ...calendarData.bookedSlots.map(cls => {
      const start = cls.scheduledAt?.toDate?.() ?? new Date()
      return {
        id: cls.id,
        title: 'Booked',
        start,
        end: new Date(start.getTime() + (cls.duration || 60) * 60000),
        type: 'booked',
      }
    }),
    ...calendarData.blockedSlots.map(slot => {
      const start = slot.startAt?.toDate?.() ?? new Date()
      const end = slot.endAt?.toDate?.() ?? new Date()
      return { id: slot.id, title: 'Unavailable', start, end, type: 'blocked' }
    }),
  ]

  function isSlotAvailable(slotStart) {
    const slotEnd = addMinutes(slotStart, duration)
    return !events.some(e => slotStart < e.end && slotEnd > e.start)
  }

  function handleDateTimeChange(date, time) {
    const d = date !== undefined ? date : selectedDate
    const t = time !== undefined ? time : selectedTime
    setConflict(false)
    if (d && t) {
      const [h, m] = t.split(':').map(Number)
      const slotStart = new Date(d)
      slotStart.setHours(h, m, 0, 0)
      if (!isSlotAvailable(slotStart)) setConflict(true)
    }
  }

  const minDate = format(new Date(), 'yyyy-MM-dd')

  // Called when a date number is clicked in month view
  function handleDrillDown(date) {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    if (date < today) return // block past dates
    setCurrentDate(date)
    setCurrentView('day')
  }

  // Called when a time slot is clicked in day view
  function handleSelectSlot({ start }) {
    if (currentView !== 'day') return
    if (isBefore(start, new Date())) return // block past slots
    setSelectedDate(format(start, 'yyyy-MM-dd'))
    setSelectedTime(format(start, 'HH:mm'))
    setConflict(false)
    setShowPicker(true)
  }

  async function handleBook() {
    if (!selectedDate || !selectedTime || !teacherId) return
    const [h, m] = selectedTime.split(':').map(Number)
    const slotStart = new Date(selectedDate)
    slotStart.setHours(h, m, 0, 0)
    if (isBefore(slotStart, new Date())) return
    if (!isSlotAvailable(slotStart)) { setConflict(true); return }
    setBookingLoading(true)
    try {
      await createClass({
        studentId: user.id,
        teacherId,
        scheduledAt: Timestamp.fromDate(slotStart),
        duration,
        lessonNotes: note,
        isRecurring: false,
        recurringId: null,
        status: 'pending',
      })
      navigate('/student/dashboard')
    } catch (e) {
      console.error(e)
    } finally {
      setBookingLoading(false)
    }
  }

  return (
    <StudentLayout>
      <div className="w-full">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-xl font-semibold text-gray-800">Book a Class</h1>
          <p className="text-sm text-gray-400 mt-1">
            Tap a date to open day view, then tap a time slot to send a request.
          </p>
        </div>

        {/* Controls row — button + legend on same line */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="w-3 h-3 rounded-sm bg-red-200 border border-red-300" />
            Booked / Unavailable
          </div>
          <button
            onClick={() => setShowPicker(true)}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shrink-0"
          >
            <RiCalendarLine size={16} />
            Pick a time
          </button>
        </div>

        {/* Calendar */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <style>{`
            /* Consistent borders across both month and day views */
            .rbc-month-view,
            .rbc-time-view             { border-color: rgba(0,0,0,0.07); }
            .rbc-header                { border-color: rgba(0,0,0,0.07) !important; font-size: 12px; font-weight: 500; color: #6b7280; padding: 8px 4px; }
            .rbc-day-bg + .rbc-day-bg  { border-color: rgba(0,0,0,0.07); }
            .rbc-month-row + .rbc-month-row { border-color: rgba(0,0,0,0.07); }
            .rbc-timeslot-group        { border-color: rgba(0,0,0,0.07); }
            .rbc-time-slot             { border-color: rgba(0,0,0,0.07); }
            .rbc-time-content          { border-color: rgba(0,0,0,0.07); }
            .rbc-time-header-content   { border-color: rgba(0,0,0,0.07); }
            .rbc-time-header-gutter    { border-color: rgba(0,0,0,0.07); }
            .rbc-day-slot .rbc-time-slot { border-color: rgba(0,0,0,0.07); }
            /* Today highlight */
            .rbc-today                 { background-color: #fffbeb !important; }
            /* Date cells in month view */
            .rbc-date-cell             { font-size: 12px; padding: 4px 6px; }
            .rbc-date-cell a           { cursor: pointer; }
            .rbc-date-cell a:hover     { color: #f59e0b; font-weight: 600; }
            .rbc-off-range-bg          { background: rgba(0,0,0,0.02); }
            .rbc-off-range .rbc-date-cell a { opacity: 0.35; pointer-events: none; }
            /* Clickable time slots in day view */
            .rbc-day-slot .rbc-time-slot:hover { background: rgba(245,158,11,0.07); cursor: pointer; }
            .rbc-slot-selection        { background: rgba(245,158,11,0.15) !important; }
            /* Time labels */
            .rbc-label                 { font-size: 11px; color: #9ca3af; }
            .rbc-time-gutter .rbc-timeslot-group { border-color: rgba(0,0,0,0.07); }
            /* Day column header */
            .rbc-time-header-content .rbc-header { border-bottom: 1px solid rgba(0,0,0,0.07); }
          `}</style>
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: 540 }}
            onNavigate={date => setCurrentDate(date)}
            view={currentView}
            onView={setCurrentView}
            onDrillDown={handleDrillDown}
            drilldownView="day"
            selectable
            longPressThreshold={10}
            onSelectSlot={handleSelectSlot}
            dayPropGetter={date => {
              const today = new Date(); today.setHours(0, 0, 0, 0)
              if (date < today) return { style: { opacity: 0.45, cursor: 'not-allowed' } }
              return {}
            }}
            slotPropGetter={date => {
              if (isBefore(date, new Date())) return { style: { cursor: 'not-allowed' } }
              return {}
            }}
            components={{ toolbar: CalendarToolbar }}
            eventPropGetter={() => ({
              style: {
                backgroundColor: '#fecaca',
                border: '1px solid #fca5a5',
                color: '#991b1b',
                borderRadius: '6px',
                fontSize: '11px',
                padding: '2px 6px',
              }
            })}
            views={['month', 'day']}
            popup
          />
        </div>
      </div>

      {/* Booking modal */}
      {showPicker && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-gray-800">Request a Class</h2>
              <button onClick={() => { setShowPicker(false); setConflict(false) }}>
                <RiCloseLine size={20} className="text-gray-400" />
              </button>
            </div>

            <div className="space-y-4 mb-5">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                <input
                  type="date"
                  min={minDate}
                  value={selectedDate}
                  onChange={e => { setSelectedDate(e.target.value); handleDateTimeChange(e.target.value, undefined) }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Time</label>
                <input
                  type="time"
                  value={selectedTime}
                  onChange={e => { setSelectedTime(e.target.value); handleDateTimeChange(undefined, e.target.value) }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Duration</label>
                <div className="flex gap-2">
                  {[30, 45, 60, 90].map(d => (
                    <button key={d} type="button"
                      onClick={() => { setDuration(d); handleDateTimeChange(undefined, undefined) }}
                      className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                        duration === d
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'border-gray-200 text-gray-600 hover:border-amber-300'
                      }`}
                    >
                      {d < 60 ? `${d}m` : `${d / 60}h`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Note to teacher (optional)</label>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                  placeholder="What you'd like to learn..."
                />
              </div>

              {conflict && (
                <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">
                  This slot overlaps with an existing booking. Please choose a different time.
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowPicker(false); setConflict(false) }}
                className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2.5 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBook}
                disabled={bookingLoading || !selectedDate || !selectedTime || conflict}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50"
              >
                {bookingLoading ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </StudentLayout>
  )
}
