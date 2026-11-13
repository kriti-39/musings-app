import { useState, useEffect } from 'react'
import { RiBankLine } from 'react-icons/ri'
import { useAuth } from '../../context/AuthContext'
import { getTransferDetails, saveTransferDetails } from '../../firebase/creditRequests'

// ─── The account students abroad pay into ────────────────────────────────────
// Shown to a student on the "Request credits" screen, exactly as typed here.
// It lives in the database rather than in the code so the office can change it
// without a deploy, and so it is only ever served to somebody signed in.
//
// Free text on purpose: an IBAN, a SWIFT code, a Wise link and a UK sort code
// do not fit one set of form fields, and whoever keeps this up to date knows
// what their own students need to see.
export default function TransferDetailsCard() {
  const { user } = useAuth()
  const [text, setText] = useState('')
  const [saved, setSaved] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let live = true
    getTransferDetails().then(d => {
      if (!live) return
      setText(d)
      setSaved(d)
      setLoaded(true)
    })
    return () => { live = false }
  }, [])

  async function save() {
    setBusy(true)
    setMessage('')
    try {
      await saveTransferDetails(text, user?.id)
      setSaved(text)
      setMessage('Saved. Students see this straight away.')
    } catch (e) {
      console.error('Could not save transfer details:', e)
      setMessage('Could not save. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
        <RiBankLine size={15} /> Bank transfer details
      </h2>
      <p className="text-xs text-gray-400 mt-1 mb-3">
        What students abroad see when they ask for credits. Account name, number, bank, SWIFT or IBAN — whatever they need to send money.
      </p>
      <textarea
        value={text} onChange={e => setText(e.target.value)} disabled={!loaded || busy}
        rows={6} maxLength={2000}
        placeholder={loaded ? 'Not set yet — students are told to ask Guruji for the details.' : 'Loading…'}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50"
      />
      <div className="flex items-center justify-between gap-3 mt-3">
        <p className="text-xs text-gray-500">{message}</p>
        <button onClick={save} disabled={!loaded || busy || text === saved}
          className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:bg-gray-200 disabled:text-gray-400 transition-colors">
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
