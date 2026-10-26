import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './config'

// ─── Who is regular, kept where students cannot read it ──────────────────────
// This used to live on the student's own profile document. The app never
// showed it to them, but a profile is readable by its owner — so a student who
// opened developer tools could see that Guruji had flagged them irregular.
// Nothing they could change; just something they were never meant to read.
//
// It lives here instead: ONE document, staff-only, keyed by student id. One
// document rather than one per student because the Students list shows a tag
// for all ninety-odd at once, and a document each would be ninety-odd reads
// every time that page opened.
//
//   staffOnly/attendance = { <uid>: { tag, computed }, ... }
//
// `tag` is what a human pinned. `computed` is what the arithmetic last worked
// out, cached so a list can show something without reading every class for
// every student.

const REF = ['staffOnly', 'attendance']

function ref() {
  return doc(db, REF[0], REF[1])
}

// The whole map, for a list. Staff only — a student's read is refused by the
// rules, so this returns an empty map for them rather than throwing.
export async function loadAttendanceMap() {
  try {
    const snap = await getDoc(ref())
    return snap.exists() ? (snap.data() || {}) : {}
  } catch (e) {
    console.error('Attendance map failed to load:', e)
    return {}
  }
}

export function metaFor(map, studentId) {
  return (map && studentId && map[studentId]) || null
}

export async function loadAttendanceFor(studentId) {
  const map = await loadAttendanceMap()
  return metaFor(map, studentId)
}

// Pin a student regular or irregular, or pass null to go back to following
// their classes. merge:true so two staff editing different students at the
// same moment cannot wipe each other's entry.
export async function setAttendanceTag(studentId, tag) {
  await setDoc(ref(), {
    [studentId]: { tag: tag ?? null, updatedAt: serverTimestamp() },
  }, { merge: true })
}

// Cache what the arithmetic worked out, so a list has something to show.
// Written only when it actually changes, to keep this document quiet.
export async function saveComputedAttendance(studentId, computed) {
  await setDoc(ref(), {
    [studentId]: { computed: computed ?? null },
  }, { merge: true })
}
