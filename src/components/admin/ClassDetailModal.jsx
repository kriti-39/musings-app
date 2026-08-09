import { useState } from 'react'
import { RiCloseLine, RiCalendarLine, RiTimeLine, RiUserLine, RiGlobalLine, RiVideoLine, RiExternalLinkLine } from 'react-icons/ri'
import {
  cancelClass, rescheduleClass, markClassDone,
  confirmClass, rejectClass, updateClass, deleteClass, saveRecording
} from '../../firebase/db'
import { Timestamp } from 'firebase/firestore'
import { useAuth } from '../../context/AuthContext'
import { fmtTime, tzCity } from '../../utils/timezone'
import ConfirmDialog from '../shared/ConfirmDialog'

const STATUS_STYLES = {
  scheduled:  'bg-green-50 text-green-700',
  pending:    'bg-amber-50 text-amber-700',
  completed:  'bg-gray-100 text-gray-500',
  cancelled:  'bg-red-50 text-red-500',
  rejected:   'bg-red-50 text-red-500',
}

export default function ClassDetailModal({ cls, studentName, studentTimezone, onClose, onUpdate }) {
  const { user } = useAuth()
  const [view, setView] = useState('detail') // detail | reschedule | notes | recording
  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('')
  const [notes, setNotes] = useState(cls.lessonNotes || '')
  const [recUrl, setRecUrl] = useState(cls.recordingUrl || '')
  const [recTitle, setRecTitle] = useState(cls.recordingTitle || '')
  const [loading, setLoading] = useState(false)
  const [confirm, setConfirm] = useState(null) // { title, message, confirmLabel, variant, action }

  const scheduledDate = cls.scheduledAt?.toDate?.() ?? new Date(cls.scheduledAt)

  async function handle(fn) {
    setLoading(true)
    try { await fn(); onUpdate?.(); onClose() }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function runConfirm() {
    if (!confirm) return
    await handle(confirm.action)
    setConfirm(null)
  }

  function askReschedule() {
    if (!newDate || !newTime) return
    const when = new Date(`${newDate}T${newTime}`).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    setConfirm({
      title: 'Reschedule this class?',
      message: `The class will move to ${when} and the student will be notified to re-confirm.`,
      confirmLabel: 'Reschedule',
      variant: 'primary',
      action: () => rescheduleClass(cls.id, `${newDate}T${newTime}`, cls.studentId),
    })
  }

  async function handleSaveNotes() {
    await handle(() => updateClass(cls.id, { lessonNotes: notes }))
  }

  async function handleSaveRecording() {
    if (!recUrl.trim()) return
    // Notify the student only the first time a recording is added
    const notify = cls.recordingUrl ? null : cls.studentId
    await handle(() => saveRecording(cls.id, { url: recUrl, title: recTitle }, notify))
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-gray-800">Class Details</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[cls.status] || ''}`}>
              {cls.status}
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <RiCloseLine size={20} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <RiUserLine size={16} className="text-gray-400" />
              {studentName}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <RiCalendarLine size={16} className="text-gray-400" />
              {scheduledDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <RiTimeLine size={16} className="text-gray-400" />
              {scheduledDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {cls.duration || 60} min
            </div>
            {studentTimezone && studentTimezone !== Intl.DateTimeFormat().resolvedOptions().timeZone && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <RiGlobalLine size={16} className="text-gray-400" />
                Student's time: {fmtTime(scheduledDate, studentTimezone)} ({tzCity(studentTimezone)})
              </div>
            )}
          </div>

          {/* Pending: confirm / reject */}
          {cls.status === 'pending' && (
            <div className="bg-amber-50 rounded-xl p-4 space-y-2">
              <p className="text-sm font-medium text-amber-800">Student booking request</p>
              <div className="flex gap-2">
                <button
                  onClick={() => handle(() => confirmClass(cls.id, cls.studentId))} disabled={loading}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Confirm
                </button>
                <button
                  onClick={() => handle(() => rejectClass(cls.id, cls.studentId))} disabled={loading}
                  className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          )}

          {/* Lesson notes */}
          {view === 'notes' ? (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-600">Lesson Notes</label>
              <textarea
                value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                placeholder="What was covered in this class..."
              />
              <div className="flex gap-2">
                <button onClick={() => setView('detail')} className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50">Cancel</button>
                <button onClick={handleSaveNotes} disabled={loading} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">Save</button>
              </div>
            </div>
          ) : cls.lessonNotes ? (
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <p className="text-xs font-medium text-gray-500 mb-1">Lesson Notes</p>
              <p className="text-sm text-gray-700">{cls.lessonNotes}</p>
            </div>
          ) : null}

          {/* Recording — completed classes only */}
          {view === 'recording' ? (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-600">Recording link *</label>
              <input
                type="url" value={recUrl} onChange={e => setRecUrl(e.target.value)}
                placeholder="https://... (YouTube / Drive / Zoom)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <label className="block text-xs font-medium text-gray-600 pt-1">Title (optional)</label>
              <input
                value={recTitle} onChange={e => setRecTitle(e.target.value)}
                placeholder="e.g. Raag Yaman — meend practice"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <p className="text-xs text-gray-400">Tips or notes for the student go in Lesson Notes.</p>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setView('detail')} className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50">Cancel</button>
                <button onClick={handleSaveRecording} disabled={loading || !recUrl.trim()}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
                  {loading ? 'Saving...' : 'Save Recording'}
                </button>
              </div>
            </div>
          ) : cls.recordingUrl ? (
            <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500 mb-1">Recording</p>
                <p className="text-sm text-gray-700 truncate">{cls.recordingTitle || 'Class recording'}</p>
              </div>
              <a href={cls.recordingUrl} target="_blank" rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700">
                Open <RiExternalLinkLine size={13} />
              </a>
            </div>
          ) : null}

          {/* Reschedule form */}
          {view === 'reschedule' && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">Pick a new date & time</p>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setView('detail')} className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50">Back</button>
                <button onClick={askReschedule} disabled={loading || !newDate || !newTime}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Confirm Reschedule'}
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          {view === 'detail' && cls.status !== 'cancelled' && cls.status !== 'rejected' && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              {cls.status === 'scheduled' && (
                <button onClick={() => setConfirm({
                  title: 'Mark this class as done?',
                  message: 'This marks the class completed for both you and the student.',
                  confirmLabel: 'Mark as Done',
                  variant: 'primary',
                  action: () => markClassDone(cls.id, user.role),
                })}
                  disabled={loading}
                  className="col-span-2 bg-green-500 hover:bg-green-600 text-white rounded-lg py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Mark as Done
                </button>
              )}
              <button onClick={() => setView('notes')}
                className="border border-gray-200 text-gray-600 rounded-lg py-2.5 text-sm hover:bg-gray-50 transition-colors"
              >
                {cls.lessonNotes ? 'Edit Notes' : 'Add Notes'}
              </button>
              {cls.status === 'completed' && (
                <button onClick={() => setView('recording')}
                  className="flex items-center justify-center gap-1.5 border border-gray-200 text-gray-600 rounded-lg py-2.5 text-sm hover:bg-gray-50 transition-colors"
                >
                  <RiVideoLine size={15} />
                  {cls.recordingUrl ? 'Edit Recording' : 'Add Recording Link'}
                </button>
              )}
              {cls.status === 'scheduled' && (
                <button onClick={() => setView('reschedule')}
                  className="border border-amber-200 text-amber-600 rounded-lg py-2.5 text-sm hover:bg-amber-50 transition-colors"
                >
                  Reschedule
                </button>
              )}
              {cls.status !== 'completed' && (
                <button onClick={() => setConfirm({
                  title: 'Cancel this class?',
                  message: 'The student will be notified that the class is cancelled.',
                  confirmLabel: 'Cancel Class',
                  variant: 'danger',
                  action: () => cancelClass(cls.id, cls.studentId),
                })} disabled={loading}
                  className="col-span-2 border border-red-200 text-red-500 rounded-lg py-2.5 text-sm hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  Cancel Class
                </button>
              )}
              <button
                onClick={() => setConfirm({
                  title: 'Permanently delete this class?',
                  message: 'This cannot be undone.',
                  confirmLabel: 'Delete',
                  variant: 'danger',
                  action: () => deleteClass(cls.id),
                })}
                disabled={loading}
                className="col-span-2 text-xs text-gray-400 hover:text-red-500 transition-colors py-1 disabled:opacity-50"
              >
                Delete permanently
              </button>
            </div>
          )}
        </div>
      </div>

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          variant={confirm.variant}
          loading={loading}
          onConfirm={runConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
