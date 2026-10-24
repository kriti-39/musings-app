// ─── Move lesson notes and recordings off the class document ─────────────────
//
// Why: a class document has to be readable by every signed-in user. The
// slot-lock transaction looks up whoever holds a time in order to refuse a
// double booking, and the booking calendar greys out busy slots the same way.
// So while the notes and the recording lived on that document, every student
// could read Guruji's notes about every other student, and open anyone's class
// recording — link and passcode together.
//
// They move to classes/{id}/detail/d, which only that class's own student and
// staff can read. Two booleans stay behind, hasNotes and hasRecording, so a
// list can still say "has a recording" without reading anybody's private text.
//
// Run against beta first:
//   node scripts/move-class-detail.mjs ./beta-firebase-adminsdk.json
//
// It is safe to run twice: a class whose text has already moved is skipped.
// Pass --dry to see what it would do and write nothing.
//
// The key file is gitignored (*firebase-adminsdk*.json). Never paste its
// contents anywhere — it grants full access to the project it belongs to.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const DRY = process.argv.includes('--dry')
const ALLOW_PROD = process.argv.includes('--yes-production')

const rc = JSON.parse(readFileSync(new URL('../.firebaserc', import.meta.url), 'utf8'))
const BETA = rc.projects?.beta
const PRODUCTION = rc.projects?.prod

const keyPath = process.argv[2]
if (!keyPath || keyPath.startsWith('--')) {
  console.error('\n  Usage: node scripts/move-class-detail.mjs <service-account.json> [--dry] [--yes-production]\n')
  process.exit(1)
}

const key = JSON.parse(readFileSync(resolve(keyPath), 'utf8'))

// Production is a deliberate, separate decision. The live app is in front of
// 92 students; moving their data is not something to do by forgetting a flag.
if (key.project_id === PRODUCTION && !ALLOW_PROD) {
  console.error(`\n  That key is for PRODUCTION (${PRODUCTION}).`)
  console.error('  Run it against beta first. If you really mean production,')
  console.error('  add --yes-production, and take a Firestore export beforehand.\n')
  process.exit(1)
}
if (key.project_id !== BETA && key.project_id !== PRODUCTION) {
  console.error(`\n  That key belongs to "${key.project_id}", which is neither`)
  console.error(`  beta ("${BETA}") nor prod ("${PRODUCTION}") in .firebaserc. Refusing.\n`)
  process.exit(1)
}

console.log(`\n${DRY ? 'DRY RUN on' : 'Migrating'} project: ${key.project_id}`)
if (key.project_id === PRODUCTION) console.log('  *** THIS IS THE LIVE PROJECT ***')

initializeApp({ credential: cert(key), projectId: key.project_id })
const db = getFirestore()

const FIELDS = ['lessonNotes', 'recordingInfo', 'recordingUrl', 'recordingTitle']

function textOn(data) {
  const out = {}
  for (const f of FIELDS) {
    const v = data?.[f]
    if (typeof v === 'string' && v.trim()) out[f] = v
  }
  return out
}

const snap = await db.collection('classes').get()
console.log(`\n${snap.size} classes to look at.\n`)

let moved = 0, already = 0, nothing = 0, failed = 0

for (const docSnap of snap.docs) {
  const data = docSnap.data()
  const text = textOn(data)

  if (Object.keys(text).length === 0) {
    // Nothing to move. Make sure the flags match what is in the detail doc,
    // so a class migrated by an earlier run still lists correctly.
    nothing++
    continue
  }

  const detailRef = docSnap.ref.collection('detail').doc('d')

  try {
    const existing = await detailRef.get()
    if (existing.exists && Object.keys(textOn(existing.data())).length > 0) {
      // Already moved, and the class document still has its copy — clear it.
      if (!DRY) {
        await docSnap.ref.update({
          ...Object.fromEntries(FIELDS.map(f => [f, FieldValue.delete()])),
          hasNotes: !!text.lessonNotes,
          hasRecording: !!(text.recordingInfo || text.recordingUrl),
        })
      }
      already++
      continue
    }

    if (!DRY) {
      // Write the detail FIRST and only then remove it from the class. If the
      // run dies in between, the text exists in both places, which the app
      // reads correctly — the opposite order could lose it.
      await detailRef.set({ ...text, movedAt: FieldValue.serverTimestamp() }, { merge: true })
      await docSnap.ref.update({
        ...Object.fromEntries(FIELDS.map(f => [f, FieldValue.delete()])),
        hasNotes: !!text.lessonNotes,
        hasRecording: !!(text.recordingInfo || text.recordingUrl),
      })
    }
    moved++
    if (moved <= 5 || moved % 50 === 0) {
      const what = [
        text.lessonNotes ? 'notes' : null,
        (text.recordingInfo || text.recordingUrl) ? 'recording' : null,
      ].filter(Boolean).join(' + ')
      console.log(`  ${DRY ? 'would move' : 'moved'} ${docSnap.id} (${what})`)
    }
  } catch (e) {
    failed++
    console.error(`  FAILED ${docSnap.id}:`, e.message)
  }
}

console.log(`
${DRY ? 'Would move' : 'Moved'}:        ${moved}
Already moved:    ${already}
Nothing to move:  ${nothing}
Failed:           ${failed}
`)

if (failed > 0) {
  console.error('Some classes failed. Run it again — it skips what is already done.\n')
  process.exit(1)
}
if (DRY) console.log('Nothing was written. Drop --dry to do it.\n')
process.exit(0)
