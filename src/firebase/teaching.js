// ─── When the studio teaches ─────────────────────────────────────────────────
// One document, `settings/teaching`, holding the hours Guruji keeps and the
// zone they are kept in. Everything about the booking calendar rests on it: a
// day is available because it falls inside these hours and nothing has taken
// it, and without them "available" has no meaning at all — which is why the
// old calendar could only show what was BUSY.
//
// One document rather than a field on the teacher's profile, because a student
// has to read it to book and the profile rules are an allowlist written for
// something else. A student may read this; only staff may write it.
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './config'
import { defaultTeaching, DEFAULT_DAY } from '../utils/availability'
import { tzOffsetMinutes } from '../utils/timezone'

const REF = ['settings', 'teaching']

function ref() {
  return doc(db, REF[0], REF[1])
}

// Hours are stored as minutes from midnight, per weekday (0 = Sunday), in the
// TEACHER's zone. Minutes rather than '18:00' strings so the arithmetic never
// has to parse anything, and because a close of 24*60 says midnight-as-an-end
// in a way that '00:00' cannot.
function sane(hours) {
  const out = {}
  for (let d = 0; d < 7; d++) {
    const v = hours?.[d]
    if (!v) { out[d] = null; continue }        // a day the studio does not teach
    const open = Number(v.open)
    const close = Number(v.close)
    if (!Number.isFinite(open) || !Number.isFinite(close) || close <= open) {
      out[d] = { ...DEFAULT_DAY }
      continue
    }
    out[d] = { open: Math.max(0, open), close: Math.min(24 * 60, close) }
  }
  return out
}

// Falls back to the default rather than throwing. A studio that has never set
// its hours should still be bookable on the sensible default, not dark.
export async function getTeaching(teacherTimezone = 'Asia/Kolkata') {
  try {
    const snap = await getDoc(ref())
    if (snap.exists()) {
      const d = snap.data()
      return {
        hours: sane(d.hours),
        timezone: d.timezone || teacherTimezone,
        isDefault: false,
      }
    }
  } catch (e) {
    console.error('Teaching hours failed to load, using the default:', e)
  }
  return { hours: defaultTeaching(), timezone: teacherTimezone, isDefault: true }
}

export async function saveTeaching({ hours, timezone, teacherId = null }) {
  await setDoc(ref(), {
    hours: sane(hours),
    timezone,
    // The security rules enforce these hours too, and rules cannot look a
    // timezone up, so the zone's distance from UTC is stored beside it. Right
    // for a zone with no daylight saving, which Kolkata is; a studio in one
    // that has it would need this refreshed when the clocks change.
    offsetMinutes: tzOffsetMinutes(timezone),
    teacherId,
    updatedAt: serverTimestamp(),
  }, { merge: true })
}

export const WEEKDAYS = [
  { n: 0, label: 'Sunday', short: 'Sun' },
  { n: 1, label: 'Monday', short: 'Mon' },
  { n: 2, label: 'Tuesday', short: 'Tue' },
  { n: 3, label: 'Wednesday', short: 'Wed' },
  { n: 4, label: 'Thursday', short: 'Thu' },
  { n: 5, label: 'Friday', short: 'Fri' },
  { n: 6, label: 'Saturday', short: 'Sat' },
]

// "6:00 am" from 360. Midnight as a CLOSING time reads as "12:00 am" and
// belongs at the end of a day, never the start of one.
export function fmtMinutes(mins) {
  const m = Math.max(0, Math.min(24 * 60, Number(mins) || 0))
  const h24 = Math.floor(m / 60)
  const mm = String(m % 60).padStart(2, '0')
  const half = h24 >= 12 && h24 < 24 ? 'pm' : 'am'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${mm} ${m === 24 * 60 ? 'am' : half}`
}
