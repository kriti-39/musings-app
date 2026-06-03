import { useState, useEffect } from 'react'
import { RiCloseLine } from 'react-icons/ri'
import { getAllStudents, createClass, createRecurringSchedule, getTeacherId } from '../../firebase/db'
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

  useEffect(() => {
    getAllStudents().then(setStudents)
  }, [])

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
      const teacherId = await getTeacherId()
      if (!teacherId) { setError('No teacher account found.'); setLoading(false); return }
      const studentId = form.studentId

      if (form.isRecurring) {
        const recurring = await createRecurringSchedule({
          studentId,
          teacherId,
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

        await Promise.all(occurrences.map(date => createClass({
          studentId,
          teacherId,
          scheduledAt: Timestamp.fromDate(date),
          duration: Number(form.duration),
          lessonNotes: form.notes,
          recurringId: recurring.id,
          isRecurring: true,
          status: 'scheduled',
        })))
      } else {
        await createClass({
          studentId,
          teacherId,
          scheduledAt,
          duration: Number(form.duration),
          lessonNotes: form.notes,
          recurringId: null,
          isRecurring: false,
          status: 'scheduled',
        })
      }

      onSuccess?.()
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
          {/* Student */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Student *</label>
            <select
              name="studentId" value={form.studentId} onChange={handleChange}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="">Select a student</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
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
