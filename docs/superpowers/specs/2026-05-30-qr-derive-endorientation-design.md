# QR Codec — Derive endOrientation (Drop Redundant Field) — Design

**Date:** 2026-05-30
**Status:** Design (awaiting review → writing-plans)
**Author:** Claude (Opus 4.8) + Austen
**Related:**
- `2026-05-29-step-derived-field-integrity-design.md` — names full derive-only as the "correct end-state" but scopes it OUT (reconcile-on-write instead). This spec executes the first derive-only slice that spec deferred.
- `2026-05-29-start-orientation-register-design.md` — provides the closure theorem and the `recalculateAllOrientations` re-seed machinery this spec reuses; owns the future "drop redundant per-step startOrientation" follow-up.

---

## 1. Problem

The QR / shortcode codec bakes a per-motion `endOrientation` character into every encoded motion. `endOrientation` is **fully derivable** — a pure function of `(startOrientation, motionType, turns, rotationDirection)` plus `(startLocation, endLocation)` for the float branch. Storing a derivable value creates a drift surface: a stored `endOrientation` can disagree with what the algorithm says it must be.

This is the same class of bug the step-derived-field-integrity spec fixes for `gridMode`/`startPosition`/`endPosition`/`letter`, applied to the codec layer. That spec chose reconcile-on-write (recompute the stored copy) and explicitly deferred the stronger fix — eliminate the stored copy entirely — as "correct end-state, out of scope." This spec is that stronger fix, scoped to the single most isolated field (`endOrientation`) in the single most isolated layer (the codec).

### Why endOrientation, why now

- **Isolated surface.** The codec is `sequence-encoder.ts` plus a round-trip verifier. No editor consumers, no persisted `SequenceData` shape change.
- **Proven pattern, proven seam.** The decomposer already drops `prefloatRotationDirection` as derivable (`sequence-decomposer.ts`, documented "intentionally NOT stored"). This extends an established pattern.
- **Strongest anti-drift guarantee.** Reconcile-on-write repairs drift at the next write; derive-only makes drift structurally impossible because no stored copy exists.

## 2. Ground truth (verified)

### Derivation
`calculateEndOrientation` — canonical source `src/lib/shared/render/core/calculations/orientation.ts:210`. Inputs: `startOrientation`, `motionType`, `turns` (`number | "fl"`), `rotationDirection`, `startLocation`, `endLocation`. Branch dependencies:
- whole-turn (common): only `startOrientation` + `motionType` + `turns`
- fractional turns: + `rotationDirection`
- float (`type === "float"` or `turns === "fl"`): `startOrientation` + `startLocation` + `endLocation` (handpath), ignores turns/rotation

`recalculateAllOrientations` (`orientation-propagation.ts`) chains it per hand: each step's `startOrientation` = previous step's `endOrientation`. Per-hand, independent (blue/red).

### Domain confirmation (MCP orientation-algebra)
Pro/static reverse orientation on odd whole turns, anti/dash on even; fractional turns step the 8-point radial cycle (0.25 turn = 1 step); float orientation is handpath-derived. Net transform of any returning sequence is a pure rotation of the 8-cycle — consistent with the deriver.

### Current codec
- `encodeMotion` (`sequence-encoder.ts:174`): fixed-width positional, no delimiters —
  `${startLoc}${endLoc}${startOrient}${endOrient}${rotation}${turns}${type}${prop}`.
- `decodeMotion` (`sequence-encoder.ts:192-212`): reads by character offset; `endOrient` at `:199`.
- **No version marker on the motion format.** Container tags exist (`s~` inline, `r1:` recipe, `q1:`/`d1:` compression) but none gates motion field count. Dropping a char without a version flag silently misparses.

