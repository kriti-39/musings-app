// GET /api/health — is this deployment wired up?
//
// Reports WHICH configuration is present, never any value. Added because
// "payment isn't set up" and "the variable went to the wrong environment" look
// identical from the outside, and guessing at someone's Vercel dashboard is a
// slow way to find out.
//
// Safe to leave public: every field is a boolean, a public key id, or a
// project id that already ships inside the browser bundle.
export default function handler(req, res) {
  const present = (name) => !!process.env[name]

  const keyId = process.env.RAZORPAY_KEY_ID || ''
  let serviceAccountProject = null
  let serviceAccountValid = false
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT
    if (raw) {
      const parsed = JSON.parse(raw)
      serviceAccountProject = parsed.project_id || null
      // A key pasted with its newlines mangled parses but can't sign anything
      serviceAccountValid = !!parsed.private_key?.includes('BEGIN PRIVATE KEY')
    }
  } catch {
    serviceAccountValid = false
  }

  res.status(200).json({
    // Server-side, read at runtime by the functions
    runtime: {
      RAZORPAY_KEY_ID: present('RAZORPAY_KEY_ID'),
      RAZORPAY_KEY_SECRET: present('RAZORPAY_KEY_SECRET'),
      RAZORPAY_WEBHOOK_SECRET: present('RAZORPAY_WEBHOOK_SECRET'),
      FIREBASE_SERVICE_ACCOUNT: present('FIREBASE_SERVICE_ACCOUNT'),
    },
    razorpay: {
      configured: !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
      mode: keyId.startsWith('rzp_test_') ? 'test'
        : keyId.startsWith('rzp_live_') ? 'LIVE'
        : keyId ? 'unrecognised' : 'absent',
      keyIdPrefix: keyId ? keyId.slice(0, 12) : null,   // public anyway
    },
    firebaseAdmin: {
      project: serviceAccountProject,
      keyLooksIntact: serviceAccountValid,
    },
    note: 'Values are never reported — only whether each one is present.',
  })
}
