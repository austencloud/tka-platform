# Combinator Test Audit — LOOPs-only redesign vs. the existing 142 tests

**Date:** 2026-08-05
**Scope:** `tests/unit/combination/*.test.ts` (11 files, 4,396 lines, 142 `it()` cases) against
`docs/superpowers/specs/2026-08-05-sequence-combinator-redesign-design.md`. Read-only audit —
no source or test file touched.

## 1. Summary — is "most will be rewritten" true?

**No, not by count.** Of 142 tests: **83 HOLD (58%), 31 REWRITE (22%), 20 DELETE (14%), 8 UNCLEAR
(6%)**. A bare majority of the suite needs no change at all.

But the raw count hides where the mass actually sits. The freeform-vs-LOOP question lives in
exactly three files — `sequence-combinator.test.ts` (the walk search itself), `walk-classifier.test.ts`
(Verdict/ranking/sampling), and `ambient.test.ts` (bridge-graph search) — 47 tests, 33% of the
suite. Inside those three files the design's prediction is **exactly right**: every single test is
REWRITE or DELETE (0 HOLD across all 47). `walk-classifier.test.ts` in particular is majority
DELETE (11/18) because its whole subject — the `Verdict` type (`SEQUENTIAL`/`FUSED`/`BRAIDED`/`HYBRID`)
and the `rankResults`/`samplerSlice` presentation pipeline — has no equivalent in the new design,
which buckets by full-circle count instead.

The other 8 files (95 tests, 67% of the suite) are almost untouched, because they test things the
redesign never questioned: dataframe grounding (`fixtures.test.ts`, `base-sequence-registry.test.ts`),
pure geometry (`position-groups.test.ts`), the retained letter-calculus module
(`letter-calculus.test.ts`, explicitly kept per the spec), card-level spatial transforms
(`variant-generator.test.ts`), the walk→SequenceData assembly pass (`splice-builder.test.ts`, minus
one test that calls the doomed search), and an entirely unrelated module revived for the Advanced
drawer's similarity panel (`analyzer-revival.test.ts`).

So: **"most will be rewritten" is false for the suite as a whole, and true — almost tautologically —
for the three files that actually encode the old contract.** The practical takeaway for whoever
executes the rewrite: budget the effort on `sequence-combinator.test.ts` + `walk-classifier.test.ts`
+ `ambient.test.ts` (and the connector-roster half of `base-sequence-registry.test.ts`); the other
eight files are close to drop-in.

## 2. Per-file results

### `position-groups.test.ts` (6 tests) — all HOLD

Pure geometry (`positionGroup`, `seamOf`, `seamEndOf`) with no reference to search results, verdicts,
or LOOP admissibility. Untouched by the redesign.

| Test | Line | Verdict | Reason |
|---|---|---|---|
| extracts the family from a GridPosition | 14 | HOLDS | Pure string parsing, contract-independent |
| returns null for unknown strings | 26 | HOLDS | ditto |
| returns null for a bare group name with no trailing digits | 30 | HOLDS | ditto |
| returns null for an empty string | 34 | HOLDS | ditto |
| rejects uppercase (case-sensitive by design) | 38 | HOLDS | ditto |
| reads startPosition and endPosition off a step | 44 | HOLDS | ditto |

### `fixtures.test.ts` (18 tests) — all HOLD

Validates the ground-truth cards (GGGG, HHHH, AAAA, FALG, GHGH, ΦΨΦΨ) against the dataframe,
orientation propagation, and arrow-location calculation. These are INPUT fixtures, not engine
outputs — nothing here asserts a card is an admissible combinator *result*, so the LOOPs-only
gate doesn't touch it. The redesign's Stage 4 still needs closed, dataframe-grounded, orientation-
fixpoint material to build from.

