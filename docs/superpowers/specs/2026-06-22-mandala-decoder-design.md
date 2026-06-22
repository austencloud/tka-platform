# Mandala Decoder — Design Spec

**Date:** 2026-06-22
**Status:** Approved design, pre-plan
**Author:** Austen + Claude (brainstorm)

## The Idea

A mandala looks like an alien glyph. Treat it as one. Given a *rendered* TKA
mandala, decode every valid pathway in the catalog that traces that exact glyph.
The shape is the word; decoding is listing every utterance that maps to it.

This is **inverse lookup against a precomputed index**, not a from-scratch
solve. The forward model (`mandala-geometry-calculator.ts` → `calculate()`) is
deterministic and cheap; the catalog of valid LOOP sequences is finite (53k+
across the Firestore decks). So decode = fingerprint the query, look up the
class.

### Scope (locked during brainstorm)

- **Input:** a mandala the app itself rendered — exact vector paths, no camera,
  no raster pipeline. (Photo-of-screen and open-world hand-drawn decode were
  considered and deferred; both build on this same engine.)
- **Equivalence:** color-blind shape match as the **core key**, with color
  signature and rotation/reflection orbit as **annotations**, so the result can
  be viewed through all three lenses at once.

### The honest limit (stated up front)

Decode returns an **equivalence class**, never "the one true pathway" — many
pathways genuinely trace one glyph (`feedback_mandala_fingerprint_is_visual`:
"if blue draws an arc and red draws the same arc on top, it's one line"). That
collapse is the feature's deepest output: it enumerates exactly which sequences
are visually indistinguishable.

## Reuse / never-hand-roll justification

- **Reuse** `mandala-geometry-calculator.ts` `calculate()` — the forward model.
  Same sequence → byte-identical SVG `d` strings (fixed 500px frame,
  `MANDALA_GRID_RADIUS` 80). No new geometry math.
- **Reuse** `samplePathPoints(d)` and `classifyPath(d)` from
  `scripts/shape-fingerprint-test.ts` — SVG `d` → point array, and the
  DASH/ANTISPIN/PROSPIN/DOT type classifier.
- **Reuse** `content-hasher.ts` for the hash step.
- **Reuse** `MandalaRenderer` for rendering decoded results in the lab page.
- **Reuse** `MandalaGeometryCalculator.test.ts` patterns for the new tests.
- **Extend, don't fork:** the existing `fingerprint()` in shape-fingerprint-test
  is a coarse *type-count* key (`D{n}A{n}P{n}T{n}`) — groups thousands of
  distinct shapes, too lossy to identify a specific glyph. Keep it as a fast
  **pre-bucket**; add the geometric-exact layer on top.
- **New (justified — grep found nothing geometric-exact):** `mandala-fingerprint.ts`,
  the index builder, `mandala-decoder.ts`, and the lab page.

## Architecture — three units

### 1. `mandala-fingerprint.ts` (pure functions)

Location: `src/lib/shared/mandala/services/mandala-fingerprint.ts`. Pure,
no I/O, fully unit-testable.

- `quantize(paths) → QuantizedPointSets` — `samplePathPoints` each `d`, snap
  coords to a tolerance grid (~1px). Grid coarse enough to survive FP drift
  under rotation, fine enough to keep distinct glyphs apart. **Grid value is
  tuned by the round-trip + rotation tests — that tuning is the experiment.**
- `shapeKey(paths) → string` — **primary key.** Color-blind: merge
  blue+red+purple point-sets, quantize, sort points, hash via `content-hasher`.
  **Known property (as built):** the key is a hash of the *sorted point set*, so
  it is stroke-order- and color-independent by design. Two glyphs that visit the
  exact same quantized point cloud in different draw order collapse to one key.
  For dense sampled mandala tip-paths this is the intended "the shape is its
  point cloud" semantics; record it before the production Firestore path builds
  on it (a future stricter key could fold in connectivity if a real collision
  ever surfaces).
- `colorSignature(paths) → { blueOnly, redOnly, comboPurpleRatio }` — the
  annotation honoring the red→blue→purple lens.
- `orbitKey(paths) → string` — rotation/reflection-invariant key. **As built
  (exact, not the tolerance-based geometry-rotation the draft proposed):**
  quantize each point ONCE into `(radiusBucket, angleBucket)` polar tokens, then
  let the dihedral group act on the *integer angle buckets* — a 45° rotation is
  exactly `+ANGLE_BUCKETS/8` buckets, a reflection is bucket negation. Take the
  lexicographic-min canonical token string over the 8×2 group, then hash. Because
  the float→int rounding happens once on the original glyph and the group acts on
  integers, orbit membership is exact by construction (no boundary scatter). The
  earlier "rotate the Cartesian geometry and re-quantize" approach was only ~99%
  invariant — 45° scales coords by an irrational factor, so re-rounding rotated
  points scattered boundary cases. Replaced.