### Backward-compat surface (verified — supersedes earlier incorrect claims)
| Artifact | QR contents | Format-dependent? |
|---|---|---|
| Printed deck cards | **shortcode** `tka.run/<code>` — `image-composer.ts:871` calls `generateAsImage(seq, qrSize, darkMode)` omitting `offline` (defaults `false` → `createShortCode`); `export-options.ts:94` "short codes generated for deck cards" | **No** — opaque code; encoded blob in Firestore `shortcodes/{code}.encoded`, migratable by us |
| Signed-in viewer QR | shortcode | No |
| **Guest inline QR + shared `s~` URLs** | full `s~<blob>` baked in the QR/URL (`ChoreoCard.svelte:311` `offline = !authState.isAuthenticated`) | **Yes** — bytes are the format; cannot be migrated server-side (we don't hold them) |

Stored corpus needing optional migration: Firestore `shortcodes/{code}.encoded` + R2 snapshot `snapshots/shortcodes-v2.json` + git `data/snapshots/shortcodes.json`. Backfill script exists: `scripts/_archive/backfill-shortcode-encoded.ts`.

## 3. Architecture

### Versioned codec, permanent legacy decode path

Bump the existing format tags that decode already branches on — `q1:→q2:` (QR), `d1:→d2:` (URL), `r1:→r2:` (recipe). The new tag means "v2 motion layout: 7 fields, endOrientation omitted, derive on decode." Old/untagged blobs decode through the **legacy 8-field path, kept permanently** (cheap). Every in-the-wild inline `s~` blob and every un-migrated shortcode still resolves. No artifact breaks.

`decodeMotion` gains a `formatVersion` parameter:
- **v1:** read 8 fields (today's behavior, unchanged).
- **v2:** read 7 fields, then call the canonical `calculateEndOrientation`, seeded from the motion's own `startOrientation` (which v2 still carries — see scope).

`encodeMotion` v2 stops emitting the `endOrient` character. Encoder always writes v2 going forward; v1 emit path is retired (encode), retained only for decode.

### Scope of field dropping — endOrientation ONLY

This pilot drops **only** `endOrientation`. Each motion keeps its own `startOrientation`, so each motion self-derives its end with no chaining pass — minimal blast radius. Dropping the redundant per-step `startOrientation` (steps 2..N equal the previous step's `endOrientation`, recomputable by chaining from a single seed) is the larger compression play and belongs to the start-orientation-register seed work — **explicit follow-up, not this spec.**

### Deriver: use canonical, add no copy

There are four byte-identical copies of `calculateEndOrientation` (render-core canonical, the inlined package copy, sequence-engine, mcp-server). That is a latent derivation-vs-derivation drift surface. This pilot:
- imports the canonical render-core deriver at decode; **adds no fifth copy.**
- adds a test asserting all four copies produce identical output across the input space (cheap drift tripwire).
- The full 4→1 collapse to one shared module is a **named follow-up** ("canonical deriver collapse") — the real long-term purity win, out of scope here.

### Migration: deferred

Correctness requires no migration (legacy decode path stays). Re-encoding the Firestore/snapshot corpus to v2 buys only marginal size reduction and is deferred; the existing backfill script handles it if ever wanted.

## 4. Ship gate — corpus equivalence proof (non-negotiable)

Repurpose `verifySequenceRoundTrip` (`sequence-encoder.ts:345-376`). Before v2 encoding is trusted:

1. For every stored `shortcodes.encoded` blob plus the round-trip test corpus: decode (v1), then run the v2 derive path and assert `derived endOrientation === stored endOrientation` at 100%.
2. Any mismatch is a deriver bug surfaced safely on real data — block ship, fix the deriver, never ship a lossy codec.

This converts the verifier from "stored == stored after round-trip" to "derived == original," which is the actual correctness claim of derive-only.

## 5. What this fixes / does NOT

**Fixes:**
- Eliminates the endOrientation stored-vs-derived drift surface in the codec entirely (no stored copy to drift).
- Proves the derive-only pattern on a contained surface before the larger consumer refactor.

**Explicit non-goals:**
- Dropping per-step `startOrientation` (→ start-orientation-register follow-up).
- Collapsing the 4 deriver copies (→ canonical-deriver-collapse follow-up; guarded by a test here).
- Migrating the stored corpus (deferred; legacy decode covers correctness).
- Eliminating storage for `gridMode`/`position`/`letter` (→ step-derived-field-integrity's deferred end-state).

## 6. Affected files

**Edited:**
- `src/lib/shared/navigation/services/sequence-encoder.ts` — `encodeMotion` v2 (drop `endOrient`); `decodeMotion(formatVersion)` (v1 8-field legacy path retained, v2 7-field + derive); bump `q1:→q2:` / `d1:→d2:` and emit v2 tags; rewrite `verifySequenceRoundTrip` to assert derived == original.
- `src/lib/shared/qr/services/compositional-encoder.ts` / `compositional-decoder.ts` — `r1:→r2:` tag; recipe inner blob uses v2 motion layout; legacy `r1:` decode retained.
- Import canonical `calculateEndOrientation` from `src/lib/shared/render/core/calculations/orientation.ts` into the decode path.

**New tests:**
- Corpus equivalence: stored `encoded` blobs + round-trip corpus, derived endOrientation == stored, 100%.
- Legacy decode: v1 (`q1:`/`d1:`/`r1:`/untagged) blobs still resolve unchanged.
- v2 round-trip: encode→decode→derive equals original, including float / `"fl"` turns / dash / static / center / fractional cases.
- Deriver-copies parity: the 4 `calculateEndOrientation` copies agree across the input space.

## 7. Testing (TDD — failing test first)

1. **Equivalence (red):** assert derived endOrientation == stored across the corpus before the derive path exists. Drives the deriver wiring.
2. **Legacy resolve:** a captured v1 inline `s~` blob decodes identically after the change (no regression for in-the-wild codes).
3. **v2 float branch:** a float / `"fl"` motion round-trips through v2 (locations carried, handpath derivation correct).
4. **Version routing:** `q2:`/`d2:`/`r2:` route to v2 decode; absent/`*1:` route to v1.
5. **Browser verification:** scan a freshly generated guest (inline v2) QR and a signed-in (shortcode) QR; confirm both resolve to the correct sequence end-to-end. Per verification-protocol.

## 8. Relationship to the derived-field program

Three specs, three layers, one shared propagation engine (`recalculateAllOrientations`):

| Spec | Layer | Mechanism |
|---|---|---|
| step-derived-field-integrity | editor | reconcile-on-write (gridMode/position/letter) |
| start-orientation-register | catalog | re-seed start orientation as a deck axis |
| **this** | codec / persistence | drop endOrientation, derive on decode |

This is the first realization of the derive-only end-state the editor spec named but deferred. Its follow-ups (drop redundant startOrientation; collapse the 4 derivers) extend it toward "every derivable field is derived, from one canonical source."