| Test | Line | Verdict | Reason |
|---|---|---|---|
| GGGG is a closed 4-step loop with position continuity | 62 | HOLDS | Fixture data-integrity check |
| HHHH (ccw) is a closed 4-step loop | 70 | HOLDS | ditto |
| HHHH (cw) is a closed 4-step loop and is GGGG's rotation-faithful twin | 74 | HOLDS | ditto |
| AAAA is a closed 4-step loop | 94 | HOLDS | ditto |
| GHGH (Austen's fused example) is closed and alternates letters | 98 | HOLDS | Input-card shape check, not an engine-output claim |
| FALG is Austen's closed 8-step card and crosses alpha/beta four times | 106 | HOLDS | ditto |
| ΦΨΦΨ is a closed bridge loop touching both worlds on every step | 123 | HOLDS | ditto |
| every fixture's positions agree with getGridPositionFromLocations | 138 | HOLDS | Data-integrity, independent of contract |
| every fixture motion's motionType is derivable from its own fields | 160 | HOLDS | ditto |
| every fixture sequence's start position matches its first step's seam | 178 | HOLDS | ditto |
| every loop fixture is a fixpoint of recalculateAllOrientations | 198 | HOLDS | Stage 4 still needs this invariant |
| canonical arrow locations are applied, including dash special cases | 215 | HOLDS | ditto |
| Ψ and Φ steps carry dash/static motions | 236 | HOLDS | ditto |
| Ψ and Φ bridge the alpha and beta worlds the fixtures live in | 245 | HOLDS | Connector roster still needs bridge material |
| the dataset bootstrap really hydrates the production pipeline | 290 | HOLDS | Infra check |
| FALG round-trips through deriveSequenceLetters | 310 | HOLDS | ditto |
| every fixture step is a real row of DiamondPictographDataframe.csv | 333 | HOLDS | ditto |
| the standalone Ψ/Φ steps are dataframe rows too | 356 | HOLDS | ditto |

### `letter-calculus.test.ts` (14 tests) — all HOLD

Tests `enumerateHybridWords`/`edgesFromSequence`/`findIngredientCoverWitness` directly. The spec
explicitly names this module as retained: *"retaining letter-calculus.ts as the family-aware
pre-sieve."* No test here asserts anything about which closures are admissible LOOPs — it operates
one layer below that, on position FAMILIES, which the design keeps as Layer 0.

| Test | Line | Verdict | Reason |
|---|---|---|---|
| extracts family edges from a concrete sequence | 32 | HOLDS | Module retained per spec |
| FALG's real card decomposes into FL/AA/GG edge families | 38 | HOLDS | ditto |
| derives FALG from FL + AA + GG, canonical rotation | 47 | HOLDS | ditto |
| word list deterministic, independent of ingredient order (I3/N1) | 61 | HOLDS | ditto |
| shortest-first ordering surfaces short words (N1) | 79 | HOLDS | ditto |
| closed-walk constraint: GG + AA alone cannot interleave | 92 | HOLDS | ditto |
| HHHH/GGGG chain as primitive necklaces | 100 | HOLDS | ditto |
| AAAA cannot reach GGGG without a bridge | 112 | HOLDS | ditto |
| emits only primitive necklaces (I5) | 122 | HOLDS | ditto |
| exact cover: two distinct-name ingredients need 2 occurrences (I4) | 128 | HOLDS | ditto |
| index identity: same-named ingredients aren't merged (I4/N2) | 147 | HOLDS | ditto |
| fast-fails when requireAllIngredients exceeds maxLength (N4) | 201 | HOLDS | ditto |
| maxResults cap sets resultsTruncated, not budgetExhausted (N3) | 227 | HOLDS | ditto |
| tiny search budget sets budgetExhausted; results stay a subset (M10) | 236 | HOLDS | ditto |

### `base-sequence-registry.test.ts` (9 tests) — 8 HOLD, 1 REWRITE

Structural properties of `BASE_SEQUENCES` (edges chain into a cycle, letters agree, ambient
eligibility) are format-independent and survive a roster expansion untouched. One test hardcodes
the CURRENT roster size, which the design's "24 base sequences (19 + 2 Type 2 + 2 Type 3 + 1
Type 4)" connector roster will outgrow.

