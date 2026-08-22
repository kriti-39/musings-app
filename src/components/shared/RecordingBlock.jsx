import { useState } from 'react'
import { RiFileCopyLine, RiCheckLine, RiExternalLinkLine } from 'react-icons/ri'
import { firstUrl } from '../../firebase/db'

// Shows a pasted recording block the way a chat app would: line breaks kept,
// links tappable, and one button to copy the whole thing (so a Zoom passcode
// travels with the link instead of being retyped).

function linkify(text) {
  return text.split(/(https?:\/\/\S+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer"
        className="text-amber-600 underline underline-offset-2 break-all">
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Older browsers / denied clipboard permission
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch { return false }
  }
}

export default function RecordingBlock({ text, label = 'Recording' }) {
  const [copied, setCopied] = useState(false)
  if (!text?.trim()) return null
  const url = firstUrl(text)

  async function handleCopy() {
    if (await copyText(text)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="bg-gray-50 rounded-xl px-4 py-3">
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <button onClick={handleCopy}
          className={`flex items-center gap-1 text-xs font-medium transition-colors ${
            copied ? 'text-green-600' : 'text-gray-400 hover:text-amber-600'
          }`}>
          {copied ? <RiCheckLine size={13} /> : <RiFileCopyLine size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{linkify(text)}</p>

      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          Open recording <RiExternalLinkLine size={13} />
        </a>
      )}
    </div>
  )
}
