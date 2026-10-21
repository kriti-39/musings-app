// ─── A person, as a circle ───────────────────────────────────────────────────
// Falls back to initials on a colour derived from the name, so a student with
// no photo still looks like someone rather than a grey blank — and so lists
// stay cheap: the picture itself lives in its own Firestore document and is
// only fetched on a profile page, never once per row.

const TONES = [
  'bg-amber-100 text-amber-700',
  'bg-emerald-100 text-emerald-700',
  'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700',
  'bg-rose-100 text-rose-700',
  'bg-teal-100 text-teal-700',
]

// First letter of the first name, plus the first of the last — "Asha Menon" → AM.
// Kept internal so this file exports only the component (fast refresh needs that).
function initials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Same name always gets the same colour, so a face you know stays the colour
// you know it by.
function toneFor(name) {
  let hash = 0
  for (const ch of (name || '')) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return TONES[hash % TONES.length]
}

const SIZES = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-16 h-16 text-lg',
  xl: 'w-24 h-24 text-2xl',
}

export default function Avatar({ name, src = null, size = 'md', className = '' }) {
  const box = `${SIZES[size] || SIZES.md} rounded-full shrink-0 ${className}`

  if (src) {
    return (
      <img
        src={src}
        alt={name ? `${name}'s photo` : 'Profile photo'}
        className={`${box} object-cover bg-gray-100`}
      />
    )
  }

  return (
    <div
      aria-hidden="true"
      className={`${box} ${toneFor(name)} flex items-center justify-center font-semibold select-none`}
    >
      {initials(name)}
    </div>
  )
}
