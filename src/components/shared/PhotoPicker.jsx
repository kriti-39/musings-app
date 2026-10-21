import { useState, useRef } from 'react'
import { RiCameraLine, RiDeleteBinLine } from 'react-icons/ri'
import Avatar from './Avatar'
import { compressAvatar } from '../../utils/image'
import { savePhoto, deletePhoto } from '../../firebase/db'

// ─── Set or replace a profile picture ────────────────────────────────────────
// The new picture is shown the instant it's chosen, before the write lands —
// uploading on a phone connection is slow enough that waiting feels broken.
// If the save fails it reverts and says so.
export default function PhotoPicker({ uid, name, initialSrc = null, savedBy = null, onChange }) {
  const [src, setSrc] = useState(initialSrc)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const input = useRef(null)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''                // so picking the same file twice still fires
    if (!file) return

    setError('')
    setBusy(true)
    const previous = src
    try {
      const dataUrl = await compressAvatar(file)
      setSrc(dataUrl)                  // show it at once
      await savePhoto(uid, dataUrl, savedBy)
      onChange?.(dataUrl)
    } catch (err) {
      console.error('Photo save failed:', err)
      setSrc(previous)                 // put the old one back
      setError("That picture couldn't be saved. Please try another.")
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove() {
    setError('')
    setBusy(true)
    const previous = src
    setSrc(null)
    try {
      await deletePhoto(uid)
      onChange?.(null)
    } catch (err) {
      console.error('Photo delete failed:', err)
      setSrc(previous)
      setError("That picture couldn't be removed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-4">
        <div className={busy ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
          <Avatar name={name} src={src} size="xl" />
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => input.current?.click()} disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50">
              <RiCameraLine size={14} /> {src ? 'Change photo' : 'Add photo'}
            </button>
            {src && (
              <button type="button" onClick={handleRemove} disabled={busy}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
                <RiDeleteBinLine size={14} /> Remove
              </button>
            )}
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5">
            {busy ? 'Saving…' : 'Square crop from the middle. Kept small, so it loads on any connection.'}
          </p>
        </div>
      </div>

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      <input ref={input} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  )
}
