import { useEffect, useState } from 'react'
import { RiSmartphoneLine, RiShareForwardLine } from 'react-icons/ri'

// One-tap install. Captures Chrome's beforeinstallprompt and fires the native
// "Add to Home screen" dialog on click. On iOS (no programmatic install) it
// shows a short hint instead. Renders nothing once the app is installed.
export default function InstallButton() {
  const [deferred, setDeferred] = useState(null)
  const [installed, setInstalled] = useState(false)

  const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)
  const standalone = typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone)

  useEffect(() => {
    if (standalone) { setInstalled(true); return }
    const onPrompt = (e) => { e.preventDefault(); setDeferred(e) }
    const onInstalled = () => { setInstalled(true); setDeferred(null) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [standalone])

  // Already installed / running as an app → nothing to show
  if (installed) return null

  // iOS can't trigger an install programmatically — gently tell them how
  if (isIOS) {
    return (
      <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 bg-gray-50 rounded-lg py-2.5 px-3">
        <RiShareForwardLine size={15} className="shrink-0" />
        <span>To install: tap <strong className="text-gray-600">Share</strong> → <strong className="text-gray-600">Add to Home Screen</strong></span>
      </div>
    )
  }

  // Android/Chrome but the prompt isn't available yet (or already installed)
  if (!deferred) return null

  async function handleInstall() {
    deferred.prompt()
    try { await deferred.userChoice } catch { /* ignore */ }
    setDeferred(null)
  }

  return (
    <button
      onClick={handleInstall}
      className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
    >
      <RiSmartphoneLine size={18} /> Add to Home Screen
    </button>
  )
}
