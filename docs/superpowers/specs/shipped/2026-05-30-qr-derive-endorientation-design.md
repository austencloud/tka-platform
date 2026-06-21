# Codec — Derive endOrientation (Drop Redundant Field) — Design

**Date:** 2026-05-30
**Status:** Design (corrected against real source; awaiting review → writing-plans)
**Author:** Claude (Opus 4.8) + Austen
**Related:**
- `2026-05-29-step-derived-field-integrity-design.md` — names full derive-only as the "correct end-state" but scopes it OUT (reconcile-on-write instead). This spec executes the first derive-only slice that spec deferred.
- `2026-05-29-start-orientation-register-design.md` — closure theorem + `recalculateAllOrientations` re-seed machinery; owns the future "drop redundant per-step startOrientation" follow-up.

---

## 1. Problem

The shared sequence codec bakes a per-motion `endOrientation` character into every encoded motion. `endOrientation` is **fully derivable** — a pure function of `(startOrientation, motionType, turns, rotationDirection)` plus `(startLocation, endLocation)` for the float branch. Storing a derivable value creates a drift surface: a stored `endOrientation` can disagree with what the algorithm says it must be (the same bug class step-derived-field-integrity fixes for gridMode/position/letter).

This spec eliminates the stored copy for `endOrientation` in the single most isolated field, with the strongest possible guarantee: derive-only makes drift structurally impossible because no stored copy exists.

## 2. Ground truth (verified against real source — supersedes earlier draft)

### The codec is shared by URL **and** QR
`encodeMotion` (`sequence-encoder.ts:132`), `decodeMotion` (`:184`), `encodeBeat` (`:177`), `decodeBeat` (`:257`), `encodeSequence` (`:382`), `decodeSequence` (`:419`) are the shared core. Consumers:
- **URL deep links:** `generateShareURL`, `generateViewerURL`, `/sequence/<id>` routes, `?open=` — via `encodeSequenceWithCompression`/`decodeSequenceWithCompression` (`:515`/`:528`).
- **QR:** `encodeSequenceForQR` (`:641`) / `decodeSequenceFromQR` (`:669`), plus the compositional recipe path.

A format change to the motion layout therefore affects URL and QR uniformly. Both must emit the new version and both must still decode the old one.

### The motion format is unversioned, fixed-width positional
`encodeMotion:174` → `${startLoc}${endLoc}${startOrient}${endOrient}${rotation}${turns}${type}${prop}` (loc=2 chars, orient/rotation/type/prop=1, turns variable; `endOrient` at offset 6). `decodeMotion` reads by cursor offset (`:198-212`), `endOrientCode` at `:199`. There is **no version marker on the flat string.** `decodeSequence:433` only distinguishes a legacy numeric-start blob (`/^\d+$/`) from the position blob.

### Compression tags are NOT the version seam
`sequence-codec.ts`: `compressForURL`→`d1:`/`raw:`, `compressForQR`→`q1:`/`raw:` — these mark *compression*, not motion layout. `RECIPE_PREFIX="r1:"` (`qr/services/types.ts:18`), `INLINE_PREFIX="s~"` (`sequence-encoder.ts:125`) are transport/recipe tags. **The motion-format version must live on the flat string itself**, independent of all of these.

### Derivation (canonical)
`calculateEndOrientation` — `src/lib/shared/render/core/calculations/orientation.ts:210`. Inputs: `startOrientation`, `motionType`, `turns` (`number | "fl"`), `rotationDirection`, `startLocation`, `endLocation`. `recalculateAllOrientations` (`orientation-propagation.ts`) chains per hand. Domain-confirmed via MCP orientation-algebra (pro/static reverse on odd whole turns, anti/dash on even; fractional steps the 8-cycle; float is handpath-derived).

### Existing round-trip verifier
`verifySequenceRoundTrip` (`:755`) does decode→re-encode→re-decode then `findMotionMismatch` (`:345`, field list includes `endOrientation`). This proves round-trip *stability*, not derive-correctness — after derive-only it passes trivially (both decodes derive identically). It is NOT the ship gate; a new equivalence test is (§5).

