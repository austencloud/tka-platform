# Practice Consolidation — Viewer Becomes the Single Practice Home

**Date:** 2026-07-01
**Type:** Design + Decision Record (doubles as ADR-style guardrail)
**Status:** Approved (roadmap; execution gated on viewer-practice progress)

---

## Summary

TKA has **two** practice surfaces that evolved independently and share **zero**
tracking primitives:

1. **Standalone Train module** (`/train`) — webcam + MediaPipe hand-tracking that
   *judges* your motion into a grade.
2. **Viewer practice** (inside the sequence viewer) — tempo-ramp *play-along* that
   helps you go faster, with no judgment.

Decision: **the sequence viewer becomes the one practice home.** Train stops being
a *standalone destination you navigate to* and becomes a *component reservoir the
viewer consumes*. Nothing is deleted. The only thing that eventually disappears is
the `/train` nav entry — and only as the **final** step, after the viewer has
absorbed every capability worth keeping (no dead window, no feature-loss interim).

### Why

- Viewer practice is **zero-friction**: no camera permission, no standing back, no
  MediaPipe load — it runs in-context on any single sequence you are already
  viewing. It is how most users will actually practice.
- Train is **high-friction**, and its payoff (accurate CV scoring) is exactly the
  part that was never finished (see Parity Gap #3). The friction is paid up front;
  the reward is unbuilt.
- The MediaPipe hand-tracking pipeline is **expensive to rebuild** and is the one
  crown jewel worth preserving regardless of where practice lives.

---

## Current state (audited 2026-07-01, three parallel scouts)

### Standalone Train module

- **Registered + reachable**, `isMain: true` (NOT orphaned):
  - `src/lib/shared/navigation/config/module-definitions.ts:205-214` — `train`
    module, label "Train", "Practice with real-time scoring"
  - `src/lib/shared/navigation/config/tab-definitions.ts:264-283` — two tabs:
    `practice` + `progress`
  - `src/routes/+layout.svelte:125` — lazy loader for `TrainModule.svelte`
- **UI** (~30 components under `src/lib/features/train/components/`): root router
  `TrainModule.svelte`; `practice/` bento layout (`PracticeBentoLayout`,
  `CameraSection`, `GridSection`, `CanvasSection`, `ControlBar`); feedback
  (`PerformanceFeedbackPanel`, `ResultsScreen`, `StatusPanel`); config sheets
  (`ModePickerSheet`, `ModeSettingsSheet`, `AdaptiveModeConfig`, `StepModeConfig`,
  `TimedModeConfig`, `GridSettingsSheet`); progress (`StatsOverview`,
  `PersonalBests`, `SessionHistory`).
- **Detection pipeline** (headless, `src/lib/features/train/services/`):
  `media-pipe-detector.ts`, `hand-landmarker.ts`, `hand-assigner.ts`,
  `hand-state-analyzer.ts`, `hand-tracking-stabilizer.ts`,
  `handedness-analyzer.ts`, `quadrant-mapper.ts` + factory getters.
- **State/persistence**: `train-state.svelte.ts`, `train-practice-state.svelte.ts`;
  `session-completion-processor.ts`, `performance-history-tracker.ts`; IndexedDB
  `trainPerformances` table (`src/lib/shared/persistence/database/tka-database.ts`,
  models in `train-database-models.ts`).
- **Coarse loop works, deep tracking stubbed**: binary quadrant hit/miss → combo →
  score → S/A/B/C/D/F grade → IndexedDB → progress dashboard. But **zero timing
  tolerance, no early/late, no per-step accuracy**:
  `beatResultsJson` hardcoded `"[]"` (`session-completion-processor.ts:70`),
  `lastPerformance` never set (`train-state.svelte.ts:85`),
  `StoredBeatResult` (`train-database-models.ts:46-52`) and
  `isQuadrantCorrect(…, tolerance)` (`quadrant-mapper.ts:99-105`) defined but
  **never called**.

### Viewer practice (already invested — 7-spec family, 2026-06-24 → 06-29)

- **Entry** from any single sequence: Practice button in
  `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte`
  (desktop :455, mobile :414) → `ctx.enterPracticeMode()`.
- **A.1 shipped**: strip read-ahead lane (`PracticeLanePane.svelte` wrapping
  `StepStrip`), tempo ramp (Creep / Staircase / Custom), metronome, hold; cockpit
  bars (`PracticeSetupBar`, `PracticeBar`); count-in overlay. Fully wired into
  `ViewerSplitPane.svelte` (responsive split, glide transitions).
- **Tracks BPM only, by deliberate design.** From
  `2026-06-24-viewer-practice-restore-design.md:50-52`: personal best was cut as
  "a hollow, gameable metric" (no props tracking). **No scoring, no hit detection,
  no camera** wired.
- **CameraManager built, NOT wired**: `src/lib/shared/train/services/camera-manager.ts`
  (enumerate/start/stop/switch/`captureFrame`). Memory notes an "AR mirror" (webcam
  behind transparent canvas) planned for A.2. Not imported by any viewer component
  yet.

### Overlap

| Concern            | Train module        | Viewer practice          |
| ------------------ | ------------------- | ------------------------ |
| Hit detection      | MediaPipe CV        | none                     |
| Scoring / grades   | yes (shallow)       | deliberately cut         |
| Camera             | full pipeline       | CameraManager built, unwired |
| Persistence        | IndexedDB results   | localStorage config only |
| State factory      | `TrainState`        | `TempoPracticeState`     |
| UI                 | bento layout        | cockpit bar              |

**Zero shared tracking primitives.** Two philosophies: Train *judges*; viewer
*helps you play along*.

---

## Decision detail

### Preserve as reservoir (untouched now; consumed by the viewer later)

All four UI groups **and** the pipeline are kept — confirmed keep-all:

- **Detection pipeline** (headless): the seven `features/train/services/*` files +
  getters; `camera-manager.ts` already in `shared/train/services/`.
- **AR overlay UI**: `CameraSection.svelte` + `GridSection.svelte` — the strongest
  reuse candidate; this *is* what the viewer AR mirror wants. Reuse, do not rebuild.
- **3-mode config UI**: ModePicker + Timed/Step/Adaptive settings sheets.
- **Scoring feedback UI**: `PerformanceFeedbackPanel`, `ResultsScreen`, `StatusPanel`.
- **Progress / history**: `StatsOverview`, `PersonalBests`, `SessionHistory` +
  `performance-history-tracker.ts` + the IndexedDB `trainPerformances` table.

### Retires LAST — the standalone shell only

Removed **only** at the final phase, once parity is reached:

- `module-definitions.ts:205-214` (train entry)
- `tab-definitions.ts:264-283` (practice + progress tabs)
- `+layout.svelte:125` (loader)
- `TrainModule.svelte` top router + standalone orchestration wrappers
  (`PracticePanel`, `TrainModePanel`, `PracticeBentoLayout`) that only exist to run
  the destination.

---

## Parity gap — the retirement gate

`/train` may be pulled **only** when the viewer has absorbed all of:

1. **AR mirror wired** — `CameraManager` behind the viewer canvas (passive
   self-observation). (A.2 partial.)
2. **Camera + grid overlay reused** in the viewer (`CameraSection` / `GridSection`
   composed, not rebuilt).
3. **CV hit-detection wired to the viewer step timeline** — the long road the user
   named ("a long way before we do"): frame→step correlation, timing windows,
   tolerance (`isQuadrantCorrect` finally called), confidence gating, and real
   `beatResultsJson` population. This is the "complex tracking we never finished."
4. **Scoring feedback + results reachable in the viewer**
   (`PerformanceFeedbackPanel` / `ResultsScreen`).
5. **Progress / history reachable** from the viewer or a stats home
   (dashboard + `performance-history-tracker` keep their IndexedDB source).
6. **3-mode config reconciled** with the viewer's cockpit presets — decide whether
   Timed/Step/Adaptive fold into the tempo cockpit or become a scored-mode toggle.

---

## Phased absorption roadmap

Execution of P1+ is **gated on viewer-practice progress** (A.2 and the deep
tracking). This doc sequences the work; it does not front-load it.

- **P0 (now) — decision record + guardrail.** Zero code removed. This spec plus a
  reservoir note (see Guardrail) mark `/train` "legacy, retire-last" and the
  two-doors state as intentional-temporary. Promote the viewer as the primary
  practice entry in product framing.
- **P1 — AR mirror.** Relocate the detection pipeline + AR overlay UI to a shared
  location; wire the passive AR mirror into the viewer (camera behind canvas, no
  scoring).
- **P2 — deep tracking.** Wire CV hit-detection to the viewer step timeline and
  build the real per-step accuracy tracking (frame→step, timing deltas, tolerance,
  confidence). Populate `beatResultsJson` for real. *(The long-horizon part.)*
- **P3 — scoring surface.** Bring scoring feedback + results + progress/history
  into the viewer, reachable in-context.
- **P4 — mode reconciliation.** Resolve 3-mode config vs the viewer cockpit.
- **P5 — retire.** Remove the `/train` nav entry + standalone shell. The viewer is
  the sole practice home.

---

## Guardrail (why this doc exists)

The Train module currently reads *orphan-able* — a future agent could delete it the
way `AssembleLabModule` was retired. It must not be. Until P5, Train's components
and pipeline are a **live reservoir** feeding an in-progress migration. Treat any
`features/train/**` deletion as a violation of this spec. The presence of two
practice entry points is **intentional and temporary**, not drift to be "cleaned
up."

---

## Related

- Viewer practice spec family: `2026-06-24-viewer-practice-restore-design.md`,
  `2026-06-26-practice-focused-mode-design.md`,
  `2026-06-27-practice-strip-mode-design.md`,
  `2026-06-27-practice-setup-flow-design.md`,
  `2026-06-28-practice-metronome-design.md`,
  `2026-06-29-practice-setup-bottom-bar-design.md`,
  `2026-06-29-practice-entry-button-design.md`
- Memory: `project_practice_rehaul`, `project_practice_camera_overlay`
- Rules: `never-hand-roll.md` (reservoir = don't rebuild what's preserved),
  `feedback_write_adrs_for_high_value_decisions`
