# Shape-Matrix Hero Pool — Design

**Date:** 2026-07-21
**Status:** Approved, implementing
**Author:** brainstormed with Austen

## Problem

The home hero (`HomeHero.svelte` → `SequenceHeroDemo.svelte` → `InlineAnimationPlayer`)
always plays a live-generated 16-count rotated LOOP from `generatePerVisitDemo`
(`per-visit-demo.ts`). None of the 3136-cell × 6-mode shape-matrix possibility
space ever reaches the front page. Austen wants roughly two-thirds of hero draws
to come from the shape matrix, with a small elemental indicator in the
bottom-right of the canvas identifying the TnD element of the matrix draw.

## Constraints discovered (grounding)

1. **Landing boots firebase-free by design.** `SiteHeader.svelte:29-40` documents
   that landing mode must not statically import Firebase (auth/firestore/db/functions
   have module-eval side effects via `$lib/shared/auth/firebase.ts:109,218,488-568`).
   `detectSiteMode()` (`src/config/domains.ts:71-97`) classifies `/` as landing.
2. **The shape-matrix realization pipeline is firebase-tainted only by module
   colocation, not by function call.** `applyVariationDescriptor`
   (`deck-variation.ts:304-353`) and its full call tree
   (`applyBoxMode` → `applyStartOriMode` → `transformSequence` → `applyPattern` →
   `loopCloses`) never touch Firestore. The taint comes from two sibling imports:
   `transformSequence` from `reversal-seed-service.ts` (firebase for its *seeder*
   exports) and `applyPattern` from `turn-pattern-manager.ts` (firebase for its
   *CRUD* exports). A physical file split removes the taint.
3. **The base data is 22 four-beat words, not 8160 sequences.** The
   `l1-tnd-motions` catalog stores 22 four-beat rotated-LOOP words
   (`build-realization-sequence.ts:17-24`, seeded by `scripts/seed-tnd-deck.ts`
   with `sequenceLength: 4`, `isCircular: true`). Every cell+mode realization is
   *constructed* from a base word by applying a turn pattern + orientation + grid
   descriptor. Construction is pure geometry.
4. **The element is NOT rotation-invariant for opposite-direction cells.**
   `deriveTnD` (`tnd-deriver.ts:82-102`) measures each hand's *absolute* phase to
   compass south. A uniform rotation cancels for same-direction pairs (water/earth/sun
   survive any rotation) but shifts `delta` by `-2θ` for opposite-direction pairs —
   a 90° rotation flips tog↔split (fire↔air). Confirmed by the deriver's own design
   doc (`2026-05-30-tnd-downbeat-deriver-and-gamma-split-design.md:31`) and
   `deck-variation.ts:279-284`. Therefore the element MUST be re-derived from the
   final played geometry, never carried from the cell's nominal mode.
5. **A base word closes in 4 beats (position AND orientation).** Repeating it 4×
   is a visual no-op (verified: all 22 words return to start pose after 4 beats;
   `OrientationCycleExtender.extendIfNeeded` returns them unchanged). So matrix
   draws stay 4-count. A turn pattern applied to a base word may or may not preserve
   closure — `applyVariationDescriptor` reports `turnLoopClosed`
   (`deck-variation.ts:217-221`), which is the anti-snap gate.
6. **A closed 4-beat word rotates to any position via `rotateSequenceGeometry`**
   (`sequence-derived-fields.ts:125-150`) — pure, firebase-free, orientation chain
   preserved (rotation never touches orientation fields). This is exactly what
   `applyBoxMode` (`deck-variation.ts:286-296`) uses (`rotateSequenceGeometry(seq, ±1)`).

## Architecture

Runtime construction, not per-sequence bake. Two seams:

```
scripts/build-tnd-base-words.ts   (headless, firebase-admin, one-time + on reseed)
   │  reads catalogs/l1-tnd-motions via admin SDK (bypasses firebase client)
   ▼
static/data/hero/tnd-base-words.json   (22 words, ~small)
   ▼
shape-matrix-hero-pool.ts   (firebase-free landing service)
   │  enumerate cell space in code (buildFlowerAxis + applyFilter — pure)
   │  pick random (blueFlower, redFlower, mode)
   │  resolveBase (lookup in the 22)  → applyVariationDescriptor (firebase-free)
   │  reroll if !turnLoopClosed        → rotate to chain target (rotateSequenceGeometry)
   │  deriveTnDFromPictograph → TnDElement
   ▼
hero-act.svelte.ts  (2/3 matrix, 1/3 generated; generated 1/3 sub-roll → box)
   ▼
HomeHero.svelte → SequenceHeroDemo.svelte (element indicator, matrix draws only)
```

### Component 1 — Firebase-free extraction (foundation, do first)

