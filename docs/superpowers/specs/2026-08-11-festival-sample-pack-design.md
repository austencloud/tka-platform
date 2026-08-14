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

| Slot | Card                                                        |
| ---- | ----------------------------------------------------------- |
| 1–2  | Mirrored LOOP: one 16-count, one 8-count                    |
| 3–4  | Rotated LOOP: one 16-count, one 8-count                     |
| 5–6  | VTG cards teaching basic Type 1 letters, turn intensity ≤ 2 |
| 7–8  | Compound fun: one mirrored/swapped, one mirrored/inverted   |
| 9    | Signup card (new)                                           |

Cards mix published sequences with frozen output from the canonical LOOP
generator. The signup card owns the pack's QR; sample-card mandala cells remain
available for teaching instead of repeating eight more links.

### Sheet mechanics

- `scripts/festival-pack-9up.cjs`: US Letter duplex PDF, semantic elemental
  front frames, rainbow card backs, columns mirrored for long-edge duplex, and
  shared cut lines.
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
- Back: a three-step relay: scan a choreo card and learn its sequence, teach
  the sequence to someone else, then hand them the card so they repeat the
  cycle from step one.

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

## Print-run revision: difficulty mix (2026-08-13)

Every pack contains exactly three Level 2 cards chosen from all eight
choreography slots. One of the remaining LOOP cards is Level 3 with a maximum
turn intensity of 0.5. Four cards stay at Level 1 with zero turns. The
four-step TnD cards are excluded from Level 3 because no balanced half-turn
assignment in the approved vocabulary passes loop closure.

The 60-pack run contains all 56 possible three-card selections once, plus four
balanced repeats. Each of the eight slots is selected for Level 2 22 or 23
times. Each of the six LOOP slots receives Level 3 exactly 10 times.

Turn patterns come from twelve named rhythmic families. Actual card length
controls the available vocabulary: four strict balanced families for 4-step
cards, those four plus four more for 8-step cards, and all twelve for 16-step
cards. Every family balances blue and red. The four-step core favors obvious
blocks, pulses, and alternating hands; the 16-step tier allows denser phrases
because the repeated period makes the rhythm legible. The chosen family tiles
the quartered or halved structural unit and must pass the canonical loop
closure check.

Austen's `festival-sampler-turn-pattern-votes (2).json` review is the initial
approval source. Its 59 Yay votes map to eight of the twelve families; the
three vetoed patterns are not in the catalog. Austen approved the remaining
four families in conversation on 2026-08-14, so all twelve print families now
open as Yay in the review UI. Browser votes override the approval seed. Slot
choices, pattern IDs, exact turn strings, and generated sequences are frozen
into the print manifests so reopening or printing the job does not reshuffle a
pack.

## Print-run revision: elemental frames (2026-08-13)

LOOP front frames use the same geometry-based TnD classifier and six-element
color registry as the rest of the app. Each classifiable step contributes its
element color in sequence order; Type 2 steps contribute no invented gray band.
A mixed word such as BΣTX therefore produces Water blue and Sun yellow. A
Type 2-only word uses a deliberate black-and-paper frame because it has no TnD
element to claim. TnD teaching cards keep their existing single-element frame.

The shared `wrapContentInCardFrame` primitive accepts the ordered palette, so
the sampler does not own a second frame renderer and existing deck output stays
unchanged when no palette is supplied.

## Build order

1. `/start` page (UI shown to Austen before finish)
2. `/test/signup-card` harness + card art (shown before print)
3. Propose + render the 8 cards (sign-off on the list)
4. `festival-pack-9up.cjs` + proof PDF
5. Austen prints, cuts, laminates

## Reuse ledger (never-hand-roll evidence)

| Capability             | Owner reused                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------- |
| Google sign-in         | `src/lib/shared/auth/components/SocialAuthCompact.svelte`                          |
| Magic link             | `src/lib/shared/auth/components/EmailLinkAuth.svelte` + `email-link-completion.ts` |
| Guest identity         | `src/lib/shared/auth/services/guest-identity.ts` (`ensureGuestIdentity`)           |
| PWA install steps      | `src/lib/shared/mobile/components/EnhancedPWAInstallGuide.svelte` + config         |
| n-up duplex PDF        | `scripts/donation-cards-4up.cjs` (cloned, 3×3)                                     |
| Card PNGs              | Deck Releaser MPC ZIP export                                                       |
| Print-res card harness | `/test/insert-card` pattern                                                        |
