import { useState, useEffect } from 'react'
import { RiWhatsappLine, RiCheckLine, RiArrowGoBackLine, RiErrorWarningLine } from 'react-icons/ri'
import {
  subscribePendingFollowUps, markFollowUpDone, undoFollowUpDone,
  getAllStudentsIncludingInactive, fmtWhen,
} from '../../firebase/db'
import { whatsappUrl, cancelledClassMessage, normalizePhone } from '../../utils/whatsapp'
import { useAuth } from '../../context/AuthContext'

const byLatest = (a, b) => (b.scheduledAt?.seconds ?? 0) - (a.scheduledAt?.seconds ?? 0)

// Students whose class the studio cancelled and who haven't been spoken to yet.
// The list is live and shared: the teacher and every admin see the same one,
// and the moment anyone messages or ticks off a student, that student drops off
// everyone's screen — so no one is contacted twice.
export default function FollowUpCard() {
  const { user, role } = useAuth()
  const staffId = user?.id
  const [items, setItems] = useState([])      // live: still waiting, across all staff
  const [students, setStudents] = useState({})
  const [loading, setLoading] = useState(true)
  // Rows handled on THIS device. They leave the live list at once, so they're
  // kept here to stay visible (greyed, with Undo) for the person who did it.
  const [mine, setMine] = useState({})        // id -> { cls, done }

  useEffect(() => {
    getAllStudentsIncludingInactive()
      .then(all => {
        const map = {}
        all.forEach(s => { map[s.id] = s })
        setStudents(map)
      })
      .catch(e => console.error('Follow-up: students failed to load:', e))

    const unsubscribe = subscribePendingFollowUps(
      list => { setItems(list); setLoading(false) },
      e => { console.error('Follow-up list failed to load:', e); setLoading(false) },
    )
    return unsubscribe
  }, [])

  // Once an Undo has landed, the row is back in the live list — stop tracking it
  useEffect(() => {
    const live = new Set(items.map(c => c.id))
    setMine(m => {
      const stale = Object.keys(m).filter(id => !m[id].done && live.has(id))
      if (!stale.length) return m
      const next = { ...m }
      stale.forEach(id => { delete next[id] })
      return next
    })
  }, [items])

  async function handleDone(cls, via) {
    setMine(m => ({ ...m, [cls.id]: { cls, done: true } }))   // tick off straight away
    try { await markFollowUpDone(cls.id, staffId, via) }
    catch (e) {
      console.error('Could not mark follow-up done:', e)
      setMine(m => { const next = { ...m }; delete next[cls.id]; return next })
    }
  }

  async function handleUndo(cls) {
    // Keep showing it (as active) until the live list brings it back
    setMine(m => ({ ...m, [cls.id]: { cls, done: false } }))
    try { await undoFollowUpDone(cls.id) }
    catch (e) {
      console.error('Could not undo:', e)
      setMine(m => ({ ...m, [cls.id]: { cls, done: true } }))
    }
  }

  const live = new Set(items.map(c => c.id))
  const heldHere = Object.values(mine).filter(m => !live.has(m.cls.id)).map(m => m.cls)
  const rows = [...items, ...heldHere].sort(byLatest)
  const isDone = id => mine[id]?.done === true
  const outstanding = rows.filter(c => !isDone(c.id))

  if (loading || rows.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-amber-100">
      <div className="px-4 py-2.5 border-b border-gray-50">
        <h2 className="text-sm font-semibold text-gray-800">
          Follow up for cancelled {outstanding.length === 1 ? 'class' : 'classes'}
          {outstanding.length > 1 && (
            <span className="font-normal text-gray-400"> · {outstanding.length}</span>
          )}
        </h2>
      </div>

      <div>
        {rows.map(cls => {
          const s = students[cls.studentId]
          const date = cls.scheduledAt?.toDate?.()
          const when = fmtWhen(date, s?.timezone)
          const done = isDone(cls.id)
          const hasNumber = !!normalizePhone(s?.phone, s?.country)
          // Guruji writes in the first person; admins write for the studio
          const url = whatsappUrl(s?.phone, s?.country, cancelledClassMessage({
            name: s?.name, date, tz: s?.timezone, fromTeacher: role === 'teacher',
          }))

          return (
            <div key={cls.id}
              className={`px-4 py-2.5 border-t border-gray-100 first:border-t-0 flex items-center justify-between gap-3 ${
                done ? 'opacity-50' : ''
              }`}>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate leading-tight">{s?.name || 'Student'}</p>
                <p className="text-xs text-gray-400 leading-tight mt-0.5">{when}</p>
                {!hasNumber && !done && (
                  <p className="text-[11px] text-amber-600 leading-tight mt-0.5 flex items-center gap-1">
                    <RiErrorWarningLine size={11} className="shrink-0" /> No phone saved
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {done ? (
                  <button onClick={() => handleUndo(cls)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <RiArrowGoBackLine size={13} /> Undo
                  </button>
                ) : (
                  <>
                    <button onClick={() => handleDone(cls, 'manual')} title="Already spoken to them"
                      className="p-1.5 text-gray-400 hover:text-green-600 transition-colors">
                      <RiCheckLine size={16} />
                    </button>
                    <a href={url} target="_blank" rel="noopener noreferrer"
                      onClick={() => handleDone(cls, 'whatsapp')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-medium transition-colors">
                      <RiWhatsappLine size={14} /> Message
                    </a>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
