# Practice Strip Mode — Read-Ahead Beat-Lane for Focused Practice

**Date:** 2026-06-27
**Status:** Design — awaiting review
**Area:** `src/lib/shared/sequence-viewer/`, `src/lib/shared/timeline/`
**Builds on:** `2026-06-26-practice-focused-mode-design.md` (cockpit bar), `2026-06-24-viewer-practice-restore-design.md`
**Phase:** A of the practice rehaul. Phase C (camera-sensed scoring, the `features/train` direction) is the eventual north star and explicitly out of scope here.

## Problem

Focused practice (the in-flight cockpit-bar work) still visualizes the sequence as **side-by-side**: the animation canvas next to a static ChoreoCard grid, with a highlight border chasing the active beat across the grid (`ViewerSplitPane.svelte` → `highlightedStepIndex`). For practice this is the wrong cognitive model:

- Two focal points — big canvas + small side card — so the eye darts.
- The highlight is **reactive**: you watch the canvas, the border lags behind it.
- No read-ahead — you can't see what's coming, only where you are.

The landing "Infinite Spinner" proved a better model: a **focus-locked read-ahead strip** (active pictograph pinned center under a gold frame, the track slides one cell per beat). It's single-focal and predictive — the next move slides *toward* you. That's the rhythm-game (Guitar Hero / DDR) mechanic, and the user confirmed it reads better than side-by-side for practice.

## Decisions (locked with user)

- **Strip replaces side-by-side** as the content of focused practice. Not a new route/module.
- **Composes with the cockpit bar**, doesn't replace it. The cockpit bar (`2026-06-26` spec) owns the bottom transport (exit · play/pause · BPM · loop dots · Level Up) and the focused chrome. This spec owns the **content area** above it. Separate seams.
- **Hero is C-lane**: full-stage animation canvas + a read-ahead beat-lane. Canvas never disappears — it's the live motion feedback.
- **User-adjustable**, not a fixed ratio:
  - **Split preset** between canvas and lane — `lane-heavy` (default) · `balanced` · `canvas-heavy`.
  - **Read-ahead depth** — how many upcoming moves are visible (`1` / `2` / `3+`), driven by the lane's cell size (zoom).
- **Beat-pulse** on the focus frame, synced to the beat — the rhythm tell.
- **Feel-only.** No scoring, no hit-detection, no audio/haptic metronome (Phase A).
- The landing strip is **extracted to a shared component**; the landing keeps identical behavior.

## Design

### Layout — `PracticeStage.svelte` (new)

The focused-practice content host. Rendered by the viewer hosts when `practiceActive` **instead of** the side-by-side split. A vertical stack inside the focused viewport, above the docked cockpit bar:

1. **`AnimatorCanvas`** (full-stage) — reuses the `progressLine` + `tapToToggle` props shipped 2026-06-27. Live motion + the minimal export-style progress foot; tap toggles play. This is the "excellent feedback" half.
2. **`BeatStrip`** (new shared component, below) — the read-ahead lane.
3. A small **stage-controls** overlay (split preset + read-ahead stepper) — see Controls.

The split between canvas and lane is a **flex ratio** set by the split preset:

| Preset | Canvas | Lane |
|---|---|---|
| `lane-heavy` (default) | ~38% | ~62% |
| `balanced` | ~55% | ~45% |
| `canvas-heavy` | ~72% | ~28% |

Canvas is `flex` with `min-height: 0` (it squares to whatever the ratio gives it, same as the landing fit work). Lane takes the rest. Ratios are tunable during build against real proportions — the table is the starting point, not a contract.

### `BeatStrip.svelte` (new, shared) — extracted from the landing

Lift the focus-locked carousel out of `PlayWithItInner.svelte` (the `beatStripBlock` snippet + `.beat-viewport`/`.beat-track`/`.beat-focus` + the `trackX`/`activeIndex`/`visibleRange`/`cellOpacity`/`cellScale` state) into `src/lib/shared/timeline/BeatStrip.svelte` (next to `UnifiedTimeline`).

**Props:**

```ts
{
  cells: NotationCell[];        // start + each beat: { key, data, label, isStart, stepNumber }
  currentStep: number;          // float from playback (integer = step, fraction = progress)
  bpm: number;                  // drives slide duration (60/bpm * 0.5, clamped 0.12–0.42s)
  cellSize?: number;            // default 72; smaller = more read-ahead visible (zoom)
  bluePropType?: PropType;
  redPropType?: PropType;
  beatPulse?: boolean;          // default false; pulse the focus frame on integer-step crossings
  onCellClick?: (index: number) => void;  // optional seek (practice: jump to a move)
}
```

`STRIDE`, `FRAME`, and `BUFFER` derive from `cellSize` (currently hardcoded). The hero scale, spotlight opacity/scale, virtualization window, soft-edge mask, and BPM-tied slide duration carry over verbatim. `NotationCell` moves to a shared type so both consumers share it.

