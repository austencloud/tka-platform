# Beat-to-Step Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Every wave is a single-session unit.

**Goal:** Rename every sequence-step `beat*` / `Beat*` identifier across `src/` and `packages/` to `step*` / `Step*`, preserving every legitimate musical-beat identifier, in 13 bounded waves that each produce one atomic commit on `main`.

**Architecture:** Twelve content waves + one audit sweep. Each wave scoped by module ownership (not alphabetical); each wave ~50–150 files and ~80–1,100 identifiers; each wave independently revertible. Classification rules live in the design spec; this plan enumerates execution.

**Tech Stack:** TypeScript, Svelte 5, pnpm workspaces, vitest, svelte-check.

**Spec:** `docs/superpowers/specs/2026-04-20-beat-to-step-rename-design.md`

**Sibling spec (blocks Waves 1, 2, 3):** `docs/superpowers/specs/2026-04-20-sequence-engine-unification-design.md` — the `Step`/`Motion` types this rename targets must exist first.

---

## Open Items Requiring Austen's Decision Before Implementation

Items 1–3 must be answered before Wave 1 starts. Item 4 can resolve mid-flight.

1. **`BeatMap` global naming.** Spec default is KEEP (the type holds video timestamps). Options: (a) KEEP as `BeatMap` — simplest; (b) RENAME to `StepToBeatMap` or `StepTimestampMap` — more explicit but breaks serialized Firestore docs in `shortcodes/*` and `sequences/*`. Austen chooses.
2. **`BeatDuration` per-file decisions.** Seven files contain this identifier with mixed meaning. Austen does one 15-minute review session before Wave 5 to decide each (spec Section 6 lists them).
3. **Deprecation alias policy for `AnimationPlaybackController` transport methods.** Spec proposes keeping `stepHalfBeatForward` as a deprecated alias for `stepHalfForward` for one release. Austen confirms whether to alias or hard-break.
4. **TODO comment sweep cadence.** Whether to resolve `// TODO(beat-rename)` comments mid-waves (after each) or batch at the end (before Wave 12). Default: batch before Wave 12.

---

## Pre-Wave Setup

- [ ] **Classification-rules cheat sheet pinned for executors.** Copy Section 4 + Section 6 from the spec into `docs/superpowers/plans/2026-04-20-beat-to-step-classification-cheat-sheet.md` for each wave session to reference inline. One artifact, referenced from every wave.
- [ ] **Audit script written: `scripts/beat-rename-audit.mjs`.** Given a file path, prints per-line classification (KEEP / RENAME / REVIEW) per spec rules. Executed by the model in each wave to pre-scan before editing. Deliverable in Wave 0.
- [ ] **TODO-comment convention agreed.** Format: `// TODO(beat-rename): AMBIGUOUS — <reason> — <catalog-id-if-any>`. Committed in Wave 0.

---

## Wave 0 — Pilot

**Scope:** `src/lib/features/create/shared/domain/models/` only. Goal: validate the classification rules against real code and produce the audit script, with minimal blast radius. Zero interaction with the sibling unification spec at this point.

**Blocks on:** Nothing.

**Estimated identifiers:** ~80.

**Expected outcome:** classification rules revised if needed; audit script working; one clean commit; pilot-wave retrospective notes added to the spec.

### Tasks

- [ ] **0.1** List every file under `src/lib/features/create/shared/domain/models/`. Record count.
- [ ] **0.2** Run a word-boundary grep for `beat` across the pilot directory. For each file, for each match, record: identifier name, line number, 3-line context, classification per spec rules, comments.
- [ ] **0.3** Write `scripts/beat-rename-audit.mjs`:
  - Input: one file path or glob.
  - Output: JSON array of `{ file, line, identifier, classification, reason }`.
  - Implements Section 4 decision tree verbatim.
  - Includes Ambiguity Catalog lookup from a hard-coded JSON embedded in the script.
- [ ] **0.4** For every RENAME match in pilot files, apply the edit. For every REVIEW match, add a `// TODO(beat-rename)` comment. For every KEEP match, do nothing.
- [ ] **0.5** Run verification: `npm test && npm run check && npm run build`. All three green.
- [ ] **0.6** If any classification was wrong in retrospect, update spec Section 4 or Section 6 with the new rule.
- [ ] **0.7** Commit. Message: `refactor(beat→step): wave 0 pilot — create/shared/domain/models/`. Body lists files, RENAME count, REVIEW count, KEEP count, verification evidence (test output summary, check clean, build clean).
- [ ] **0.8** Pilot retrospective appended to spec as Appendix A: "What the pilot taught us." Max 300 words. Rules that changed; edge cases surfaced.

