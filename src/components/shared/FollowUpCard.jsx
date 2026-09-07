import { useState, useEffect } from 'react'
import { RiWhatsappLine, RiCheckLine, RiArrowGoBackLine, RiErrorWarningLine } from 'react-icons/ri'
import {
  getPendingFollowUps, markFollowUpDone, undoFollowUpDone,
  getAllStudentsIncludingInactive, fmtWhen,
} from '../../firebase/db'
import { whatsappUrl, cancelledClassMessage, normalizePhone } from '../../utils/whatsapp'

// Students whose class the studio cancelled and who haven't been spoken to yet.
// Only shows up when there's something to do; opening WhatsApp ticks the
// student off, so the list empties itself as the messages go out.
export default function FollowUpCard({ staffId }) {
  const [items, setItems] = useState([])
  const [students, setStudents] = useState({})
  const [done, setDone] = useState({})   // id -> true, kept briefly so Undo is possible
  const [loading, setLoading] = useState(true)

  async function fetchAll() {
    try {
      const [pending, all] = await Promise.all([
        getPendingFollowUps(),
        getAllStudentsIncludingInactive(),
      ])
      const map = {}
      all.forEach(s => { map[s.id] = s })
      setStudents(map)
      setItems(pending)
    } catch (e) {
      console.error('Follow-up list failed to load:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  async function handleDone(cls, via) {
    setDone(d => ({ ...d, [cls.id]: true }))     // tick off straight away
    try { await markFollowUpDone(cls.id, staffId, via) }
    catch (e) {
      console.error('Could not mark follow-up done:', e)
      setDone(d => ({ ...d, [cls.id]: false }))
    }
  }

  async function handleUndo(cls) {
    setDone(d => ({ ...d, [cls.id]: false }))
    try { await undoFollowUpDone(cls.id) }
    catch (e) { console.error('Could not undo:', e) }
  }

  const outstanding = items.filter(c => !done[c.id])
  if (loading || items.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-amber-100">
      <div className="px-5 py-4 border-b border-gray-50">
        <h2 className="text-sm font-semibold text-gray-800">
          Follow up{outstanding.length > 0 ? ` · ${outstanding.length}` : ''}
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">
          {outstanding.length === 0
            ? 'All caught up — everyone has been contacted.'
            : 'Classes you cancelled. Message each student to rearrange.'}
        </p>
      </div>

      <div>
        {items.map(cls => {
          const s = students[cls.studentId]
          const when = fmtWhen(cls.scheduledAt?.toDate?.(), s?.timezone)
          const isDone = done[cls.id]
          const hasNumber = !!normalizePhone(s?.phone, s?.country)
          const url = whatsappUrl(s?.phone, s?.country, cancelledClassMessage({ name: s?.name, when }))

          return (
            <div key={cls.id}
              className={`px-5 py-3.5 border-t border-gray-100 first:border-t-0 flex items-center justify-between gap-3 ${
                isDone ? 'opacity-50' : ''
              }`}>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{s?.name || 'Student'}</p>
                <p className="text-xs text-gray-400 mt-0.5">{when}</p>
                {!hasNumber && !isDone && (
                  <p className="text-[11px] text-amber-600 mt-0.5 flex items-center gap-1">
                    <RiErrorWarningLine size={12} /> No phone saved — pick the contact in WhatsApp
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isDone ? (
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