**Read-ahead depth = cellSize.** Smaller cells → more cells fit the lane width → you see further ahead. The stepper maps `1 / 2 / 3+` ahead to concrete `cellSize` values (e.g. 96 / 72 / 52), tuned against the real lane width during build.

**Beat-pulse.** When `beatPulse`, flash the `.beat-focus` frame each time `Math.floor(currentStep)` increments (a short scale/glow on the gold frame). Pure CSS keyed off the step change. Respects `prefers-reduced-motion` (no pulse).

### Controls — split + zoom (seam-safe)

Split preset + read-ahead stepper live as a **compact overlay on the stage** (e.g. top-right of the lane) and are mirrored in the existing **`PracticeConfigPopover.svelte`**. They do **not** go in the cockpit bar — that file belongs to the `2026-06-26` spec. Button + toggle-indicator only (no checkboxes, no dropdowns; 44px targets; `SegmentedControl` for the 3-way split preset, a stepper for read-ahead).

### State

Split preset + read-ahead depth are practice view-prefs. Persist them in the practice config store (`tempo-practice-state.svelte.ts`, already `localStorage`-backed under `tka-practice-config`) alongside `progressionMode`, so they survive sessions with the rest of the practice settings. No new state machine.

### Data flow

```
playbackController.currentStep (float)  ─┐
tempo-practice-orchestrator (bpm, loops) ─┼─► PracticeStage ─► BeatStrip (view)
practice config (split, readAhead)       ─┘                └─► AnimatorCanvas (progressLine, tapToToggle)
```

`BeatStrip` is a pure view over playback + config — no engine ownership, no lifecycle. `PracticeStage` reads the same playback/orchestrator the cockpit bar reads; it doesn't fork playback.

## Reuse (never-hand-roll)

- **`AnimatorCanvas`** — reused as-is with `progressLine` + `tapToToggle` (shipped 2026-06-27). No new canvas.
- **Tempo orchestrator** (`tempo-practice-orchestrator.ts`) — unchanged; still owns BPM ramp + progression. The strip is orthogonal (it shows *which* move; the orchestrator owns *how fast*).
- **Carousel logic** — extracted, not rewritten. Landing is refactored to consume the shared `BeatStrip` with **no behavior change** (verify by before/after screenshot at iPhone SE).
- **`currentStep` float** — already exposed by the playback controller; no new plumbing.
- **`SegmentedControl`** for the split preset (the canonical single-select primitive).

## Files

**New:**
- `src/lib/shared/timeline/BeatStrip.svelte` — extracted focus-locked carousel. (Grep: no shared beat-strip/playhead-carousel primitive exists; `pattern-strip/` is for editing sequences, not playback progress.)
- `src/lib/shared/sequence-viewer/components/PracticeStage.svelte` — focused-practice content: canvas + BeatStrip + stage-controls.

**Modify:**
- `src/routes/landing/components/PlayWithItInner.svelte` — consume `BeatStrip`; drop the inlined carousel. No visual change.
- `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte` — render `PracticeStage` instead of side-by-side when `practiceActive`. **(Seam: the `2026-06-26` cockpit spec also edits this file for the bottom bar / rail-hide. Coordinate — different regions.)**
- `src/routes/sequence/[id]/+page.svelte` — same content swap. **(Same seam caveat.)**
- `src/lib/shared/sequence-viewer/state/tempo-practice-state.svelte.ts` — persist `splitPreset` + `readAheadDepth`.
- `src/lib/shared/sequence-viewer/components/PracticeConfigPopover.svelte` — mirror split + read-ahead controls.

**Shared type:** move `NotationCell` to a shared location both consumers import.

## Seam coordination

The `2026-06-26` cockpit-bar spec and this spec both touch `SequenceViewerDrawerHost.svelte` and `routes/sequence/[id]/+page.svelte`. They edit different regions — cockpit edits the **bottom bar + rail visibility**; this edits the **content area** (side-by-side → `PracticeStage`). The plan must sequence these so they don't collide. If the cockpit bar is mid-build by another agent, land that first (or merge carefully on the shared hosts). Do **not** edit the cockpit bar's `PracticeBar.svelte` or its bottom-bar wiring here.

## Verification

- Landing Infinite Spinner unchanged after the `BeatStrip` extraction — before/after screenshot at iPhone SE (375), DOM check that the strip cells/slide behave identically.
- Enter practice in the viewer → side-by-side is gone, `PracticeStage` fills the focused content, cockpit bar still docked below.
- Split presets re-flow canvas/lane; read-ahead stepper changes how many upcoming moves show; both persist across reload.
- Beat-pulse flashes the focus frame on each step at the set BPM; off under `prefers-reduced-motion`.
- Tap the canvas toggles play; progress foot tracks the loop.
- `npm run check` green.

## Out of scope (Phase A)

- Scoring / hit-detection / combos — Phase C, the `features/train` camera track.
- Audio + haptic metronome — also out per the cockpit spec.
- `features/train` module wiring — separate surface; not touched here.
- A separate practice route — focused state only, per the cockpit spec.
