# Stage Choreography System — Design Spec v2

> **RUNTIME CORRECTION — 2026-08-20.** The 2D editor and timeline described
> here shipped, but `StageViewer` remained a placeholder and never became the
> proposed `Viewer3DScene` wrapper. The current runtime contract is
> `../active/2026-08-20-stage-performance-runtime-design.md`.

> Multi-performer formation choreography built on top of the existing Scene3D/Viewer3DScene system. Beat-synced transitions, top-down SVG formation editor, walk style controls.

**Supersedes:** `2026-05-25-stage-locomotion-design.md` (rejected — hand-rolled module instead of reusing existing 3D viewer)

---

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | Own module, shared 3D system | Stage mounts Viewer3DScene with stage-specific config — gets performers, props, effects, environments for free |
| Formation editing | SVG overlay on top-down camera | Draggable dots over the 3D canvas in overhead mode; no separate 2D editor tab |
| Camera flip | `camera-controls` `setLookAt()` with transition | Already installed, already handles smooth position+target interpolation. Museum flip pattern as reference for state save/restore |
| Timeline | `animation-timeline-js` wrapped in Svelte | Zero-dep canvas timeline with keyframes, zoom, pan, snap — replaces 1000+ lines of hand-rolled timeline rendering |
| Walk controls | Popover reusing existing popover pattern | Per-transition settings, using same popover architecture as `ViewerPopover`/`TempoPopover` |
| Sequences | Shared sequence in v1 | All performers play the same sequence; data model supports per-performer for future |
| Formation presets | Reuse `FormationSelector` + `@austencloud/scene-3d` presets | `FORMATION_PRESET_INFO`, `PRESET_VALID_COUNTS` already exist |
| Performer count | 2–8, default 4 | Matches existing Viewer3DScene multi-performer support |

---

## 1. Primitive Reuse Map

Every component in this spec either reuses an existing primitive or has explicit justification for being new.

| Need | Existing Primitive | Action |
|------|-------------------|--------|
| Timeline rendering | **`animation-timeline-js`** (npm, zero-dep canvas) | Adopt — wrap in Svelte component. Replaces hand-rolled timeline. |
| Playback context interface | **`UnifiedPlaybackContext`** (`src/lib/shared/timeline/unified-playback-context.ts`) | Implement this interface for stage playback state |
| Transport controls | **`TransportControls.svelte`** (`src/lib/shared/animation-engine/components/controls/`) | Reuse directly |
| BPM controls | **`BpmChips.svelte`** (`src/lib/shared/animation-engine/components/controls/`) | Reuse directly (compact variant) |
| Formation presets | **`FormationSelector.svelte`** (`src/lib/shared/3d/components/controls/`) + `FormationPopover.svelte` | Reuse directly — it already has preset buttons, disabled states, performer count awareness |
| Popover for transition settings | **Existing popover pattern** (e.g. `TempoPopover.svelte`, `ViewerPopover.svelte`) | Follow same architecture — new content, same shell |
| Context menu (right-click chips) | **`ContextMenu.svelte`** (`src/lib/shared/components/context-menu/`) | Reuse directly — bits-ui based, keyboard nav, floating-ui |
| Collapsible sidebar sections | **`CollapsibleSection.svelte`** (`src/lib/features/admin/components/feature-flags/shared/`) | Reuse directly — title, icon, count, defaultOpen, Snippet children |
| SVG dot dragging | **Raw pointer events** (`setPointerCapture` pattern from `UnifiedTimeline.svelte` lines 35-58) | Same pattern — pointerdown/move/up with capture. No library needed for simple 2D. |
| Clip/chip dragging on timeline | **`createClipMove.ts`** (`src/lib/features/compose/timeline/components/clip-interactions/`) | Reference pattern for snapping + drag behavior. `animation-timeline-js` handles this natively. |
| Camera smooth transition | **`camera-controls`** (already installed, `setLookAt(x,y,z, tx,ty,tz, true)`) | Use directly — the `true` param enables smooth transition |
| Camera state save/restore | **`CameraStateSnapshot`** pattern from `viewer-3d-state.svelte.ts` | Extend — save orbit state before flip, restore on return |
| Overlay positioning | **Existing overlay pattern** (`PathLinesOverlay`, `GlyphOverlay`, `Recording3DOverlay`) | Follow same absolute-position-over-canvas approach |
| Chip display for formations | **`MorphChip.svelte`** (`src/lib/shared/foundation/ui/morph-chip/`) | Evaluate — formation chips on timeline may be too specialized. `animation-timeline-js` renders its own keyframe markers natively. |
| Slider for performer count | **`ParamSlider.svelte`** (`src/lib/features/lab/tabs/scene-lab/components/`) or `StepperCard` | Reuse ParamSlider or StepperCard pattern |

