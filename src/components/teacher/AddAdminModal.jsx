import { useState } from 'react'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { secondaryAuth } from '../../firebase/config'
import { createAdmin } from '../../firebase/db'
import PasswordInput from '../shared/PasswordInput'
import { RiCloseLine } from 'react-icons/ri'

export default function AddAdminModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.name || !form.email || !form.password) return
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true)
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, form.email, form.password)
      await createAdmin(cred.user.uid, { name: form.name, email: form.email })
      await secondaryAuth.signOut()
      onSuccess?.()
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to create admin.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-800">Add Admin</h2>
          <button onClick={onClose}><RiCloseLine size={20} className="text-gray-400" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
            <input name="name" value={form.name} onChange={handleChange} required
              placeholder="Admin name"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
            <input name="email" type="email" value={form.email} onChange={handleChange} required
              placeholder="admin@example.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
            <PasswordInput name="password" value={form.password} onChange={handleChange} required
              placeholder="Min. 6 characters"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>

          {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2.5 text-sm hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50">
              {loading ? 'Creating...' : 'Create Admin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
