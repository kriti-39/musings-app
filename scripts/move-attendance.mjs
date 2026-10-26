// ─── Move the regular/irregular tag off student profiles ─────────────────────
//
// Why: a student can read their own profile document. The app never showed
// them the tag, but anyone opening developer tools could see that Guruji had
// flagged them irregular. Nothing they could change — just something written
// about them, for the studio, that they were never meant to read.
//
// It moves to ONE staff-only document, staffOnly/attendance, keyed by student
// id, so the Students list still costs a single read rather than one per
// student. The fields are then deleted from each profile.
//
// Run against beta first:
//   node scripts/move-attendance.mjs ./beta-firebase-adminsdk.json --dry
//
// Safe to run twice: a profile with nothing left to move is skipped.
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
  console.error('\n  Usage: node scripts/move-attendance.mjs <service-account.json> [--dry] [--yes-production]\n')
  process.exit(1)
}

const key = JSON.parse(readFileSync(resolve(keyPath), 'utf8'))

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

const snap = await db.collection('users').where('role', '==', 'student').get()
console.log(`\n${snap.size} students to look at.\n`)

const entries = {}
const toClear = []

for (const d of snap.docs) {
  const data = d.data()
  const tag = data.attendanceTag ?? null
  const computed = data.attendanceComputed ?? null
  if (tag === null && computed === null) continue

  entries[d.id] = {}
  if (tag !== null) entries[d.id].tag = tag
  if (computed !== null) entries[d.id].computed = computed
  toClear.push(d.ref)

  console.log(`  ${(data.name || d.id).padEnd(24)} tag=${String(tag).padEnd(10)} computed=${computed}`)
}

const moved = Object.keys(entries).length
if (moved === 0) {
  console.log('  Nothing to move.\n')
  process.exit(0)
}

if (!DRY) {
  // Write the staff-only document FIRST. If this dies in between, the tags
  // exist in both places, which the app reads correctly — the opposite order
  // would lose them.
  await db.doc('staffOnly/attendance').set(entries, { merge: true })

  for (const ref of toClear) {
    await ref.update({
      attendanceTag: FieldValue.delete(),
      attendanceComputed: FieldValue.delete(),
    })
  }
}

console.log(`\n${DRY ? 'Would move' : 'Moved'} ${moved} student${moved === 1 ? '' : 's'}.`)
if (DRY) console.log('Nothing was written. Drop --dry to do it.\n')
else console.log('Tags are now staff-only; the profile fields are gone.\n')
process.exit(0)
