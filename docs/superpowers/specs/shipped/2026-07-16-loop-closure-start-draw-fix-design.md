# LOOP Closure Start-Draw Fix (2026-07-16)

**Defect (reproduced 2026-07-16 via `generate_sequence`):** word + `loopType`
generation fails immediately with `Position pair X -> Y not valid for Z LOOP`,
and for some words fails the SAME way on every attempt despite an internal 30x
retry loop. Forcing `startPosition` + `endPosition` (probed from
`validate_loop_options`) succeeds every time — valid paths exist; the engine
just never draws toward them.

Reported repros (all now fixed):

| Word | loopType | Old result | New result |
|---|---|---|---|
| CΣVX | rotated (halved) | `alpha1 -> alpha7` / `alpha7 -> alpha5` invalid | OK (e.g. start alpha3, seed→alpha7, 180°) |
| ΔZΩX | swapped | `alpha7 -> alpha7` twice | OK (e.g. start alpha5, seed→alpha1) |
| UYFΘ- | swapped | `gamma11 -> gamma3` three times | OK (e.g. start gamma13, seed→gamma7) |

## Root cause

The word-based LOOP path and the length-based LOOP path in
`packages/sequence-engine/src/generation/builder/SequenceBuilder.ts` handle a
random (unspecified) start position **asymmetrically**.

**Closure is enforced by one mechanism:** `BeamSearch.search()` filters the
FINAL letter's variations to a caller-supplied `requiredEndPositions` set
(`BeamSearch.ts:266-271`). That set is a function of `(startPosition, loopType,
period)` — for `swapped`, `SWAPPED_POSITION_MAP[start]`; for `rotated` halved,
`HALF_POSITION_MAP[start]` (180°). So the search can only steer toward closure
when it knows the start up front.

**Length path (correct):** when the start is random it builds a
`loopPositionMap` of every start→validEnds and passes it into
`searchByLength()`, which derives `requiredEndPositions` from the actual chosen
start and filters the final beat (`SequenceBuilder.ts:475-479`, consumed at
`BeamSearch.ts:466-499`). Plus a backward `PositionReachabilityAnalyzer` pass.

**Word path (buggy):** `buildByWord` only computed `requiredEndPositions` when
`effectiveStartPosition` was already set (`SequenceBuilder.ts:293-300`, pre-fix).
For a random-start word LOOP it left `requiredEndPositions` **undefined**, so:

1. `search()` ran with **no closure filter at all** — the final-letter filter
   (`BeamSearch.ts:267`) is a no-op when `requiredEndPositions` is undefined.
   The beam produced whatever best-scoring path it liked.
2. Only AFTER the search did it validate the actual start→end pair and, on
   mismatch, `continue` to retry (`SequenceBuilder.ts:326-338`, pre-fix).

That retry is where determinism bites. The whole computation feeding the drawn
end position is deterministic within a single call:

- `turnAllocation` is computed ONCE before the retry loop
  (`SequenceBuilder.ts:264`), so it is identical across all 30 retries.
- Beam seeding and scoring are deterministic; the beam is seeded from the
  top-scored first-letter variations across all positions — **the start pool is
  never shuffled or resampled** between retries.
