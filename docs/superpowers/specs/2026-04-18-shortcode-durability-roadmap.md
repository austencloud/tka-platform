# Shortcode Durability Roadmap

**Status:** Wave 1 in progress
**Owner:** Austen + Claude
**Date drafted:** 2026-04-18

## Why this exists

We just deleted 933 orphan shortcodes and confirmed 1233 more are zombies. Two
root causes:

1. **`createShortCode()` wraps `encodeForQR()` in try-catch and silently skips
   `encoded` on failure** (`src/lib/shared/qr/services/implementations/ShortCodeManager.ts:229`).
   Result: shortcodes written with no self-contained payload, pointing only to
   mutable external state (user sequences that get deleted, decks that get
   regenerated).
2. **Telemetry is dead code.** `incrementScanCount()` and `logScanEvent()` are
   defined but never called. We have no idea which codes are actually being
   used.

The durability goal is simple: every shortcode must be fully resolvable from
its own document forever, regardless of what happens to external collections.
And every scan must leave a trace so we can see the system in use.

---

## Wave 1 — Cleanup + invariant (in progress)

**Goal:** Self-contained shortcodes as a hard invariant. Start telemetry.

- [ ] **Final zombie sweep.** Expand `scripts/delete-orphan-shortcodes.ts`
  classification to also flag any shortcode that has neither `encoded` nor
  full inline `sequenceData.steps`. Those are unresolvable by definition.
  Run with `--confirm`. Expect ~1233 deleted.
- [ ] **Drop the try-catch in `createShortCode()`.** If `encodeForQR()` throws,
  propagate. No more half-documents. File: `ShortCodeManager.ts:225-230`.
- [ ] **Harden `firestore.rules` `shortcodes` create.** Require
  `request.resource.data.encoded is string && request.resource.data.encoded.size() > 0`.
  Client regression can't produce broken docs anymore.
- [ ] **Wire telemetry.** In every resolver path (`resolveShortCode()` in
  `ShortCodeManager.ts`, the static-snapshot resolver, and any Cloud Function
  resolver if one exists), call `incrementScanCount(code)` + `logScanEvent(code, { referer, userAgent })`
  on successful resolve. Do this *after* returning the sequence so latency
  isn't affected (fire-and-forget).
- [ ] **Regenerate static snapshot** so `shortcodes.json` reflects the cleaned
  state.
- [ ] **Commit as one PR** titled "fix(shortcodes): durability invariant +
  telemetry wiring".

**Definition of done:** every shortcode in Firestore has a non-empty `encoded`
field. Scan count is ticking up in real time. `firestore.rules` rejects any
attempt to create a shortcode without `encoded`.

---

## Wave 2 — Admin dashboard (next session)

**Goal:** See which codes are actually being used before ever touching this
collection again.

- [ ] Create `/admin/shortcodes` (authenticated admin only, reuse existing
  admin-gate pattern).
- [ ] Table of top 50 codes by `scanCount`. Columns: code, word, scanCount,
  lastScannedAt, created, owner.
- [ ] Secondary view: codes with `scanCount === 0` and
  `createdAt > 30 days ago`. These are candidates for future cleanup.
- [ ] Live feed of the last 100 scan events (pulled from `scanEvents`
  subcollection, sorted by timestamp). Show code + referer + userAgent + ISO
  timestamp.
- [ ] Sparkline per top-50 code (daily scan counts last 30 days).

Keep it functional, not decorative. No animation, no dark/light themes, no
feature toggles. One page, three sections.

---

## Wave 3 — Community map pings (brainstorming required)

**Vision (Austen, 2026-04-18):**
> When someone scans a choreo card anywhere in the world, a pin blooms on the
> community map with the sequence word + city. When I ship 1000 cards to
> cities across the world, we get to watch the snowball roll in real time.

**Open questions that need a brainstorming session before spec:**

1. **Privacy posture.** City-level geo-IP only? Or ZIP-level? Any per-user
   opt-in UX? Does a scan from a non-authenticated user leave a pin? If yes,
   how do we prevent pin spam / abuse?
2. **Pin lifecycle.** Fade over hours, stick for N days, permanent? When
   multiple scans hit the same city, stack into a cluster with a count, or
   show individual pins?
3. **Visual distinction.** Printed-card scans vs app-native scans vs
   QR-embed-in-email scans — do these get different pin treatments? (Yes,
   probably. The printed-card one is the dopamine hit.)
4. **Integration with existing community map.** Where does the map live
   today? What data model does it use? Does adding live-scan pins conflict
   with whatever else is there?
5. **Latency.** Real-time (websocket / Firestore snapshot listener) or
   batched (poll every 30s)? The "watching it bloom" experience depends on
   this.
6. **Back-fill.** If we had scan data from before the map existed, would we
   replay it? (Probably not — start fresh with the foundation's telemetry.)

**Scope deliverable when the brainstorming happens:** a design doc for the
pin component, the data model for `scanEvents` with geo enrichment, the map
integration point, and a rollout plan.

---

## Larger context: the snowball

Austen, quoted 2026-04-18:
> I've been working on this for four years and I hear threads from other
> countries and other states and other cities that people are teaching my
> system. The snowball has only begun to roll. We are on the precipice of the
> flow arts revolution.

The map-ping feature is aesthetic, but it's also evidence. It proves to
Austen and everyone else that the reach is real. That shapes priorities —
Wave 3 isn't a nice-to-have, it's part of the product narrative.

---

## Files touched during this work (so far)

- `scripts/backfill-shortcode-encoded.ts` — new (committed `aed95a7730`)
- `scripts/export-static-snapshot.cjs` — v2 skinny schema (committed `aed95a7730`)
- `scripts/delete-orphan-shortcodes.ts` — new (committed `fcfb73e74b`)
- `scripts/probe-zombie-shortcodes.ts` — new (this session)
- `firebase-functions/src/snapshotShortCodes.ts` — new (committed `aed95a7730`)
- `static/data/snapshots/shortcodes.json` — regenerated (committed `fcfb73e74b`)
- `static/data/snapshots/orphan-shortcodes.json` — audit trail (committed `fcfb73e74b`)

## Files to be touched in Wave 1

- `src/lib/shared/qr/services/implementations/ShortCodeManager.ts` (drop try-catch,
  wire telemetry calls)
- `firestore.rules` (tighten create rule)
- `scripts/delete-orphan-shortcodes.ts` (expand classification)
- `static/data/snapshots/shortcodes.json` (regenerate post-cleanup)
