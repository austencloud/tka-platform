# Beat-to-Step Rename — Design Spec

**Date:** 2026-04-20
**Status:** Ready for implementation planning
**Author:** Austen + Claude (sibling to sequence-engine-unification)
**Related:** `docs/superpowers/specs/2026-04-20-sequence-engine-unification-design.md`

## Problem

Across `src/` and `packages/`, ~1,017 files contain the word "beat" and the tree holds ~8,800 raw `beat` references. Three overlapping meanings share one identifier:

1. **Sequence step** — a pictograph inside a sequence. Historical misnomer. Should be `step`.
2. **Musical beat** — a BPM-driven tick on an audio/video timeline. Legitimate. Should stay `beat`.
3. **Transport tick** — a playback increment (half-step, full-step) inside the animation controller. Uses `beat` as a synonym for a step-index slot. Should be `step`.

The sequence-engine-unification spec introduces unified `Step` and `Motion` types in `@tka/tka-types`. This spec renames call-sites to match. The two specs are siblings — neither blocks the other, but this one is larger and higher-risk, so it waves in behind Phase 2 of the unification plan.

The hard part is classification, not keystroke count. A mechanical `beat → step` replace would destroy the audio subsystem. The rules below are what makes this surgical.

## Goals

1. Every identifier describing a sequence step uses `step*` / `Step*`.
2. Every identifier describing a musical or BPM-driven beat stays `beat*` / `Beat*`.
3. Ambiguous identifiers get human review before rename — never silent guessing.
4. Each wave is independently commit-able, revert-able, and verified.
5. After all waves, `grep -w beat` on the codebase returns only entries from the preserved-beat catalog (Section 7).

## Non-Goals

- **User-facing UI copy.** Strings like "Beat 1", "Go to beat N" in pre-existing UI stay untouched in this rename unless they are wrong enough to confuse users. A follow-up UX copy pass (different spec) can update display labels.
- **Firestore field names in stored documents.** Fields like `blueReversal` and any `beat*` persisted keys stay as-is for back-compat. A migration is a separate, signed-off effort.
- **Renaming anything in the musical-beat subsystem.** `BeatMarker`, `BeatGrid`, `BeatMapEditor` etc. (see Section 7) are correct names and stay.
- **Touching MCP wire contracts.** If an MCP tool response or request uses `beat` in a JSON field, that field stays; only internal variable names change.
- **Comments and prose inside JSDoc.** If a comment says "the current beat" meaning sequence step, it's updated *only* as part of the same edit that renames the identifier it describes — never as a standalone grep/replace.

## Architecture

### Terminology Anchor

Per `sequence-engine-unification-design.md` §"Unified Type Layer", a **Step** is one pictograph inside a sequence. Its `stepNumber` is required. Its `duration` is measured in musical beats. That single sentence contains both meanings: `Step` is the sequence unit; `beat` is the time unit. The rename encodes that distinction in every identifier.

### Classification Rules

Three outcomes per identifier: **RENAME** (to step), **KEEP** (as beat), **REVIEW** (human decides).

Rules are evaluated top-down; the first rule that matches wins. Each rule fires on the **enclosing file path + identifier name + surrounding context** in that order.

#### Rule 1 — File-Path Preserve (highest priority)

Any identifier inside a file under one of these paths is **KEEP** unless Rule 4 (local context override) fires:

- `src/lib/features/compose/**` — video/audio composition; BPM-driven layer grid. Includes `tabs/arrange/**` (tunnel composition over music), `timeline/**`, `components/video-player/**`, `tabs/playback/**`, `workers/**`.
- `src/lib/features/compose/compose/phases/audio/**` — audio loading, BPM detection, track library.
- `src/lib/features/video/**` — video lab, including `BeatMappingView`.
- `src/lib/shared/video-collaboration/**` — `BeatMap` interop domain.
- `src/lib/shared/sequence-viewer/components/beat-mapping/**` — video-to-sequence timestamp mapping.
- `src/lib/shared/device-sync/**` — BPM-synced playback coordination.
- Files matching `bpm-*`, `*Bpm*`, `AudioState*`, `AudioStorage*`, `metronome*`, `tempo*`.

#### Rule 2 — File-Path Rename

Any identifier inside a file under one of these paths is **RENAME**:

