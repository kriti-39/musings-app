import { useState, useEffect } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './config'

// ─── Who to call with an enquiry ─────────────────────────────────────────────
// Kept in the database, not the code, because the person answering changes:
// when they move on, Guruji types in the next name and number in Settings and
// every page shows it at once, with no deploy.
//
// It is shown to people who are NOT signed in — on the login screen and the
// policy pages, which is where a prospective student or a payment reviewer
// arrives — so this one document is readable by anybody. Nothing else in
// `settings` is.
const REF = ['settings', 'contact']

export const MAX_NAME = 60
export const MAX_PHONE = 24

export async function getContact() {
  try {
    const snap = await getDoc(doc(db, REF[0], REF[1]))
    if (!snap.exists()) return null
    const d = snap.data()
    return d.phone ? { name: d.name || '', phone: d.phone } : null
  } catch (e) {
    console.error('Enquiry contact failed to load:', e)
    return null
  }
}

export async function saveContact({ name, phone }, staffId = null) {
  await setDoc(doc(db, REF[0], REF[1]), {
    name: String(name || '').trim().slice(0, MAX_NAME),
    phone: String(phone || '').trim().slice(0, MAX_PHONE),
    updatedBy: staffId,
    updatedAt: serverTimestamp(),
  })
}

// "+91 70038 86380" → "tel:+917003886380"
export function telHref(phone) {
  return `tel:${String(phone || '').replace(/[^\d+]/g, '')}`
}

export function useContact() {
  const [contact, setContact] = useState(null)
  useEffect(() => {
    let live = true
    getContact().then(c => { if (live) setContact(c) })
    return () => { live = false }
  }, [])
  return contact
}
