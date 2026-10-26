import { useState, useEffect } from 'react'
import { RiUserLine, RiEdit2Line, RiCheckLine, RiCloseLine } from 'react-icons/ri'
import { useAuth } from '../../context/AuthContext'
import { updateOwnProfile, getPhoto } from '../../firebase/db'
import { displayId } from '../../utils/auth'
import Avatar from './Avatar'
import PhotoPicker from './PhotoPicker'

// What a person may change about themselves. Deliberately short: the User ID
// is how they log in, and the fee, role and billing arrangement belong to the
// studio. The Firestore rule enforces exactly this list — the form is the
// polite version of it, not the protection.
const GENDERS = [
  { id: 'female', label: 'Female' },
  { id: 'male', label: 'Male' },
  { id: '', label: 'Prefer not to say' },
]

export default function MyProfileCard() {
  const { user, role, refreshUser } = useAuth()
  const [editing, setEditing] = useState(false)
  const [photo, setPhoto] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', phone: '', gender: '' })

  useEffect(() => {
    setForm({
      name: user?.name || '',
      phone: user?.phone || '',
      gender: user?.gender || '',
    })
  }, [user])

  useEffect(() => {
    if (user?.hasPhoto && user?.id) {
      getPhoto(user.id).then(setPhoto).catch(e => console.error('Photo failed to load:', e))
    } else {
      setPhoto(null)
    }
  }, [user?.id, user?.hasPhoto])

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Please enter your name.'); return }
    setSaving(true)
    setError('')
    try {
      await updateOwnProfile({ ...user, role }, {
        name: form.name.trim(),
        phone: form.phone.trim(),
        gender: form.gender,
      })
      await refreshUser?.()
      setEditing(false)
    } catch (err) {
      console.error('Profile save failed:', err)
      setError('Could not save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function cancel() {
    setForm({ name: user?.name || '', phone: user?.phone || '', gender: user?.gender || '' })
    setError('')
    setEditing(false)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <RiUserLine size={18} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-800">Profile</h2>
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors">
            <RiEdit2Line size={14} /> Edit
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={handleSave} className="space-y-4">
          {/* Saves on its own, straight away — it is not part of the form, so
              a picture can't be lost by cancelling. */}
          <PhotoPicker
            uid={user.id}
            name={form.name || user?.name}
            initialSrc={photo}
            savedBy={user.id}
            onChange={(src) => { setPhoto(src); refreshUser?.() }}
          />

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
            <input
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="+91 9876543210"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Used to reach you about a class — nothing else.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Gender</label>
            <div className="flex gap-2">
              {GENDERS.map(g => (
                <button key={g.id || 'unset'} type="button"
                  onClick={() => setForm(f => ({ ...f, gender: g.id }))}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                    form.gender === g.id
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'border-gray-200 text-gray-600 hover:border-amber-300'
                  }`}>
                  {g.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">
              Only used for your picture when you haven&rsquo;t set one.
            </p>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={cancel} disabled={saving}
              className="flex-1 flex items-center justify-center gap-1.5 border border-gray-200 text-gray-600 rounded-lg py-2.5 text-sm hover:bg-gray-50 disabled:opacity-50">
              <RiCloseLine size={16} /> Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50">
              <RiCheckLine size={16} /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <Avatar name={user?.name} src={photo} gender={user?.gender} size="lg" />
            <div className="min-w-0">
              <p className="text-base font-semibold text-gray-800 truncate">{user?.name || '—'}</p>
              <p className="text-sm text-gray-400 truncate">{user?.phone || 'No phone saved'}</p>
            </div>
          </div>

          <div className="space-y-2 text-sm mt-5 pt-5 border-t border-gray-50">
            <div className="flex justify-between gap-3">
              <span className="text-gray-400">{role === 'student' ? 'User ID' : 'Email'}</span>
              <span className="text-gray-700 font-medium truncate">{displayId(user)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-400">Role</span>
              <span className="text-gray-700 font-medium capitalize">{role}</span>
            </div>
          </div>

          <p className="text-xs text-gray-400 mt-4">
            Your User ID can&rsquo;t be changed — it&rsquo;s how you sign in.
            {role === 'student' && ' To change your password, please contact your teacher or admin.'}
          </p>
        </>
      )}
    </div>
  )
}
