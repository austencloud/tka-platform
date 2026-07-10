# StepData→Step Migration — Checkpoint Package (Spec 4, analysis + guardrail slice)

**Date:** 2026-07-05 · **Status:** CHECKPOINT — awaiting Austen's go/no-go on the wave plan
**Parent spec:** `2026-07-03-fable-stepdata-motion-migration-remainder-design.md`
**Scope of this dispatch:** (1) corrected analysis, (2) A/B/C strategy decision, (3) rendering-parity harness. The migration itself is explicitly NOT executed here.

---

## 0. The ground truth moved under the spec — re-baselined first

The conversion plan (2026-06-30) and its §0 CORRECTION were both written BEFORE the
2026-07-02 unification shipped. Verified at HEAD:

| §0 claim (2026-06-30)                                          | At HEAD (2026-07-05)                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "StepData is NOT assignable to Step"                           | **FALSE now.** `StepData extends Step` by declaration (`step-data.ts:29`, with compile-time `Assert<StepData extends Step>` proofs at lines 58-64). Motions are both-required `{blue, red}: MotionData`.                                                                                                                                                                                                   |
| "the ~120 files of free widening does not exist"               | **Widening exists again** — any consumer param can widen `StepData → Step` and every caller stays green. The REVERSE (feeding lean engine `Step` into a `StepData`/`MotionData` sink) is what still breaks, and that is the real remaining migration.                                                                                                                                                      |
| "Step.motions forces lean Motion on consumers"                 | Defused: `MotionData extends Motion` (`motion-data.ts:39`), so `StepData.motions` satisfies `Step.motions` without dropping view fields.                                                                                                                                                                                                                                                                   |
| Landmine D1: "engine `deriveReversals` LACKS the loop wrap"    | **RESOLVED by Spec 2** (commit `6423f92e2b`, 2026-07-05): `deriveReversals(steps, { loop })` owns the wrap at the canonical source (`packages/sequence-engine/src/analysis/deriveReversals.ts:85-90`); app `processReversals` is a thin delegate (`reversal-detector.ts:48-64`). The "never call deriveReversals for display flags" rule is obsolete — the app already does, everywhere, via the delegate. |
| Landmine D2: "bridge round-trips discard authored render data" | Defanged: `stepDataToStep` is identity-by-declaration; the lossy bridge survives only as script/test infrastructure (grep: zero `src/` importers of `adapters/step-bridge`; only `step-constructability-check.ts` / `step-lossy-mutation-test.ts`, where its lossiness is the negative control's tooth).                                                                                                   |
| Landmine D3: contentHash blast radius                          | Hash V2 live; **data-parity guard re-run at HEAD 2026-07-05: 202 sequences × 8 fingerprints, 0 drift.** Roundtrip parity: **202 sequences / 2,758 steps / 7 fingerprints, LOSSLESS**, with non-vacuous risk-field coverage (handPath=10, skew=6, pathShape=4, float=49, prefloat=20).                                                                                                                      |
| "no rendering parity harness"                                  | Was half-true: a manual pixel page existed (`/test/step-migration-parity`) but had **two confirmed blind spots** (§3). Now closed by the automated harness built in this dispatch.                                                                                                                                                                                                                         |

Consequence: **the plan's waves 1-6 and its cluster tables are obsolete as written** — they
solve a type-assignability problem that no longer exists. The remaining migration is a
different, smaller shape, quantified below.

## 1. Corrected file-by-file analysis at HEAD

### 1a. What "remains" of the ~235-file replacement

The 2026-07-02 subtype redefinition did not just unblock the old plan — it **retired most
of it**. There is no bridge to route around, no assignability wall, no forced rewrite.
What actually remains, measured:

**MotionData census — 168 real files** (grep `\bMotionData\b` + factory-only callers,
false positives excluded: TIKA/API/engine local types, comment-only mentions):

| Bucket                           | Files | Meaning                                                                                                                                                                                                                                                 |
| -------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PRODUCER (constructs MotionData) | 75    | ~90% flow through `createMotionData`/`createPlaceholderMotion` — the factory stays the single choke point for view defaults. Only 5 hand-rolled/cast literals (guide-motion-configs, museum-exhibit-sequences, sequence-encoder, positions-concept ×2). |
| VIEW-READER (reads a view extra) | 40    | Blocked from lean `Motion` — but their reads concentrate on just 3 dominant fields: **propType (17) · gridMode (12) · isVisible (10)**, then arrowPlacementData (7), pathShape (6), skew (4).                                                           |
| STRUCTURAL-ONLY                  | 45    | **Widenable to lean `Motion` today**, zero behavior risk from the type alone. Includes all 13 circular LOOP executors and the 16-file arrow-positioning calculation core.                                                                               |
| TYPE-ONLY pass-through           | 8     | Trivially widenable.                                                                                                                                                                                                                                    |

**Arrow/prop pipeline (34 files)** — "the most intricate, regression-prone subsystem":
16 STRUCTURAL / 14 VIEW / 2 PRODUCER / 2 TYPE-ONLY. The location/rotation/quadrant math
core is already lean-compatible; the view dependence is real but narrow (propType +
gridMode for placement-file keys, arrowPlacementData for manual nudges, skew for path
resolution). It does NOT need lean `Motion` — rendering legitimately requires view fields.

**StepData census** — table below. App extras still in circulation: `isStep` (16
occurrences), `isSelected` (token in 92 files, the bulk belonging to the SEPARATE
arrow/prop selection subsystem the plan's do-not-touch table already flagged), reversal
flags (pipeline-owned, re-derived on read), `betaSwapped`/`category` (render concerns).
Both `create-step-data` factory copies still exist (foundation + create) and must stay in
lockstep or be consolidated.

**StepData census — 213 real files** (grep `\bStepData\b`, 226 candidates, 13
comment-only mentions excluded):

| Bucket          | Files | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PRODUCER        | 78    | Constructs StepData (factory / typed literal / spread-mutation / decode cast). Includes the 13 spread-transform LOOP executors, both QR codecs, `sequence-encoder` decode, `step-deriver`, `sequence-hydrator`.                                                                                                                                                                                                                                                               |
| EXTRAS-READER   | 40    | Reads an app extra — but **17 of the 40 only via `isVisibleMotion(step.motions.x)`** (compile against lean `Step`, silently lose absence semantics). Direct extras-readers are 23, dominated by `blueReversal`/`redReversal` (13 files: render layer-compositor / glyph-renderer / layer-key-deriver / PictographContainer, V1 hasher, exporters, reversal-matcher/seed-service) and `propType` (10). `pictograph-type-guards.ts` is the lone `isStep` runtime discriminator. |
| STRUCTURAL-ONLY | 49    | Widenable to lean `Step` today.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| TYPE-ONLY       | 45    | Trivially widenable pass-throughs.                                                                                                                                                                                                                                                                                                                                                                                                                                            |

Two behaviorally-relevant files fly UNDER this census because they type against
`SequenceData` only: `prepare-mandala-club-sequence.ts` (writes
`propType`/`pathShape`/`isVisible` — a producer+extras-writer) and
`sequence-decomposer.ts` (reads reversal/handPath/skew through steps — extras). Wave
planning must include them by hand. Watch also the three type-lie/serialization spots the
census flagged: `VillageLabTab`/`museum-village-manager` (`as readonly StepData[]` casts)
and `start-position-manager.ts` (whole-object `JSON.stringify` persists extras).

### 1b. Presence register re-validated — all 110 sites at current HEAD

Register: `2026-07-01-presence-as-signal-register.md`. Current state:

| Family                         | RE-ENCODED | GONE  | RAW-live (legit)      | RAW-dead / blind    |
| ------------------------------ | ---------- | ----- | --------------------- | ------------------- |
| A render/solo (29)             | 28         | 0     | 1                     | 0                   |
| **B identity/derivation (32)** | **24**     | **5** | **1 (benign differ)** | **2 absence-blind** |
| C loaders (18)                 | 9          | 0     | 8                     | 1                   |
| D editing/UX (31)              | 24         | 0     | 4                     | 3                   |
| **Total (110)**                | **85**     | **5** | **14**                | **6**               |

- **85 sites** consciously re-encoded onto `isVisibleMotion` / explicit `isVisible`
  checks. The 13 legitimately-raw loader/option sites guard genuinely-partial sources
  (thin gallery JSON, `PictographData` partial motions, catalog wire data) — correct as-is.
- **5 GONE**: compose loopability duplicates (now re-exports of the foundation checker)
  and three loop-detector internals replaced by the canonical `@tka/sequence-engine/loop`
  delegation (absence re-encoded once at the `toEngineMotion` seam, `loop-detector.ts:184`).
- Guard suite locks the family-B core: `tests/unit/presence-as-signal-guards.test.ts`
  **21/21 green at HEAD** (7 of the 32 B-sites directly, 2 transitively).

### 1c. The 32-site "silent corruption tier" — where it really stands

24/32 re-encoded, 5 gone (engine-delegated), 1 dead-benign (encoder round-trip differ,
decode always fills placeholders). **Two genuinely absence-blind stragglers found:**

1. `src/lib/shared/navigation/services/sequence-hydrator.ts:92` — QR-decode gridMode
   donor scan still checks raw truthiness; decode now placeholder-fills, so a leading
   blank beat always wins and donates gridMode derived from placeholder locations.
2. `src/lib/shared/browse/services/sequence-difficulty-calculator.ts:30-40` — never
   filters invisible motions; a decode-path placeholder carrying a non-radial last-known
   orientation can silently inflate the difficulty badge.

Plus **4 dead gates** in D/C (silent always-pass, no corruption but wrong UX):
`PhraseEffortLabModule.svelte:251` (blank-step freeze guard never fires),
`ArrowLayerModal.svelte:56` + `PipelineEditorDock.svelte:92` (arrow-adjust UI no longer
inert for placeholder hands — WASD can write special-placement overrides keyed off a
fabricated motion), `compositional-utils.ts:98` (grid positions now derive for every
QR-decoded beat, including placeholder beats). And 2 adjacent finds:
`thumbnail-renderer.ts:202` (placeholder-bearing start positions skip repair) and
`rotation-direction-pattern-manager.ts:94-99` (extract side bakes placeholder rotation
values into saved patterns; the turns twin fixed this, the rotation variant didn't).

**These 8 sites are Wave 0 of the remaining migration** — small, enumerated, each needs
an `isVisibleMotion` pass + a guard test.

### 1d. The one silent widening hazard

`isVisibleMotion` is generic over `{ isVisible?: boolean }` and treats a MISSING field as
visible. Lean canonical `Motion` has no `isVisible`, so:

- At the 85 re-encoded sites, widening a signature to lean `Motion` **compile-breaks
  loudly** at the `isVisibleMotion(...)` call — safe failure mode.
- **Exception:** `features/write/services/sheet-continuity.ts:19-25` (`oriOf`) — its
  structural param stays assignable from lean `Motion`, `isVisible` reads undefined, and
  every placeholder silently becomes "visible", changing which choreo-sheet rows connect.
  The one site the compiler will NOT catch. Any wave that widens toward the write/choreo
  feature must fix `oriOf` first (require the flag or take `MotionData`).

## 2. A/B/C decision: **C — data-driven opportunistic widening. A and B are moot.**

The plan's fork asked: (1) merge A+B into one forced rewrite, (2) build a transitional
app-local Step shape and migrate in two hops, or (3) re-run the analysis and let the data
pick. The re-run settles it:

- **Option B is already shipped — permanently, not transitionally.** The 2026-07-02
  subtype redefinition IS the "app-local Step shape that widens cleanly"
  (`StepData extends Step`, `MotionData extends Motion`). Building another intermediate
  type would duplicate what exists.
- **Option A (merge + forced rewrite of all ~235/168 files) buys nothing.** There is no
  bridge left to eliminate in app code, no type wall, and identity/derivation sinks are
  already canonical-compatible (roundtrip LOSSLESS over 2,758 steps). Forcing lean
  `Motion` through the 40 VIEW-READERs and 75 producers would re-litigate the
  absence-encoding at 110 sites for zero behavioral gain — the exact cost/risk profile
  that made the original plan "not safe to execute as written."
- **Option C, concretely:** the data says the remaining migration is FOUR bounded moves,
  not a 235-file replacement:
  - **Wave 0 — straggler fixes (8 sites, §1c).** Absence-blind + dead gates, each with a
    guard test. Independent of everything else; do first.
  - **Wave 1 — free widening (~120 file-slots, overlapping).** The 45 STRUCTURAL + 8
    TYPE-ONLY MotionData files plus the 49 STRUCTURAL + 45 TYPE-ONLY StepData files
    (the two censuses overlap — e.g. the LOOP executors appear in both) widen to lean
    `Motion`/`Step` signatures. Compiler-gated, behavior-free; enables engine output to
    flow into these modules without enrichment. Fix `sheet-continuity.oriOf` (§1d), the
    unsound casts (`arrow-quadrant-calculator.ts:137`, `rewound-loop-executor.ts:135`
    `return {} as MotionData`, `VillageLabTab`/`museum-village-manager`
    `as readonly StepData[]`) en route. The 17 isVisible-via-helper files stay OUT of
    this wave (they compile against lean types but silently lose absence semantics —
    §1d); they migrate only alongside an explicit absence-signal decision.
  - **Wave 2 — extras retirement.** Delete `isStep` (16 occurrences; reroute the type
    guards) and step-level `isSelected` (id-keyed selection store is the successor);
    consolidate the duplicated `create-step-data` factories. This is the slice the
    absence-encoding design deferred ("deleted in final slice").
  - **NON-GOALS, named:** the render pipeline keeps required view fields (that is what
    rendering needs — `MotionData` IS the render-side `MotionWithView`); `StepData` the
    name survives until Wave 2 proves nothing else depends on the extras; no forced
    producer rewrite (the factory choke point already injects view defaults).
- **Every wave gates on the full net:** render-parity (capture→wave→compare, §3) +
  data-parity guard + roundtrip parity + presence guards + one full `svelte-check` +
  commit-scoped pathspec.

## 3. Rendering-parity harness — built, tested, committed

### What existed, and why it wasn't enough

`/test/step-migration-parity` (the "pixel net", 2026-07-01) renders frozen sequences and
pixel-diffs before/after. Empirically confirmed blind on the two channels that matter most:

1. **Arrows and props never rendered.** The page constructed `Canvas2DDirectRenderer`
   with no `PictographPreparer` and nothing ever calls `setGlobalPreparerGetter` — so
   `ensurePrepared` fell through to "return unprepared (arrows/props won't render)"
   (`canvas-2d-direct-renderer.ts:179`). The most regression-prone subsystem was invisible.
2. **Reversal dots never rendered.** Its `buildPictograph` dropped
   `blueReversal`/`redReversal`; the glyph renderer keys off `pictograph.blueReversal`
   (`canvas-2d-glyph-renderer.ts:636`). The D1/D4 corruption channel was invisible.

It was also manual (click-driven), network-dependent, and had no tests.

### What was built (pipeline v2)

| Piece                                                                                                         | Path                                                     |
| ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Shared core (render+hash+diff, preparer wired, reversal flags carried)                                        | `src/lib/shared/render/parity/render-parity-core.ts`     |
| Automated wave gate (vitest browser mode, Chromium)                                                           | `tests/render-parity/render-parity.test.ts`              |
| Committed offline corpus (26 seqs = 24 stride-sampled + 2 risk fixtures; 360 steps, **219 reversal-bearing**) | `tests/render-parity/fixtures/render-parity-corpus.json` |
| Corpus builder (from the data-parity snapshot)                                                                | `scripts/migrations/build-render-parity-corpus.ts`       |
| Vitest project config (publicDir=static so SVG assets load)                                                   | `tests/config/vitest.render-parity.config.ts`            |
| Manual page, rewired onto the shared core (one pipeline, two front-ends)                                      | `src/routes/test/step-migration-parity/+page.svelte`     |

Baselines carry `pipelineVersion`; v1↔v2 compares are refused with a "recapture" error on
both front-ends.

### Usage (the wave gate)

```bash
# at the pre-wave commit
npm run test:render-parity:capture   # freezes 360 renders -> tests/render-parity/.baseline/ (gitignored)
# ...apply the migration wave...
npm run test:render-parity:compare   # re-renders the SAME corpus; non-zero drift fails,
                                     # baseline|current|diff PNG triplets -> tests/render-parity/.artifacts/
# anytime (CI-able, no baseline needed)
npm run test:render-parity           # self-contained: determinism + round-trip + teeth
```

Corpus regeneration (only when the upstream snapshot changes):
`npx tsx scripts/migrations/build-render-parity-corpus.ts` (refuses a corpus with zero
reversal-bearing steps). The manual page remains for interactive triage on live gallery data.

### Verification (all run 2026-07-05)

- **Self-mode: 6 passed, 2 mode-gated skipped.** Includes: corpus non-vacuousness;
  determinism across passes (with a preparer-failure trap — any
  "Failed to prepare pictograph" warning fails the test — and a blank-render guard);
  manifest capture→compare round-trip = 0 drift;
  **three TEETH tests** proving the channels are live by injecting mutations post-hydrate
  and requiring detected drift: flipped reversal flags, `turns+1` structural change,
  manual arrow nudge (+60px). The v1 page fails all three by construction.
- **Wave-gate loop proven end-to-end:** capture froze 360 pictographs from 26 sequences
  (3.5 MB manifest); compare in a fresh browser session reported
  **PARITY: 360/360, 0 drifted, worst 0%** — cross-session determinism holds.
- **Failure path proven:** with two baseline entries deliberately swapped, compare failed
  with `DRIFT: 2/360 (worst 4.207%)` and wrote the six triplet PNGs to `.artifacts/`.
  Baseline recaptured clean afterwards.
- **Full `svelte-check`: 0 errors, 0 warnings** with the core + page rewire in place.
- Presence guards **21/21**, data-parity **0 drift (202×8)**, roundtrip **LOSSLESS
  (202/2,758×7)** — the complete net is green at HEAD before any wave starts.
- jsdom baseline for reference: **3,665 passed / 23 failed (10 files)** — all 23
  pre-existing, unrelated drift (effects Echo→Ghost rename, firebase mock hangs), per
  the dispatch note. None touch step/motion/parity domains.

## 4. What this checkpoint asks of Austen

Approve (or amend) the Option-C wave plan in §2. Wave 0 (8 straggler sites) and Wave 1
(53-file widening) are independently shippable, each gated by the §3 net. Nothing in this
package changed migration-relevant behavior: the harness is additive, and the parity nets
prove HEAD is a clean baseline.

---

## 5. WAVE 0 EXECUTED — 2026-07-05 (approved by Austen; Waves 1–2 remain gated)

Commit `cd2b8ee349` re-encoded all 8 straggler sites from §1c onto the canonical
`isVisibleMotion` predicate:

| Site                                                            | Fix                                                                                                                                    |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `navigation/sequence-hydrator.ts` gridMode donor                | Placeholder beats skipped; first VISIBLE beat donates. All-placeholder → gridMode stays unset (no fabricated donor).                   |
| `browse/sequence-difficulty-calculator.ts`                      | Invisible motions excluded from orientation/turns scans — placeholder CLOCK orientations can no longer inflate the badge.              |
| `qr/compositional-utils.ts` `enrichStepsWithGridPositions`      | Placeholder beats keep null GridPositions (LOOP executors see them unset, as pre-migration).                                           |
| `create/rotation-direction-pattern-manager.ts` `extractPattern` | Placeholder hands extract as `null` (skip slot), not `"none"` — mirrors turn-pattern-manager's fixed extract side.                     |
| `browse/thumbnail-renderer.ts` `ensureStartPosition`            | Placeholder-bearing start positions count as invalid (repair runs); placeholder first beats can't donate the repair.                   |
| `PhraseEffortLabModule.svelte` playback tick                    | Blank-step freeze gate fires again for placeholder beats.                                                                              |
| `ArrowLayerModal.svelte` / `PipelineEditorDock.svelte`          | Arrow-adjust surfaces inert for placeholder hands — WASD can no longer write special-placement overrides keyed off fabricated motions. |

Guardrail evidence (all run 2026-07-05, post-fix):

- **Render parity: 360/360, 0 drifted, worst 0%** vs a baseline recaptured at pre-change
  HEAD (mandatory recapture — `63a3840053` changed reversal display after the previous
  baseline). Zero diffs is the EXPECTED result: the corpus is real both-handed sequences;
  the fixes bind only where invisible placeholders flow. No cell-by-cell explanations owed.
- **Presence guards: 28/28** (21 original + 7 new Wave-0 tripwires covering the four
  pure-function sites, each with a visible-motion control). The three component sites
  (PhraseEffortLab, ArrowLayerModal, PipelineEditorDock) and the private
  `ensureStartPosition` carry the identical predicate change, verified by typecheck —
  component-test scaffolding for lab/modal internals was deliberately not built
  (`component-test-discipline.md`).
- **Full `svelte-check`: 0 errors, 0 warnings** (clean run after formatting).
- **jsdom suite: 3,676 passed / 23 failed — the identical 23 pre-existing unrelated
  failures**, zero new.
- Reversal-dot policy untouched: no fix touches reversal logic or display
  (prop-channel-only per `63a3840053` stands).

**Still open:** Wave 1 (free widening) and Wave 2 (extras retirement) — gated on approval.

---

## 6. WAVE 1 LEDGER — dispatched 2026-07-09 (approved by Austen; Fable-orchestrated per `.claude/rules/fable-routing.md`)

- [x] Render-parity baseline recaptured at pre-wave tree state (360/360, pipeline v2)
- [x] MotionData census re-enumerated (per-file lists in session scratchpad; 198 candidates, ~30 need engine-local/TIKA false-positive resolution)
- [x] StepData census re-enumerated (242 files, 6 parallel classifier batches)
- [x] `sheet-continuity.ts` `oriOf` fixed — param now `MotionData | undefined`; lean Motion no longer structurally passes (`60553621d4`)
- [x] Unsound casts fixed (`60553621d4`): arrow-quadrant `Pick<>`-narrowed, rewound `createPlaceholderMotion(color)`, VillageLab/museum-village inner casts removed; follow-up `90aab8aecd` replaced the outer `as SequenceData` casts with `createSequenceData` factory (cast removal had surfaced them as the only 2 full-check errors)
- [x] Widening batches executed: A=2 files (`dabf92ffbe`), B=11 (`5757aa1954`), C=6 (`6e5af92899`) — 19 widened total
- [~] deferred: ~55 census-widenable slots NOT widened — executors found systematic blockers the field-usage census can't see: (1) loop executors mutate + return the same `StepData[]` reference and spread-construct extras (all 16+2 skipped; fixing needs a factory at the executor boundary, Wave-2 shape); (2) canonical `Motion.color` is `PropColor | undefined` vs app-required `MotionColor` — blocks ALL color-reading code; resolve in @tka/tka-types before more widening; (3) `$state`/shared-interface/serialized-schema files skipped by design. Also deferred: .svelte components (marginal value) + src/lib/shared/pictograph/arrow/** (another session active there).
- [x] Gates green 2026-07-09: render-parity compare 360/360 0-drift · presence guards 28/28 · full svelte-check 0 errors/0 warnings · jsdom 3,940 passed / 23 failed (identical known pre-existing set, zero new)
- [x] Scoped commits per batch (`git commit -- <paths>`)
- [x] Wave 2 EXECUTED 2026-07-09 (Austen-approved, Fable-orchestrated):
  - `isSelected` deleted from StepData/StartPositionData/schema + factories + conversion fallbacks (`7f7846a45f`). Never truthy at runtime; UI already on `sequence-selection-state` props; id-keyed `selection-store` successor exists + tested.
  - `isStep` retired: field deleted, type guard now `stepNumber >= 1` only, 7 writers cleaned, straggler grep zero (`7f7846a45f`). `isStartPosition` deliberately KEPT (required discriminator, wider blast — future slice). Persisted `isStep`/`isSelected` in old JSON = inert, no reader remains, no migration needed.
  - Factory shim collapsed: `shared/create/factories/create-step-data.ts` deleted, 12 importers repointed to foundation (`2e8f4d6467`). `create-start-position-data.ts` has a real body — NOT consolidated this wave.
  - Missed-test fix: StepDeriver isStep assertion dropped (`7cae1d81cb`).
  - Motion.color prerequisite CLOSED as won't-fix: optionality is intentional + load-bearing (engine builds channel-keyed motions colorless; regression test "accepts a Motion with no color" guards it). App enforces via MotionData. Widening color-reading code stays blocked by design.
  - Gates 2026-07-09: parity compare 360/360 0-drift (baseline recaptured post-W1) · presence guards 28/28 · StepDeriver 30/30 · jsdom failures = known pre-existing set only (build-flower-sequence failure verified pre-existing against unmodified file) · full svelte-check: only 2 errors, both in another session's uncommitted choreo-card render-keys work (startPositionLayout), zero in wave files.
- [ ] Remaining (future slices, not blocking): `isStartPosition` retirement decision; `create-start-position-data` factory consolidation; loop-executor boundary factory (identity-return pattern); .svelte component widening; arrow/** widening (was session-locked)
