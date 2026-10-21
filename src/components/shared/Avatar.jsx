import { RiMenLine, RiWomenLine } from 'react-icons/ri'

// ─── A person, as a circle ───────────────────────────────────────────────────
// Three fallbacks, in order: the photo if there is one, then a figure if the
// person told us their gender, then their initials on a colour derived from
// their name. Nobody gets a grey blank, and nobody is assigned a gender they
// did not give — an unset gender falls through to initials rather than
// guessing from the name.
//
// Lists stay cheap either way: the picture lives in its own Firestore
// document and is fetched only on a profile, never once per row.

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

const GLYPH_SIZE = { sm: 16, md: 22, lg: 30, xl: 44 }

export default function Avatar({
  name, src = null, gender = null, size = 'md', className = '', attendance = null,
}) {
  // A band around the photo, LinkedIn-style. Never the only signal — whoever
  // renders this with a ring also shows the word.
  const ring = attendance === 'regular' || attendance === 'irregular'
    ? `att-ring att-ring--${attendance}`
    : ''
  const box = `${SIZES[size] || SIZES.md} rounded-full shrink-0 ${ring} ${className}`

  if (src) {
    return (
      <img
        src={src}
        alt={name ? `${name}'s photo` : 'Profile photo'}
        className={`${box} object-cover bg-gray-100`}
      />
    )
  }

  // A figure only when the person actually told us. Anything else — unset,
  // 'other', 'prefer not to say' — falls through to initials rather than
  // picking one for them.
  const Glyph = gender === 'male' ? RiMenLine : gender === 'female' ? RiWomenLine : null

  return (
    <div
      aria-hidden="true"
      className={`${box} ${toneFor(name)} flex items-center justify-center font-semibold select-none`}
    >
      {Glyph ? <Glyph size={GLYPH_SIZE[size] || GLYPH_SIZE.md} /> : initials(name)}
    </div>
  )
}
