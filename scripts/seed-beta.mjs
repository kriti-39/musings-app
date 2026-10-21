// ─── Fill the BETA project with deliberately awkward test data ───────────────
//
// Not a copy of production. Real data is messy in ways clean test data never
// is — a student with no fee set, a blank country, a payment with no months, a
// class from before `status` existed. Those gaps are what break screens, so
// they're created here on purpose, along with cases that may not exist in
// production yet (an expired credit batch with credits still in it, a batch
// that's been extended, a student sitting exactly on the 4-credit cap).
//
// Run:
//   node scripts/seed-beta.mjs ./beta-firebase-adminsdk.json
//
// The key file is gitignored (*firebase-adminsdk*.json). Never paste its
// contents anywhere — it grants full access to the project it belongs to.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore'

// ─── Guard: never, ever the live project ─────────────────────────────────────
// The check is an EXACT match against the `beta` alias in .firebaserc, not a
// guess at the name. A fuzzy test would have passed "v2musingwithdeva" only
// because "deva" happens to contain "dev" — luck, not safety.
const rc = JSON.parse(readFileSync(new URL('../.firebaserc', import.meta.url), 'utf8'))
const BETA = rc.projects?.beta
const PRODUCTION = rc.projects?.prod

const keyPath = process.argv[2]
if (!keyPath) {
  console.error('\nUsage: node scripts/seed-beta.mjs <path-to-beta-service-account.json>\n')
  process.exit(1)
}
if (!BETA) {
  console.error('\n  No "beta" project in .firebaserc — refusing to guess which project to fill.\n')
  process.exit(1)
}

const key = JSON.parse(readFileSync(resolve(keyPath), 'utf8'))

if (key.project_id === PRODUCTION) {
  console.error(`\n  REFUSING TO RUN.\n`)
  console.error(`  That key belongs to ${PRODUCTION} — the LIVE project, with real students.`)
  console.error(`  This script wipes the database before seeding. It must only ever point at beta.\n`)
  process.exit(1)
}

if (key.project_id !== BETA) {
  console.error(`\n  REFUSING TO RUN.\n`)
  console.error(`  That key belongs to "${key.project_id}".`)
  console.error(`  .firebaserc says beta is "${BETA}". Only that project may be seeded.\n`)
  process.exit(1)
}

console.log(`\nSeeding project: ${key.project_id}`)

initializeApp({ credential: cert(key), projectId: key.project_id })
const db = getFirestore()
const auth = getAuth()

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DAY = 86400000
const now = Date.now()
const ago = (d) => Timestamp.fromDate(new Date(now - d * DAY))
const ahead = (d) => Timestamp.fromDate(new Date(now + d * DAY))

// Matches src/utils/auth.js — the app maps a User ID to an internal email.
const INTERNAL_DOMAIN = 'devasclasses.app'
const idToEmail = (v) => `${v.toLowerCase()}@${INTERNAL_DOMAIN}`

const PASSWORD = 'test1234'

// Fixed uids so re-running overwrites rather than piling up duplicates.
async function upsertLogin(uid, userId, name) {
  const email = idToEmail(userId)
  try {
    await auth.createUser({ uid, email, password: PASSWORD, displayName: name })
    return 'created'
  } catch (e) {
    if (e.code === 'auth/uid-already-exists' || e.code === 'auth/email-already-exists') {
      await auth.updateUser(uid, { email, password: PASSWORD, displayName: name })
      return 'updated'
    }
    throw e
  }
}

const set = (col, id, data) => db.collection(col).doc(id).set(data)

// ─── The cast ────────────────────────────────────────────────────────────────

const STAFF = [
  { uid: 'seedTeacher', userId: 'guruji', name: 'Debapriya Adhikary', role: 'teacher',
    timezone: 'Asia/Kolkata' },
  { uid: 'seedAdmin', userId: 'office', name: 'Office Admin', role: 'admin',
    timezone: 'Asia/Kolkata' },
]