**Verification gate for Wave 0:**
- `npm test` — pass, no new failures.
- `npm run check` — zero new errors.
- `npm run build` — success.
- Audit-script smoke test on 3 files outside the pilot directory produces sensible output (no dry-run false positives on the preserved catalog, no false negatives on obvious rename sites).

---

## Wave 1 — `@tka/tka-types` + `@tka/sequence-engine`

**Scope:** `packages/tka-types/`, `packages/sequence-engine/`. The canonical engine tree.

**Blocks on:** Sequence-engine-unification Phase 1 complete. Once the unified `Step`/`Motion` types live in `@tka/tka-types`, this wave renames all app-facing `beat*` identifiers inside the engine to match.

**Estimated files:** ~110. **Estimated identifiers:** ~700.

### Tasks

- [ ] **1.1** Confirm sibling spec Phase 1 merged to main. Blocker if not.
- [ ] **1.2** Run audit script on `packages/tka-types/` and `packages/sequence-engine/`. Save JSON report to `/tmp/wave1-audit.json`.
- [ ] **1.3** Review report: confirm no KEEP entries (engine has no musical content). Any KEEP = classification bug, stop and fix.
- [ ] **1.4** Apply all RENAME edits. Typical edits: `beatIndex → stepIndex`, `sequenceStep.beatNumber → sequenceStep.stepNumber` (already unified if sibling Phase 1 done), local `beat` params → `step`.
- [ ] **1.5** Update any engine-internal test files that reference renamed identifiers.
- [ ] **1.6** Run parity harness (from sibling spec) over the 200-sequence corpus. Require bit-identical output.
- [ ] **1.7** Run `npm test` in `packages/sequence-engine/` and `packages/tka-types/`. Green.
- [ ] **1.8** Run root `npm run check` + `npm run build`. Green.
- [ ] **1.9** Commit. Message: `refactor(beat→step): wave 1 — tka-types + sequence-engine`. Body cites parity-harness summary (N sequences, 0 diffs).

**Verification gate:** parity harness bit-identical + all tests green + check clean + build clean.

---

## Wave 2 — `@tka/domain` + `@tka/render-core` + `@tka/pictograph` + `@tka/render-composition`

**Scope:** `packages/domain/`, `packages/render-core/`, `packages/pictograph/`, `packages/render-composition/`.

**Blocks on:** Wave 1 complete.

**Estimated files:** ~80. **Estimated identifiers:** ~300.

### Tasks

- [ ] **2.1** Audit script pass on all four packages. Save report.
- [ ] **2.2** Review report. Flag any exported `Beat*` symbol — must match spec Section 6 Additional Rule 3 (published-package renames need Austen sign-off).
- [ ] **2.3** For each flagged export, ask Austen in-conversation before proceeding. Default: if not yet published, rename freely. If already on npm, propose a deprecation alias.
- [ ] **2.4** Apply RENAME edits.
- [ ] **2.5** Rebuild all four packages: `pnpm --filter @tka/domain build`, etc. Zero errors.
- [ ] **2.6** `npm test` + `npm run check` + `npm run build` at root. Green.
- [ ] **2.7** Commit.

**Verification gate:** all package builds clean + tests + check + build at root.

---

## Wave 3 — Create module (authoring core)

**Scope:** `src/lib/features/create/` excluding `src/lib/features/create/shared/domain/models/` (done in Wave 0) and excluding `generate/circular/services/implementations/Strict*LOOPExecutor.ts` (being deleted by sibling Phase 3).

**Blocks on:** Sibling Phase 2 merged. Wave 1 merged. Wave 2 merged.

**Estimated files:** ~180. **Estimated identifiers:** ~1,100.

**Why it blocks on sibling Phase 2:** the app-side `StepData` transition completes in sibling Phase 2; renaming here before then means renaming symbols that are about to be deleted.

### Tasks

- [ ] **3.1** Audit script pass over whole create/ tree. Save report.
- [ ] **3.2** Confirm sibling Phase 2 merged. Verify `StepData` imports resolve.
- [ ] **3.3** Sort audit entries by file. For each file:
  - Apply RENAMEs.
  - Add TODO comments for REVIEW entries.
  - Leave KEEP entries alone.
