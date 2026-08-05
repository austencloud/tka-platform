# LOOP Detection False Negatives — Handoff (2026-08-05)

## Mission

TKA reports `loop: none` on sequences that are unambiguously LOOPs, and the MCP
tool `detect_loop_pattern` returns a **different answer every time it is called
on the same word**. Austen hand-built four valid ALGF LOOPs in the constructor
on 2026-08-05 (mirrored, swapped, mirrored+swapped, and a mirrored/swapped/
inverted variant that mutates to ALGFBLHF); every one of them displays
`loop: none`. He called this severe and wants detection to work consistently.

This is not one bug. Investigation found **three independent LOOP detectors**
with three different circularity definitions, and the two headline symptoms have
**different root causes**. Nothing has been fixed yet — this handoff is the
investigation result plus a ranked fix plan.

Context for why it surfaced now: the sequence-combinator redesign
(`docs/superpowers/specs/2026-08-04-sequence-combinator-design.md`, being
re-brainstormed 2026-08-05) must emit LOOPs only, so it needs a detector it can
trust. That redesign is a separate workstream and does not block this one.

## Done — verified

Investigation only. No code changed, nothing committed but this document.

Every claim below was verified by reading the cited file in this session or by
running the cited tool call. Line numbers are from 2026-08-05 on `main`.

**1. The three detectors are real and independent.**

| # | Detector | Entry point | Input basis |
|---|---|---|---|
| 1 | Engine (canonical) | `packages/sequence-engine/src/loop/detection/LOOPDetector.ts` + `pair-relation.ts` | realized steps |
| 2 | loop-labeler fork | `src/lib/features/loop-labeler/services/loop-detector.ts` | realized steps |
| 3 | MCP tool wrapper | `mcp-server-pkg/src/tools/loop-tools.ts:132-181` | **re-derived from the word** |

Detector #1 is shared by the MCP and by `src/lib/shared/create/services/loop-detector.ts`.
Detector #2 is a full reimplementation that does **not** use the engine, and it
is the one that drives the card-header glyph. A fix to the engine does not reach it.

**2. `detect_loop_pattern` is non-deterministic.** Three identical calls of
`detect_loop_pattern("ALGFALGF")` in one session returned three different
realizations:

| Call | start | end | isCircular | verdict |
|---|---|---|---|---|
| 1 | alpha1 | alpha5 | false | "Not a circular sequence" |
| 2 | alpha5 | alpha5 | **true** | "Circular sequence with no detected pattern (freeform)" |
| 3 | alpha5 | alpha1 | false | "Not a circular sequence" |

Cause: `loop-tools.ts:132` accepts only a `word` — no step data at all — then
`sequence-builder.ts:186-238` builds *one random variation walk* and stops at the
first **valid** walk, not the first **closing** one (`:219-227`). Letters have up
to 8 variations each; only some realizations close. The tool reports a property
of a coin flip.

Contrast, same session: `generate_loop_sequence("ALGF", loopType:
"rotated_swapped")` returns a valid closed 8-step LOOP, alpha1 → alpha1,
`period: "halved"`. The generator *constructs* the closing realization; the
detector hopes to stumble on it.

Note that even the lucky circular realization (call 2) reported `freeform` —
closing positionally is not the same as being the LOOP realization. Raising
`maxAttempts` cannot fix this; it bounds build retries, not the search for a
closing realization.

**3. The `loop: none` Austen saw is NOT a detector failure.** It is a persisted
field that nothing writes on the constructor save path.

- `src/lib/shared/browse/services/claude-code-copier.ts:53` emits
  `` `loop: ${fullSequence.loopType || "none"} | ` `` — a read of persisted
  `SequenceData.loopType` (`src/lib/shared/foundation/domain/models/sequence-data.ts:85`).
  It runs no detection. **Verified by reading the file.**
- Only three writers of `loopType` exist: the LOOP generator
  (`src/lib/shared/create/services/generation-orchestrator.ts:204`), QR/URL
  hydration (`src/lib/shared/navigation/services/sequence-hydrator.ts:91,136`),
  and public-index sync (`src/lib/features/library/services/public-index-syncer.ts:460-523`).
- A grep of `src/lib/shared/library/` for `loopType` assignment returns only the
  public projection (`public-sequence-projection.ts:586`, which *reads*
  `loop.loopType`), the Zod schema (`library-schemas.ts:100`), and tests.
  **Verified by grep in this session** — the save path writes nothing.

So: build a LOOP by hand, save it, and the field was never computed. Detection
never ran on that path at all.

