// ─── Per-caller rate limiting ────────────────────────────────────────────────
// Every endpoint here is authenticated, and until now that was the only limit:
// a signed-in student could call /api/push in a loop and land an unbounded
// number of pushes on Guruji's phone. Each one passed the student-may-notify-
// staff check honestly, which is exactly why nothing stopped it. With a dozen
// students that is theoretical; with a hundred it is a matter of time.
//
// A counter per caller per clock hour, held in `rateLimits`. There is no rule
// for that collection, so it falls through Firestore's default deny and no
// client can read or write it — only the Admin SDK, which bypasses rules
// entirely, reaches it.
//
// The window is a fixed clock hour rather than a sliding one. That is less
// precise (a caller gets a fresh allowance on the hour) and far cheaper: the
// bucket id is derived arithmetically, so checking costs one document read and
// one write, with nothing to scan and nothing to prune.
//
// Counting in a transaction, rather than incrementing and reading back, is what
// makes concurrent calls add up correctly — the flood this exists to stop is
// concurrent by nature, and a lost update there would let it through.

// Chosen to be invisible in real use and obvious in abuse. A student books,
// cancels or reschedules a handful of times a day; each of those sends one
// push. Sixty an hour is roughly a month of ordinary use compressed into an
// hour, so nobody legitimate will ever see this.
export const LIMITS = {
  push: 60,
  'create-order': 20,
  cancel: 30,
}

function bucketOf(now) {
  return Math.floor(now / 3600000)   // the clock hour
}

// Returns { ok: true } or { ok: false, retryAfter } (seconds until the window
// turns over). Fails OPEN: if the counter itself cannot be read or written, the
// request proceeds. A throttle that goes down must not take the app with it —
// being unable to count is not a reason to refuse somebody's payment.
export async function checkRate(adminSdk, uid, action, now = Date.now()) {
  const max = LIMITS[action]
  if (!max || !uid) return { ok: true }

  const bucket = bucketOf(now)
  const ref = adminSdk.firestore().doc(`rateLimits/${uid}_${action}_${bucket}`)

  try {
    const count = await adminSdk.firestore().runTransaction(async tx => {
      const snap = await tx.get(ref)
      const n = (snap.exists ? Number(snap.data()?.n) || 0 : 0) + 1
      tx.set(ref, {
        n,
        uid,
        action,
        // For a Firestore TTL policy on this field, so spent buckets are swept
        // up by Firebase instead of piling up for ever. Without the policy the
        // documents are harmless, just untidy.
        expiresAt: new Date((bucket + 2) * 3600000),
      })
      return n
    })

    if (count > max) {
      const secondsLeft = Math.ceil(((bucket + 1) * 3600000 - now) / 1000)
      return { ok: false, retryAfter: Math.max(secondsLeft, 1), count, max }
    }
    return { ok: true, count, max }
  } catch (e) {
    console.error(`Rate check failed for ${uid}/${action}, allowing:`, e)
    return { ok: true }
  }
}

// Refuse with the standard status and header, so a real client can back off
// properly instead of hammering.
export function tooMany(res, { retryAfter }) {
  res.setHeader('Retry-After', String(retryAfter))
  return res.status(429).json({
    error: 'Too many requests. Please wait a little and try again.',
  })
}