- [ ] **3.4** Special attention files (historically dense):
  - `src/lib/features/create/shared/workspace-panel/sequence-display/components/StepGrid.svelte`
  - `src/lib/features/create/shared/workspace-panel/sequence-display/components/SpotlightGrid.svelte`
  - `src/lib/features/create/shared/workspace-panel/sequence-display/components/StandardGrid.svelte`
  - `src/lib/features/create/shared/state/step-grid-display-state.svelte.ts`
  - Any `LOOPExtender*`, `SequenceExtender*` left after sibling Phase 3.
- [ ] **3.5** `npm test` + `npm run check` + `npm run build`. Green.
- [ ] **3.6** **Manual smoke:** `curl localhost:5173/create` works; author a 4-step sequence; use keyboard arrows; delete a step; save sequence. No errors in browser console.
- [ ] **3.7** Commit.

**Verification gate:** full test/check/build + manual smoke documented in commit body.

---

## Wave 4 — Animation playback named exceptions

**Scope:** exactly 4 files:
- `src/lib/features/compose/services/contracts/IAnimationPlaybackController.ts`
- `src/lib/features/compose/services/contracts/IAnimationPlaybackControllerFactory.ts`
- `src/lib/features/compose/services/implementations/AnimationPlaybackController.ts`
- `src/lib/features/compose/services/implementations/AnimationPlaybackControllerFactory.ts`

**Blocks on:** Wave 3.

**Estimated identifiers:** ~100.

**Why it's a wave:** these files live under compose/ (KEEP-zone per file-path rule) but the classification rules name them as full-file exceptions. Explicit per-file audit matters because miscategorizing them has cascading effects — both the AnimationPlaybackController interface and its Factory are consumed elsewhere.

### Tasks

- [ ] **4.1** Read each file start-to-finish. Confirm every `beat*` identifier describes a step index, not a musical timestamp.
- [ ] **4.2** Apply renames per spec Section 6 Ambiguity Catalog entries for `stepHalfBeatForward`, `stepFullBeatForward`, `animateToBeat*`, `animationStartBeat`, `getTimePositionForBeat`, `jumpToStep(beat)` → `jumpToStep(step)`, `seekToStep(beat)` → `seekToStep(step)`.
- [ ] **4.3** Per Open Item 3: either add deprecation aliases (two exported names; old one logs `console.warn` once) or hard-break. Default from Open Items = deprecation alias; Austen may override.
- [ ] **4.4** Update every app-side caller. TypeScript will surface them via `npm run check`.
- [ ] **4.5** `npm test` + `npm run check` + `npm run build`.
- [ ] **4.6** **Manual smoke:** open a sequence, press play, scrub, jump between steps. No console errors; playback visually correct.
- [ ] **4.7** Commit.

---

## Wave 5 — Sequence viewer + shared sequence domain

**Scope:** `src/lib/shared/sequence-viewer/` (excluding `components/beat-mapping/` — handled in Wave 9), `src/lib/shared/sequence-*/`, `src/lib/shared/pictograph/`.

**Blocks on:** Wave 1, Wave 3.

**Estimated files:** ~140. **Estimated identifiers:** ~800.

### Tasks

- [ ] **5.1** Austen session: resolve BeatDuration per-file decisions (Open Item 2). Produce a 7-line verdict list appended to the audit cheat-sheet.
- [ ] **5.2** Audit script pass.
- [ ] **5.3** Apply RENAMEs and TODO-comment adds.
- [ ] **5.4** Special attention files:
  - `src/lib/shared/sequence-viewer/components/ChoreoCard.svelte`
  - `src/lib/shared/sequence-viewer/components/ExportImagePanel.svelte`
  - `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte` (has BeatMap ambiguities — REVIEW, do not rename BeatMap itself)
  - `src/lib/shared/pictograph/shared/domain/models/*`
- [ ] **5.5** `npm test` + `npm run check` + `npm run build`.
- [ ] **5.6** **Manual smoke:** open viewer for a saved sequence; export an image; open a shared-link page. No errors.
- [ ] **5.7** Commit.

---

## Wave 6 — Choreo card + thumbnail export + shared render

**Scope:** `src/lib/features/choreo-card/`, `src/lib/features/fuse/`, `src/lib/shared/render/`, `src/lib/shared/animation-engine/` (non-audio parts — exclude any file that imports from `audio/` or references `bpm`/`tempo`).

**Blocks on:** Wave 5.

**Estimated files:** ~100. **Estimated identifiers:** ~500.

### Tasks