**4. Detector #2 has a transform-coverage gap.**
`src/lib/features/loop-labeler/services/comparison/reflection-comparer.ts:5-8`
imports exactly `MIRROR_VERTICAL` and `FLIP_HORIZONTAL` — **two reflection axes.**
**Verified by reading the file.** The engine tests four
(`pair-relation.ts:117-128`, including northeast-southwest and
northwest-southeast). Per `.claude/rules/tka-domain.md` → LOOP Reflection
Guardrails, diagonal-axis reflections are equally valid LOOPs. Every
diagonal-axis mirrored LOOP is therefore a guaranteed false negative in the
detector that renders the card glyph.

Also absent from `domain/constants/loop-type-definitions.ts:10-31`:
`mirrored_rotated`, `mirrored_inverted_rotated`, `mirrored_rotated_swapped`, and
the four-component `mirrored_rotated_inverted_swapped` — all of which the engine
resolves in `deriveLoopTypeFromComponents` (`LOOPDetector.ts:121-158`).

**5. Three incompatible definitions of "circular" coexist.**

| Definition | Location |
|---|---|
| position-only | `src/lib/features/loop-labeler/services/loop-detector.ts:106-122` |
| position-only, step 0 | `packages/sequence-engine/src/loop/detection/LOOPDetector.ts:162-173` |
| position **and** orientation | `src/lib/shared/foundation/services/sequence-loopability-checker.ts:38-43` |

The strict one gates `src/lib/shared/create/services/loop-detector.ts:141-143`,
which returns `loopType: null` outright at `:69-76` for a sequence whose
positions close but whose orientations do not — with no diagnostic. That is a
real false-negative class, and it is arguably wrong on the domain: a sequence
whose orientations need a second pass is a period-2 LOOP, ordinary TKA, not a
non-LOOP.

**6. Letter mutation is NOT implicated.** The hypothesis that inverted LOOPs
break detection because letters mutate (A→B, G→H) is **refuted**: no detector
reads `letter` for any decision. The engine compares locations + motionType only
(`LOOPDetector.ts:296-309`); the labeler's `step-pair-analyzer.ts:78-110` uses
letters for a display string that feeds no decision.

## Believed done — unverified

Nothing is claimed as fixed. Two investigation findings were reported by the
subagent but **not** independently re-read by the author of this handoff, so
treat them as leads rather than facts:

- `reduceRepeatedMotionSkeleton` (`packages/sequence-engine/src/loop/detection/LOOPDetector.ts:317-336`)
  may over-reduce: it collapses to the shortest repeating motion skeleton before
  detection, so an 8-step LOOP whose halves share a location/motionType skeleton
  but differ in orientation could reduce to 4 steps and change which pairs get
  compared. Needs a targeted test to confirm.
- `deriveLoopTypeFromComponents` may have no entry for `flipped` in any
  multi-component combination, degrading `confidence` to `"probable"` and thereby
  disabling compositional QR encoding (`src/lib/shared/qr/services/compositional-encoder.ts:48`)
  for every E-W-axis compound LOOP. Verify against the enum map in
  `loop-components.ts:94-100` before acting.

## In flight

Nothing. No branch, no worktree, no uncommitted code. This document is the only
artifact. Work happens on `main` per `.claude/rules/worktree-workflow.md`.

Note: `git status` on 2026-08-05 shows ~28 modified files from other sessions
(animation-engine, compose, export). **They are not related to this work** — do
not stage them. Commit with explicit pathspecs only
(`.claude/rules/commit-only-your-own-changes.md`).

## Loose ends (ranked)

**#1 — Start here: decide the circularity definition with Austen.** Everything
downstream depends on it, and it is a domain call, not an engineering one. The
question: does a sequence whose positions close but whose orientations need a
second pass count as circular? The combinator work of 2026-08-04 already models
this as `period` (a period-2 loop is ordinary TKA, see
`src/lib/shared/combination/services/splice-builder.ts:28-43`), which argues for
"yes, circular, with period 2" over "not a LOOP." Get the ruling, then make all
three definitions agree.

**#2 — Compute and persist `loopType` on the constructor save path.** This is
the fix for the symptom Austen actually reported, and it is independent of every
detector defect below. Find the save path (`SaveToLibraryButton.svelte`,
`construct-tab-state.svelte.ts`, `library-repository.ts`) and run realization-based
detection at save time. Confirm first whether the card-header glyph is *also*
blank on Austen's hand-built LOOPs — `resolveLoopDisplay`
(`src/lib/features/loop-labeler/services/loop-display-resolver.ts:220-289`) does
live detection on realized steps, so the glyph may be correct while the exported
string says none. If the glyph is right, this is purely a persistence gap.

