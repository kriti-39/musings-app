import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { enUS } from 'date-fns/locale/en-US'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import StudentLayout from '../../components/student/StudentLayout'
import { useAuth } from '../../context/AuthContext'
import { getTeacherCalendarForMonth, createClass, getTeacherId } from '../../firebase/db'
import { Timestamp } from 'firebase/firestore'
import { RiCloseLine } from 'react-icons/ri'

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
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [bookingLoading, setBookingLoading] = useState(false)
  const [duration, setDuration] = useState(60)
  const [note, setNote] = useState('')

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
    const slotEnd = new Date(slotStart.getTime() + duration * 60000)
    return !events.some(e => {
      const eStart = e.start
      const eEnd = e.end
      return slotStart < eEnd && slotEnd > eStart
    })
  }

  async function handleBook() {
    if (!selectedSlot || !teacherId) return
    setBookingLoading(true)
    try {
      await createClass({
        studentId: user.id,
        teacherId,
        scheduledAt: Timestamp.fromDate(selectedSlot),
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
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-800">Book a Class</h1>
          <p className="text-sm text-gray-400 mt-1">Click an available slot to request a class. The teacher will confirm.</p>
        </div>

        {/* Legend */}
        <div className="flex gap-5 mb-4">
          {[
            { color: '#d1fae5', border: '#6ee7b7', label: 'Available' },
            { color: '#fee2e2', border: '#fca5a5', label: 'Booked / Not Available' },
            { color: '#fef3c7', border: '#fcd34d', label: 'Selected' },
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
            .rbc-slot-selection { background-color: rgba(245,158,11,0.15); }
          `}</style>
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: 560 }}
            onNavigate={date => setCurrentDate(date)}
            selectable
            onSelectSlot={({ start }) => {
              if (start < new Date()) return
              if (isSlotAvailable(start)) setSelectedSlot(start)
            }}
            eventPropGetter={e => ({
              style: {
                backgroundColor: e.type === 'blocked' ? '#fee2e2' : '#fecaca',
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
      {selectedSlot && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-800">Request Class</h2>
              <button onClick={() => setSelectedSlot(null)}><RiCloseLine size={20} className="text-gray-400" /></button>
            </div>

            <div className="bg-amber-50 rounded-xl px-4 py-3 mb-4">
              <p className="text-sm font-medium text-amber-800">
                {selectedSlot.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                {selectedSlot.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-2">Duration</label>
              <div className="flex gap-2">
                {[30, 45, 60, 90].map(d => (
                  <button key={d} type="button" onClick={() => setDuration(d)}
                    className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                      duration === d ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-200 text-gray-600 hover:border-amber-300'
                    }`}
                  >
                    {d < 60 ? `${d}m` : `${d/60}h`}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-xs font-medium text-gray-600 mb-1">Note to teacher (optional)</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                placeholder="What you'd like to learn..."
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setSelectedSlot(null)} className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2.5 text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={handleBook} disabled={bookingLoading}
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