| Test | Line | Verdict | Reason |
|---|---|---|---|
| contains the MCP-documented compound bases | 15 | HOLDS | Superset relationship — new roster still contains these |
| contains Austen's promoted bases with Θ, never lowercase θ | 22 | HOLDS | Assumes WΣYΘ/XΔZΩ survive into the 24-base roster (plausible, not yet confirmed — see §4) |
| every entry's edges chain and close into a cycle | 29 | HOLDS | Structural invariant, roster-size-independent |
| edges' letters correspond exactly to letters, in cycle order | 44 | HOLDS | ditto |
| ambient-eligible = rosterConfirmed bases only | 50 | HOLDS | `>=9` floor, not an exact count — survives growth |
| ambientLetterSet covers bridge letters, excludes unconfirmed placeholders | 55 | HOLDS | ditto |
| ambientBaseForLetter resolves the owning rosterConfirmed base | 66 | HOLDS | ditto |
| each ambient-eligible letter belongs to exactly one rosterConfirmed base | 76 | HOLDS | Structural, independent of roster size |
| every entry's edges agree with the canonical dataframe (all 15 entries) | 93 | **REWRITE** | Hardcodes `BASE_SEQUENCES.length === 15`; the design's connector roster is 24 entries. The per-entry dataframe-membership check itself is sound and should be kept, just re-pointed at the grown table |

### `variant-generator.test.ts` (19 tests) — HOLD, pending one architecture confirmation

Tests `buildVariants`/`buildRotationFaithfulTwin`/`buildTwinSource` directly — pure functions that
turn a card into its spatial variants (rotate/mirror/colour-swap) or its rotation-faithful twin.
None of them assert anything about closed-walk search results or LOOP admissibility; they test a
card-transform utility one layer below the search. **Flagged UNCLEAR at the module level, not
per-test** (see §4): the design's Stage 1 vocabulary is described as "each letter contributing its
variations as edges" — a per-letter-realization model — which may or may not still route through
this whole-card spatial-transform apparatus. If the module survives (plausible: the design keeps
"liberty toggles" in the Advanced drawer, and `VariantLiberties` is literally named after them),
every test below HOLDS as written.

| Test | Line | Verdict | Reason |
|---|---|---|---|
| collapses GGGG_CW's 32 candidates to 4 distinct sources | 154 | HOLDS* | Pure transform/dedup, independent of freeform-vs-LOOP |
| keeps the simplest descriptor as each class's survivor | 167 | HOLDS* | ditto |
| collapses FALG's 32 candidates to 16 distinct sources | 184 | HOLDS* | ditto |
| emits 2 sources with every liberty off except the twin | 191 | HOLDS* | ditto |
| emits exactly one source with no liberties at all | 198 | HOLDS* | ditto |
| never shrinks the source set when a liberty is added | 205 | HOLDS* | ditto |
| gives every source and sequence a unique id | 227 | HOLDS* | ditto |
| normalizes word to the expanded letter string on every source | 252 | HOLDS* | ditto |
| preserves grid mode on every source | 274 | HOLDS* | ditto |
| applies the twin AFTER the spatial and colour transforms | 284 | HOLDS* | ditto |
| labels card A's twin through the shared source builder | 308 | HOLDS* | ditto |
| turns GGGG_CW into the HHHH_CW fixture | 326 | HOLDS* | Ground-truth transform math, contract-independent |
| keeps rotation direction and reverses the traversal | 362 | HOLDS* | ditto |
| holds the twin's start position at its own first step | 384 | HOLDS* | ditto |
| re-derives every letter of the asymmetric FALG card | 397 | HOLDS* | ditto |
| produces real dataframe rows, not just plausible ones | 417 | HOLDS* | ditto |
| is an involution on positions, locations and rotations | 428 | HOLDS* | ditto |
| self-twins the ΦΨ bridge loop | 449 | HOLDS* | ditto |
| relocates dash arrows to match the reversed hand path | 475 | HOLDS* | ditto |

\* Contingent on `variant-generator.ts` being retained by the redesign — see §4.

### `sequence-combinator.test.ts` (14 tests) — the walk search being replaced

