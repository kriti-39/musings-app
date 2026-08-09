import { useEffect, useState } from 'react'
import StudentLayout from '../../components/student/StudentLayout'
import { useAuth } from '../../context/AuthContext'
import { getStudentAllClasses, renameRecording } from '../../firebase/db'
import { LOCAL_TZ, tzCity, fmtTime, fmtLongDate } from '../../utils/timezone'
import { RiVideoLine, RiExternalLinkLine, RiPencilLine, RiCheckLine, RiCloseLine } from 'react-icons/ri'

export default function StudentRecordings() {
  const { user } = useAuth()
  const [recordings, setRecordings] = useState([])
  const [loading, setLoading] = useState(true)

  async function fetchRecordings() {
    try {
      const all = await getStudentAllClasses(user.id)
      // Newest first (getStudentAllClasses already sorts descending)
      setRecordings(all.filter(c => c.recordingUrl))
    } catch (e) {
      console.error('Failed to fetch recordings:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.id) fetchRecordings()
    else if (user !== undefined) setLoading(false)
  }, [user])

  function patchTitle(id, title) {
    setRecordings(prev => prev.map(c => (c.id === id ? { ...c, recordingTitle: title } : c)))
  }

  const tz = user?.timezone || LOCAL_TZ

  return (
    <StudentLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Recordings</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Your class recordings · times in {tzCity(tz)}
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-10">Loading...</p>
        ) : recordings.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
            <RiVideoLine size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400 text-sm">No recordings yet.</p>
            <p className="text-gray-300 text-xs mt-1">Your teacher will post recordings here after class.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recordings.map(cls => (
              <RecordingCard key={cls.id} cls={cls} tz={tz} onRename={patchTitle} />
            ))}
          </div>
        )}
      </div>
    </StudentLayout>
  )
}

function RecordingCard({ cls, tz, onRename }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(cls.recordingTitle || '')
  const [saving, setSaving] = useState(false)
  const date = cls.scheduledAt?.toDate?.() ?? new Date()
  const displayTitle = cls.recordingTitle || 'Class recording'

  async function handleSave() {
    setSaving(true)
    try {
      await renameRecording(cls.id, title)
      onRename(cls.id, title.trim())
      setEditing(false)
    } catch (e) {
      console.error('Rename failed:', e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                value={title} onChange={e => setTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
                placeholder="Name this lesson..."
                autoFocus
                className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button onClick={handleSave} disabled={saving}
                className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50">
                <RiCheckLine size={16} />
              </button>
              <button onClick={() => { setEditing(false); setTitle(cls.recordingTitle || '') }}
                className="p-1.5 text-gray-400 hover:bg-gray-50 rounded-lg transition-colors">
                <RiCloseLine size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <p className="font-medium text-gray-800 truncate">{displayTitle}</p>
              <button onClick={() => setEditing(true)} title="Rename"
                className="shrink-0 p-1 text-gray-300 hover:text-amber-500 transition-colors">
                <RiPencilLine size={14} />
              </button>
            </div>
          )}
          <p className="text-sm text-gray-400 mt-1">
            {fmtLongDate(date, tz)} · {fmtTime(date, tz)} · {cls.duration || 60} min
          </p>
          {cls.lessonNotes && (
            <p className="text-xs text-gray-500 mt-2 italic">"{cls.lessonNotes}"</p>
          )}
        </div>
      </div>
      <a href={cls.recordingUrl} target="_blank" rel="noopener noreferrer"
        className="mt-4 inline-flex items-center gap-2 bg-amber-50 hover:bg-amber-100 text-amber-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
        <RiVideoLine size={16} /> Watch recording <RiExternalLinkLine size={13} />
      </a>
    </div>
  )
}