const STUDENTS = [
  {
    uid: 'seedAsha', userId: 'asha', name: 'Asha Menon',
    why: 'the ordinary case — India, pays monthly, books weekly',
    country: 'India', timezone: 'Asia/Kolkata', phone: '+91 9876543210',
    feeType: 'monthly', feeAmount: 1500, billingMode: 'credits',
    credits: { quantity: 4, used: 1, expiresInDays: 23 },
    history: { weeks: 12, cadenceDays: 7 },
    payments: [{ amount: 1500, monthsBack: 0, status: 'confirmed', method: 'upi' }],
  },
  {
    uid: 'seedTom', userId: 'tom', name: 'Tom Hardy',
    why: 'overseas — 6-week window, and credits expiring soon',
    country: 'United Kingdom', timezone: 'Europe/London', phone: '+44 7700 900123',
    feeType: 'monthly', feeAmount: 2500, billingMode: 'credits',
    credits: { quantity: 4, used: 2, expiresInDays: 3 },
    history: { weeks: 8, cadenceDays: 14 },
    // One payment covering three months — tests the monthly splitting
    payments: [{ amount: 7500, monthsBack: 1, covers: 3, status: 'confirmed', method: 'bank_transfer' }],
  },
  {
    uid: 'seedRaj', userId: 'raj', name: 'Raj Verma',
    why: 'NO fee set, BLANK country — tests the fallbacks and the empty state',
    country: '', timezone: 'Asia/Kolkata', phone: '',
    feeType: 'flexible', feeAmount: null, billingMode: 'credits',
    credits: null,                                   // nothing — cannot book
    history: { weeks: 4, cadenceDays: 7 },
    payments: [{ amount: 1200, monthsBack: 0, status: 'pending', method: 'upi' }],
  },
  {
    uid: 'seedKamal', userId: 'kamal', name: 'Kamal Bose',
    why: 'the OLD arrangement — no billingMode, must still book freely',
    country: 'India', timezone: 'Asia/Kolkata', phone: '+91 9811122233',
    feeType: 'monthly', feeAmount: 1500, billingMode: null,
    credits: null,
    history: { weeks: 20, cadenceDays: 7 },
    payments: [{ amount: 1500, monthsBack: 0, status: 'confirmed', method: 'cash' }],
    legacyClasses: true,                             // classes with no `status` field at all
  },
  {
    uid: 'seedPriya', userId: 'priya', name: 'Priya Sharma',
    why: 'sitting exactly on the 4-credit cap — Add should be disabled',
    country: 'India', timezone: 'Asia/Kolkata', phone: '+91 9822233344',
    feeType: 'monthly', feeAmount: 1500, billingMode: 'credits',
    credits: { quantity: 4, used: 0, expiresInDays: 28 },
    history: { weeks: 6, cadenceDays: 7 },
    payments: [{ amount: 1500, monthsBack: 0, status: 'confirmed', method: 'cash' }],
  },
  {
    uid: 'seedSam', userId: 'sam', name: 'Sam Okoye',
    why: 'EXPIRED batch with credits still in it — tests Revive',
    country: 'Nigeria', timezone: 'Europe/London', phone: '+234 802 123 4567',
    feeType: 'per_class', feeAmount: 500, billingMode: 'credits',
    credits: { quantity: 4, used: 1, expiresInDays: -6 },   // lapsed six days ago
    history: { weeks: 10, cadenceDays: 14 },
    payments: [{ amount: 2000, monthsBack: 1, status: 'confirmed', method: 'other' }],
  },
  {
    uid: 'seedMira', userId: 'mira', name: 'Mira Das',
    why: 'an already-extended batch, and a drifted-away history',
    country: 'India', timezone: 'Asia/Kolkata', phone: '+91 9833344455',
    feeType: 'monthly', feeAmount: 1500, billingMode: 'credits',
    credits: { quantity: 4, used: 3, expiresInDays: 11, extended: true },
    history: { weeks: 8, cadenceDays: 7, stoppedDaysAgo: 75 },
    payments: [
      { amount: 1500, monthsBack: 2, status: 'confirmed', method: 'upi' },
      { amount: 1500, monthsBack: 1, status: 'rejected', method: 'upi' },
    ],
  },
]

// ─── Build it ────────────────────────────────────────────────────────────────