- [ ] **6.1** Audit script pass. Explicitly mark `src/lib/shared/animation-engine/components/AnimatorCanvas.svelte` for manual context check — it bridges animation and rendering.
- [ ] **6.2** Apply edits.
- [ ] **6.3** `npm test` + `npm run check` + `npm run build`.
- [ ] **6.4** **Visual regression:** export a sample choreo card PNG; compare pixel-diff against a pre-wave baseline. Zero diff.
- [ ] **6.5** Commit.

---

## Wave 7 — Browse, library, gallery-generator

**Scope:** `src/lib/features/browse/`, `src/lib/features/library/`, `src/lib/features/gallery-generator/`.

**Blocks on:** Wave 5.

**Estimated files:** ~70. **Estimated identifiers:** ~350.

### Tasks

- [ ] **7.1** Audit script pass.
- [ ] **7.2** Apply edits.
- [ ] **7.3** `npm test` + `npm run check` + `npm run build`.
- [ ] **7.4** **Manual smoke:** `curl localhost:5173/browse` renders; open a deck; navigate a sequence.
- [ ] **7.5** Commit.

---

## Wave 8 — Labs, levels, write, authoring tools

**Scope:** `src/lib/features/assemble-lab/`, `disassemble-lab/`, `levels/`, `level5-lab/`, `level6-lab/`, `loop-labeler/`, `phrase-effort-lab/`, `effort-lab/`, `mandala-generator/`, `write/`, `duration-lab/`, `hand-path-builder/`, `hand-path-explorer/`, `hand-paths/`, `trigrid-lab/`, `vtg-lab/`, `skewlab/`, `constraint-layout-lab/`.

**Blocks on:** Wave 5.

**Estimated files:** ~90. **Estimated identifiers:** ~300.

### Tasks

- [ ] **8.1** Audit script pass. Expect small per-file counts; many labs have only 2–5 beat refs.
- [ ] **8.2** Apply edits.
- [ ] **8.3** `npm test` + `npm run check` + `npm run build`.
- [ ] **8.4** **Manual smoke:** one lab per sub-feature reached via the lab-tab navigation.
- [ ] **8.5** Commit.

---

## Wave 9 — Beat-mapping step-index exceptions

**Scope:** `src/lib/shared/sequence-viewer/components/beat-mapping/` + `src/lib/shared/video-collaboration/`. Rename **only** the step-index identifiers flagged in spec Section 6: `beatIndex`/`activeBeatIndex` inside these files become `stepIndex`/`activeStepIndex`. Every other `beat*` identifier in these files stays per Preserved-Beat Catalog.

**Blocks on:** Wave 5.

**Estimated files:** ~10. **Estimated identifiers:** ~30.

**High precision required.** This wave is small but has the lowest error tolerance — miscategorizing here breaks the video-to-sequence anchoring feature.

### Tasks

- [ ] **9.1** Read `BeatMapEditor.svelte`, `BeatMapTimeline.svelte`, `beat-map-utils.ts`, `CollaborativeVideoManager.ts`, `CollaborativeVideo.ts` fully — not just diff-level.
- [ ] **9.2** For each `beat*` identifier, verify it is either (a) a step index into the sequence (RENAME) or (b) a video-time/musical-beat anchor (KEEP). Comment each decision in the commit body.
- [ ] **9.3** Apply edits. Touch only the identifiers that are step indices.
- [ ] **9.4** `npm test` + `npm run check` + `npm run build`.
- [ ] **9.5** **Manual smoke:** open a saved sequence with a video. Run the beat-mapping editor. Place/drag at least 3 beat markers. Save. Reopen. Markers persist; timestamps correct.
- [ ] **9.6** Commit.

---

## Wave 10 — MCP servers + deployment functions

**Scope:** `mcp-server/`, `mcp-server-pkg/`, `deployment/functions/`.

**Blocks on:** Waves 1 and 2 (engine + packages must be renamed first).

**Estimated files:** ~40. **Estimated identifiers:** ~200.

### Tasks

- [ ] **10.1** Audit script pass. Flag any identifier that appears in an MCP tool schema or JSON response — those stay unchanged (wire contract stability).
- [ ] **10.2** Apply edits only to internal implementation identifiers.
- [ ] **10.3** Build `mcp-server-pkg`: `pnpm --filter @austencloud/tka-domain-mcp build`. Zero errors.
- [ ] **10.4** Run the MCP round-trip smoke test from sibling spec §4: `generate_sequence` with 3 known-good inputs (one LOOP, one non-loop, one high-turn sequence). Diff output against pre-wave baseline. Must match.
- [ ] **10.5** Run broadcast function dry-run (if available); if no dry-run harness exists, verify deployment/functions tsc-compiles clean.
- [ ] **10.6** `npm test` + `npm run check` + `npm run build`.
- [ ] **10.7** Commit.