**#3 — Fix `detect_loop_pattern` to accept realized steps.** Either add an
optional steps parameter, or make it search for a *closing* realization instead
of accepting the first valid one. A non-deterministic domain oracle is worse than
no oracle — anything that consults it (including the combinator redesign) inherits
the coin flip. Also fix or remove the misleading `maxAttempts`.

**#4 — Close detector #2's transform gap:** add the two diagonal reflection axes
and the four missing multi-component definitions. Blast radius is large and
user-visible (card glyphs, printed deck backs, video export overlay) — see the
consumer list below.

**#5 — Consolidate detectors #1 and #2.** The labeler fork's header comment
claims a 2026-07-05 consolidation that covered `shared/create` only. Finishing it
removes the whole class of "two answers for one sequence." Do this after #1-#4
land, not instead of them.

**#6 — Fix the cache and the silent catch.** `displayCache`
(`loop-display-resolver.ts:142`) is keyed on `sequence.id` and never invalidated
on step edits, so editing in place keeps a stale glyph. The catch at `:319-321`
swallows every detection throw and falls through to persisted components, making
a crash indistinguishable from a genuine no-LOOP result.

### Consumer blast radius (for #4 and #5)

Detector #2 via `resolveLoopDisplay`: `ChoreoCard.svelte:538`,
`CardBack.svelte:115`, `card-back-data.ts:437`, `card-back-job-builder.ts:350`,
`card-front-assembler.ts:345`, `AnimatorCanvas.svelte:474`,
`video-export-orchestrator.ts:127`, `cover-front-renderer.ts:75`,
`QScanPage.svelte:784`, `SpinnerNowPlaying.svelte:34`,
`LOOPLabelerModule.svelte:139`, `loop-labeler-state.svelte.ts:137`,
`composition-root/index.ts:43`.

Engine / detector #3: `sequence-hydrator.ts:91`, `compositional-encoder.ts:46`,
`public-index-syncer.ts:472,489,510`, `thumbnail-renderer.ts:114`,
`SequenceDisplay.svelte:105`, `explorer-generator.ts:57`,
`SequenceBuilder.ts:453`.

MCP: `loop-tools.ts:156`, `sequence-tools.ts:789`.

## Decisions already made

- **Austen, 2026-08-05:** detection failing on hand-built sequences is "pretty
  severe — we definitely want the detection to work consistently." This is a
  correctness workstream, not polish.
- **Austen, 2026-08-05:** he builds LOOPs by hand in the constructor, not only
  via the generator. Detection must work on hand-authored material; "the
  generator produces it correctly" is not a sufficient bar.
- **Domain canon** (`.claude/rules/tka-domain.md`): reflection axis and grid mode
  are independent; diagonal axes (NE-SW, NW-SE) are as valid as N-S (mirrored)
  and E-W (flipped). Do not treat the two-axis set as correct-by-convention.
- **Terminology** (same rule): "turn" is reserved for prop turns and body turns.
  A LOOP's rotation slice is 180°/90° or "halved"/"quartered" — never "half
  turns."

## Gotchas

- **`resolveLoopConfig` is not a detector.** Despite the memory note calling it
  the LOOP single source of truth, `src/lib/shared/create/services/loop-type-utils.ts:225`
  is a *generation-side* config resolver and nothing in detection calls it. The
  build half and the recognize half of the LOOP algebra never meet — which is
  exactly why `generate_loop_sequence` can build what `detect_loop_pattern`
  cannot see. Do not "fix" detection by routing it through `resolveLoopConfig`
  without understanding that split.
- **A word does not determine its LOOP type.** Proven 2026-08-05 via
  `list_letter_variations("Ψ")`: from alpha7, blue-dashes lands beta7 and
  red-dashes lands beta3 — 180° apart, same letter, same start. So the same word
  admits several different closures depending on which variations are realized.
  Any detector reasoning from a word is structurally wrong, not merely
  imprecise.
- **The MCP server is a separate package** at `E:\tka-platform\mcp-server-pkg`
  (configured in `.mcp.json` to run `dist/index.js`). Editing `src/` there does
  nothing until it is rebuilt, and the running server needs a restart to pick it
  up. Compare `reference_engine_dist_stale_in_dev` in memory for the same trap on
  the engine package.
- **Don't trust `isCircular` from any single source** while #1 is unresolved —
  three definitions disagree by design right now.
- Reproduce the non-determinism before changing anything: call
  `detect_loop_pattern("ALGFALGF")` three times. If it returns the same answer
  three times, the build changed since 2026-08-05 and this handoff's premise
  needs re-checking.
