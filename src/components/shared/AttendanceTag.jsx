import { useState } from 'react'
import { RiPushpinFill, RiCheckLine } from 'react-icons/ri'
import { useAuth } from '../../context/AuthContext'
import { updateUser } from '../../firebase/db'
import { attendance, attendanceLabel, REGULAR_PER_MONTH } from '../../utils/studentStats'

const STYLES = {
  regular: 'bg-green-50 text-green-700',
  irregular: 'bg-orange-50 text-orange-600',
  unknown: 'bg-gray-100 text-gray-500',
}

// ─── Regular or irregular ────────────────────────────────────────────────────
// Staff only — never rendered on anything a student sees. Worked out from
// their classes (two a month or more is regular), with an admin able to pin it
// either way for the cases the arithmetic can't know about.
export default function AttendanceTag({ student, classes, onChange, editable = false }) {
  const { role } = useAuth()
  const isAdmin = role === 'admin'
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const { tag, pinned, computed } = attendance(student, classes)
  const style = STYLES[tag] || STYLES.unknown

  async function set(value) {
    setBusy(true)
    try {
      await updateUser(student.id, { attendanceTag: value })
      onChange?.()
      setOpen(false)
    } catch (e) {
      console.error('Could not set the attendance tag:', e)
    } finally {
      setBusy(false)
    }
  }

  const chip = (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${style}`}>
      {pinned && <RiPushpinFill size={10} className="shrink-0 opacity-70" />}
      {attendanceLabel(tag)}
    </span>
  )

  if (!editable || !isAdmin) return chip

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} disabled={busy}
        className="disabled:opacity-50" title="Set regular or irregular">
        {chip}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 z-20 w-60 bg-white rounded-xl border border-gray-200 shadow-lg p-1.5">
            <p className="text-[11px] text-gray-400 px-2.5 py-1.5">
              {computed
                ? `Their classes say ${attendanceLabel(computed).toLowerCase()} — ${REGULAR_PER_MONTH} a month or more is regular.`
                : 'Not enough classes yet to tell.'}
            </p>
            {[
              { v: null, label: 'Follow their classes' },
              { v: 'regular', label: 'Always regular' },
              { v: 'irregular', label: 'Always irregular' },
            ].map(o => {
              const active = (student?.attendanceTag ?? null) === o.v
              return (
                <button key={o.label} onClick={() => set(o.v)} disabled={busy}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs text-left transition-colors ${
                    active ? 'bg-amber-50 text-amber-800 font-medium' : 'text-gray-600 hover:bg-gray-50'
                  }`}>
                  {o.label}
                  {active && <RiCheckLine size={14} className="shrink-0" />}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
