import { useState, useEffect, useRef } from 'react'
import { RiCloseLine, RiErrorWarningLine, RiSearchLine } from 'react-icons/ri'
import { getAllStudents, createClass, createRecurringSchedule, getTeacherId, createNotification, findOverlappingClasses, findBlockedOverlaps, fmtWhen } from '../../firebase/db'
import { Timestamp } from 'firebase/firestore'

const DURATIONS = [30, 45, 60, 90, 120]
const FREQUENCIES = [
  { value: 'weekly', label: 'Every week' },
  { value: 'biweekly', label: 'Every 2 weeks' },
]

export default function ScheduleClassModal({ onClose, onSuccess, defaultDate }) {
  const [students, setStudents] = useState([])
  const [form, setForm] = useState({
    studentId: '',
    date: defaultDate ? formatDate(defaultDate) : '',
    time: defaultDate ? formatTime(defaultDate) : '',
    duration: 60,
    notes: '',
    isRecurring: false,
    frequency: 'weekly',
    endDate: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [teacherId, setTeacherId] = useState(null)
  const [overlap, setOverlap] = useState(false)
  const [blockedHit, setBlockedHit] = useState(null) // blocked slot the time falls into

  useEffect(() => {
    getAllStudents().then(setStudents)
    getTeacherId().then(setTeacherId)
  }, [])

  // Warn (non-blocking) if the chosen slot already has a class or falls into
  // a blocked (unavailable) period
  useEffect(() => {
    if (!teacherId || !form.date || !form.time) { setOverlap(false); setBlockedHit(null); return }
    let active = true
    const start = new Date(`${form.date}T${form.time}`)
    findOverlappingClasses(teacherId, start, Number(form.duration))
      .then(hits => { if (active) setOverlap(hits.length > 0) })
      .catch(() => {})
    findBlockedOverlaps(teacherId, start, Number(form.duration))
      .then(hits => { if (active) setBlockedHit(hits[0] || null) })
      .catch(() => {})
    return () => { active = false }
  }, [teacherId, form.date, form.time, form.duration])

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.studentId) return setError('Please select a student.')
    if (!form.date || !form.time) return setError('Please set a date and time.')
    setLoading(true)

    try {
      const scheduledAt = Timestamp.fromDate(new Date(`${form.date}T${form.time}`))
      // Shared calendar: all classes belong to the single teacher, even if an admin schedules them
      const tId = teacherId || await getTeacherId()
      if (!tId) { setError('No teacher account found.'); setLoading(false); return }
      const studentId = form.studentId
      // Collected and handed back to the page so the calendar updates instantly,
      // without waiting on (or depending on) a re-fetch round trip.
      const created = []
      // The student reads their notification in their own timezone
      const studentTz = students.find(s => s.id === studentId)?.timezone || 'Asia/Kolkata'

      if (form.isRecurring) {
        const recurring = await createRecurringSchedule({
          studentId,
          teacherId: tId,
          dayOfWeek: new Date(`${form.date}T${form.time}`).getDay(),
          time: form.time,
          duration: Number(form.duration),
          frequency: form.frequency,
          startDate: scheduledAt,
          endDate: form.endDate ? Timestamp.fromDate(new Date(form.endDate)) : null,
        })

        // Generate classes until end date or 8 weeks
        const occurrences = generateOccurrences(
          new Date(`${form.date}T${form.time}`),
          form.frequency,
          form.endDate ? new Date(form.endDate) : null,
          8
        )

        const refs = await Promise.all(occurrences.map(date => createClass({
          studentId,
          teacherId: tId,
          scheduledAt: Timestamp.fromDate(date),
          duration: Number(form.duration),
          lessonNotes: form.notes,
          recurringId: recurring.id,
          isRecurring: true,
          status: 'scheduled',
        })))
        occurrences.forEach((date, i) => created.push({
          id: refs[i].id,
          studentId, teacherId: tId,
          scheduledAt: Timestamp.fromDate(date),
          duration: Number(form.duration),
          lessonNotes: form.notes,
          recurringId: recurring.id,
          isRecurring: true,
          status: 'scheduled',
        }))
      } else {
        const ref = await createClass({
          studentId,
          teacherId: tId,
          scheduledAt,
          duration: Number(form.duration),
          lessonNotes: form.notes,
          recurringId: null,
          isRecurring: false,
          status: 'scheduled',
        })
        created.push({
          id: ref.id,
          studentId, teacherId: tId,
          scheduledAt,
          duration: Number(form.duration),
          lessonNotes: form.notes,
          recurringId: null,
          isRecurring: false,
          status: 'scheduled',
        })
      }

      // Let the student know a class was scheduled for them. Wrapped so a failed
      // notification can never hide a class that was actually created.
      try {
        const when = fmtWhen(new Date(`${form.date}T${form.time}`), studentTz)
        await createNotification(
          studentId,
          'class_scheduled',
          form.isRecurring
            ? `Starting ${when}, then ${form.frequency === 'weekly' ? 'every week' : 'every 2 weeks'}`
            : when,
          null,
          form.isRecurring ? 'Recurring classes scheduled' : 'New class scheduled',
        )
      } catch (e) { console.error('Class saved, student notify failed:', e) }

      onSuccess?.(created)
      onClose()
    } catch (err) {
      console.error(err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Schedule a Class</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <RiCloseLine size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Student — type to search instead of scrolling a long list */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Student *</label>
            <StudentPicker
              students={students}
              value={form.studentId}
              onChange={id => setForm(f => ({ ...f, studentId: id }))}
            />
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
              <input
                type="date" name="date" value={form.date} onChange={handleChange}
                min={new Date().toISOString().split('T')[0]}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Time *</label>
              <input
                type="time" name="time" value={form.time} onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Duration</label>
            <div className="flex gap-2 flex-wrap">
              {DURATIONS.map(d => (
                <button
                  key={d} type="button"
                  onClick={() => setForm(f => ({ ...f, duration: d }))}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    form.duration === d
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'border-gray-200 text-gray-600 hover:border-amber-300'
                  }`}
                >
                  {d < 60 ? `${d}m` : `${d / 60}h`}
                </button>
              ))}
            </div>
          </div>

          {/* Lesson notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Lesson notes (optional)</label>
            <textarea
              name="notes" value={form.notes} onChange={handleChange} rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
              placeholder="What will be covered in this class..."
            />
          </div>

          {/* Recurring */}
          <div className="border border-gray-100 rounded-xl p-4 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox" name="isRecurring" checked={form.isRecurring} onChange={handleChange}
                className="w-4 h-4 accent-amber-500"
              />
              <span className="text-sm font-medium text-gray-700">Make this a recurring class</span>
            </label>

            {form.isRecurring && (
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Repeats</label>
                  <div className="flex gap-2">
                    {FREQUENCIES.map(f => (
                      <button
                        key={f.value} type="button"
                        onClick={() => setForm(fm => ({ ...fm, frequency: f.value }))}
                        className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                          form.frequency === f.value
                            ? 'bg-amber-500 text-white border-amber-500'
                            : 'border-gray-200 text-gray-600 hover:border-amber-300'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">End date (optional)</label>
                  <input
                    type="date" name="endDate" value={form.endDate} onChange={handleChange}
                    min={form.date}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <p className="text-xs text-gray-400 mt-1">Leave blank to generate 8 classes.</p>
                </div>
              </div>
            )}
          </div>

          {overlap && !form.isRecurring && (
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              <RiErrorWarningLine size={15} className="shrink-0 mt-0.5" />
              <span>This time already has a class. You can still schedule it (e.g. a group lesson).</span>
            </div>
          )}

          {blockedHit && (
            <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">
              <RiErrorWarningLine size={15} className="shrink-0 mt-0.5" />
              <span>
                This time is blocked{blockedHit.reason ? ` (${blockedHit.reason})` : ''} — students can't book it.
                You can still schedule here if it's a known exception.
              </span>
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button" onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2.5 text-sm hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit" disabled={loading}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Scheduling...' : form.isRecurring ? 'Schedule Classes' : 'Schedule Class'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Type-to-search student picker. With 80+ students a plain dropdown means
// scrolling; this filters as you type and still works by tapping the list.
function StudentPicker({ students, value, onChange }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const selected = students.find(s => s.id === value)
  const q = query.trim().toLowerCase()
  const matches = q
    ? students.filter(s =>
        s.name?.toLowerCase().includes(q) ||
        s.userId?.toLowerCase().includes(q) ||
        s.country?.toLowerCase().includes(q))
    : students

  // Showing the chosen student as a chip keeps the choice unmistakable
  if (selected && !open) {
    return (
      <div className="flex items-center justify-between gap-2 border border-gray-200 rounded-lg px-3 py-2">
        <span className="text-sm text-gray-800 truncate">{selected.name}</span>
        <button type="button"
          onClick={() => { onChange(''); setQuery(''); setOpen(true) }}
          className="shrink-0 text-xs text-amber-600 hover:underline">
          Change
        </button>
      </div>
    )
  }

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
        <input
          type="text" value={query} autoFocus={open}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Type a name to search..."
          className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-11 z-40 bg-white rounded-xl shadow-lg border border-gray-100 max-h-56 overflow-y-auto">
          {matches.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No student matches "{query}".</p>
          ) : (
            matches.map(s => (
              <button key={s.id} type="button"
                onClick={() => { onChange(s.id); setQuery(''); setOpen(false) }}
                className="w-full text-left px-4 py-2.5 hover:bg-amber-50 transition-colors border-b border-gray-50 last:border-b-0">
                <span className="block text-sm text-gray-800 truncate">{s.name}</span>
                {s.country && <span className="block text-xs text-gray-400">{s.country}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function formatDate(date) {
  return date.toISOString().split('T')[0]
}

function formatTime(date) {
  return date.toTimeString().slice(0, 5)
}

function generateOccurrences(startDate, frequency, endDate, maxCount) {
  const dates = []
  const intervalDays = frequency === 'weekly' ? 7 : 14
  let current = new Date(startDate)
  const limit = endDate || null

  while (dates.length < maxCount) {
    if (limit && current > limit) break
    dates.push(new Date(current))
    current.setDate(current.getDate() + intervalDays)
  }

  return dates
}
