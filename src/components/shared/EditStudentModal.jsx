import { useState } from 'react'
import { updateUser } from '../../firebase/db'
import { RiCloseLine } from 'react-icons/ri'
import { useAuth } from '../../context/AuthContext'
import { validityLabel } from '../../utils/credits'
import PhotoPicker from './PhotoPicker'

const TIMEZONES = [
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney',
  'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Chicago',
  'America/Los_Angeles', 'America/Toronto', 'America/Vancouver', 'Pacific/Auckland',
]

const FEE_TYPES = [
  { value: 'monthly', label: 'Monthly flat fee' },
  { value: 'per_class', label: 'Per class' },
  { value: 'flexible', label: 'Flexible / manual' },
]

// Edit a student's profile (teacher/admin only). Updates the Firestore user doc.
// Login User ID & password are NOT editable here — those are auth-level changes.
export default function EditStudentModal({ student, photo = null, onClose, onSuccess }) {
  const { user, role } = useAuth()
  const isAdmin = role === 'admin'
  const [form, setForm] = useState({
    name: student?.name || '',
    phone: student?.phone || '',
    country: student?.country || '',
    timezone: student?.timezone || 'Asia/Kolkata',
    feeType: student?.feeType || 'monthly',
    feeAmount: student?.feeAmount ?? '',
    billingMode: student?.billingMode || 'legacy',
    creditsWithoutPayment: student?.creditsWithoutPayment === true,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required.'); return }
    setLoading(true)
    setError('')
    try {
      await updateUser(student.id, {
        name: form.name.trim(),
        phone: form.phone.trim(),
        country: form.country.trim(),
        timezone: form.timezone,
        feeType: form.feeType,
        feeAmount: form.feeAmount === '' || form.feeAmount === null ? null : Number(form.feeAmount),
        // Only an admin can move someone onto (or off) the credit system, so
        // nobody else's save can change it by accident.
        ...(isAdmin ? {
          billingMode: form.billingMode,
          creditsWithoutPayment: form.creditsWithoutPayment,
        } : {}),
      })
      onSuccess?.()
      onClose()
    } catch (err) {
      console.error(err)
      setError('Could not save. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Edit Student</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <RiCloseLine size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Saves on its own, straight away — it isn't part of the form, so a
              picture can't be lost by closing without saving. */}
          <PhotoPicker
            uid={student.id}
            name={form.name || student.name}
            initialSrc={photo}
            savedBy={user?.id}
            onChange={() => onSuccess?.()}
          />

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
            <input
              name="name" value={form.name} onChange={handleChange} required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

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

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Timezone</label>
            <select
              name="timezone" value={form.timezone} onChange={handleChange}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
            >
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fee Type</label>
              <select
                name="feeType" value={form.feeType} onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              >
                {FEE_TYPES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
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

          {/* How this student books. Existing students stay on the old way
              until an admin deliberately moves them over. */}
          {isAdmin && (
            <div className="border-t border-gray-100 pt-4">
              <label className="block text-xs font-medium text-gray-600 mb-2">How they book</label>
              <div className="flex gap-2">
                {[
                  { v: 'legacy', label: 'As before', hint: 'Books freely, fees handled outside the app' },
                  { v: 'credits', label: 'Class credits', hint: `Needs credits to book · last ${validityLabel(form)}` },
                ].map(o => (
                  <button key={o.v} type="button"
                    onClick={() => setForm(f => ({ ...f, billingMode: o.v }))}
                    className={`flex-1 text-left px-3 py-2.5 rounded-lg border transition-colors ${
                      form.billingMode === o.v
                        ? 'border-amber-400 bg-amber-50'
                        : 'border-gray-200 hover:border-amber-200'
                    }`}>
                    <span className="block text-sm font-medium text-gray-800">{o.label}</span>
                    <span className="block text-[11px] text-gray-400 mt-0.5">{o.hint}</span>
                  </button>
                ))}
              </div>
              {form.billingMode === 'credits' && student?.billingMode !== 'credits' && (
                <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-2">
                  They'll need credits before they can book again — add some straight after saving.
                </p>
              )}

              {/* Credits are classes already paid for, so adding them asks for
                  the amount. This is the exception: a student the studio
                  settles with some other way, whose credits the office adds
                  directly. */}
              {form.billingMode === 'credits' && (
                <label className="flex items-start gap-2 mt-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.creditsWithoutPayment}
                    onChange={e => setForm(f => ({ ...f, creditsWithoutPayment: e.target.checked }))}
                    className="mt-0.5 shrink-0"
                  />
                  <span className="text-[11px] text-gray-500">
                    <span className="block text-xs font-medium text-gray-700">
                      Add credits without recording a payment
                    </span>
                    Only for students settled with outside the app. Leave this off and
                    the office must enter what was paid before credits are added.
                  </span>
                </label>
              )}
            </div>
          )}

          <p className="text-xs text-gray-400">The student's User ID and password can't be changed here.</p>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2.5 text-sm hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg py-2.5 text-sm font-medium transition-colors disabled:opacity-50">
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