Every test here drives `findCombinations` from `services/sequence-combinator.ts`, which the design
names directly for replacement (*"replacing the walk search and classifier"*). None of these tests
check LOOP admissibility of a result — they check that the OLD freeform search finds closed walks
and reports search-bookkeeping fields (`impossible`, `resultsTruncated`, `budgetExhausted`,
`searchedToLength`) that describe the old bounded-DFS architecture.

| Test | Line | Verdict | Reason |
|---|---|---|---|
| finds a sequential (2-block) combination of GGGG + HHHH | 80 | REWRITE | Asserts a freeform concatenation exists; needs a Stage-3 LOOP-admissibility check added, not just re-pointing — **dangerous, see §3** |
| finds an interleaved (4+ block) combination carrying both letters | 93 | REWRITE | Same freeform-shape-only gap — **dangerous, see §3** |
| every result is a closed loop with position continuity | 103 | REWRITE | Necessary but nowhere near sufficient under LOOPs-only — **dangerous, see §3** |
| every result draws material from BOTH cards and names its B variants | 124 | REWRITE | `cardAShare`/`cardBShare`/`variantsB` are old-`CombinationResult`-shaped; concept (both cards contribute) persists per spec but field names likely don't |
| anchors on card A's twin, not only its identity | 140 | UNCLEAR | Depends on whether Stage 2's unit search still explores card-A's rotation-faithful twin as a distinct anchor — needs a decision |
| records each walk in its canonical block partition | 154 | DELETE | Internal mechanic of the old seam-graph DFS (wrap-split block merging); Stage 2's unit-length+connector-budget search has no stated analog |
| separates truncation, budget and depth in its report | 169 | DELETE | Design explicitly kills this: *"No caps, no truncation banner — the box is declared and the search inside it finishes"* |
| re-enters card A at a different phase of its own cycle | 183 | DELETE | Tests a free-walk re-entry mechanic specific to the old open DFS; no stated parallel in the bounded unit search |
| proves AAAA + GGGG impossible at DEFAULT options, without searching | 210 | REWRITE | The underlying domain fact (disjoint position families, no shared seam) is real and load-bearing for Stage 1/2 — needs re-expression under whatever "no connector available" now means |
| treats a card with no steps as unreachable, not as a search | 238 | REWRITE | Edge case likely persists; API shape will change |
| dedups rotations of the same closed walk | 249 | REWRITE | Phase-invariant dedup is a real requirement any closed-walk search needs; mechanism (`contentDedupKey`) may carry over |
| is deterministic — same inputs, same results in the same order | 292 | REWRITE | Generic requirement, tied to old API surface |
| reports a grid-mode mismatch instead of searching | 311 | REWRITE | Real domain constraint (odd rotation is the only grid-mode-crossing transform); precheck likely persists |
| clamps maxResultLength to a walkable range | 322 | DELETE | `maxResultLength`/64 clamp is old-contract-specific; new design always shows full circles and bounds by unit length + connector budget instead |

### `splice-builder.test.ts` (10 tests) — 9 HOLD, 1 REWRITE