Physically split the pure transform functions out of their firebase-tainted host
modules into new firebase-free modules. Host modules re-export for back-compat, so
existing consumers are untouched. `deck-variation.ts` imports the pure functions
from the NEW modules, making `deck-variation.ts` itself firebase-free.

| New firebase-free module | Functions moved out of | Firebase left behind |
|---|---|---|
| `src/lib/shared/create/services/turn-pattern-apply.ts` | `turn-pattern-manager.ts`: `applyPattern`, `validateForSequence`, `updateMotionStartOrientation` (private), `extractPattern`, types `TargetHand`/`TurnPatternApplyResult` | `savePattern`/`loadPatterns`/`deletePattern` stay in `turn-pattern-manager.ts` |
| `src/lib/features/choreo-card/services/reversal-transform-apply.ts` | `reversal-seed-service.ts`: `transformSequence`, `applyReversalMatrix`, `solveHandFlips`, `flipMotion` (private), `spinOf` (private) | `seedReversalPattern`/`writeCatalogWithSequences`/`stripUndefined` stay in `reversal-seed-service.ts` |
| `src/lib/shared/shape-matrix/services/tnd-base-index.ts` | `build-realization-sequence.ts`: `WORD_MODE`, `stylePairOf` (private), `buildBaseIndex`, `resolveBase` | `loadBaseIndex` (firebase loader via `catalog-loader`) stays in `build-realization-sequence.ts` |

Verified clean deps: `reversal-patterns.ts`, `reversal-transform.ts`,
`apply-turns-to-motion.ts`, `debug-logger.ts` all grep firebase-clean.
`deck-variation.ts`'s only firebase taints are the two moved imports;
after the split it imports `applyPattern` from `turn-pattern-apply` and
`transformSequence` from `reversal-transform-apply`.

Back-compat: `turn-pattern-manager.ts` and `reversal-seed-service.ts` add
`export { ... } from "./new-module"` re-export lines for every moved symbol.
`build-realization-sequence.ts` imports the pure functions from `tnd-base-index.ts`
and re-exports them.

### Component 2 — Base-words bake script

`scripts/build-tnd-base-words.ts`, modeled on `scripts/build-mandala-index.ts`
(firebase-admin, `tsx --tsconfig scripts/tsconfig.json`). Reads the 22 sequences
from `catalogs/l1-tnd-motions/sequences` via admin SDK, writes them verbatim to
`static/data/hero/tnd-base-words.json` (array of `SequenceData`). One-time; rerun
only when `seed-tnd-deck.ts` reseeds. `npm run` script alias: `build:tnd-base-words`.

### Component 3 — Hero pool service

`src/lib/shared/landing/data/shape-matrix-hero-pool.ts` — firebase-free.

- Imports the baked words (`import words from "$lib/../static/..."` via a
  `static/`-served fetch OR a direct JSON import; use fetch of
  `/data/hero/tnd-base-words.json` to keep it out of the initial bundle, matching
  how `loadDiamondEdges` fetches its CSV).
- `buildBaseIndex(words)` (from `tnd-base-index.ts`) → the `Map` `resolveBase` reads.
- `loadDiamondEdges()` (`pictograph-letter-lookup.ts`, firebase-free CSV fetch).
- Enumerates the cell space: `buildFlowerAxis()` + `applyFilter(axis, {grid:"diamond"...}, collapse)`
  for the diamond axis and `{grid:"box"...}` for the box axis. Cells = diamond×diamond
  ∪ box×box (never mixed — `blue.grid === red.grid`). All 7 `TURN_VALUES`.
- `drawMatrixRealization(opts?: { chainStartPosition?; random? })`:
  1. Pick a random cell (blueFlower, redFlower, same grid) + random mode from `MODE_ORDER`.
  2. `resolveBase(idx, mode, blueFlower.style, redFlower.style)` — skip on miss.
  3. Build `CardVariation` descriptor:
     - `turnPattern`: `` `${fmt(blueFlower.turns)}|${fmt(redFlower.turns)}` `` (uniform unit, TnD form).
     - `gridMode`: `blueFlower.grid` (== redFlower.grid for our cells).
     - `startOriPair`: `{ blue: oriToOrientation(blueFlower.ori), red: oriToOrientation(redFlower.ori) }`
       so the cell's orientation axis is honored.
  4. `applyVariationDescriptor(base, descriptor, edges)` → `{ sequence, turnLoopClosed }`.
  5. If `!turnLoopClosed`: retry from step 1 (cap `MAX_DRAWS = 12`).
  6. If `chainStartPosition` given and reachable: `rotateSequenceGeometry` the result
     so its start pose matches the chain target. Unreachable (even-index position or
     no clean rotation) → return `null` (caller falls back to a generated draw).
  7. `deriveTnDFromPictograph(finalSeq.steps[firstVisible])` → `tndMode` →
     `TND_MODE_TO_FAMILY[tndMode]` → `TND_BY_FAMILY[family]` → `TnDElement`.
     Derived from the FINAL geometry (post box + post rotation), so it is correct
     for box/rotation permutations by construction.
  8. JSON-clone the sequence (plain objects for the player, matching per-visit-demo).
  9. Return `{ sequence, element } | null`.
