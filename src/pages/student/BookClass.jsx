import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay, addMinutes, isBefore } from 'date-fns'
import { enUS } from 'date-fns/locale/en-US'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import StudentLayout from '../../components/student/StudentLayout'
import { useAuth } from '../../context/AuthContext'
import { getStudentBookingCalendar, createBooking, getTeacherId, getTeacher } from '../../firebase/db'
import { Timestamp } from 'firebase/firestore'
import {
  RiCloseLine, RiCalendarLine,
  RiArrowLeftSLine, RiArrowRightSLine
} from 'react-icons/ri'
import { LOCAL_TZ, tzCity, shiftToTz, unshiftFromTz, tzOffsetMinutes, fmtTime, fmtLongDate } from '../../utils/timezone'

const localizer = dateFnsLocalizer({
  format, parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { 'en-US': enUS },
})

// ── Custom calendar toolbar — Month + Day only for students ─────────────────
function CalendarToolbar({ label, onNavigate, onView, view }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3 px-3 pt-3">
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
  const [bookingError, setBookingError] = useState('')
  const [currentView, setCurrentView] = useState('month')

  // Timezones
  const studentTz = user?.timezone || LOCAL_TZ
  const [teacherTz, setTeacherTz] = useState(null)
  const [displayTz, setDisplayTz] = useState(studentTz)

  // Two-click booking: 1st click highlights a slot, 2nd click opens the modal
  const [pendingSlot, setPendingSlot] = useState(null)

  useEffect(() => {
    getTeacher()
      .then(t => {
        if (t) { setTeacherId(t.id); setTeacherTz(t.timezone || LOCAL_TZ) }
        else getTeacherId().then(id => { if (id) setTeacherId(id) })
      })
      .catch(e => {
        console.error('Teacher lookup failed:', e)
        getTeacherId().then(id => { if (id) setTeacherId(id) }).catch(() => {})
      })
  }, [])

  useEffect(() => {
    if (teacherId && user?.id) {
      getStudentBookingCalendar(teacherId, user.id, currentDate.getFullYear(), currentDate.getMonth())
        .then(setCalendarData)
        .catch(e => console.error('Calendar load failed:', e))
    }
  }, [teacherId, user, currentDate])

  // Events are shifted so the calendar visually shows the chosen display timezone
  const events = [
    ...calendarData.bookedSlots.map(cls => {
      const start = cls.scheduledAt?.toDate?.() ?? new Date()
      const end = new Date(start.getTime() + (cls.duration || 60) * 60000)
      const completed = cls.status === 'completed'
      return {
        id: cls.id,
        title: completed ? 'Done' : cls.mine ? 'Upcoming' : 'Busy',
        start: shiftToTz(start, displayTz),
        end: shiftToTz(end, displayTz),
        type: completed ? 'completed' : cls.mine ? 'mine' : 'booked',
      }
    }),
    ...calendarData.blockedSlots.map(slot => {
      const start = slot.startAt?.toDate?.() ?? new Date()
      const end = slot.endAt?.toDate?.() ?? new Date()
      return {
        id: slot.id, title: 'Busy',
        start: shiftToTz(start, displayTz),
        end: shiftToTz(end, displayTz),
        type: 'blocked',
      }
    }),
    // Highlighted slot the student tapped once (tap again to book)
    ...(pendingSlot ? [{
      id: '__sel__', title: 'Tap again to book',
      start: pendingSlot, end: addMinutes(pendingSlot, duration), type: 'selection',
    }] : []),
  ]

  // Overlaps a teacher-blocked (unavailable) time → cannot book at all
  function hitsBlocked(slotStart) {
    const slotEnd = addMinutes(slotStart, duration)
    return events.some(e => e.type === 'blocked' && slotStart < e.end && slotEnd > e.start)
  }
  // Overlaps another class → bookable, but needs teacher confirmation
  function hitsBusy(slotStart) {
    const slotEnd = addMinutes(slotStart, duration)
    return events.some(e => e.type === 'booked' && slotStart < e.end && slotEnd > e.start)
  }

  // Build a LOCAL Date from date+time strings (matches the shifted calendar space).
  // Avoids `new Date("yyyy-mm-dd")` which parses as UTC and shifts the day/time.
  function displayWallClock(dateStr, timeStr) {
    const [y, mo, d] = dateStr.split('-').map(Number)
    const [h, m] = timeStr.split(':').map(Number)
    return new Date(y, mo - 1, d, h, m, 0, 0)
  }

  function handleDateTimeChange(date, time) {
    const d = date !== undefined ? date : selectedDate
    const t = time !== undefined ? time : selectedTime
    setConflict(false)
    if (d && t) {
      const slotStart = displayWallClock(d, t)
      if (hitsBlocked(slotStart)) setConflict('blocked')
      else if (hitsBusy(slotStart)) setConflict('busy')
    }
  }

  const minDate = format(new Date(), 'yyyy-MM-dd')

  // Date number clicked in month view → open that day
  function handleDrillDown(date) {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    if (date < today) return
    setPendingSlot(null)
    setCurrentDate(date)
    setCurrentView('day')
  }

  // Slot clicked. Month view: open that whole day. Day view: first click highlights.
  function handleSelectSlot({ start }) {
    if (currentView === 'month') {
      const today = new Date(); today.setHours(0, 0, 0, 0)
      if (start < today) return
      setPendingSlot(null)
      setCurrentDate(start)
      setCurrentView('day')
      return
    }
    // Day view — first tap highlights the slot
    if (isBefore(unshiftFromTz(start, displayTz), new Date())) return // block past
    setPendingSlot(start)
  }

  // Open the booking modal for the highlighted slot (second tap on it)
  function openBookingFor(start) {
    setSelectedDate(format(start, 'yyyy-MM-dd'))
    setSelectedTime(format(start, 'HH:mm'))
    setConflict(false)
    handleDateTimeChange(format(start, 'yyyy-MM-dd'), format(start, 'HH:mm'))
    setShowPicker(true)
  }

  function handleSelectEvent(event) {
    if (event.type === 'selection') openBookingFor(event.start)
    // taps on busy/own blocks do nothing for students
  }

  // The real (absolute) instant for the picked wall-clock in the display timezone.
  // Robust + device-independent: treat (date,time) as a wall clock IN displayTz,
  // then subtract that timezone's offset to get the true UTC instant.
  function realInstant() {
    if (!selectedDate || !selectedTime) return null
    const [y, mo, d] = selectedDate.split('-').map(Number)
    const [h, mi] = selectedTime.split(':').map(Number)
    if ([y, mo, d, h, mi].some(n => Number.isNaN(n))) return null
    const utcGuess = Date.UTC(y, mo - 1, d, h, mi)
    const offset = tzOffsetMinutes(displayTz, new Date(utcGuess))
    return new Date(utcGuess - offset * 60000)
  }

  async function handleBook() {
    if (!selectedDate || !selectedTime || !teacherId) return
    const instant = realInstant()
    if (isBefore(instant, new Date())) return
    // Teacher-blocked times can't be booked at all
    if (hitsBlocked(displayWallClock(selectedDate, selectedTime))) { setConflict('blocked'); return }
    setBookingLoading(true)
    setBookingError('')
    try {
      await createBooking({
        studentId: user.id,
        teacherId,
        scheduledAt: Timestamp.fromDate(instant),
        duration,
        lessonNotes: note,
      })
      navigate('/student/dashboard')
    } catch (e) {
      console.error(e)
      setBookingError('Failed to book. Please try again.')
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
            Tap a date, then a free time slot to book instantly. Taken slots need teacher confirmation.
          </p>
        </div>

        {/* Timezone view toggle */}
        {teacherTz && teacherTz !== studentTz && (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-gray-400">Show times in:</span>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              <button onClick={() => setDisplayTz(studentTz)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${displayTz === studentTz ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}>
                My time ({tzCity(studentTz)})
              </button>
              <button onClick={() => setDisplayTz(teacherTz)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${displayTz === teacherTz ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}>
                Teacher's time ({tzCity(teacherTz)})
              </button>
            </div>
          </div>
        )}

        {/* Controls row — compact 3-tag legend + Book Class button on one line */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2.5 text-[11px] text-gray-500 min-w-0 flex-wrap">
            <span className="flex items-center gap-1 shrink-0">
              <span className="w-2.5 h-2.5 rounded-sm bg-green-200 border border-green-300" /> Upcoming
            </span>
            <span className="flex items-center gap-1 shrink-0">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-200 border border-red-300" /> Busy
            </span>
            <span className="flex items-center gap-1 shrink-0">
              <span className="w-2.5 h-2.5 rounded-sm bg-gray-200 border border-gray-300" /> Done
            </span>
          </div>
          <button
            onClick={() => setShowPicker(true)}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shrink-0"
          >
            <RiCalendarLine size={16} />
            Book Class
          </button>
        </div>

        {/* Calendar */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <style>{`
            /* Subtle neutral borders that read well on both light and dark */
            .rbc-month-view,
            .rbc-time-view             { border-color: rgba(128,128,128,0.2); }
            .rbc-header                { border-color: rgba(128,128,128,0.2) !important; font-size: 12px; font-weight: 500; color: #9ca3af; padding: 6px 4px; }
            .rbc-day-bg + .rbc-day-bg  { border-color: rgba(128,128,128,0.14) !important; }
            .rbc-month-row + .rbc-month-row { border-color: rgba(128,128,128,0.14) !important; }
            .rbc-timeslot-group        { border-color: rgba(128,128,128,0.14) !important; }
            .rbc-time-slot             { border-color: transparent !important; }
            .rbc-time-content          { border-top-color: rgba(128,128,128,0.14) !important; }
            .rbc-time-content > * + *   { border-left-color: rgba(128,128,128,0.14) !important; }
            .rbc-time-header-content   { border-left-color: rgba(128,128,128,0.14) !important; }
            .rbc-time-header-content > * + * { border-left-color: rgba(128,128,128,0.14) !important; }
            .rbc-time-header.rbc-overflowing { border-right-color: rgba(128,128,128,0.14) !important; }
            /* Remove the empty all-day row */
            .rbc-allday-cell           { display: none !important; }
            /* Today highlight — subtle tint */
            .rbc-today                 { background-color: rgba(245,158,11,0.07) !important; }
            /* Date cells in month view */
            .rbc-date-cell             { font-size: 12px; padding: 4px 6px; }
            .rbc-date-cell a           { cursor: pointer; }
            .rbc-date-cell a:hover     { color: #f59e0b; font-weight: 600; }
            .rbc-off-range-bg          { background: rgba(128,128,128,0.06); }
            .rbc-off-range .rbc-date-cell a { opacity: 0.35; pointer-events: none; }
            /* Clickable time slots in day view */
            .rbc-day-slot .rbc-time-slot:hover { background: rgba(245,158,11,0.07); cursor: pointer; }
            .rbc-slot-selection        { background: rgba(245,158,11,0.18) !important; }
            .rbc-label                 { font-size: 11px; color: #9ca3af; }
            .rbc-current-time-indicator { background: #f59e0b; height: 2px; }
          `}</style>
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: 540 }}
            date={currentDate}
            onNavigate={date => { setPendingSlot(null); setCurrentDate(date) }}
            view={currentView}
            onView={v => { setPendingSlot(null); setCurrentView(v) }}
            onDrillDown={handleDrillDown}
            drilldownView="day"
            selectable
            longPressThreshold={10}
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
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
            eventPropGetter={(event) => {
              const base = { borderRadius: '6px', fontSize: '11px', padding: '2px 6px' }
              if (event.type === 'selection')
                return { style: { ...base, backgroundColor: '#f59e0b', border: '2px solid #d97706', color: '#fff', fontWeight: 600 } }
              if (event.type === 'mine')
                return { style: { ...base, backgroundColor: '#bbf7d0', border: '1px solid #86efac', color: '#166534' } }
              if (event.type === 'completed')
                return { style: { ...base, backgroundColor: '#e5e7eb', border: '1px solid #d1d5db', color: '#4b5563' } }
              // busy / blocked
              return { style: { ...base, backgroundColor: '#fecaca', border: '1px solid #fca5a5', color: '#991b1b' } }
            }}
            views={['month', 'day']}
            popup
          />
        </div>
      </div>

      {/* Floating confirm bar when a slot is selected (reliable on mobile) */}
      {pendingSlot && !showPicker && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">
              {format(pendingSlot, 'EEE, d MMM')} · {format(pendingSlot, 'h:mm a')}
            </p>
            <p className="text-xs text-gray-400">{tzCity(displayTz)} time</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setPendingSlot(null)}
              className="px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={() => openBookingFor(pendingSlot)}
              className="px-4 py-2 text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-lg">
              Book this slot
            </button>
          </div>
        </div>
      )}

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

              {/* Dual-timezone preview — so the student picks a slot that works for the teacher too */}
              {selectedDate && selectedTime && realInstant() && (
                <div className="bg-amber-50 rounded-lg px-3 py-2.5 space-y-1">
                  <p className="text-xs font-medium text-amber-800">{fmtLongDate(realInstant(), studentTz)}</p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Your time ({tzCity(studentTz)})</span>
                    <span className="font-medium text-gray-800">{fmtTime(realInstant(), studentTz)}</span>
                  </div>
                  {teacherTz && teacherTz !== studentTz && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Teacher's time ({tzCity(teacherTz)})</span>
                      <span className="font-medium text-gray-800">{fmtTime(realInstant(), teacherTz)}</span>
                    </div>
                  )}
                </div>
              )}

              {conflict === 'blocked' && (
                <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">
                  The teacher is unavailable at this time. Please pick another slot.
                </p>
              )}
              {conflict === 'busy' && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                  This time already has a class. You can still request it — the teacher will confirm if it works.
                </p>
              )}
              {bookingError && (
                <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{bookingError}</p>
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
                disabled={bookingLoading || !selectedDate || !selectedTime || conflict === 'blocked'}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50"
              >
                {bookingLoading ? 'Booking...' : conflict === 'busy' ? 'Request anyway' : 'Book Class'}
              </button>
            </div>
          </div>
        </div>
      )}
    </StudentLayout>
  )
}
