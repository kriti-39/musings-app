// ─── User ID login ──────────────────────────────────────────────────────────
// Firebase Auth requires an email-format string, but students/admins shouldn't
// need a real email. So we map a simple User ID to a fixed-domain internal
// email behind the scenes — the user only ever sees and types their User ID.

export const INTERNAL_DOMAIN = 'devasclasses.app'

// Convert a login/creation input into the email Firebase needs.
// If the input already contains '@' it's treated as a real email (so existing
// accounts keep working); otherwise it's a User ID and we append the domain.
export function idToEmail(input) {
  const v = (input || '').trim()
  if (!v) return v
  return v.includes('@') ? v.toLowerCase() : `${v.toLowerCase()}@${INTERNAL_DOMAIN}`
}

// What to STORE as the visible User ID on the profile (the plain thing typed).
export function idToStored(input) {
  return (input || '').trim().toLowerCase()
}

// What to DISPLAY for an account: the plain User ID, hiding the internal domain.
export function displayId(user) {
  const v = user?.userId || user?.email || ''
  return v.endsWith('@' + INTERNAL_DOMAIN) ? v.split('@')[0] : v
}
