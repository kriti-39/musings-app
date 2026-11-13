import {
  doc, getDoc, setDoc, updateDoc, getDocs, collection, query, where,
  onSnapshot, serverTimestamp,
} from 'firebase/firestore'
import { db } from './config'
import { createNotification, notifyStaff } from './notify'

// ─── "I have paid by bank transfer — please add my credits" ──────────────────
// Students abroad pay bank to bank. No card gateway can take a wire, and for
// some countries no gateway works at all, so that money never passes through
// the app: the office sees it arrive in the bank, and the app has to be told.
//
// This is the telling. A student says what they sent; the studio checks the
// bank and decides how many credits that is worth.
//
// THE STUDENT NEVER ASKS FOR A NUMBER OF CREDITS. They report an amount and
// nothing else. How many classes a transfer buys is the studio's decision, and
// a request that named a quantity would be a figure for somebody to approve in
// a hurry. The security rules refuse any request carrying one.
//
// It is also not a payment record. Students cannot write to `payments` at all
// — a rule added after a student could invent a confirmed payment for
// themselves — and this does not reopen that. The money goes on the books only
// when staff grant the credits, through the same grantCreditsWithPayment every
// other manual payment uses.
//
// ONE DOCUMENT PER STUDENT, keyed by their own id. That is what stops a
// student filing a hundred requests: there is only one place to write, and the
// rules let them write there again only once the last ask has been answered.
// Rules cannot count documents, but they can tell a create from an update.

const COL = 'creditRequests'

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'AED', 'SGD', 'RUB', 'INR', 'Other']
export const MAX_AMOUNT = 10000000
export const MAX_NOTE = 300

export function requestProblem({ amount, currency, note }) {
  const n = Number(amount)
  if (!Number.isFinite(n) || n <= 0) return 'Enter the amount you sent.'
  if (n > MAX_AMOUNT) return 'That amount looks wrong. Please check it.'
  if (!CURRENCIES.includes(currency)) return 'Choose the currency you paid in.'
  if ((note || '').length > MAX_NOTE) return `Keep the note under ${MAX_NOTE} characters.`
  return null
}

export function fmtAsk(req) {
  if (!req) return ''
  const n = Number(req.amount) || 0
  const shown = Number.isInteger(n) ? n.toLocaleString('en-IN') : n.toFixed(2)
  return req.currency && req.currency !== 'Other' ? `${shown} ${req.currency}` : shown
}

// The student's side. Overwrites their one document — the rules allow that
// only when there is nothing still waiting.
export async function submitCreditRequest(student, { amount, currency, note = '' }) {
  const problem = requestProblem({ amount, currency, note })
  if (problem) throw new Error(problem)

  const ask = {
    studentId: student.id,
    amount: Number(amount),
    currency,
    note: note.trim(),
    status: 'pending',
    createdAt: serverTimestamp(),
  }
  await setDoc(doc(db, COL, student.id), ask)

  // Staff hear about it, but a failure to tell them must not undo the request:
  // it is on their dashboard either way.
  try {
    await notifyStaff('credit_requested',
      `Paid ${fmtAsk(ask)} by bank transfer — asking for credits`,
      { title: student.name || 'A student' })
  } catch (e) { console.error('Request saved, staff notify failed:', e) }
}

// Live, because the answer arrives from the other side.
export function subscribeOwnCreditRequest(studentId, onChange, onError) {
  return onSnapshot(
    doc(db, COL, studentId),
    snap => onChange(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    onError,
  )
}

export async function getPendingCreditRequests() {
  const snap = await getDocs(query(collection(db, COL), where('status', '==', 'pending')))
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0))
}

export async function getCreditRequest(studentId) {
  const snap = await getDoc(doc(db, COL, studentId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

// Staff only (the rules enforce it). `granted` is written AFTER the credits
// exist, never before — a request marked granted with no credits behind it is
// the one state that would leave a student told yes and holding nothing.
export async function resolveCreditRequest(studentId, {
  status, quantity = null, staffId = null, reason = '',
}) {
  if (status !== 'granted' && status !== 'declined') throw new Error('Unknown outcome')
  await updateDoc(doc(db, COL, studentId), {
    status,
    grantedQuantity: status === 'granted' ? quantity : null,
    resolvedBy: staffId,
    resolvedAt: serverTimestamp(),
    declineReason: status === 'declined' ? (reason || '').trim() : '',
  })
  // A grant already tells the student their credits have arrived; only a "no"
  // needs a message of its own.
  if (status === 'declined') {
    try {
      await createNotification(studentId, 'credit_request_declined',
        reason?.trim()
          ? `The studio could not match your transfer: ${reason.trim()}`
          : 'The studio could not match your transfer yet. Please get in touch with Guruji.',
        null, 'Credit request')
    } catch (e) { console.error('Declined, student notify failed:', e) }
  }
}

// ─── Where to send the money ─────────────────────────────────────────────────
// Kept in Firestore rather than in the code, for two reasons: the office can
// change it without a deploy, and it sits behind sign-in — anything written in
// the JavaScript is readable by whoever downloads the app, signed in or not.
const DETAILS = ['settings', 'transfer']

export async function getTransferDetails() {
  try {
    const snap = await getDoc(doc(db, DETAILS[0], DETAILS[1]))
    return snap.exists() ? (snap.data().details || '') : ''
  } catch (e) {
    console.error('Transfer details failed to load:', e)
    return ''
  }
}

export async function saveTransferDetails(details, staffId = null) {
  await setDoc(doc(db, DETAILS[0], DETAILS[1]), {
    details: String(details || '').slice(0, 2000),
    updatedBy: staffId,
    updatedAt: serverTimestamp(),
  }, { merge: true })
}
