import { useState } from 'react'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { secondaryAuth } from '../../firebase/config'
import { createStudent } from '../../firebase/db'
import { idToEmail, idToStored } from '../../utils/auth'
import PasswordInput from '../shared/PasswordInput'
import { RiCloseLine } from 'react-icons/ri'

const TIMEZONES = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Vancouver',
  'Pacific/Auckland',
]

const FEE_TYPES = [
  { value: 'monthly', label: 'Monthly flat fee' },
  { value: 'per_class', label: 'Per class' },
  { value: 'flexible', label: 'Flexible / manual' },
]

export default function AddStudentModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    name: '',
    userId: '',
    password: '',
    phone: '',
    country: '',
    timezone: 'Asia/Kolkata',
    feeType: 'monthly',
    feeAmount: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Create Firebase Auth account using secondary app (doesn't sign out admin).
      // The User ID is mapped to an internal email Firebase can store.
      const cred = await createUserWithEmailAndPassword(secondaryAuth, idToEmail(form.userId), form.password)
      await secondaryAuth.signOut()

      // Create Firestore document
      await createStudent(cred.user.uid, {
        name: form.name,
        userId: idToStored(form.userId),
        email: idToEmail(form.userId),
        phone: form.phone,
        country: form.country,
        timezone: form.timezone,
        feeType: form.feeType,
        feeAmount: form.feeAmount ? Number(form.feeAmount) : null,
      })

      onSuccess?.()
      onClose()
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setError('That User ID is already taken. Choose another.')
      } else if (err.code === 'auth/weak-password') {
        setError('Password must be at least 6 characters.')
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Add New Student</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <RiCloseLine size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Name + Email */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
              <input
                name="name" value={form.name} onChange={handleChange} required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="Rohit Sharma"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">User ID *</label>
              <input
                name="userId" type="text" autoCapitalize="none" autoCorrect="off"
                value={form.userId} onChange={handleChange} required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="rohit01"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Temporary Password *</label>
            <PasswordInput
              name="password" value={form.password} onChange={handleChange} required minLength={6}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="Share this with the student"
            />
            <p className="text-xs text-gray-400 mt-1">Share the User ID and this password with the student.</p>
          </div>

          {/* Phone + Country */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
              <input
                name="phone" value={form.phone} onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="+91 9876543210"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Country</label>
              <input
                name="country" value={form.country} onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="India"
              />
            </div>
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Timezone *</label>
            <select
              name="timezone" value={form.timezone} onChange={handleChange}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
            >
              {TIMEZONES.map(tz => (
                <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>
              ))}
            </select>
          </div>

          {/* Fee */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fee Type</label>
              <select
                name="feeType" value={form.feeType} onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              >
                {FEE_TYPES.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Amount (₹)</label>
              <input
                name="feeAmount" type="number" value={form.feeAmount} onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="2000"
              />
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button" onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2.5 text-sm hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit" disabled={loading}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
