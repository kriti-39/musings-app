// ─── Auto-update ────────────────────────────────────────────────────────────
// Every build is stamped with a unique __BUILD_ID__ (see vite.config.js) and
// emits a /version.json with the same id. The running app periodically compares
// its baked-in id against the deployed version.json. If they differ, a newer
// version has been deployed — so we reload to pick it up. This kills the stale
// browser-cache problem where fixes look "still broken" until a manual refresh.
//
// Reloads only happen at safe moments (a few seconds after load, or when the
// app is brought back into focus) so an active form is never interrupted.

/* global __BUILD_ID__ */
const CURRENT = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : null

async function fetchDeployedBuildId() {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    return data?.buildId || null
  } catch {
    return null
  }
}

function reloadForUpdate(deployedId) {
  // Guard against a reload loop if the new bundle still can't be fetched fresh.
  const key = 'mwd_last_update_reload'
  if (sessionStorage.getItem(key) === deployedId) return
  sessionStorage.setItem(key, deployedId)
  window.location.reload()
}

async function checkOnce() {
  if (!CURRENT) return
  const deployed = await fetchDeployedBuildId()
  if (deployed && deployed !== CURRENT) reloadForUpdate(deployed)
}

export function startAutoUpdate() {
  // Only meaningful in the deployed build (dev has no emitted version.json).
  if (!import.meta.env.PROD || !CURRENT) return

  // 1) A few seconds after a fresh load — catches the case where the browser
  //    served a stale cached bundle; it quietly upgrades to the latest.
  setTimeout(checkOnce, 4000)

  // 2) Every time the user returns to the app (reopens the PWA / switches back).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkOnce()
  })

  // 3) A slow heartbeat for long-lived sessions left open in the background.
  setInterval(() => {
    if (document.visibilityState === 'visible') checkOnce()
  }, 5 * 60 * 1000)
}
