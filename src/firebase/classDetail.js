import { doc, getDoc, setDoc, getDocs, collection, serverTimestamp } from 'firebase/firestore'
import { db } from './config'

// ─── What is written ABOUT a class, as opposed to WHEN it is ─────────────────
// Lesson notes and the recording (link and passcode together) used to sit on
// the class document itself. The class document has to stay readable by every
// signed-in user — the slot-lock transaction looks up whoever holds a time in
// order to refuse a double booking, and the calendar greys out busy slots the
// same way — so putting notes there meant all 92 students could read Guruji's
// notes about each other's children, and open each other's class recordings.
//
// They live here instead: one document per class, at classes/{id}/detail/d,
// readable and writable only by that class's own student and by staff. The
// class document keeps two booleans — hasNotes and hasRecording — so a list
// can show "has a recording" without fetching anyone's private text.

const DETAIL_DOC = 'd'

function detailRef(classId) {
  return doc(db, 'classes', classId, 'detail', DETAIL_DOC)
}

export async function getClassDetail(classId) {
  if (!classId) return null
  const snap = await getDoc(detailRef(classId))
  return snap.exists() ? snap.data() : null
}

// Several at once, for a list. Each is a read, so callers fetch only the rows
// they are actually going to show text for.
export async function getClassDetails(classIds = []) {
  const ids = [...new Set(classIds.filter(Boolean))]
  const out = {}
  await Promise.all(ids.map(async (id) => {
    try {
      const d = await getClassDetail(id)
      if (d) out[id] = d
    } catch (e) {
      console.error('Class detail failed to load for', id, e)
    }
  }))
  return out
}

// merge: true throughout, because notes and recording are written by different
// people at different times and neither should wipe the other.
export async function saveClassDetail(classId, patch) {
  await setDoc(detailRef(classId), { ...patch, updatedAt: serverTimestamp() }, { merge: true })
}

// ─── Reading a class's detail, old or new ────────────────────────────────────
// Classes created before this change still carry the fields on the class
// document. Both shapes are read for as long as those classes are around, so
// nothing already recorded disappears from view. The migration script moves
// them; these fallbacks mean the app is correct before, during and after it.

export function notesFrom(cls, detail) {
  return (detail?.lessonNotes ?? cls?.lessonNotes ?? '').trim()
}

export function hasNotes(cls, detail = null) {
  if (detail) return !!notesFrom(cls, detail)
  return !!(cls?.hasNotes || cls?.lessonNotes?.trim())
}

// The first web link inside a block of text, if any.
export function firstUrl(text) {
  const m = (text || '').match(/https?:\/\/\S+/)
  return m ? m[0] : null
}

// True without reading the detail at all, so a list can filter cheaply.
export function hasRecording(cls, detail = null) {
  if (detail) return !!recordingText(cls, detail)
  return !!(cls?.hasRecording || cls?.recordingInfo?.trim() || cls?.recordingUrl?.trim())
}

// What to show the student — the pasted block, or a legacy title + link.
export function recordingText(cls, detail = null) {
  const info = detail?.recordingInfo ?? cls?.recordingInfo
  if (info?.trim()) return info.trim()
  const title = detail?.recordingTitle ?? cls?.recordingTitle
  const url = detail?.recordingUrl ?? cls?.recordingUrl
  return [title, url].filter(t => t?.trim()).join('\n')
}

export function recordingTitleOf(cls, detail = null) {
  return detail?.recordingTitle ?? cls?.recordingTitle ?? ''
}

// Does this class still hold its text on the class document? Used by the
// migration to find what is left to move.
export function needsMigration(cls) {
  return !!(cls?.lessonNotes?.trim() || cls?.recordingInfo?.trim()
    || cls?.recordingUrl?.trim() || cls?.recordingTitle?.trim())
}

export async function allDetailDocs(classId) {
  const snap = await getDocs(collection(db, 'classes', classId, 'detail'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}