**New components justified:**

| New Component | Why it can't reuse existing |
|---------------|---------------------------|
| `StageViewer.svelte` | Thin config wrapper over Viewer3DScene — only 20-30 lines wiring stage state to viewer props. No visual logic. |
| `FormationOverlay.svelte` | SVG overlay with performer dots + facing indicators + path previews. No existing overlay has draggable positioned elements with coordinate transforms. Closest is `PathLinesOverlay` (visual-only, no interaction). |
| `stage-choreography-state.svelte.ts` | Business logic for formation sequencing. Already partially exists; needs cleanup to implement `UnifiedPlaybackContext` interface. |
| `stage-edit-mode.svelte.ts` | UI state (camera mode toggle, selection, drag). ~50 lines. Feature-specific. |
| `stage-types.ts` | Type definitions. Already partially exists. |

---

## 2. Module Structure

```
src/lib/features/stage/
├── StageModule.svelte              # Entry, mounts StageViewer + timeline + sidebar
├── components/
│   ├── StageViewer.svelte          # Thin wrapper: configures Viewer3DScene with stage props
│   ├── FormationOverlay.svelte     # SVG overlay for top-down editing (the ONE new visual component)
│   └── StageTimeline.svelte        # Svelte wrapper around animation-timeline-js canvas
├── state/
│   ├── stage-choreography-state.svelte.ts  # Formations, BPM, playback (implements UnifiedPlaybackContext)
│   └── stage-edit-mode.svelte.ts           # Camera mode, selection, drag state
└── domain/
    └── stage-types.ts              # Type definitions
```

Note: NO new popover, chip, selector, collapsible, context menu, transport, or BPM component. All reused.

---

## 3. Data Model

> **Updated 2026-05-25:** Switched from global-formation model to per-performer marks model, validated via playground prototype. Each performer owns their own path of waypoints ("marks"), each with independent beat timing and walk style. This is more expressive than synchronized global formations and matches industry tools (Pyware, DrillWeaver).

```typescript
interface StageChoreography {
  id: string;
  name: string;
  bpm: number;
  stageWidth: number;   // meters
  stageDepth: number;   // meters
  performers: Performer[];
  sharedSequenceId: string | null;
}

interface Performer {
  id: string;
  index: number;        // 0-7
  label: string;        // 'A'–'H'
  color: string;
  marks: Mark[];        // ordered waypoints — marks[0] is starting position
  sequenceId: string | null;  // null = use sharedSequenceId (future)
}

interface Mark {
  id: string;
  x: number;            // stage coords, meters
  z: number;
  beats: number;        // beats to arrive here from previous mark (0 for starting position)
  walkStyle: 'crab' | 'direct';
  easing: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
}
```

**Key concepts:**
- Performers labeled A–H (letters), marks labeled 1, 2, 3... (numbers) — no collision
- `marks[0]` = starting position (beats=0, no transition)
- Each mark stores its own beat duration and walk style — transitions are per-mark, not global
- Deletion: removing mark 3 reconnects path from mark 2 → mark 4 (standard keyframe behavior)
- Formation presets set all performers' `marks[0]` to preset positions, clearing subsequent marks

---

## 4. Camera Flip & Formation Edit Mode

### Two modes, one canvas

| Mode | Camera | Overlay | Interactions |
|------|--------|---------|--------------|
| **3D View** (default) | Orbit via `camera-controls` | None | Rotate, zoom, pan; watch playback |
| **Formation Edit** | Top-down via `camera-controls.setLookAt()` | FormationOverlay SVG | Drag performers, set facing, see paths |

### Flip mechanics using `camera-controls` (already installed)

```typescript
// Enter top-down
const snapshot = cameraControls.getState(); // save for return
cameraControls.setLookAt(
  stageCenter.x, 15, stageCenter.z,    // position: 15m above center
  stageCenter.x, 0, stageCenter.z,     // target: looking down at stage
  true                                   // enable smooth transition
);

// Return to 3D
cameraControls.setState(snapshot, true); // restore with transition
```

