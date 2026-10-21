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
export default function AttendanceTag({ student, classes, onChange, editable = false, pill = false }) {
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

  // `pill` is the version that sits on the ring under an avatar: solid, tiny,
  // and in the ring's own colour so the two read as one thing.
  const chip = pill ? (
    <span className={`att-pill att-ring--${tag} inline-flex items-center gap-1 text-[10px] leading-none px-2 py-1 rounded-full font-semibold uppercase whitespace-nowrap`}>
      {pinned && <RiPushpinFill size={9} className="shrink-0 opacity-80" />}
      {attendanceLabel(tag)}
    </span>
  ) : (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${style}`}>
      {pinned && <RiPushpinFill size={10} className="shrink-0 opacity-70" />}
      {attendanceLabel(tag)}
    </span>
  )

  if (!editable || !isAdmin) return chip

  return (
    <>
      <button onClick={() => setOpen(true)} disabled={busy}
        className="disabled:opacity-50" title="Set regular or irregular">
        {chip}
      </button>

      {/* A centred dialog, not a dropdown. Anchored positioning kept putting
          this off the edge of a phone — it hangs off a 64px avatar in one
          place and the last column of a three-column grid in another, and
          either way `right-0` opens it into nothing. A dialog has no anchor
          to get wrong, and matches every other choice in the app. */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-2 mb-[env(safe-area-inset-bottom)]"
            onClick={e => e.stopPropagation()}>
            <div className="px-3 pt-2 pb-3">
              <p className="text-sm font-semibold text-gray-800">
                {student?.name?.split(' ')[0] || 'This student'} — regular or irregular?
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {computed
                  ? `Their classes say ${attendanceLabel(computed).toLowerCase()}. ${REGULAR_PER_MONTH} a month or more counts as regular.`
                  : 'Not enough classes yet to tell.'}
              </p>
            </div>

            {[
              { v: null, label: 'Follow their classes', hint: 'Worked out from attendance, kept up to date' },
              { v: 'regular', label: 'Always regular', hint: 'Ignore a quiet patch — illness, travel, exams' },
              { v: 'irregular', label: 'Always irregular', hint: 'Keep the flag on however often they come' },
            ].map(o => {
              const active = (student?.attendanceTag ?? null) === o.v
              return (
                <button key={o.label} onClick={() => set(o.v)} disabled={busy}
                  className={`w-full flex items-start justify-between gap-3 px-3 py-3 rounded-xl text-left transition-colors disabled:opacity-50 ${
                    active ? 'bg-amber-50' : 'hover:bg-gray-50'
                  }`}>
                  <span className="min-w-0">
                    <span className={`block text-sm ${active ? 'font-semibold text-amber-800' : 'text-gray-700'}`}>
                      {o.label}
                    </span>
                    <span className="block text-[11px] text-gray-400 mt-0.5">{o.hint}</span>
                  </span>
                  {active && <RiCheckLine size={17} className="shrink-0 text-amber-600 mt-0.5" />}
                </button>
              )
            })}

            <button onClick={() => setOpen(false)} disabled={busy}
              className="w-full mt-1 py-2.5 text-sm text-gray-500 rounded-xl hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  )
}