function monthKey(monthsBack) {
  const d = new Date()
  d.setMonth(d.getMonth() - monthsBack)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

async function wipe() {
  const cols = ['users', 'classes', 'payments', 'credits', 'notifications', 'availability',
    'recurringSchedules', 'receipts', 'photos']
  for (const c of cols) {
    const snap = await db.collection(c).get()
    if (snap.empty) continue
    // Batched deletes, 400 at a time (Firestore's limit is 500 writes)
    let batch = db.batch(); let n = 0
    for (const d of snap.docs) {
      batch.delete(d.ref); n++
      if (n % 400 === 0) { await batch.commit(); batch = db.batch() }
    }
    await batch.commit()
    console.log(`  cleared ${snap.size} from ${c}`)
  }
}

async function seedStaff() {
  for (const s of STAFF) {
    const how = await upsertLogin(s.uid, s.userId, s.name)
    await set('users', s.uid, {
      name: s.name, userId: s.userId, email: idToEmail(s.userId),
      role: s.role, timezone: s.timezone, isActive: true,
      createdAt: ago(400),
    })
    console.log(`  ${s.role.padEnd(7)} ${s.userId.padEnd(8)} ${how}`)
  }
}

async function seedStudent(s) {
  await upsertLogin(s.uid, s.userId, s.name)

  const profile = {
    name: s.name, userId: s.userId, email: idToEmail(s.userId),
    role: 'student', isActive: true,
    phone: s.phone, country: s.country, timezone: s.timezone,
    feeType: s.feeType, feeAmount: s.feeAmount,
    createdAt: ago(200),
  }
  // Absent, not null — a legacy student has no such field at all
  if (s.billingMode) profile.billingMode = s.billingMode
  await set('users', s.uid, profile)

  // ── credits ──
  let batchId = null
  if (s.credits) {
    batchId = `${s.uid}Batch`
    const expires = Timestamp.fromDate(
      new Date(now + s.credits.expiresInDays * DAY))
    const lapsed = s.credits.expiresInDays < 0
    const full = s.credits.used >= s.credits.quantity
    await set('credits', batchId, {
      studentId: s.uid,
      quantity: s.credits.quantity,
      used: s.credits.used,
      status: lapsed ? 'expired' : full ? 'exhausted' : 'active',
      expiresAt: expires,
      validity: /india/i.test(s.country) || !s.country ? '1 month' : '6 weeks',
      source: 'admin',
      reason: 'Seeded for testing',
      grantedBy: 'seedAdmin',
      grantedByName: 'Office Admin',
      grantedAt: ago(7),
      extensions: s.credits.extended
        ? [{ at: ago(3), by: 'seedAdmin', reason: 'Guruji was travelling',
             from: ago(1), to: expires }]
        : [],
      updatedAt: ago(1),
    })
  }

  // ── class history ──
  const { weeks, cadenceDays, stoppedDaysAgo = 0 } = s.history
  const classes = []
  for (let i = 0; i < weeks; i++) {
    const daysAgo = stoppedDaysAgo + (weeks - i) * cadenceDays
    classes.push({
      id: `${s.uid}Cls${i}`,
      studentId: s.uid, teacherId: 'seedTeacher',
      scheduledAt: ago(daysAgo),
      duration: 60,
      // Classes from before `status` existed simply don't have one
      ...(s.legacyClasses && i < 3 ? {} : { status: 'completed' }),
      markedDoneBy: 'auto',
      lessonNotes: i % 4 === 0 ? 'Raag Yaman — alap and bandish' : '',
      createdAt: ago(daysAgo + 2),
      updatedAt: ago(daysAgo),
    })
  }

  // A missed one, a cancelled one, and an upcoming one for everyone with history
  if (weeks > 2) {
    classes.push({
      id: `${s.uid}Missed`,
      studentId: s.uid, teacherId: 'seedTeacher',
      scheduledAt: ago(9), duration: 60, status: 'completed',
      missed: true, missedAt: ago(8), missedBy: 'seedAdmin',
      createdAt: ago(16), updatedAt: ago(8),
    })
    classes.push({
      id: `${s.uid}Cancelled`,
      studentId: s.uid, teacherId: 'seedTeacher',
      scheduledAt: ago(4), duration: 60, status: 'cancelled',
      followUpNeeded: true,
      createdAt: ago(11), updatedAt: ago(4),
    })
  }
  if (!stoppedDaysAgo) {
    classes.push({
      id: `${s.uid}Next`,
      studentId: s.uid, teacherId: 'seedTeacher',
      scheduledAt: ahead(2 + Math.floor(Math.random() * 5)),
      duration: 60, status: 'scheduled',
      // Only credit students' classes were paid for with one
      ...(batchId ? { paidWith: 'credit', creditBatchId: batchId } : {}),
      createdAt: ago(1), updatedAt: ago(1),
    })
  }

  for (const c of classes) {
    const { id, ...data } = c
    await set('classes', id, data)
  }

  // ── payments ──
  for (const [i, p] of (s.payments || []).entries()) {
    const covers = p.covers || 1
    const months = Array.from({ length: covers }, (_, k) => monthKey(p.monthsBack - k))
      .filter(Boolean)
    await set('payments', `${s.uid}Pay${i}`, {
      studentId: s.uid,
      amount: p.amount,
      method: p.method,
      months,
      note: covers > 1 ? 'Paid three months up front' : '',
      status: p.status,
      submittedBy: p.status === 'pending' ? 'student' : 'staff',
      ...(p.status === 'confirmed' ? { confirmedBy: 'seedAdmin', confirmedAt: ago(20) } : {}),
      hasReceipt: false,
      submittedAt: ago(20 + i * 30),
    })
  }

  // A payment with NO months array at all — the kind of record that breaks
  // a monthly total if the code isn't careful.
  if (s.uid === 'seedKamal') {
    await set('payments', 'seedKamalPayOld', {
      studentId: s.uid, amount: 1500, method: 'cash',
      status: 'confirmed', submittedBy: 'staff', submittedAt: ago(300),
    })
  }

  console.log(`  ${s.userId.padEnd(8)} ${classes.length} classes · ${s.why}`)
}

async function main() {
  console.log('\nClearing existing data…')
  await wipe()

  console.log('\nStaff:')
  await seedStaff()

  console.log('\nStudents:')
  for (const s of STUDENTS) await seedStudent(s)

  console.log(`\nDone. Every login uses the password: ${PASSWORD}`)
  console.log('  Staff:    guruji (teacher), office (admin)')
  console.log('  Students: ' + STUDENTS.map(s => s.userId).join(', '))
  console.log('\nThings worth opening first:')
  console.log('  sam    — expired credits, try Revive')
  console.log('  raj    — no credits, no fee, blank country; booking should be blocked')
  console.log('  kamal  — the old arrangement; must still book with no credits')
  console.log('  tom    — overseas 6-week window, 3-month payment split across months')
  console.log('  priya  — on the cap, Add should be disabled\n')
}

main().catch(e => { console.error('\nSeeding failed:', e); process.exit(1) })
