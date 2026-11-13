// ─── Who the studio is, legally ──────────────────────────────────────────────
// Razorpay's reviewers read these details off the public pages and check them
// against the KYC on the account. They must MATCH, so they are kept in one
// place rather than retyped across four pages where one could drift.
//
// ⚠️  EVERY VALUE MARKED "FILL IN" MUST BE REPLACED BEFORE THESE PAGES GO
//     LIVE. They are not guesses that happen to be close — they are blanks.
//     Publishing a policy page carrying someone else's placeholder address is
//     worse than having no page at all, and a mismatch with the KYC is the
//     commonest reason an international application is refused.
export const STUDIO = {
  // What students call it.
  name: "Deva's Classes",

  // The name on the Razorpay account and the bank account behind it. For a
  // sole proprietor this is usually the person's own name, or "<Name>
  // (Proprietor, <Trading Name>)".
  legalName: 'FILL IN — registered name on the Razorpay account',

  // The full registered address, with postcode. Razorpay expects a real,
  // complete one; a city alone is not enough.
  address: 'FILL IN — full registered address, including postcode',

  // Reachable, monitored, and the same address the account uses.
  email: 'FILL IN — contact email',

  // Optional. Remove it rather than inventing one.
  phone: '',

  // Only if registered. Leave empty otherwise — never invent a number.
  gstin: '',

  // The country whose law governs the terms, and the city whose courts have
  // jurisdiction.
  jurisdiction: 'FILL IN — city, India',
}

// True when anything above still needs filling, so the app can say so loudly
// rather than quietly serving placeholders to a payment reviewer.
export function studioIncomplete() {
  return Object.entries(STUDIO)
    .filter(([, v]) => typeof v === 'string' && v.startsWith('FILL IN'))
    .map(([k]) => k)
}