- `typeBucket(paths)` — the coarse `classifyPath` count key was dropped: the
  primary index is an O(1) map lookup, so a pre-filter bucket adds nothing.

### 2. Index builder — `scripts/build-mandala-index.ts` (run via tsx)

Walks the catalog (Firestore decks, paginated as shape-fingerprint-test already
does), runs `calculate()` per sequence, computes the four keys, emits
`static/data/mandala-index.json`:

```json
{
  "version": 1,
  "byShape": { "<shapeKey>": [ {seqId, word, deck, colorSig, orbitKey} ] },
  "byOrbit": { "<orbitKey>": [ "<shapeKey>", ... ] }
}
```

`byOrbit` puts rotated/mirrored twins one hop from any shape. This file **is**
the "preparation work" — explicit, one-time, regenerated when the catalog grows.

### 3. `mandala-decoder.ts`

Location: `src/lib/shared/mandala/services/mandala-decoder.ts`. Loads the index
(lazy, cached), exposes:

```ts
decode(input: MandalaPaths | SequenceLike): DecodeResult
```

`DecodeResult`:

```ts
{
  query:        { word, shapeKey, colorSig },
  exactClass:   SeqRef[],            // same glyph, color-blind — core answer
  colorVariants:{ blueOnly: SeqRef[], redOnly: SeqRef[], combo: SeqRef[] },
  rotationOrbit:{ ref: SeqRef, rotationSteps: number, reflected: boolean }[],
  count:        { exact: number, orbit: number }
}
```

## Data flow

**Build:** `catalog seq → calculate(steps) → MandalaPaths → {shapeKey, orbitKey,
colorSig, typeBucket} → index entry`.

**Decode:** `rendered mandala → MandalaPaths → shapeKey → index.byShape[shapeKey]
= exact class → group by colorSig → index.byOrbit[orbitKey] − shapeKey =
rotated/mirrored twins`.

## UI

Lab test page at `src/routes/test/mandala-decoder/+page.svelte` — real
components per `visualization-routing.md`, no mockup.

- Left: pick a mandala from a deck (or the live sequence).
- Right: the decoded class rendered as real mini-mandalas via `MandalaRenderer`,
  grouped under three headers: **Exact glyph** (exactClass), **By color**
  (colorVariants), **Rotated/mirrored twins** (rotationOrbit).
- Counts shown with `tabular-nums` (no layout shift per `no-layout-shift.md`).

## Testing — the "complete accuracy" proof

- **Round-trip property test** — N random catalog sequences:
  `decode(calculate(seq)).exactClass` MUST contain `seq`. The hard correctness
  gate; a miss means the fingerprint is lossy the wrong way.
- **Known-collision test** — a blue/red-swapped pair (same traced lines) lands
  in the same `exactClass`. Validates color-blindness.
- **Rotation test** — a sequence and its catalog 45°-twin share `orbitKey` but
  differ in `shapeKey`. Validates the orbit annotation.
- **Determinism test** — `shapeKey` byte-stable across runs (`calculate()` is
  pure).

## Edge cases

- **FP drift under rotation** — irrational coords from 45° rotation; the ~1px
  quantization grid absorbs it. Tune grid until round-trip AND rotation tests
  both pass.
- **Start-position-only / empty paths** — no key; excluded from index.
- **Query not in catalog** (library sequence, not a deck) — `exactClass` empty;
  v1 reports "no catalog pathway traces this glyph" honestly. Nearest-match
  (Hausdorff/Fréchet over point-sets) is a tagged future extension, NOT v1.
- **Index size** — 53k entries; `content-hasher` keys keep it lean. If the JSON
  gets unwieldy, that's the trigger to flip to the seeded-field production path.

## Production path (later, not v1)

Once proven via the static index, promote the fingerprint to a first-class
seeded Firestore field (`mandalaShape`, `orbitId`) at deck-seed time; decode
becomes a normal `where mandalaShape == X` query. Shares the exact same
`mandala-fingerprint.ts` module — building the static index costs nothing toward
this. Needs a one-time backfill + composite index.

## Out of scope (v1)

- Raster / photo-of-screen decode (registration, deskew, color separation).
- Open-world solve for off-grammar hand-drawn mandalas (CSP over motion grammar).
- Nearest-match for non-catalog queries.
- Firestore seeded-field production path.
