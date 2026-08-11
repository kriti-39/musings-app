import { useState, useEffect } from 'react'
import { RiCloseLine, RiAddLine, RiDeleteBinLine, RiErrorWarningLine } from 'react-icons/ri'
import {
  getBlockedSlotsForMonth, addBlockedRange, deleteBlockedSlot, deleteBlockedGroup, getTeacherId,
  buildBlockIntervals, findClassesInIntervals, cancelClassesForBlock, getAllStudentsIncludingInactive,
} from '../../firebase/db'

export default function ManageAvailabilityModal({ onClose }) {
  const [teacherId, setTeacherId] = useState(null)
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    startDate: '', endDate: '', fullDay: false, startTime: '', endTime: '', reason: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // Classes that would be cancelled by the pending block — shown for confirmation
  const [clash, setClash] = useState(null) // { classes, students }

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
    if (!form.startDate) { setError('Please pick a date.'); return }
    if (form.endDate && form.endDate < form.startDate) {
      setError('"To" date must be on or after the "From" date.')
      return
    }
    if (!form.fullDay) {
      if (!form.startTime || !form.endTime) {
        setError('Set start and end times, or tick "Block full day(s)".')
        return
      }
      if (form.endTime <= form.startTime) {
        setError('End time must be after start time.')
        return
      }
    }
    setError('')
    setSaving(true)
    try {
      // Check for classes inside the period BEFORE blocking — the teacher must
      // see what would be cancelled and agree to it first.
      const intervals = buildBlockIntervals(blockOpts())
      const hits = await findClassesInIntervals(teacherId, intervals)
      if (hits.length > 0) {
        const students = {}
        try {
          const all = await getAllStudentsIncludingInactive()
          all.forEach(s => { students[s.id] = s })
        } catch { /* names fall back to "Student" */ }
        setClash({ classes: hits, students })
        return
      }
      await applyBlock([])
    } catch (e) {
      console.error(e)
      setError('Failed to block this period.')
    } finally {
      setSaving(false)
    }
  }

  function blockOpts() {
    return {
      startDate: form.startDate,
      endDate: form.endDate || null,
      fullDay: form.fullDay,
      startTime: form.startTime,
      endTime: form.endTime,
      reason: form.reason,
    }
  }

  // Write the block, cancelling any classes the teacher agreed to displace.
  async function applyBlock(classesToCancel) {
    await addBlockedRange(teacherId, blockOpts())
    if (classesToCancel.length) await cancelClassesForBlock(classesToCancel)
    setForm({ startDate: '', endDate: '', fullDay: false, startTime: '', endTime: '', reason: '' })
    setClash(null)
    await fetchSlots()
  }

  async function confirmClash() {
    setSaving(true)
    setError('')
    try {
      await applyBlock(clash.classes)
    } catch (e) {
      console.error(e)
      setError('Failed to block this period.')
    } finally {
      setSaving(false)
    }
  }

  // Old single slots have no groupId; grouped ranges share one. Either way the
  // list shows ONE row per block and deletes the whole thing at once.
  const groups = []
  const seen = new Map()
  for (const slot of slots) {
    const key = slot.groupId || slot.id
    if (seen.has(key)) {
      const g = seen.get(key)
      g.days.push(slot)
    } else {
      const g = { key, groupId: slot.groupId || null, days: [slot] }
      seen.set(key, g)
      groups.push(g)
    }
  }

  async function handleDelete(group) {
    if (group.groupId) await deleteBlockedGroup(group.groupId)
    else await deleteBlockedSlot(group.days[0].id)
    setSlots(s => s.filter(x => (x.groupId || x.id) !== group.key))
  }

  function formatGroup(group) {
    const first = group.days[0]
    const last = group.days[group.days.length - 1]
    const start = first.startAt?.toDate?.() ?? new Date()
    const end = last.endAt?.toDate?.() ?? new Date()
    const fmtDay = (d) => d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
    const date = group.days.length > 1 ? `${fmtDay(start)} – ${fmtDay(end)}` : fmtDay(start)
    const fullDay = first.fullDay
      || (start.getHours() === 0 && start.getMinutes() === 0 && end.getHours() === 23 && end.getMinutes() === 59)
    const time = fullDay
      ? 'Full day'
      : `${start.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} – ${(first.endAt?.toDate?.() ?? end).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
    return { date, time }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Manage Availability</h2>
          <button onClick={onClose}><RiCloseLine size={20} className="text-gray-400" /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Add new blocked period */}
          <form onSubmit={handleAdd} className="space-y-3">
            <p className="text-xs font-medium text-gray-600">Block time off</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">From</label>
                <input type="date" value={form.startDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">To (optional)</label>
                <input type="date" value={form.endDate}
                  min={form.startDate || new Date().toISOString().split('T')[0]}
                  onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer py-1">
              <input type="checkbox" checked={form.fullDay}
                onChange={e => setForm(f => ({ ...f, fullDay: e.target.checked }))}
                className="w-4 h-4 accent-amber-500"
              />
              <span className="text-sm text-gray-700">Block full day(s)</span>
            </label>
            {!form.fullDay && (
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
            )}
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
              {saving ? 'Blocking...' : 'Block this time'}
            </button>
          </form>

          {/* Existing blocked periods */}
          <div>
            <p className="text-xs font-medium text-gray-600 mb-3">Upcoming blocked time</p>
            {loading ? (
              <p className="text-xs text-gray-400">Loading...</p>
            ) : groups.length === 0 ? (
              <p className="text-xs text-gray-400">Nothing blocked.</p>
            ) : (
              <div className="space-y-2">
                {groups.map(group => {
                  const { date, time } = formatGroup(group)
                  return (
                    <div key={group.key} className="flex items-center justify-between bg-red-50 rounded-xl px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{date}</p>
                        <p className="text-xs text-gray-500">{time}{group.days[0].reason ? ` · ${group.days[0].reason}` : ''}</p>
                      </div>
                      <button onClick={() => handleDelete(group)}
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

      {/* Clash confirmation — classes inside the period the teacher is blocking */}
      {clash && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <RiErrorWarningLine size={18} className="text-amber-500" />
                <h2 className="text-base font-semibold text-gray-800">
                  {clash.classes.length} class{clash.classes.length > 1 ? 'es' : ''} in this period
                </h2>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Blocking this time will cancel {clash.classes.length > 1 ? 'these classes' : 'this class'} and
                notify {clash.classes.length > 1 ? 'the students' : 'the student'} to reschedule after
                consulting with Guruji.
              </p>
            </div>

            <div className="px-6 py-4 overflow-y-auto space-y-2">
              {clash.classes.map(c => {
                const d = c.scheduledAt?.toDate?.()
                return (
                  <div key={c.id} className="bg-red-50 rounded-xl px-4 py-3">
                    <p className="text-sm font-medium text-gray-800">
                      {clash.students[c.studentId]?.name || 'Student'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {d ? d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'}
                      {d ? ` · ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''}
                      {` · ${c.duration || 60} min`}
                      {c.status === 'pending' ? ' · awaiting confirmation' : ''}
                    </p>
                  </div>
                )
              })}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setClash(null)} disabled={saving}
                className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2.5 text-sm hover:bg-gray-50 disabled:opacity-50">
                Keep classes
              </button>
              <button onClick={confirmClash} disabled={saving}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50">
                {saving ? 'Blocking...' : 'Block & cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
