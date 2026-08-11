# Festival Sample Pack + /start Signup Funnel — Design

**Date:** 2026-08-11 · **Deadline:** printed sheets by ~Friday 2026-08-14 (festival this weekend)
**Approved:** conversationally by Austen 2026-08-11; UI review gate: he sees the /start page and card art before ship.

## Goal

A passable physical card pack that gets festival people signed up for Flow Arts
Composer with minimal friction. Each recipient gets one 9-card pack: 1 signup
card (QR → pitch/signup page) + 8 canonical choreo cards. Austen does the pitch
in person; the page's job is account creation, not selling.

## Part 1 — The 9-up sample pack sheet (print)

### Set composition (curated once, duplicated per pack)

| Slot | Card |
|---|---|
| 1–2 | Mirrored LOOP: one 16-count, one 8-count |
| 3–4 | Rotated LOOP: one 16-count, one 8-count |
| 5–6 | VTG cards teaching basic Type 1 letters, turn intensity ≤ 2 |
| 7–8 | Compound fun: one mirrored/swapped, one mirrored/inverted |
| 9 | Signup card (new) |

Cards are selected at build time from **released catalogs** so every card is
canonical with a working `/q/[code]` QR. The concrete 8-card list is proposed to
Austen for sign-off before rendering (deck-release-expert territory; TnD catalog
is variation authority).

### Sheet mechanics

- New `scripts/festival-pack-9up.cjs`, cloned from `scripts/donation-cards-4up.cjs`
  (which mirrors `codex-6up.cjs`): US Letter duplex PDF, rainbow border frame,
  columns mirrored for long-edge duplex, shared cut lines.
- 3×3 grid: poker cards at true 2.5"×3.5" (180×252 pt) fit 540×756 pt inside
  612×792 letter with margins.
- Consumes the 8 card front/back PNGs from the Deck Releaser's existing MPC ZIP
  export + the signup card front/back PNG.
- Output: one duplex PDF; print N copies = N complete packs.
- **Deliberately does NOT extend the deck-release insert system**
  (`renderInfoCardFront/Back`). A second insert kind is the elegant long-term
  move but modifies a shipped pipeline days before the deadline. Script
  composes; app pipeline untouched.

### Signup card art

- Rendered at print resolution from a new `/test/signup-card` harness (same
  pattern as shipped `/test/insert-card`), keeping typography consistent with
  the card system.
- Front: QR to `https://tkaflowarts.com/start` + the URL printed as text
  (QR-dead insurance) + one pitch line.
- Back: matching card back art.

## Part 2 — The /start page (web)

New route `src/routes/(public)/start`, editorial shell. Public page: 4K rules
apply, all-viewport verification required (primary audience is phones at a jam).

### Flow

1. **Signup-first landing.** Short headline + one line, then straight into
   account creation. Reuses existing auth owners:
   - `SocialAuthCompact` (Google) — primary; one tap, no email round-trip.
   - `EmailLinkAuth` (magic link via Brevo) — secondary.
2. **Guest hatch, deadpan.** A real button (per clickables-look-like-buttons),
   below the auth block: "Continue without an account" + one-line deadpan cost
   statement (copy honed at build, fire-jam tested). Runs `ensureGuestIdentity()`
   → app. Guests also get the install step.
3. **Post-signup success beat** (magic-link completions redirect back here):
   1. **"Put it on your home screen"** — primary. Composes existing
      `EnhancedPWAInstallGuide` / `PlatformInstructions` /
      `pwa-install-instructions.ts` (platform + browser detected). Android
      Chrome may use the real `beforeinstallprompt` one-tap; iOS gets
      Share → Add to Home Screen steps. App is already installable
      (manifest at `src/app.html:949`).
   2. **"Scan any card in your pack"** — secondary; camera-app scanning works
      without the app open.
   3. "Open the app" button.

### Explicitly rejected

- Native App Store build in 48h: no iOS build exists (Capacitor unbuilt, T6);
  Apple review alone is 1–3 days. PWA is the move.
- `tka.run/start`: keeps tka.run single-purpose (sequence short codes).

## Not in scope this week

- Public `/deck/[n]` pages, a formal "Festival Sampler" Firestore deck release,
  referral/attribution tracking. The 8-card set can become a released deck later
  without reprinting.

## Build order

1. `/start` page (UI shown to Austen before finish)
2. `/test/signup-card` harness + card art (shown before print)
3. Propose + render the 8 cards (sign-off on the list)
4. `festival-pack-9up.cjs` + proof PDF
5. Austen prints, cuts, laminates

## Reuse ledger (never-hand-roll evidence)

| Capability | Owner reused |
|---|---|
| Google sign-in | `src/lib/shared/auth/components/SocialAuthCompact.svelte` |
| Magic link | `src/lib/shared/auth/components/EmailLinkAuth.svelte` + `email-link-completion.ts` |
| Guest identity | `src/lib/shared/auth/services/guest-identity.ts` (`ensureGuestIdentity`) |
| PWA install steps | `src/lib/shared/mobile/components/EnhancedPWAInstallGuide.svelte` + config |
| n-up duplex PDF | `scripts/donation-cards-4up.cjs` (cloned, 3×3) |
| Card PNGs | Deck Releaser MPC ZIP export |
| Print-res card harness | `/test/insert-card` pattern |
