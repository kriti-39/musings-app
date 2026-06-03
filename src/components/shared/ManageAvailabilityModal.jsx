import { useState, useEffect } from 'react'
import { RiCloseLine, RiAddLine, RiDeleteBinLine } from 'react-icons/ri'
import { getBlockedSlotsForMonth, addBlockedSlot, deleteBlockedSlot, getTeacherId } from '../../firebase/db'

export default function ManageAvailabilityModal({ onClose }) {
  const [teacherId, setTeacherId] = useState(null)
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ date: '', startTime: '', endTime: '', reason: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Shared calendar: availability always belongs to the single teacher
  useEffect(() => { getTeacherId().then(id => setTeacherId(id)) }, [])

  async function fetchSlots() {
    if (!teacherId) return
    setLoading(true)
    const now = new Date()
    const results = await Promise.all([0, 1, 2].map(i => {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      return getBlockedSlotsForMonth(teacherId, d.getFullYear(), d.getMonth())
    }))
    const all = results.flat().sort((a, b) =>
      (a.startAt?.seconds ?? 0) - (b.startAt?.seconds ?? 0)
    )
    setSlots(all)
    setLoading(false)
  }

  useEffect(() => { if (teacherId) fetchSlots() }, [teacherId])

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.date || !form.startTime || !form.endTime) {
      setError('Please fill in date, start time and end time.')
      return
    }
    const start = new Date(`${form.date}T${form.startTime}`)
    const end = new Date(`${form.date}T${form.endTime}`)
    if (end <= start) { setError('End time must be after start time.'); return }
    setError('')
    setSaving(true)
    try {
      await addBlockedSlot(teacherId, start.toISOString(), end.toISOString(), form.reason)
      setForm({ date: '', startTime: '', endTime: '', reason: '' })
      await fetchSlots()
    } catch (e) {
      console.error(e)
      setError('Failed to add slot.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(slotId) {
    await deleteBlockedSlot(slotId)
    setSlots(s => s.filter(x => x.id !== slotId))
  }

  function formatSlot(slot) {
    const start = slot.startAt?.toDate?.() ?? new Date()
    const end = slot.endAt?.toDate?.() ?? new Date()
    return {
      date: start.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
      time: `${start.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`,
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Manage Availability</h2>
          <button onClick={onClose}><RiCloseLine size={20} className="text-gray-400" /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Add new blocked slot */}
          <form onSubmit={handleAdd} className="space-y-3">
            <p className="text-xs font-medium text-gray-600">Block a time slot</p>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date</label>
              <input type="date" value={form.date}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Start time</label>
                <input type="time" value={form.startTime}
                  onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">End time</label>
                <input type="time" value={form.endTime}
                  onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Reason (optional, internal)</label>
              <input value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="e.g. Personal appointment"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
              <RiAddLine size={16} />
              {saving ? 'Blocking...' : 'Block this slot'}
            </button>
          </form>

          {/* Existing blocked slots */}
          <div>
            <p className="text-xs font-medium text-gray-600 mb-3">Upcoming blocked slots</p>
            {loading ? (
              <p className="text-xs text-gray-400">Loading...</p>
            ) : slots.length === 0 ? (
              <p className="text-xs text-gray-400">No blocked slots.</p>
            ) : (
              <div className="space-y-2">
                {slots.map(slot => {
                  const { date, time } = formatSlot(slot)
                  return (
                    <div key={slot.id} className="flex items-center justify-between bg-red-50 rounded-xl px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{date}</p>
                        <p className="text-xs text-gray-500">{time}{slot.reason ? ` · ${slot.reason}` : ''}</p>
                      </div>
                      <button onClick={() => handleDelete(slot.id)}
                        className="text-red-400 hover:text-red-600 transition-colors">
                        <RiDeleteBinLine size={16} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
