import { useState, useEffect } from 'react'
import { RiPhoneLine } from 'react-icons/ri'
import { useAuth } from '../../context/AuthContext'
import { getContact, saveContact, MAX_NAME, MAX_PHONE } from '../../firebase/contact'

// ─── The enquiries contact, editable by staff ────────────────────────────────
// Shown on the login screen and the policy pages. When the person answering
// changes, this is the only place to update.
export default function ContactCard() {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [saved, setSaved] = useState({ name: '', phone: '' })
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let live = true
    getContact().then(c => {
      if (!live) return
      const v = { name: c?.name || '', phone: c?.phone || '' }
      setName(v.name); setPhone(v.phone); setSaved(v); setLoaded(true)
    })
    return () => { live = false }
  }, [])

  const digits = phone.replace(/\D/g, '').length
  const phoneOk = digits >= 7 && digits <= 15
  const changed = name !== saved.name || phone !== saved.phone

  async function save() {
    if (!phoneOk) { setMessage('Enter a full phone number, with the country code.'); return }
    setBusy(true)
    setMessage('')
    try {
      await saveContact({ name, phone }, user?.id)
      setSaved({ name: name.trim(), phone: phone.trim() })
      setMessage('Saved. It shows on the login screen and policy pages straight away.')
    } catch (e) {
      console.error('Could not save the enquiry contact:', e)
      setMessage('Could not save. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
        <RiPhoneLine size={15} /> Contact for enquiries
      </h2>
      <p className="text-xs text-gray-400 mt-1 mb-3">
        Shown publicly on the login screen and the policy pages. Change it here whenever someone else takes over.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="contact-name" className="block text-xs font-medium text-gray-600 mb-1">Name</label>
          <input id="contact-name" value={name} onChange={e => setName(e.target.value)}
            disabled={!loaded || busy} maxLength={MAX_NAME} placeholder="e.g. Ashrita"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50" />
        </div>
        <div>
          <label htmlFor="contact-phone" className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
          <input id="contact-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)}
            disabled={!loaded || busy} maxLength={MAX_PHONE} placeholder="+91 70038 86380"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50" />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 mt-3">
        <p className="text-xs text-gray-500">{message}</p>
        <button onClick={save} disabled={!loaded || busy || !changed}
          className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:bg-gray-200 disabled:text-gray-400 transition-colors">
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