- `packages/sequence-engine/**`
- `packages/tka-types/**`
- `packages/domain/**`
- `packages/render-core/**`
- `packages/render-composition/**`
- `packages/pictograph/**`
- `packages/animation-renderer/**`
- `src/lib/features/create/**` — sequence authoring.
- `src/lib/features/browse/**`, `src/lib/features/library/**`, `src/lib/features/gallery-generator/**` — sequence catalog.
- `src/lib/features/choreo-card/**`, `src/lib/features/fuse/**` — sequence cards, not music.
- `src/lib/features/write/**`, `src/lib/features/assemble-lab/**`, `src/lib/features/disassemble-lab/**`, `src/lib/features/levels/**`, `src/lib/features/loop-labeler/**`, `src/lib/features/mandala-generator/**`, `src/lib/features/phrase-effort-lab/**`, `src/lib/features/effort-lab/**` — sequence-domain features.
- `src/lib/shared/pictograph/**`, `src/lib/shared/sequence-viewer/**` (excluding `beat-mapping/**`), `src/lib/shared/sequence-*/**`.
- `src/lib/shared/render/**`, `src/lib/shared/animation-engine/**` — pictograph renderers operating on steps.
- Files matching `*Sequence*`, `*Step*`, `StepData*`, `Pictograph*`.

#### Rule 3 — Identifier-Name Heuristic

Applied when Rule 1 and Rule 2 don't fire (neutral file-path):

**RENAME triggers** (identifier contains any of these tokens, case-sensitive):
- `beatIndex`, `beatNumber`, `beatCount` (unless within a BPM-Rule-1 file), `beatId`, `beatKey`, `beatSteps`, `beatSelection`, `selectedBeat`, `currentBeat` (see Rule 4 for refinement), `totalBeats` (when counting sequence steps, not musical beats), `BeatData`, `BeatGridItem` (when referring to pictograph grid, not music).
- `stepHalfBeatForward`, `stepFullBeatForward`, `animateToBeat`, `animateToBeatInternal`, `jumpToBeat`, `seekToBeat`, `getBeatKey`, `beatStart` (when used as "where step N starts"), `beatEnd`.
- `getTimePositionForBeat` — RENAME to `getTimePositionForStep` (it returns a time for a given step index).

**KEEP triggers** (identifier contains any of these tokens):
- `bpm`, `Bpm`, `BPM`, `tempo`, `Tempo`, `metronome`, `Metronome`.
- `beatMarker`, `BeatMarker`, `globalBeatMarkers` — these are musical-beat markers on an audio waveform.
- `beatsPerMinute`, `beatsPerMeasure`, `timeSignature`.
- `beatDuration` when the unit is seconds and derived from BPM (see `BeatGridCalculator.getBeatDuration(bpm)` — a beat is `60/bpm` seconds).
- `strongBeat`, `isStrongBeat`, `beatSubdivision`.
- `beatOffset` inside an `arrange-*` or `timeline-*` file (musical offset for a tunnel layer or clip).
- `beatTimestamps` inside `BeatMapEditor.svelte`, `BeatMapTimeline.svelte`, `beat-map-utils.ts`, `bpm-analyzer.ts`, `DeviceSyncCoordinator.ts`, `LanSyncCoordinator.ts` — video/audio time anchors.

**REVIEW trigger** — identifier is in the Ambiguity Catalog (Section 6). Always flag for human decision, never auto-rename.

#### Rule 4 — Local Context Override

Applied *after* Rules 1–3, as a safety lens:

- In a file otherwise KEEP-zoned (compose/audio), an identifier adjacent to `stepNumber`, `sequence.steps`, `StepData`, `Pictograph`, or a domain letter variable is probably a sequence-step reference. **Escalate to REVIEW.** Do not auto-rename in a preserved file, but flag.
- In a file otherwise RENAME-zoned, an identifier adjacent to `bpm`, `tempo`, `audio.currentTime`, `videoElement`, `audioTrack`, `metronome`, or a BPM arithmetic expression (`60 / bpm`, `* bpm / 60`) is probably a musical-beat reference. **Escalate to REVIEW.**
- `AnimationPlaybackController.ts` lives under `src/lib/features/compose/services/implementations/` (KEEP by Rule 1) but its `beat` parameters all describe step indices (verified: `stepHalfBeatForward`, `animateToBeatInternal(beat, ...)`, `jumpToStep(beat)` all operate on step numbers). This single file is a **named exception**: every `beat*` identifier in it is **RENAME** by Section 6 decision. Listed in Wave 4 with explicit per-identifier call-outs.

#### Rule 5 — Type-Definition Propagation

When a type alias, interface, or enum member is renamed, every consumer of that type is transitively renamed in the same wave. If consumers span multiple waves, the type rename blocks subsequent waves until consumers are swept. The TypeScript compiler enforces this: the rename wave is not complete until `npm run check` passes.