- 0-turn cells always pass closure (empty turn pattern, base already closes), so the
  pool is never empty.

Note: `TnDMode → familyId` needs a pure map. Two copies exist
(`deck-composer.ts:291`, `browse-filter.ts:558`) but both live in firebase-tainted
modules. Add a clean copy in `tnd-base-index.ts` (or import from `tnd-element.ts` if
extended there). Do not import from `deck-composer`/`browse-filter` (firebase).

### Component 4 — Hero act wiring

`hero-act.svelte.ts`:

- New helper `drawHeroSequence(opts)` replaces direct `generatePerVisitDemo` calls
  at the three draw sites (`start`, `prepareNext`, `advance`):
  1. `sourceRoll = random()`. If `< MATRIX_FRACTION` (2/3): try
     `drawMatrixRealization({ chainStartPosition })`. On non-null, use it (carry its
     `element`). On null (unreachable chain / all rerolls snapped), fall through.
  2. Generated branch: `seq = generatePerVisitDemo({ propType, startPosition })`.
     Then `boxRoll = random()`; if `< BOX_FRACTION` (1/3):
     `seq = applyBoxMode(seq, "box")` (imported firebase-free from `deck-variation`).
     `element = null` (no badge on generated draws).
  3. Return `{ sequence, element }`.
- The act stores `current` sequence AND `currentElement`. New getter `element`
  exposed to the host. Generated/box draws set `currentElement = null`.
- `MATRIX_FRACTION = 2/3`, `BOX_FRACTION = 1/3` as named constants.
- Chain honoring: matrix draws honor `current.startPosition` when reachable; the
  fallback path keeps the existing generated-chain behavior. A dropped chain is a
  generated draw, never a broken position jump.

### Component 5 — Element indicator

- `SequenceHeroDemo.svelte`: new optional prop `element?: TnDElement | null`.
  When present, render an absolutely-positioned badge inside `.demo-stage`
  (already `position: relative; overflow: hidden; aspect-ratio: 1`), bottom-right,
  showing `element.iconPath` (img) tinted/bordered with `element.accentColor`.
  Absolute positioning ⇒ zero layout shift (`no-layout-shift.md`). Fades in/out
  on element change; reduced-motion collapses the fade. Absent (null) ⇒ nothing
  rendered (generated draws).
- `HomeHero.svelte`: pass `element={heroAct.element}` to `SequenceHeroDemo`.
- Badge is display-only (a `*Badge`, never interactive) — consistent with
  `chip-primitives.md` keep-separate list.

## Explicitly out of scope

- Mixed diamond×box cells ("diamond on box" — not ready per Austen). Only pure
  diamond×diamond + box×box.
- Overlay-parity gate (`verifyAndCorrect`/`matched`) — that is a *drill* concern
  (canonical rotation vs an overlay). The hero wants variety; a valid flower at any
  rotation is fine, so parity search is skipped (also skips the 8-build cost).
- Baking the 8160 realizations. Construction is cheap; only the 22 base words bake.

## Testing

- Unit (`tests/unit/`): source-roll ≈ 2/3 matrix over a seeded RNG; box sub-roll ≈ 1/3;
  `drawMatrixRealization` returns only `turnLoopClosed` sequences (closure gate);
  derived element matches expected for a known same-direction cell (invariant) and a
  known box opposite-direction cell (permuted). Pool never empty.
- Contract (`tests/unit/`, extends `sequence-viewer-shell-contract.test.ts` pattern):
  static assertion that no landing module (`shape-matrix-hero-pool.ts`, `hero-act`,
  `per-visit-demo`, `SequenceHeroDemo`, `HomeHero`) transitively imports Firebase or
  `catalog-loader` — locks the firebase-free tier so this can't regress.

## Known trade-offs (flagged, not hidden)

- **Matrix draws are 4-count vs the hero's 16-count generated draws.** Two-thirds of
  draws will feel tighter/more repetitive. Main thing to eyeball live.
- **The firebase-free split touches shared modules** other features import
  (`turn-pattern-manager`, `reversal-seed-service`, `build-realization-sequence`,
  `deck-variation`). Back-compat re-exports keep callers working; wider blast radius
  than a landing-only change, worth the isolation it buys.
- **Element derived at first visible beat.** An opposite-direction 4-beat loop
  alternates tog/split across its beats (each beat is a 90° rotation). The badge
  reads the first beat's geometry — a consistent canonical choice matching
  `classifyTnDSeedForGrid`'s first-non-blank-step convention.