`buildResult` turns `WalkBlock[]` into a performable `SequenceData` (orientation re-derivation,
letter re-derivation, reversal-dot computation, period detection). This is exactly the machinery
Stage 4 ("Present") needs to expand a unit into steps a human can perform — nothing about it
depends on whether the walk it's given is freeform or LOOP-admissible; that decision happens
upstream (Stage 3) and downstream (Stage 4's "expand through the LOOP executor").

| Test | Line | Verdict | Reason |
|---|---|---|---|
| splices two cards into one closed, orientation-valid sequence | 76 | HOLDS | Pure blocks→SequenceData assembly, contract-independent |
| is deterministic — the same blocks build the same sequence | 117 | HOLDS | ditto |
| keeps the source letters through the splice | 128 | HOLDS | ditto |
| really re-derives letters rather than carrying them | 147 | HOLDS | ditto |
| recomputes reversal flags over the new step order | 159 | HOLDS | ditto |
| closes its orientation chain in one pass for GGGG + HHHH | 188 | HOLDS | ditto |
| reports a period-2 loop honestly instead of calling it circular | 226 | HOLDS | The isCircular/period distinction is exactly what the new "circle length = unit length × order of closing transform" model depends on — see §4 |
| flags an incomplete word rather than emitting a plausible short one | 274 | HOLDS | Data-integrity guard, independent of contract |
| refuses to build a sequence from an empty walk | 323 | HOLDS | ditto |
| every searched combination of GGGG + HHHH is orientation-valid | 330 | REWRITE | Calls the doomed `findCombinations`; needs re-pointing at Stage 2/3/4 output — **dangerous, see §3** |

### `ambient.test.ts` (15 tests) — the bridging graph being replaced

Tests the old `AmbientOptionProvider`/bridge-graph mechanic wholesale: live per-seam querying,
`maxAmbientRun` capping, verdict-aware ranking of bridged vs. pure results, malformed-provider
handling. The design's "connector" concept differs in kind, not just name: connectors are drawn
from a small fixed 24-entry roster (closer to today's `base-sequence-registry.ts`) rather than
queried live per-seam from the whole pictograph dataset, and the goal is explicitly *fewest possible
connectors*, not "rank pure above bridged after finding everything."

| Test | Line | Verdict | Reason |
|---|---|---|---|
| bridges AAAA and HHHH, which are impossible on card material alone | 180 | REWRITE | Confirms bridging works but never validates the bridged result is a LOOP — **dangerous, see §3** |
| finds Austen's AAAAΨHHΦ shape | 217 | REWRITE | Asserts a `SEQUENTIAL`-verdict freeform shape by name, no LOOP-admissibility check — **dangerous, see §3** |
| keeps proving impossibility when the ambient pool is empty | 277 | REWRITE | `impossible` framing is old-contract; underlying reachability fact may persist |
| refuses to call a one-way bridge impossible, and refuses to call it a result | 299 | REWRITE | ditto |
| never lets ambient material stand in for the second card | 319 | REWRITE | Real invariant (a connector can't replace a required card) likely persists; API-tied |
| caps consecutive ambient steps at maxAmbientRun | 336 | REWRITE | "Fewest possible connectors" replaces "cap run length," a related but distinct constraint |
| ranks pure-card results above anything that needed a bridge | 374 | DELETE | Ranking-then-slicing is replaced by full-circle-count bucketing; "prefer fewer connectors" is now a search/vocabulary-level preference, not a presentation-order one |
| keeps bridges out of minBlockSize, which is a floor on CARD blocks | 400 | DELETE | `minBlockSize` is an old block-cut tunable with no stated new-design analog |
| treats two bridges at the same seams as two bridges | 432 | REWRITE | Content-keyed dedup (vs letter+seam) is a real requirement for a fixed connector roster too |
| rejects a bridge step whose position labels contradict its own motions | 479 | REWRITE | Data-integrity invariant (motion locations must agree with position labels); likely persists in whatever supplies connector edges |
| names the ingredient the result CONTAINS, not the one the provider claimed | 501 | REWRITE | Real "the splice re-derives truth, not the label" principle; provider-specific mechanics don't carry over |
| survives a broken provider without inventing a proof | 542 | REWRITE | Live-provider failure handling; may not apply if connectors come from a static roster instead of a live query |
| reports the run cap its claims are relative to | 569 | DELETE | `ambientRunCap`/`impossible` framing tied to the old live-query architecture |
| samples bridged and pure answers of the same shape as different answers | 610 | DELETE | `samplerSlice`'s (verdict, length, bridged) bucketing is replaced outright by full-circle-count bucketing |
| is deterministic with ambient enabled | 655 | REWRITE | Generic requirement, old API surface |

### `facade.test.ts` (14 tests) — mixed, several UNCLEAR

`getSequenceCombinator()`'s two entry points. `candidateWords` (letter-calculus preview) is
untouched. `findCombinations` and the runtime ambient provider are exactly the machinery being
replaced, and it is genuinely unclear from the design doc alone whether `createRuntimeAmbientProvider`
(live per-seam dataset queries) has any role once connectors come from the fixed 24-base roster —
flagged UNCLEAR rather than guessed.

| Test | Line | Verdict | Reason |
|---|---|---|---|
| exposes both entry points and previews words drawing on BOTH cards | 43 | HOLDS | `candidateWords` (letter-calculus) retained per spec |
| sweeps the whole length-5 space at the defaults, on every pair shape | 70 | HOLDS | ditto |
| handles the same card twice (ingredients identified by index) | 88 | HOLDS | ditto |
| answers a bare seam with real dataset steps, ambient-filtered | 103 | UNCLEAR | Depends on whether live per-seam querying survives vs. a static 24-base roster — needs a decision |
| rejects nothing on the real dataset — the label gate never fires | 121 | HOLDS | Sweeps `positionLabelsMatchLocations` over the whole dataframe; generically useful regardless of connector architecture |
| counts what it rejected, so a silent drop is observable | 142 | UNCLEAR | `provider.stats` API is tied to the live-provider architecture — see line 103 |
| counts the handler's no-match fallback apart from real rejections | 153 | UNCLEAR | ditto |
| bridges AAAA and HHHH with no provider argument | 168 | REWRITE | Same freeform-existence-without-LOOP-check gap as ambient.test.ts:180 — **dangerous, see §3** |
| still returns pure-card results first for two cards that already meet | 196 | DELETE | "First = best" ranking concept replaced by bucketing |
| reports a healthy pool and an attached provider | 207 | UNCLEAR | Tied to live-provider architecture |
| flags poolIncomplete when the provider fails, instead of proving anything | 217 | UNCLEAR | ditto |
| flags ambientUnavailable when the dataset cannot answer | 235 | UNCLEAR | ditto |
| exposes the auto-wired provider's counters, per grid mode | 261 | UNCLEAR | ditto |
| is deterministic across runs of the whole auto-wired pipeline | 287 | REWRITE | Generic requirement, old API surface |

### `analyzer-revival.test.ts` (5 tests) — all HOLD

Tests `SimilarityCalculator`/`SequenceAligner` in `src/lib/shared/comparison/` — an entirely
separate module revived for the similarity panel. The redesign explicitly keeps this panel, just
moves it "behind a collapsed Advanced drawer." Nothing about LOOPs-only touches it.

| Test | Line | Verdict | Reason |
|---|---|---|---|
| reports a bounded score with every component populated | 26 | HOLDS | Unrelated module, unaffected by redesign |
| scores a card against itself as identical, on every component | 49 | HOLDS | ditto |
| moves the overall score when the weights move | 67 | HOLDS | ditto |
| does NOT normalize weights — they are multipliers, not a budget | 84 | HOLDS | ditto |
| aligns two fixture cards globally without throwing | 113 | HOLDS | ditto |

### `walk-classifier.test.ts` (18 tests) — the classifier being replaced

`Verdict` (`SEQUENTIAL`/`FUSED`/`BRAIDED`/`HYBRID`), `rankResults`, and `samplerSlice` have no
counterpart anywhere in the redesign, which replaces presentation entirely with "bucketed by full
circle count first... grouped by LOOP type within each bucket... flat rows, one per closure." This
is the single most-affected file: 11 of 18 tests are DELETE outright.

| Test | Line | Verdict | Reason |
|---|---|---|---|
| labels a two-run walk SEQUENTIAL and a whole-unit interleave FUSED | 98 | DELETE | Verdict system has no replacement |
| requires alternation around the WRAP, not just along the list | 126 | DELETE | ditto — tests `classifyBlocks` directly |
| labels a cut inside FALG's repeat unit BRAIDED | 155 | DELETE | ditto |
| calls FIVE steps of a unit-four card BRAIDED, not merely short ones | 177 | DELETE | ditto |
| gives every surfaced result a distinct content key | 214 | REWRITE | Content-key dedup is a real requirement for any closed-walk/unit search |
| collapses two walks over different sources that build the same sequence | 220 | REWRITE | Same-content-different-source dedup persists as a requirement |
| collapses the same loop entered at a different PHASE | 276 | REWRITE | Phase-invariant dedup persists; also documents a `SequenceCanonicalizer` defect worth keeping documented somewhere |
| drops a walk whose spliced material has no dataframe letter | 340 | REWRITE | `incompleteWord` data-integrity gate is unrelated to freeform-vs-LOOP and likely persists |
| does not let trivial two-step walks head the default page | 435 | DELETE | Sampler/ranking mechanism replaced by full-circle-count bucketing |
| samples the WAYS to combine rather than clones of the best way | 457 | DELETE | ditto |
| orders verdicts FUSED, SEQUENTIAL, HYBRID, BRAIDED | 492 | DELETE | Verdict ordering has no replacement concept |
| puts period-1 loops above period-2 within the same verdict | 533 | DELETE | Verdict-scoped, but the underlying preference (lower period/order sorts first) resurfaces structurally as "smaller full-circle-count bucket first" — worth preserving when rewriting, see §4 |
| names every card-B variant it drew on | 551 | DELETE | `variantsB` tied to the old spatial-variant model |
| names the ingredients in display words | 567 | REWRITE | Ingredient-naming concept persists ("steps coloured by origin — card A, card B, connector") but not as a `derivation` string necessarily |
| names both single-letter cards | 598 | REWRITE | ditto |
| is a no-op for GGGG + HHHH, whose unit is a single step (wholeUnitsOnly) | 612 | DELETE | `wholeUnitsOnly` tunable is tied to the BRAIDED verdict it exists to exclude |
| actually removes sub-unit blocks when a card's unit is bigger than one | 629 | DELETE | Explicitly asserts `verdict !== "BRAIDED"` — tied to the removed Verdict system |
| labels, dedups and ranks identically across runs | 664 | REWRITE | Determinism itself is a real requirement; the specific fingerprinted fields (verdict, derivation) need updating |

## 3. Dangerous: tests that would silently pass while asserting the wrong thing

These are the tests most likely to survive a careless "port the API, keep the assertions" rewrite
— they all check something real and necessary (closure, orientation validity, bridge reachability)
but **never check the one thing the whole redesign exists to add: that the result is an admissible
LOOP.** A naive port would keep every one of these green while the original defect — *"not a single
one of these sequences is a LOOP ... I don't want freeform crap sequences"* — is still fully
present.

1. **`sequence-combinator.test.ts:80`** "finds a sequential (2-block) combination of GGGG + HHHH" —
   only checks that a closed 2-block concatenation exists and its length is additive. Would pass
   identically whether or not `GGGGHHHH` validates as a LOOP under any period.
2. **`sequence-combinator.test.ts:93`** "finds an interleaved (4+ block) combination carrying both
   letters" — same gap for a FUSED-shaped result.
3. **`sequence-combinator.test.ts:103`** "every result is a closed loop with position continuity" —
   closure is necessary but nowhere near sufficient; every freeform result the 2026-08-04 build
   shipped also satisfied this.
4. **`splice-builder.test.ts:330`** "every searched combination of GGGG + HHHH is orientation-valid"
   — validates orientation correctness of whatever the search returns without ever asking whether
   any of it is a LOOP. This is the test most likely to be reused verbatim (it calls a public,
   stable-looking API) while quietly certifying freeform output as "fine."
5. **`ambient.test.ts:180`** "bridges AAAA and HHHH, which are impossible on card material alone" —
   proves bridging changes reachability, never that the bridged result is LOOP-admissible.
6. **`ambient.test.ts:217`** "finds Austen's AAAAΨHHΦ shape" — names and asserts a specific
   `SEQUENTIAL`-verdict shape exists by regex match on the word, with zero LOOP-type check. This is
   the test that most directly encodes the exact failure mode Austen rejected: it treats "the shape
   I expected exists" as success criteria, the same standard the rejected 2026-08-04 build met.
7. **`facade.test.ts:168`** "bridges AAAA and HHHH with no provider argument" — the facade-level
   twin of #5, same gap.

**Recommendation:** when these are rewritten, each one's replacement MUST add an explicit LOOP-type
assertion (or a call into whatever Stage-3 validator the new engine exposes) rather than just
re-pointing the existing assertions at a new function name. If the rewrite doesn't add that check,
the "test coverage exists" signal will be actively misleading — worse than no test, per the task's
own framing.

## 4. Where existing tests encode a domain fact worth checking against the design

No outright contradiction was found — nothing here says the design is wrong. Three places are worth
a deliberate look before or during the rewrite, because the old tests pin real domain facts the new
architecture needs to either keep, explicitly supersede, or reconcile:

1. **The raw-walk truncation cap (`sequence-combinator.test.ts:169`, `ambient.test.ts:610`).** The
   old tests treat `resultsTruncated`/`rawWalkCap` firing as *"a healthy signal on a rich pair, not
   an error."* The design explicitly overturns this, calling it *"an algorithm artifact of hunting
   whole circles to depth 16, not a fundamental limit,"* backed by a measured 2,057,344-walk,
   8-second exhaustive search under the new, narrower vocabulary. This is not a contradiction — the
   design already reconciled it — but it's worth confirming during implementation that the new
   Stage 2 search really does stay exhaustive-fast on the SAME-WORLD pairs the old tests use
   heavily (GGGG+HHHH, FALG+GGGG). The design's own fingerprint table notes same-world pairs (A+B,
   G+H) explode to **7,396** distinct words at the letter-calculus layer — confirm that Stage 3's
   discard-non-LOOP filter cuts that back down before claiming "no caps needed" holds for every
   fixture pair, not just the connector-needing ones the design measured (A+G, A+H, A+S).

2. **The isCircular/period distinction (`splice-builder.test.ts:226`).** This test pins that a
   walk can close POSITIONALLY without closing ORIENTATION in one pass (`isCircular: false`,
   `period: 2`), and that this must never be forced. The new design's "circle length = unit length
   × the order of the closing transform" model (plain=1 pass, mirrored/flipped/swapped/180°=2
   passes, 90°/270°=4 passes) appears to depend on exactly this same period/order math. Confirm
   Stage 4 reuses `splice-builder.ts`'s `orientationPeriod` simulation rather than re-deriving it —
   this is dataframe-verified, already-trusted machinery for the identical computation the new
   bucketing scheme needs.

3. **The roster-size hardcode (`base-sequence-registry.test.ts:93`, count 15) vs. the design's
   24-entry connector roster.** Not a contradiction (the design is growing the roster, not
   shrinking it), but confirm which of the 15 CURRENT entries (specifically the two
   `rosterConfirmed: false` placeholders, `WΣYΘ` and `XΔZΩ`) survive into the 24, since
   `base-sequence-registry.test.ts:22` currently asserts on their presence.

## 5. What this means for the rewrite

- **Do not touch:** `position-groups.test.ts`, `fixtures.test.ts`, `letter-calculus.test.ts`,
  `analyzer-revival.test.ts` (46 tests, 0 changes).
- **Light touch:** `base-sequence-registry.test.ts` (1 count fix), `splice-builder.test.ts` (1
  re-point), `variant-generator.test.ts` (0 changes IF the module survives — confirm first).
- **Full rewrite, concept-by-concept:** `sequence-combinator.test.ts`, `ambient.test.ts`,
  `facade.test.ts`'s `findCombinations`-driven half — re-architect around Stage 1/2/3/4, and add
  the LOOP-admissibility assertions the old tests never had (§3).
- **Delete and re-author from scratch against the new bucketing/presentation model:**
  `walk-classifier.test.ts` — there is no `Verdict`/`rankResults`/`samplerSlice` to port; the
  replacement tests need to be written against full-circle-count bucketing and LOOP-type grouping
  as first principles, using the design's own worked example (A+G: 10 words at circle-count 4, 12
  words at 16, etc.) as the oracle.
