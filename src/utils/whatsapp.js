// Opening WhatsApp with a message ready to send.
//
// wa.me needs the full international number. Phone numbers here are typed by
// hand, so some have a country code and some don't. Rather than send a broken
// link, a number we can't be sure about falls back to WhatsApp's own contact
// picker with the message still pre-filled — one extra tap, never a dead end.

// Only countries the studio actually teaches in; anything unrecognised falls
// back to the picker rather than guessing a code onto someone's number.
const DIAL_CODES = {
  india: '91',
  uk: '44', 'united kingdom': '44', england: '44', britain: '44',
  usa: '1', us: '1', 'united states': '1', 'united states of america': '1', america: '1',
  canada: '1',
  australia: '61',
  'new zealand': '64',
  uae: '971', 'united arab emirates': '971', dubai: '971',
  singapore: '65',
  germany: '49',
  france: '33',
  japan: '81',
  nepal: '977',
  bangladesh: '880',
  'sri lanka': '94',
}

// Returns the number in the form wa.me wants (digits, country code first),
// or null when we can't be confident.
export function normalizePhone(phone, country) {
  const raw = String(phone || '').trim()
  if (!raw) return null

  const digits = raw.replace(/\D/g, '')
  if (digits.length < 7) return null // too short to be a real number

  // Written with a country code already
  if (raw.startsWith('+') || raw.startsWith('00')) {
    const d = raw.startsWith('00') ? digits.slice(2) : digits
    return d.length >= 10 ? d : null
  }

  // A leading zero is a national trunk prefix — it's never part of an
  // international number, and leaving it on makes the link dead.
  const local = digits.replace(/^0+/, '')
  if (local.length < 7) return null

  // Long enough that it must already include a country code
  if (local.length >= 11) return local

  // A local number — usable only if the country tells us the code
  const code = DIAL_CODES[String(country || '').trim().toLowerCase()]
  if (code) return code + local

  return null
}

// wa.me link. Without a usable number this opens WhatsApp's contact picker
// with the text ready, so the message is never lost.
export function whatsappUrl(phone, country, message) {
  const num = normalizePhone(phone, country)
  const text = encodeURIComponent(message || '')
  return num ? `https://wa.me/${num}?text=${text}` : `https://wa.me/?text=${text}`
}

// The default note for a class the studio cancelled. Staff can edit it in
// WhatsApp before sending.
export function cancelledClassMessage({ name, when }) {
  const greeting = name ? `Namaste ${name} 🙏` : 'Namaste 🙏'
  return `${greeting}

Guruji is unavailable${when ? ` on ${when}` : ''}, so your class has been cancelled.

Shall we find another time? Please let me know what suits you.

— Deva's Classes`
}