No custom lerp/slerp needed. `camera-controls` handles interpolation natively. Reference `museum-camera-flip-controller.ts` only for the UX pattern (save state → flip → restore), not for math.

### Toggle: Button in toolbar above canvas. Keyboard: `T`.

### FormationOverlay SVG (the one genuinely new visual component)

- Absolute-positioned `<svg>` over Threlte canvas (same pattern as `PathLinesOverlay`, `Recording3DOverlay`)
- Container: `pointer-events: none`; dots/marks: `pointer-events: all`
- Drag pattern: `pointerdown` → `setPointerCapture` → `pointermove` → `pointerup` (same as `UnifiedTimeline.svelte` scrubber)
- Elements:
  - Stage boundary: rounded rect with double-ring border
  - Grid: dot grid at 1m intervals (not lines — validated in playground)
  - Center crosshair: subtle dashed guides
  - Performer origin dots: 48px touch targets, performer color fill, letter label (A–H)
  - Path marks: numbered 1, 2, 3..., smaller radius, same color as parent performer
  - Path lines: solid when selected, dashed when not
  - Beat labels: "4b" midpoint between marks (visible when performer selected)
  - Walk style indicator: ⇄ icon below crab-walk marks
- Coordinate transform: stage meters → SVG pixels via container dimensions + margins
- Selection: click performer button or origin dot → enter per-performer mode → click stage to place marks
- Multi-select: Shift+click performer buttons → alignment toolbar (top/mid/btm, left/ctr/right, distribute H/V)
- Accessibility: 48px touch targets, 16px min font, AAA contrast (7:1+), focus-visible rings, prefers-reduced-motion, ARIA landmarks + aria-pressed toggles

---

## 5. Beat-Grid Timeline (`animation-timeline-js`)

### Why adopt over hand-rolling

The compose module's `TimelinePanel` is a full NLE editor (tracks, clips, media browser) — wrong abstraction for formation keyframes. `UnifiedTimeline` is a simple scrubber, too simple for a beat-grid with formation markers. `animation-timeline-js` is purpose-built: canvas-rendered keyframe timeline with zoom, pan, snap, drag-select, virtual rendering. Zero deps. Wrapping it in Svelte is ~100 lines.

### Integration

```typescript
// StageTimeline.svelte — thin Svelte wrapper
import { Timeline } from 'animation-timeline-js';

let container: HTMLDivElement;
$effect(() => {
  const timeline = new Timeline({ id: container });
  // One row per performer — each row's keyframes are that performer's marks
  timeline.setModel({
    rows: choreography.performers.map(p => ({
      keyframes: p.marks.slice(1).map(m => ({
        val: accumulatedBeat(p, m)  // absolute beat position
      }))
    }))
  });
  // Wire events: onTimeChanged → update playhead, onSelected → select mark
});
```

### Interactions

| Action | `animation-timeline-js` feature |
|--------|-------------------------------|
| Click keyframe | `onSelected` event → select mark on that performer's row |
| Drag keyframe | Built-in drag with snap → retime mark (update beats) |
| Double-click empty | `onDoubleClick` → add mark at beat position |
| Zoom/pan | Built-in mouse wheel + drag |
| Playhead animation | `setTime()` API driven by playback state |

### Right-click context menu

Use existing `ContextMenu.svelte` (bits-ui), triggered by `onContextMenu` event from timeline.

---

## 6. Mark Properties (replaces Transition Popover)

> **Updated:** With per-performer marks model, transition properties (walk style, easing, beats) live on each Mark directly, not in a separate popover. The sidebar shows these when a mark is selected.

**When a mark is selected in the overlay or timeline, the sidebar "Mark" section shows:**
- **Header:** "A — Mark 3" (performer letter + mark number)
- **Beats to arrive:** Stepper (1–32), default 4
- **Walk style:** Two-button toggle (Direct / Crab) with `aria-pressed`
- **Easing:** 4 buttons (linear, ease-in, ease-out, ease-in-out) — v1 ships with Direct/Crab only, easing future
- **Position:** Read-only coordinate display (x, z in meters)
- **Delete Mark:** Danger button, reconnects path

---

## 7. Right Sidebar

Grid layout: `grid-template-columns: 1fr clamp(340px, 25vw, 480px)` (validated in playground — wider than ArrangeTab to accommodate 16px minimum text).

### Sections (using `CollapsibleSection.svelte`)

