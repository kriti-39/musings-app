// Run this once in the browser console to create a test admin user
// Open http://localhost:5174, open DevTools (F12), paste this in the Console tab

import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { auth, db } from './config'

async function createTestUsers() {
  // Admin user
  const admin = await createUserWithEmailAndPassword(auth, 'admin@musings.app', 'admin123')
  await setDoc(doc(db, 'users', admin.user.uid), {
    email: 'admin@musings.app',
    name: 'Admin',
    role: 'admin',
    createdAt: new Date(),
  })

  console.log('Admin created:', admin.user.uid)
}

createTestUsers()