### Backward-compat surface (verified)
| Artifact | QR/URL contents | Format-dependent? |
|---|---|---|
| Printed deck cards | **shortcode** `tka.run/<code>` — `image-composer.ts:871` `generateAsImage` omits `offline` → defaults `false` → `createShortCode`; `qr/services/types.ts` documents short codes for deck cards | **No** — opaque code; blob in Firestore `shortcodes/{code}`, migratable by us |
| Signed-in viewer QR | shortcode | No |
| **Guest inline QR + shared `s~`/URL deep links** | full encoded blob baked in the QR/URL (`ChoreoCard.svelte:311` `offline = !authState.isAuthenticated`) | **Yes** — bytes are the format; unmigratable server-side |

Printed deck cards **do** carry a QR (baked by ImageComposer via `CANONICAL_DECK_CARD_PROFILE.showQRCode = true`), and it is a format-independent shortcode — so they are safe. The format-dependent surface is guest inline blobs + shared deep links, covered by the permanent legacy decode path.

## 3. Architecture

### Version marker on the flat string

`encodeSequence` prepends a version sentinel as the first pipe-segment for v2:

```
v2|<startPosBeat>|<beat>|<beat>...
```

`decodeSequence` inspects `parts[0]`:
- `parts[0] === "v2"` → `formatVersion = 2`; shift the sentinel; decode motions with 7 fields and derive `endOrientation`.
- otherwise → legacy `formatVersion = 1` (today's behavior exactly: numeric-start branch or 8-field position blob).

This is backward compatible (every in-the-wild string lacks the `v2` sentinel → v1 path), uniform across URL + QR (both call `encodeSequence`/`decodeSequence`), and inherited by the recipe seed (which is itself an `encodeSequence` string).

### Versioned motion codec

`encodeMotion(motion, formatVersion = 2)`:
- v2: omit `endOrient` → `${startLoc}${endLoc}${startOrient}${rotation}${turns}${type}${prop}` (7 fields); drop the `!endOrient` validation gate.
- v1: today's 8-field output, retained (used for legacy-recipe hash re-encoding — see below).

`decodeMotion(encoded, color, formatVersion = 2)`:
- v1: read 8 fields (today), cursor unchanged.
- v2: read 7 fields (no `endOrientCode`), then `endOrientation = calculateEndOrientation({ startOrientation, motionType, turns, rotationDirection, startLocation, endLocation })`.
- Adjust the min-length guard (`:188` `< 10`) for the shorter v2 motion.

Encoder always emits v2 going forward. v1 emit is retained only for back-compat hashing and tests.

### Scope of field dropping — endOrientation ONLY

Each motion keeps its own `startOrientation`, so each self-derives its end with no chaining pass — minimal blast radius. Dropping the redundant per-step `startOrientation` (chain from a single seed) belongs to the start-orientation-register work — **explicit follow-up, not this spec.**

### Recipe (`r1:`) hash backward-compatibility

`compositional-encoder.ts:101` computes the recipe hash on the **uncompressed flat encoding** (`computeRecipeHash(flatEncoded)`); the decoder re-derives and re-hashes (`compositional-decoder.ts:133`) and throws on mismatch. Therefore the hash is version-sensitive:
- **New recipes:** seed + hash both computed via v2 `encodeSequence`. Self-consistent.
- **Old `r1:` recipes in the wild:** seed is v1, hash was computed on v1 flat. The decoder must re-encode for hashing **in the seed's version**. Detection: the decompressed seed string carries (or lacks) the `v2` sentinel; re-hash with `encodeSequence` emitting that same version. This is why a v1 emitter is retained.

### Deriver: use canonical, add no copy

Import the canonical render-core `calculateEndOrientation` into the decode path; add no fifth copy. Add a test asserting all four existing copies (render-core, inlined package, sequence-engine, mcp-server) agree across the input space. Full 4→1 collapse is a named follow-up.

### Migration: deferred

Correctness needs no migration (legacy decode path stays). Re-encoding the Firestore/snapshot corpus to v2 buys only marginal size and is deferred (`scripts/_archive/backfill-shortcode-encoded.ts` exists if wanted).

## 4. What this fixes / does NOT

**Fixes:** eliminates the endOrientation stored-vs-derived drift surface in the codec entirely; proves the derive-only pattern on a contained field before the larger consumer refactor.

**Explicit non-goals:** dropping per-step `startOrientation` (→ start-orientation-register follow-up); collapsing the 4 deriver copies (→ follow-up, guarded by a parity test here); migrating the stored corpus (deferred); eliminating storage for gridMode/position/letter (→ step-derived-field-integrity's deferred end-state).

## 5. Ship gate — corpus equivalence proof (non-negotiable, NEW test)

A new test (not `verifySequenceRoundTrip`, which can't prove this):

1. For a corpus of sequences carrying their true stored `endOrientation` (round-trip test fixtures + a sample of stored `shortcodes.encoded` blobs decoded to SequenceData): encode v2 (dropping endOrient) → decode v2 (deriving endOrient) → assert `derived.endOrientation === original.endOrientation` for every motion, 100%.
2. Any mismatch is a deriver bug surfaced safely on real data → block ship, fix the deriver, never ship a lossy codec.

This is the actual correctness claim of derive-only.

## 6. Affected files

**Edited:**
- `src/lib/shared/navigation/services/sequence-encoder.ts` — `encodeMotion(motion, formatVersion)` (v2 drops endOrient, v1 retained); `decodeMotion(encoded, color, formatVersion)` (v2 7-field + derive, v1 legacy); `encodeSequence` prepends `v2|` sentinel; `decodeSequence` detects sentinel → routes formatVersion; adjust min-length guard; import canonical `calculateEndOrientation`.
- `src/lib/shared/qr/services/compositional-encoder.ts` / `compositional-decoder.ts` — version-aware hashing: re-encode for `computeRecipeHash` in the seed's format version so old `r1:` recipes still verify.

**Unchanged (confirmed):** `sequence-codec.ts` (compression tags are orthogonal); `qr/services/types.ts` (`r1:` recipe prefix unchanged — recipe payload format is unchanged, only its inner flat seed gains the `v2|` sentinel).

**New tests:**
- Corpus equivalence (ship gate): derived endOrientation == original across fixtures + sampled stored blobs.
- Legacy decode regression: captured v1 inline `s~` blob + v1 URL deep link + v1 `r1:` recipe all still resolve unchanged.
- v2 round-trip: encode→decode→derive equals original across float / `"fl"` turns / dash / static / center / fractional cases.
- Deriver-copies parity: the 4 `calculateEndOrientation` copies agree across the input space.

## 7. Testing (TDD — failing test first)

1. **Equivalence (red):** assert derived endOrientation == stored across fixtures before the v2 derive path exists. Drives the deriver wiring.
2. **Legacy resolve:** a captured v1 `s~` blob, a v1 `?open=`/`/sequence/` URL, and a v1 `r1:` recipe each decode identically after the change.
3. **v2 float branch:** a float / `"fl"` motion round-trips through v2 (locations carried; handpath derivation correct).
4. **Version routing:** `v2|`-prefixed flat strings route to v2 decode; un-prefixed route to v1.
5. **Recipe hash compat:** an old v1 `r1:` recipe verifies (re-hash in v1); a new v2 recipe verifies (re-hash in v2).
6. **Browser verification:** scan a freshly generated guest (inline v2) QR and a signed-in (shortcode) QR; confirm both resolve correctly end-to-end. Per verification-protocol.

## 8. Relationship to the derived-field program

| Spec | Layer | Mechanism |
|---|---|---|
| step-derived-field-integrity | editor | reconcile-on-write (gridMode/position/letter) |
| start-orientation-register | catalog | re-seed start orientation as a deck axis |
| **this** | codec / persistence | drop endOrientation, derive on decode |

First realization of the derive-only end-state the editor spec named but deferred. Follow-ups (drop redundant startOrientation; collapse the 4 derivers) extend it toward "every derivable field derived from one canonical source."