### Classification Decision Tree (for the executing model)

For each `beat*` identifier the executor must decide:

```
1. Is the enclosing file in a Rule 1 preserve path?
   YES → default KEEP; apply Rule 4 to check for escalation.
   NO  → continue.

2. Is the enclosing file in a Rule 2 rename path?
   YES → default RENAME; apply Rule 4 to check for escalation.
   NO  → continue.

3. Does the identifier hit a Rule 3 KEEP trigger?
   YES → KEEP.
   Does it hit a Rule 3 RENAME trigger?
   YES → RENAME.

4. Is the identifier in the Ambiguity Catalog (Section 6)?
   YES → REVIEW. Do not edit; add a `// TODO(beat-rename): AMBIGUOUS — <reason>` line comment with the decision flag and skip.

5. None of the above matched.
   → REVIEW. Flag the same way.
```

### Naming Transformations

Lower-camel identifiers: `beat` → `step` (preserving plurality and suffix).
- `beatIndex` → `stepIndex`
- `beatNumber` → `stepNumber` (already the canonical name per unification spec)
- `currentBeat` → `currentStep`
- `totalBeats` → `totalSteps`
- `beatCount` → `stepCount`
- `jumpToBeat` → `jumpToStep` (already renamed in some files; verify)
- `animateToBeat` → `animateToStep`
- `animationStartBeat` → `animationStartStep`
- `beatSteps` → `steps` (double-suffix collapses)

PascalCase identifiers: `Beat` → `Step`.
- `BeatData` → `StepData` (collision: `StepData` already exists in app; that's the intended destination — confirmed by sibling spec)
- `BeatKey` → `StepKey`
- `BeatForward` → `StepForward` (within named exception files only)

Hyphen-case filenames follow the same rule: `beat-*.ts` → `step-*.ts`.

**Do not rename:**
- Words inside user-visible strings (`"Beat 1"`, `"beats per minute"`).
- Property names in JSON schemas, Firestore rule names, or MCP tool schemas.
- Git history; commit messages; CHANGELOG entries.

### Collisions

`BeatData` in the app tree already has a sibling `StepData` (from sequence-engine-unification). Renaming `BeatData → StepData` collides. Strategy:

1. If the identifier is already being deleted by sibling spec Phase 2, this wave does nothing.
2. If it survives (different codepath), rename it to `StepData` **after** Phase 2 completion so the symbol table has exactly one `StepData`.

This ordering means **Phase 2 of sequence-engine-unification blocks the tka-types/engine-local waves** of this rename. See Section 8.

### Preserved-Beat Catalog (§7 elsewhere)

Enumerated in Section 7.

## Ambiguity Catalog

These identifiers cannot be auto-classified. The executing model must flag each occurrence for human review, never auto-rename. Every entry below is backed by grep evidence across the codebase.

| Identifier | Occurrences (file:count) | Why ambiguous | Default action |
|---|---|---|---|
| `BeatDuration` / `beatDuration` | `BeatGridCalculator.ts:7`, `DeviceSyncCoordinator.ts:2`, `SequenceAnimationOrchestrator.ts:2`, `PlaybackPositionCalculator.ts:1`, `SequenceStatsCalculator.ts:1`, `SanityChecker.ts:2` | In `BeatGridCalculator` it's `60/bpm` seconds (KEEP). In `SequenceAnimationOrchestrator` + `SequenceStatsCalculator` it may be choreographic step duration (RENAME to `StepDuration`). | REVIEW each file individually. Default: if the function reads `bpm` in the same scope → KEEP. Otherwise → propose RENAME with a per-site comment. |
| `BeatMap` / `beatMap` | `BeatMapEditor.svelte:11`, `BeatMappingView.svelte:10`, `VideoPanel.svelte:10`, `SequenceViewerOrchestrator.svelte:10`, `VideoLab.svelte:8`, `CollaborativeVideoManager.ts:4`, `CollaborativeVideo.ts:2` | The `BeatMap` structure maps sequence-step indices to video timestamps. The map is *between* the two concepts. Austen's intent governs: is the name describing the music-side anchor (KEEP) or the sequence-side target (rename to `StepMap`)? | KEEP as default (the data type's primary purpose is holding timestamps). Flag for a global decision from Austen in the pilot. |
| `beatTimestamps` | `BeatMapEditor.svelte:11`, `BeatMapTimeline.svelte:7`, `SyncedPlaybackView.svelte:4`, `CollaborativeVideoManager.ts:3`, `CollaborativeVideo.ts:3`, `beat-map-utils.ts:3`, `SequenceViewerOrchestrator.svelte:1` | Always paired with `BeatMap`. If `BeatMap` KEEPs, `beatTimestamps` KEEPs. | Locked to `BeatMap` decision. |
| `beatOffset` | `arrange-grid-state.svelte.ts:8`, `CellCanvas.svelte:3`, `ArrangeCompositionConverter.ts:3`, `ArrangeGridPersister.ts:2`, `ArrangeGridSerializer.ts:2`, plus 4 more | In `arrange-*` files it's the per-layer musical offset (KEEP). Verified — `ArrangePlaybackEngine` reads BPM in the same module. | KEEP (all occurrences are inside `arrange/*`, which is KEEP-zoned). Catalog entry exists to document the decision. |
| `beatProgress` | `CollisionDetector.ts:12`, `Avatar3D.svelte:3`, `SaveProgressOverlay.svelte:3`, `SequenceAnimationOrchestrator.ts:2`, `PlaybackPositionCalculator.ts:2`, `PerformerRig.svelte:1` | In `Avatar3D`/`PerformerRig`/`CollisionDetector` it's an interpolation factor *between steps* (RENAME to `stepProgress`). In `SaveProgressOverlay` it's UI progress over total steps (RENAME). | RENAME in all current uses. Catalog entry is a documentation anchor; no human gate. |
| `BeatStart` / `beatStart` | `ChoreoCard.svelte:5`, `ImageComposer.ts:2`, `CellPreWarmer.ts:2`, `PlayWithItInner.svelte:2`, `StepCalculator.ts:1`, `IStepCalculator.ts:1`, `SequenceAnimationOrchestrator.ts:1`, `sequence-transforms.ts:1` | All occurrences in sequence-domain files. Means "step N's starting position" or "sequence-start pictograph". | RENAME universally to `StepStart` / `stepStart`. Catalog entry documents; no human gate. |
| `BeatForward` | `AnimationPlaybackController.ts:2` (`stepHalfBeatForward`, `stepFullBeatForward`) | The prefix `step*BeatForward` is a double-encoding. The `Beat` here means transport sub-tick (half-step or full-step), not music. | RENAME to `stepHalfForward` / `stepFullForward`. Note: `stepHalfBeat` has a deprecated alias already — keep the alias rule: both new and old names exported for one release, old name emits a console warning, removed in next wave. |
| `BeatCount` in SequencePickerModal, animation-export-context, TransportControls, AnimationControlsPanel | 4–9 occurrences per file | When it's `totalBeatCount` on a sequence, it means step count (RENAME). When it's `beatCountOfMusic` or similar, it means music beats (KEEP). | REVIEW per file. Default: if the value is compared against `sequence.steps.length` or similar, RENAME. |
| `getTimePositionForBeat(beat)` | `AnimationPlaybackController.ts:2`, `ISequenceStatsCalculator.ts`, others | Argument is a step index per verified usage. | RENAME to `getTimePositionForStep(step)`. Not ambiguous after review; catalog entry is documentation. |
| `BeatGridItem` | `StepGrid.svelte:4`, `TimelineGrid.svelte:3`, `SpotlightGrid.svelte:3`, `StandardGrid.svelte:2` | In `StepGrid` / `SpotlightGrid` / `StandardGrid` it's a pictograph cell (RENAME to `StepGridItem`). In `TimelineGrid` it might be a BPM beat tick — must read file. | REVIEW `TimelineGrid.svelte` explicitly. All other occurrences RENAME. |
| `beatMarker`, `BeatMarker` | `AudioStateManager.svelte.ts:13`, `BeatGridCalculator.ts:5`, `composition-state.svelte.ts:5`, `BeatGrid.svelte:3`, `composition-types.ts:2`, `composition-helpers.ts:1` | All in compose module, all reference waveform-placed markers. | KEEP. Catalog entry documents the decision so the executor doesn't re-review. |
| `beatIndex` inside `BeatMapTimeline.svelte`, `CollaborativeVideoManager.ts` | ~12 occurrences in video-mapping context | Represents "which sequence step this timestamp anchors to". The *index* is into the sequence (RENAME to `stepIndex`). The surrounding `beat-mapping` directory otherwise KEEPs. | RENAME these specific references even inside KEEP-zoned files. An index into the sequence is a step index. Document the per-file exception. |
| `activeBeatIndex` in `BeatMapTimeline.svelte` | 2 occurrences | Same reasoning as above — index into sequence steps. | RENAME to `activeStepIndex`. |
| `currentBeat` in `arrange-grid-state.svelte.ts` | 4 occurrences | Adjacent to `playbackBpm`, `getTotalBeats()`, `totalBeats` — music playback clock. | KEEP. Documented exception. |
| `stepHalfBeatForward`, `stepFullBeatForward` | `AnimationPlaybackController.ts:2` | See BeatForward row above. | Rename + deprecation alias. |

### Additional Must-Review Identifiers (no default)

Executors must stop and ask Austen if they encounter these patterns outside the files enumerated above:

1. Any identifier combining `beat` with `music`, `audio`, `tempo`, `track`, `clip`, `video`, `sync` tokens anywhere other than a Rule 1 KEEP path.
2. Any identifier combining `beat` with `step`, `sequence`, `pictograph`, `letter`, `motion`, `orientation` tokens *inside* a Rule 1 KEEP path.
3. Any `Beat*` exported from a published package (`packages/*`) that doesn't appear in this spec — publishing renames breaks third-party consumers silently.

## Preserved-Beat Catalog

These files contain `beat` that is always, intentionally, musically correct. Every `beat*` identifier inside them is KEEP unless an Ambiguity Catalog entry or a local-context override fires.

**Source of truth — nothing renames inside these paths without an explicit per-identifier catalog entry:**

### Audio subsystem
- `src/lib/features/compose/compose/phases/audio/` — entire directory.
- `src/lib/features/compose/compose/phases/audio/bpm-analyzer.ts`
- `src/lib/features/compose/compose/phases/audio/audio-persistence.ts`
- `src/lib/features/compose/compose/phases/audio/library/` — all subdirs (AudioTrack, AudioStorage, IAudioStorageManager).
- `src/lib/features/compose/compose/state/managers/AudioStateManager.svelte.ts`
- `src/lib/features/compose/compose/domain/composition-types.ts` — the `BeatMarker` type lives here.
- `src/lib/features/compose/compose/state/composition-state.svelte.ts`
- `src/lib/features/compose/compose/domain/composition-helpers.ts`

### BPM-driven UI controls
- `src/lib/features/compose/components/controls/BpmChips.svelte`
- `src/lib/features/compose/components/controls/QuickBpmPresets.svelte`

### Compose timeline (BPM grid)
- `src/lib/features/compose/timeline/components/BeatGrid.svelte`
- `src/lib/features/compose/timeline/services/BeatGridCalculator.ts`
- `src/lib/features/compose/timeline/` — all remaining files default KEEP, overridden per Ambiguity Catalog.

### Arrange (tunnel composition over music)
- `src/lib/features/compose/tabs/arrange/` — entire tree. `beatOffset`, `currentBeat`, `totalBeats` here all mean musical beats on a BPM-driven clock.

### Video collaboration + beat mapping
- `src/lib/shared/video-collaboration/` — entire tree.
- `src/lib/shared/video-collaboration/domain/CollaborativeVideo.ts`
- `src/lib/shared/video-collaboration/utils/beat-map-utils.ts`
- `src/lib/shared/sequence-viewer/components/beat-mapping/BeatMapEditor.svelte`
- `src/lib/shared/sequence-viewer/components/beat-mapping/BeatMapTimeline.svelte`
- Exception *within* these files: `beatIndex`/`activeBeatIndex` (see Ambiguity Catalog — these are step indices and RENAME).

### Video lab
- `src/lib/features/video/video-lab/views/BeatMappingView.svelte`
- `src/lib/features/video/video-lab/views/VideoLab.svelte` — has `BeatMap` references only.
- `src/lib/features/video/video-lab/views/VideoPanel.svelte`

### Device sync (LAN playback sync)
- `src/lib/shared/device-sync/DeviceSyncCoordinator.ts`
- `src/lib/shared/device-sync/LanSyncCoordinator.ts`
- `src/lib/shared/device-sync/PresenceTracker.ts`
- `src/lib/shared/device-sync/sync-types.ts`
- `src/lib/shared/device-sync/lan-sync-models.ts`

### Animation playback (partial preserve — named exceptions)
- `src/lib/features/compose/services/contracts/IAnimationPlaybackController.ts` — **exception:** step-indexed identifiers inside it RENAME.
- `src/lib/features/compose/services/implementations/AnimationPlaybackController.ts` — **exception:** same.
- `src/lib/features/compose/services/contracts/IVideoPlayer.ts` — KEEP (video time anchors).

### Collaborative video
- `src/lib/shared/video-collaboration/services/CollaborativeVideoManager.ts` — `BeatMap` consumer (KEEP core, exception for step-index fields).
- `src/lib/shared/video-collaboration/services/contracts/ICollaborativeVideoManager.ts`

### Synced playback view
- `src/lib/shared/sequence-viewer/components/SyncedPlaybackView.svelte`

### Hand-authored musical references in JSDoc only
- Any comment that reads "per-beat", "beats per minute", "strong beat", "measure" — preserve comment text verbatim.

**Catalog size:** 34 files / directories are preserve anchors; within them, ~12 specific identifiers (per the Ambiguity Catalog) are local exceptions that RENAME despite the preserve-by-default rule.

**Catalog maintenance:** if a wave discovers a file that should be added to this catalog, the wave's commit includes the catalog update in the same commit as the rename work. The catalog is a living artifact.

## Wave Structure

Work is sliced by **module ownership**, not by directory alphabetically. Each wave:

- Has a bounded file list (50–150 files).
- Is executable by a single cheap-model session start-to-finish.
- Ends with a verification gate (see Section 9).
- Produces one atomic commit.
- Can be reverted via `git revert <wave-commit>` without cascading damage.

| # | Wave | Scope | Est. files | Est. identifiers | Blocks on | Verification |
|---|---|---|---:|---:|---|---|
| 0 | **Pilot** | `src/lib/features/create/shared/domain/models/` | 6–8 | ~80 | — | Tests + check + build; manual review of classification outcomes |
| 1 | `@tka/tka-types` + `@tka/sequence-engine` | `packages/tka-types/`, `packages/sequence-engine/` | ~110 | ~700 | sequence-engine-unification Phase 1 complete | Parity harness bit-identical; engine tests pass |
| 2 | `@tka/domain` + `@tka/render-core` + `@tka/pictograph` | `packages/domain/`, `packages/render-core/`, `packages/pictograph/`, `packages/render-composition/` | ~80 | ~300 | Wave 1 | Package build + tsc clean |
| 3 | Create module — authoring core | `src/lib/features/create/` (excluding the pilot dir already done) | ~180 | ~1,100 | sequence-engine-unification Phase 2 complete | Tests + check + build + manual smoke (author a sequence) |
| 4 | Create module — animation & playback named exceptions | `src/lib/features/compose/services/implementations/AnimationPlaybackController.ts`, `IAnimationPlaybackController.ts`, `AnimationPlaybackControllerFactory.ts`, `IAnimationPlaybackControllerFactory.ts` | 4 | ~100 | Wave 3 | Tests + check + build + manual smoke (play sequence animation) |
| 5 | Sequence viewer + shared sequence domain | `src/lib/shared/sequence-viewer/` (excluding `beat-mapping/`), `src/lib/shared/sequence-*/`, `src/lib/shared/pictograph/` | ~140 | ~800 | Wave 1, Wave 3 | Tests + check + build + manual smoke (open viewer) |
| 6 | Choreo card + sequence thumbnail export | `src/lib/features/choreo-card/`, `src/lib/features/fuse/`, `src/lib/shared/render/`, `src/lib/shared/animation-engine/` (non-audio parts) | ~100 | ~500 | Wave 5 | Tests + check + build + visual regression on card export |
| 7 | Browse, library, gallery-generator | `src/lib/features/browse/`, `src/lib/features/library/`, `src/lib/features/gallery-generator/` | ~70 | ~350 | Wave 5 | Tests + check + build + manual smoke (browse catalog) |
| 8 | Labs & level tools | `src/lib/features/assemble-lab/`, `disassemble-lab/`, `levels/`, `level5-lab/`, `level6-lab/`, `loop-labeler/`, `phrase-effort-lab/`, `effort-lab/`, `mandala-generator/`, `write/` | ~90 | ~300 | Wave 5 | Tests + check + build |
| 9 | Beat-mapping step-index exceptions | `src/lib/shared/sequence-viewer/components/beat-mapping/*` and `src/lib/shared/video-collaboration/**` — rename ONLY the step-index identifiers per Ambiguity Catalog | ~10 | ~30 | Wave 5 | Tests + check + build; manual smoke on beat-map editor |
| 10 | MCP servers + deployment functions | `mcp-server/`, `mcp-server-pkg/`, `deployment/functions/` | ~40 | ~200 | Waves 1–2 | MCP integration test (`generate_sequence` round-trip) + broadcast dry-run |
| 11 | Scripts + tools | `scripts/`, `tools/`, `tests/` top-level | ~30 | ~150 | All above | `npm test` + any script-specific smoke |
| 12 | **Final sweep** | Whole tree | — | ≤ catalog-preserved | All above | Grep audit: every remaining `beat` must be in the catalog |

**Wave sizing rationale:** each wave touches < 200 files and < 1,100 identifiers. A cheap-model executor reading the spec + catalog + classification rules can finish one wave in a single session, including verification.

**Rewriting the catalog mid-wave:** allowed and expected. If Wave N discovers a new preserve site, it appends to Section 7 in the same commit.

## Verification Per Wave

Every wave's commit must pass the following before being pushed:

1. `npm test` — unit + integration tests green. Zero regressions.
2. `npm run check` — svelte-check + tsc clean. Zero new type errors.
3. `npm run build` — production build completes without warnings related to renamed symbols.
4. If the wave touches UI (Waves 3, 5, 6, 7, 9): a manual smoke test against `localhost:5173` per the paths listed in Section 8's verification column.
5. If the wave touches an engine-public symbol (Waves 1, 2): the **parity harness** from the sibling spec runs bit-identical over the 200-sequence corpus.
6. If the wave touches MCP (Wave 10): the MCP round-trip smoke test from sibling spec §4 runs clean.

**No wave ships without all verifications green.** A failed verification is a wave-internal failure — the executing model fixes or reverts within the same session, never defers.

A wave that needs to be split (verifications fail on a subset of files) splits into sub-waves with `-a`, `-b` suffixes on the commit. Never accumulate half-green changes.

## Git Strategy

Austen works on `main` with multiple parallel Claude sessions. Conflicts compound fast. Rules:

1. **One commit per wave.** Never squash across waves; never combine multiple waves into one commit.
2. **Commit message:** `refactor(beat→step): wave <N> — <scope>`. Body lists the paths touched and the verification evidence (test run summary, harness diff summary, smoke test result).
3. **Between waves, the main branch must be buildable.** Pull before starting a wave; rebase onto latest `main` at wave start.
4. **If two waves touch overlapping files** (e.g. Wave 3 and Wave 5 both touch a shared utility): the later wave must rebase on the earlier. The plan orders waves to minimize overlap, but overlap detection is the wave-starter's responsibility.
5. **Never work in a worktree or branch** — this repo's CLAUDE.md and hooks ban it. Main only.
6. **Before starting a wave, check `git status` for other Claude sessions' uncommitted work.** If unrelated modified files are present, ask Austen before touching their directories.
7. **Revert procedure:** `git revert <wave-commit>` on main. A revert is also one commit, same naming: `revert: wave <N> — <reason>`. If a revert cascades into a following wave, the cascade is a separate revert commit.

## Rollback Procedure

Per-wave revert is the primary recovery path. Sequence:

1. Identify the broken wave (verification failed post-merge, prod regression, etc.).
2. `git revert <wave-commit> --no-edit` on main.
3. Run `npm test && npm run check && npm run build` to confirm revert is clean.
4. Commit the revert; push.
5. Post-mortem before re-attempting: what classification rule was wrong? Update Section 4 or Section 6. Then re-plan the wave.

If a reverted wave's downstream consumers already merged, revert them in reverse-dependency order (highest wave number first).

## Testing Strategy

- **Unit tests.** Existing test suite must stay green throughout. Any test that hard-codes a `beat*` identifier in a string assertion must be updated as part of the wave that changes the underlying symbol.
- **Type checks.** `npm run check` is the primary correctness signal. A cheap-model executor can rely on `tsc` + `svelte-check` to catch 95% of bad renames.
- **Parity harness** (from sibling spec) — the single strongest guard against engine regressions. Runs on Waves 1, 2, 10.
- **Visual regression.** For Waves 3, 5, 6, 7: open the relevant UI, verify no visual drift (pictographs render, sequences play, cards export).
- **MCP integration test.** Wave 10 runs the full `generate_sequence` MCP round-trip with known-good inputs and diffs the output against a baseline captured pre-wave.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Executor silently auto-renames an ambiguous identifier | Every Ambiguity Catalog entry REVIEW-defaults. Executor must add a `// TODO(beat-rename)` comment on any REVIEW identifier, then move on. Austen sweeps TODOs in a separate session. |
| Type rename cascades across waves | Section 4 Rule 5 requires `npm run check` clean before a wave completes. Cross-wave type symbols are renamed together (the "transitively in the same wave" rule); if that's impossible, the type rename waits for its full consumer set. |
| Wave merge conflict with in-flight Austen edits | Section 10.6 — check status before starting; rebase at wave start. |
| Published-package consumer breaks from `Beat*` export rename | Section 6 Additional row — any `Beat*` exported from `packages/*` is REVIEW-only. Austen decides per-symbol whether to break or to publish a semver-major. |
| Firestore docs stop deserializing | Non-goal (Section 3). Wire contracts with persisted `beat*` keys are left alone. Any wave that accidentally touches a Firestore schema is reverted. |
| User-visible text drifts | Non-goal (Section 3). UI copy strings are untouched. If a wave edits a string literal, the wave is malformed and must be fixed before commit. |
| "Beat" meaning changes in the sibling unification types after this spec starts | Section 4's terminology anchor pins to the unification spec; if that spec updates, this one updates too. The sibling spec's status "Ready for implementation planning" is stable enough to proceed. |

## Success Criteria

1. After Wave 12, `rg -w beat src/ packages/` returns only entries from the Preserved-Beat Catalog or explicit musical-beat comments.
2. Every identifier describing a sequence step is `step*` / `Step*` across `src/` and `packages/`.
3. Zero test regressions across all 13 waves.
4. `npm run check` returns zero errors at the end of each wave.
5. Parity harness output bit-identical pre-Wave-1 vs post-Wave-12.
6. Ambiguity Catalog TODOs resolved by Austen in dedicated review sessions before Wave 12 gates.

## Open Items for the Implementation Plan

- Pilot wave's exact identifier list (enumerated in the plan).
- Per-wave commit-message template with verification-evidence fields.
- TODO-comment format: `// TODO(beat-rename): AMBIGUOUS — <reason> — <cataloged-id-if-any>`.
- Audit-script sketch for Wave 12 sweep — what constitutes "intentional beat" vs "leaked beat".
- Decision on `BeatMap` global name: KEEP (default in this spec) or RENAME-with-storage-back-compat. Austen call.

## Appendix A — Pilot Retrospective

**Wave 0 ran on 2026-04-20 against `src/lib/features/create/shared/domain/models/`.** Six files audited; 27 `beat` occurrences found; zero identifier-level matches; zero edits applied.

**What the pilot taught us:**

1. **The pilot directory was already migrated.** Every sequence-step identifier in these six files already uses `step*` / `Step*` (`stepIndex`, `stepNumber`, `stepCount`, `StepData`). The only "beat" tokens remaining are JSDoc prose referencing the old concept. Per Non-Goal §3.5, standalone comment-text updates are out of scope. This means Wave 0 did not exercise edit-application — it exercised audit-extraction and classification only. Wave 1 will be the first wave whose outcome proves the rename pipeline end-to-end.
2. **The identifier extractor correctly excluded JSDoc/line comments and string literals.** This matches the spec's Non-Goal §3.5 directive and is critical for every subsequent wave, where prose `beat` mentions vastly outnumber identifier `beat` mentions.
3. **Named-exception override works.** Smoke-tests on `AnimationPlaybackController.ts` (Rule 1 KEEP zone, named-exception override) correctly returned RENAME for step-index identifiers.
4. **Smoke-tested KEEP path works.** `bpm-analyzer.ts` → 2 KEEP (`beatInterval`) via Rule 1. Neutral path classifier not stressed; will be by Waves 6–8.

**Rules that changed:** None. The spec's rule set and catalog behaved correctly against this sample.

**Edge cases surfaced:**

- `msPerBeat` inside `AnimationPlaybackController.ts` (Wave 4 named exception) — the identifier is genuine BPM math (`1000 / speedMultiplier`), not a step index. The named-exception override classified it RENAME, which would be incorrect. Wave 4 must surface this per-identifier during its manual read-through (plan task 4.1 already requires this). Consider adding a Rule-3 KEEP sub-list for `msPerBeat`, `nextHalfBeat` vs `stepHalfBeatForward` in the named-exception files — but this is best handled in Wave 4's own retrospective, not now.
- Directories where rename work has already happened (like the pilot's) will yield empty commits. The project's commit hygiene rule allows this only when the wave boundary needs marking; alternative is to roll the empty wave into Wave 3 as a de-facto no-op. Kept the empty commit for revertability.

**Confidence level in rule set for Wave 1+:** High. The extractor + classifier produced sensible output on every smoke-test sample. Wave 1 (tka-types + sequence-engine) can proceed as planned once sibling-spec Phase 1 lands. The `msPerBeat`-style edge case is Wave 4-local and does not affect Waves 1–3.