**Performers:**
- Performer buttons A–H, 48px touch targets, performer color
- Add/remove buttons (1–8 range)
- Shift+click for multi-select → alignment toolbar appears
- Alignment: Top/Mid/Btm, Left/Ctr/Right, Distribute H/V (operates on each performer's last mark)

**Transport + BPM:**
- `TransportControls` component — reused directly
- `BpmChips` compact variant — reused directly
- Both drive `stage-choreography-state` playback

**Formation Presets:**
- `FormationSelector.svelte` — reused directly (already has Grid, Line, Circle, V-Shape, Diagonal + count-awareness + disabled states)
- Applying a preset resets all paths to single mark at preset positions

**Selected Mark (conditional):**
- Visible when a mark is clicked in overlay or timeline
- Header: performer letter + mark number (gradient text)
- Beats stepper (1–32)
- Walk style toggle (Direct/Crab) with `aria-pressed`
- Position display (x, z in meters, read-only)
- Delete Mark button
- Future: facing angle, easing curve, sequence assignment

**Stage Settings (collapsible):**
- Dimensions: width × depth
- Environment picker (existing scene environments)
- Grid visibility toggle

---

## 8. Playback Engine

### Implementing `UnifiedPlaybackContext`

`stage-choreography-state.svelte.ts` implements the `UnifiedPlaybackContext` interface so that `UnifiedTimeline.svelte` and `TransportControls` can drive it directly without adapter code:

```typescript
// stage-choreography-state satisfies:
interface UnifiedPlaybackContext {
  overallProgress: number;      // 0–1 across entire choreography
  currentStep: number;          // active mark index (longest performer path)
  totalSteps: number;           // max mark count across all performers
  isPlaying: boolean;
  duration: number;             // total seconds (derived from max accumulated beats / BPM)
  elapsed: number;              // current seconds
  beatMarkerPositions: number[]; // normalized [0–1] positions of marks on longest path
  bpm: number;
  seek(progress: number): void;
  togglePlay(): void;
  onBpmChange(bpm: number): void;
}
```

### Walk style interpolation

- **Direct:** Lerp position. Slerp facing toward movement vector. Performer rotates to face where they're walking.
- **Crab:** Lerp position. Facing stays fixed at 0 (toward audience). Performer sidesteps.
- **Easing:** Applied to `t` parameter before interpolation.

### Animation layers

- Upper body: shared sequence's prop animations (continuous)
- Lower body: walk cycle clip, speed ∝ distance/duration. At rest: idle.
- Root motion from formations overrides sequence root motion

### Integration with Viewer3DScene

`StageViewer` passes interpolated `[x, z]` positions into Viewer3DScene's performer position system. The exact binding depends on how `viewer-3d-state` exposes performer transforms — implementation reads that API and wires accordingly. `camera-controls` already installed handles all camera work.

---

## 9. External Dependencies

| Package | Status | Purpose |
|---------|--------|---------|
| `camera-controls` | Already installed | Smooth camera transitions, setLookAt, state save/restore |
| `@austencloud/scene-3d` | Already installed | FormationPreset types, FORMATION_PRESET_INFO, PRESET_VALID_COUNTS |
| `@threlte/core` + `@threlte/extras` | Already installed | 3D rendering, Canvas, transitions |
| `animation-timeline-js` | **NEW — to install** | Canvas-based timeline with keyframes. Zero deps, ~50KB. |
| `svelte-dnd-action` | Already installed | NOT used here (list DnD, not canvas drag) |
| `bits-ui` | Already installed | Context menu foundation (already used by ContextMenu.svelte) |

Only ONE new dependency: `animation-timeline-js`.

---

## 10. Out of Scope (v1)

- Per-performer sequences
- Curved/bezier paths
- Formation groups / sub-groups
- Audio waveform / sync
- Video export
- Undo/redo
- Stage markers / labels
- Audience perspective camera
- Loop playback
- Formation mirroring
- Collision avoidance
- @recast-navigation/three pathfinding (future — when performers need obstacle-aware paths)

---

## 11. Future Extensions (architecture-ready, not built)

- **Per-performer sequences:** `PerformerSlot.sequenceId` field exists
- **Curved paths:** Add `pathType` + control points to `TransitionConfig`
- **Undo/redo:** Command pattern wrapping state mutations
- **Audio sync:** `audioUrl` + waveform behind timeline (wavesurfer.js regions plugin)
- **Pathfinding:** `@recast-navigation/three` for obstacle-aware movement
