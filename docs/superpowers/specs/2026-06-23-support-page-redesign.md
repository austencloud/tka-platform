# Support Page Redesign — "Buy me a coffee"

Date: 2026-06-23
Route: `src/routes/(public)/support/+page.svelte` (prerendered, `noindex`)

## Why

The old `/support` page was a minimal donation card whose copy ("If this guide
helps you...") assumed the visitor had read the guide. But the page is reached
from the site header nav, the landing hero, the sidebar footer, AND the printed
guide QR — so most arrivals have not read the guide. It needed to be a general
support page for the whole Kinetic Alphabet project, and to stop looking
generic / AI-generated.

## What shipped

A "buy me a coffee" tip jar that lives inside the real public chrome:

- `SiteHeader` (nav + Open the app, active "Support" tab) and `LandingFooter`
  (About / Roots / Open the app / Sign in / Terms / Privacy) wrap the page, so a
  visitor can leave to anywhere on the site.
- Site's own navy gradient background (`#0f0f23 → #1a1a2e → #16213e`), matching
  `/about` and `/roots`. No invented purple aurora.
- Headline matches the site's sans heading style (white→translucent gradient).
- Copy: no offering list (cards/book/guide framing was inaccurate — Choreo Cards
  are too early to explain). Voice avoids the "built by one person" framing (it
  read as anonymous and erased collaborators). Final body: "The Kinetic Alphabet
  is a continuously growing project, with 4 years of development behind it.
  Donations play a huge role in making this work possible. Please consider
  supporting, any amount is deeply appreciated!" Sign-off: "Austen
  Cloud / Creator of The Kinetic Alphabet" — quietly makes the money-to-creator
  point.
- Three side-by-side payment buttons with real brand logos (Simple Icons, CC0,
  rendered white on brand-gradient fills): PayPal `@austencloud`, Venmo
  `@austencloud`, Cash App `$austencloud`. Venmo's wordmark viewBox is cropped to
  its glyph bounds so it reads at proper size.
- Mobile (<520px): buttons collapse to stacked rows.

Links: `paypal.com/paypalme/austencloud`, existing Venmo `code?user_id=...`,
`cash.app/$austencloud`.

## Suggested amounts + payment methods (shipped)

- `SegmentedControl` (the canonical single-select primitive) drives a suggested
  amount: Coffee · $5 / Lunch · $15 / Custom (number input, $1–$1000).
- The selected amount prefills every method:
  - PayPal: `paypal.com/paypalme/austencloud/<amount>`
  - Cash App: `cash.app/$austencloud/<amount>`
  - Venmo: `venmo.com/?txn=pay&recipients=austencloud&amount=<amount>` (web pay
    URL — prefills on desktop, deep-links to the app on mobile; replaces the old
    user_id code link).
- **Pay by card (Stripe):** primary CTA → `createDonationCheckout({ amountCents })`
  Firebase function (`firebase-functions/src/donation/createDonationCheckout.ts`,
  mirrors `createMerchCheckout`: same `STRIPE_SECRET_KEY`, dynamic `price_data`,
  `submit_type: "donate"`, returns to `/support?donated=1`). Frontend caller at
  `src/lib/shared/support/donation-checkout.ts` is dynamically imported so the
  firebase SDK stays out of the landing-lite bundle. A `?donated=1` return shows
  a thank-you banner.
- Amount validation is enforced both client-side and in the function
  ($1–$1000).

## Deferred (the "ongoing spec")

1. **Real screenshots / work showcase.** Austen wants real, sharp screenshots of
   the app before any showcase of the offerings goes back on the page. The app
   shot is the weak asset today (only `branding/feature-graphic.png` exists).
   Image slots were intentionally left out for now — page works imageless.

2. **Recurring membership.** A "$5/mo" membership stays parked until the app is
   ready (pre-launch recurring asks read as pushy). One-time suggested amounts
   shipped instead; a recurring tier would extend the Stripe path.

3. **Indexability.** Page is currently `noindex` (inherited from its QR-target
   origin). Now that it's a primary nav page like `/about`, consider removing
   `noindex` — not done here to avoid an unrequested SEO change.

## Sketches (throwaway)

Exploration sketches at `static/sketches/2026-06-23-support-*.html`
(editorial, gallery, immersive→tip-jar). Safe to delete.
