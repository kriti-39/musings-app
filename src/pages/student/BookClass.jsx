import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay, addMinutes, isBefore, startOfDay, addDays } from 'date-fns'
import { enUS } from 'date-fns/locale/en-US'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import StudentLayout from '../../components/student/StudentLayout'
import { useAuth } from '../../context/AuthContext'
import { getTeacherCalendarForMonth, createClass, getTeacherId } from '../../firebase/db'
import { Timestamp } from 'firebase/firestore'
import { RiCloseLine, RiCalendarLine } from 'react-icons/ri'

const localizer = dateFnsLocalizer({
  format, parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { 'en-US': enUS },
})

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
      return { id: slot.id, title: 'Not Available', start, end, type: 'blocked' }
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

  // Min date = today
  const minDate = format(new Date(), 'yyyy-MM-dd')

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
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">Book a Class</h1>
            <p className="text-sm text-gray-400 mt-1">Check availability below, then pick your slot.</p>
          </div>
          <button
            onClick={() => setShowPicker(true)}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            <RiCalendarLine size={16} />
            Pick a time
          </button>
        </div>

        {/* Legend */}
        <div className="flex gap-5 mb-4">
          {[
            { color: '#fee2e2', border: '#fca5a5', label: 'Booked / Not Available' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-3 h-3 rounded-sm border" style={{ backgroundColor: l.color, borderColor: l.border }} />
              {l.label}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <style>{`
            .rbc-calendar { font-family: inherit; }
            .rbc-header { padding: 8px; font-size: 12px; font-weight: 500; color: #6b7280; border-color: #f3f4f6; }
            .rbc-today { background-color: #fffbeb; }
            .rbc-toolbar button { font-size: 13px; border-radius: 8px; border-color: #e5e7eb; color: #374151; }
            .rbc-toolbar button.rbc-active { background-color: #f59e0b; border-color: #f59e0b; color: white; }
            .rbc-toolbar button:hover { background-color: #fef3c7; }
          `}</style>
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: 520 }}
            onNavigate={date => setCurrentDate(date)}
            eventPropGetter={() => ({
              style: {
                backgroundColor: '#fee2e2',
                border: 'none', color: '#991b1b',
                borderRadius: '6px', fontSize: '11px', padding: '2px 6px',
              }
            })}
            views={['month', 'week', 'day']}
            defaultView="week"
            popup
          />
        </div>
      </div>

      {/* Booking modal */}
      {showPicker && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
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
                        duration === d ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-200 text-gray-600 hover:border-amber-300'
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