- The only per-retry randomness (`findStartPosition`'s random Type-6 pick;
  `enrichMotionDirection`'s `Math.random()` rotation direction) does **not
  change any position string** — Type-6 starts have `start==end`, and rotation
  direction is orientation, not location.

So all 30 retries recompute the identical (or near-identical) path and fail
identically. The retry loop re-rolls dice that aren't attached to anything.

**Why deterministic for some words, not others.** At MCP defaults (level 1,
turn intensity 0) `allocateTurns` yields all-zero turns → the entire path is
deterministic → the same invalid pair recurs on every separate call (ΔZΩX
`alpha7→alpha7` twice, UYFΘ- `gamma11→gamma3` three times). At higher levels the
random turn allocation perturbs downstream scoring between calls, so CΣVX drew
two different invalid pairs — but never a valid one, because nothing steered it
there. Words that succeeded did so only when their deterministic best path
happened to coincide with a closure-valid end by luck.

**The deeper reason alpha starts can't close.** For `swapped`,
`SWAPPED_POSITION_MAP` maps `alphaN → alpha(N+4)` but `betaN → betaN` and
`gammaN → gamma(cross)`. Words like ΔZΩX have a net identity position transform
(`end == start`). From an alpha start that gives `alphaN → alphaN`, which
swapped never accepts (it needs `alpha(N+4)`); from a beta/gamma start the same
identity path DOES satisfy swapped closure. The unsteered beam kept picking
alpha starts, which are structurally incapable of closing that word — no amount
of retrying fixes a start-position class that can't close.

## The fix

Give the word path the same "steer toward closure" treatment the length path
already has, scoped entirely to `buildByWord` (no `BeamSearch` signature
change, no length-path change).

Two edits in `SequenceBuilder.ts`:

### 1. Enumerate closure-compatible start targets (new helper)

`enumerateLoopStartTargets(firstLetter, loop, gridMode, blockedStartPositions)`
returns `{ start, requiredEnds }[]`:

- Distinct start positions the first letter can occupy in this grid mode
  (`variationProvider.getAllVariations(gridMode).filter(letter)`), so candidates
  are always grid-valid (avoids diamond/box parity dead-ends).
- Skip blocked starts; skip any start whose `getAllValidEndPositions(...)` is
  empty (degenerate combos like rotated+swapped-from-alpha already return an
  empty set and self-exclude).
- Fisher-Yates shuffle so repeated calls vary the chosen start.

### 2. Search toward each target, guard closure, fail cleanly

`buildByWord` builds `searchTargets`:

- Explicit/constrained start (or non-LOOP) → single target (unchanged behavior;
  `requiredEnds` computed from the known start, as the pre-fix explicit path
  already did).
- Random-start LOOP → the enumerated list. Empty list → throw a clear
  "no closure-compatible start exists" error instead of drawing blind.

The retry loop iterates targets, passing each target's `requiredEnds` into
`search()` so the final beat is filtered to closure-valid ends. On a result it
applies a **closure guard**: `search()` only filters DIRECT final-letter
variations, but `tryBridges` (`BeamSearch.ts:594-747`) fetches the final
letter's variations through a bridge **without** re-applying `requiredEnds`, so
a bridged path can slip through ending off-target. The guard rejects any
accepted result whose real end is not in `requiredEnds` and moves to the next
candidate. This makes the builder authoritative: a genuinely infeasible word
(e.g. ABCD rotated) fails in the builder with a readable message rather than
surfacing a low-level `Invalid position pair ... cannot complete a halved
rotation` from the downstream LOOP executor.

The pre-fix post-hoc position-pair check is removed — steering + the guard
supersede it.

## Files changed

- `packages/sequence-engine/src/generation/builder/SequenceBuilder.ts`
  - `buildByWord`: replace the random-start "draw blind + post-hoc reject +
    deterministic retry" block with target enumeration + steered search +
    closure guard (~50 lines net).
  - Add private `enumerateLoopStartTargets(...)` (~30 lines) beside
    `getAllValidEndPositions` / `buildLoopPositionMap`.
  - No public API / type changes; `BeamSearch`, `searchByLength`, the length
    path, and non-LOOP word generation are untouched.
- Rebuild required: `mcp-server` imports the compiled `@tka/sequence-engine`
  `dist` (package `exports` resolve to `./dist/...`), so `tsc -b` the engine
  package after editing `src`.

## Test plan

1. **Reported repros must generate without forced positions.** For each of
   CΣVX/rotated, ΔZΩX/swapped, UYFΘ-/swapped, call the same code path the MCP
   tool uses (`generateViaEngine({ word, loopType, period:"halved",
   constraintPreset:"smooth", gridMode:"diamond", level:1 })`) across several
   attempts; every attempt must return a sequence (no throw).
2. **Genuine closure, not coincidence.** Assert the seed's last beat ends at the
   LOOP target: `HALF_POSITION_MAP[start]` for rotated-halved,
   `SWAPPED_POSITION_MAP[start]` for swapped. (Verified 2026-07-16: CΣVX
   `alpha3→alpha7`, ΔZΩX `alpha5→alpha1`, UYFΘ- `gamma13→gamma7`.)
3. **No regression across loop types / modes:** plain word (BOOK), mirrored
   (CAKE), inverted (CΣVX), rotated quartered (ΔZΩX), length-based rotated,
   explicit-start rotated, box mode — all still generate or fail cleanly.
4. **Infeasible words fail readably.** ABCD rotated (infeasible under the
   original code too — it threw `Position pair alpha3 -> alpha1 not valid for
   rotated LOOP`) now fails with the builder-owned
   `could not close as a rotated LOOP` message, never the executor's low-level
   error.
5. **Existing suite green:** `tests/unit/loop`, the loop-labeler suite,
   `generation-orchestrator-loopspec`, and `loop-period-migration` (86 tests)
   pass unchanged.

Durable-guard note: the engine package has no test runner and root vitest mocks
`SequenceBuilder`, so no existing harness drives real-data word→LOOP generation.
A lasting regression test needs a real `IVariationProvider` built from the
diamond dataframe — worth standing up as a small `@tka/sequence-engine`
integration test (or an `mcp-server` test), but that is infra beyond the loop
builder and should be a scoped follow-up rather than bundled here.

## Risks

- **More searches per generation.** Random-start word LOOP now runs up to one
  beam search per candidate start (≤ the number of positions the first letter
  occupies, typically a handful) instead of one steered search. Bounded and
  cheap; each steered search is also faster (final beat pre-filtered). Success
  is usually the first shuffled candidate.
- **Bridge leak is contained, not fixed at source.** `tryBridges` still ignores
  `requiredEnds`; the guard compensates at the builder boundary. Fixing it
  inside `tryBridges` (re-apply the final-letter filter to bridged targets)
  would let bridged paths legitimately contribute to closure — a follow-up
  improvement, not required for this defect.
- **Variety.** Steering narrows to closure-valid starts, so output is less
  random than the old (broken) draw. The Fisher-Yates shuffle over candidate
  starts preserves start-position variety across calls; within a start, turn
  allocation and rotation resolution still vary the motion content.
- **Quartered / compound types.** `getAllValidEndPositions` already encodes the
  quartered (CW+CCW) and degenerate-combo rules; enumeration reuses it, so those
  types inherit correct targets. Types whose start is pinned by
  `constrainStartForLoopType` (mirror+rotated, mirror+swap+inverted, etc.) take
  the explicit-start branch unchanged.
```