---

## Wave 11 — Scripts, tools, top-level tests

**Scope:** `scripts/`, `tools/`, top-level `tests/` directory (not test files colocated with source — those moved with Waves 1–10).

**Blocks on:** All prior waves.

**Estimated files:** ~30. **Estimated identifiers:** ~150.

### Tasks

- [ ] **11.1** Audit script pass.
- [ ] **11.2** Apply edits.
- [ ] **11.3** Re-run any script that handles sequence data (`scripts/add-humor-pair.cjs`, backfill scripts) as a smoke test.
- [ ] **11.4** `npm test` + `npm run check` + `npm run build`.
- [ ] **11.5** Commit.

---

## Wave 12 — Final Sweep + TODO Resolution

**Scope:** Whole tree. Verify no `beat*` identifier leaked through uncategorized, resolve all outstanding `// TODO(beat-rename)` comments.

**Blocks on:** All prior waves.

### Tasks

- [ ] **12.1** Run `rg -w 'beat|Beat' src/ packages/ --type ts --type svelte -l` (or the PowerShell Select-String equivalent if rg is unavailable). Capture output to `/tmp/wave12-remaining.txt`.
- [ ] **12.2** For each file in the output, verify it appears in the Preserved-Beat Catalog (Section 7). Any file not in the catalog is a classification failure — open a sub-audit.
- [ ] **12.3** Grep for `// TODO(beat-rename)`. Austen session to resolve each:
  - Either RENAME now (wave-12 edit) and remove the TODO.
  - Or document the decision inline as a permanent catalog entry and remove the TODO.
- [ ] **12.4** Update spec Section 7 (Preserved-Beat Catalog) with any additions surfaced during sweep.
- [ ] **12.5** `npm test` + `npm run check` + `npm run build`.
- [ ] **12.6** Parity harness one final run over the full 200-sequence corpus. Bit-identical.
- [ ] **12.7** Commit. Message: `refactor(beat→step): wave 12 — final sweep + TODO resolution`. Body: final catalog snapshot, remaining-refs summary ("all N remaining `beat*` occurrences are in preserved catalog"), parity-harness evidence.

---

## Rollback Procedure Per Wave

If any wave's verification gate fails post-commit (e.g. a regression surfaces within 24 hours):

1. `git revert <wave-N-commit>` on main, single commit message `revert: wave <N> — <reason>`.
2. Run `npm test && npm run check && npm run build`. Must be clean.
3. Push.
4. Post-mortem: what classification rule was wrong? Append finding to spec Section 4 or 6.
5. Re-plan the wave with updated rules. Next attempt is a fresh wave number (e.g. Wave 3-b).

If the broken wave has downstream consumers already merged, revert in reverse-dependency order: highest-numbered wave first, then decrement.

---

## Test Coverage Requirements

Every wave commit must pass, in-wave:

- **`npm test`** — zero new failing tests. Existing failures baseline-documented per wave.
- **`npm run check`** — zero new type errors. The `svelte-check` output size must not grow.
- **`npm run build`** — clean production build. No warnings referencing renamed or reintroduced symbols.
- **Wave-specific verification** — parity harness (Waves 1, 2, 10, 12), manual smoke tests (Waves 3, 4, 5, 6, 7, 8, 9, 11), visual regression (Wave 6).

A wave that fails verification mid-session:

1. Executor diagnoses the break.
2. Executor either fixes in-session (preferred) or reverts the wave's staged changes and stops.
3. Executor never commits a half-green wave.

---

## Commit Message Template

```
refactor(beat→step): wave <N> — <scope-short>

Scope: <one-line summary>
Files touched: <count>
Identifiers renamed: <count>
REVIEW comments added: <count>
Preserved identifiers (in scope): <count>

Verification:
- npm test: <pass|fail + summary>
- npm run check: <clean|N errors>
- npm run build: <clean|warning summary>
- <wave-specific>: <result>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## Exit Criteria

- All 13 waves committed to main.
- Post-Wave-12 sweep: every `beat*` in the tree is in the Preserved-Beat Catalog.
- Parity harness bit-identical pre-Wave-1 vs post-Wave-12.
- `npm test`, `npm run check`, `npm run build` all clean at the main tip.
- Open Items 1–4 resolved.
- Spec Appendix A (pilot retrospective) + any later-wave rules discoveries all landed.
