# Stage Choreography System — Design Spec v2

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

```typescript
interface StageChoreography {
  id: string;
  name: string;
  bpm: number;
  stageWidth: number;   // meters
  stageDepth: number;   // meters
  performers: PerformerSlot[];
  formations: Formation[];
  sharedSequenceId: string | null;
}

interface PerformerSlot {
  id: string;
  index: number;
  color: string;
  sequenceId: string | null;  // null = use sharedSequenceId (future)
}

interface Formation {
  id: string;
  beat: number;                     // absolute beat position
  positions: PerformerPose[];
  transition: TransitionConfig;     // how to ARRIVE at this formation
}

interface PerformerPose {
  performerId: string;
  x: number;    // stage coords, meters
  z: number;
  facing: number;  // radians, 0 = facing audience
}

interface TransitionConfig {
  walkStyle: 'crab' | 'direct';
  easing: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
}
```

**Key:** `Formation.transition` describes how performers arrive at THIS formation from the previous one. First formation has no meaningful transition (starting position).

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
- Container: `pointer-events: none`; dots: `pointer-events: all`
- Drag pattern: `pointerdown` → `setPointerCapture` → `pointermove` → `pointerup` (same as `UnifiedTimeline.svelte` scrubber)
- Elements:
  - Stage boundary: dashed rect
  - Grid: subtle lines at 1m intervals
  - Performer dots: 24px circles, performer color fill, white stroke
  - Facing wedge: small triangle on dot edge
  - Path preview: dotted lines to next-formation positions
- Coordinate transform: stage meters → SVG pixels via container dimensions + margins

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
  timeline.setModel({
    rows: [{
      keyframes: formations.map(f => ({ val: f.beat }))
    }]
  });
  // Wire events: onTimeChanged → update playhead, onSelected → select formation
});
```

### Interactions

| Action | `animation-timeline-js` feature |
|--------|-------------------------------|
| Click keyframe | `onSelected` event → select formation |
| Drag keyframe | Built-in drag with snap → retime formation |
| Double-click empty | `onDoubleClick` → add formation at beat |
| Zoom/pan | Built-in mouse wheel + drag |
| Playhead animation | `setTime()` API driven by playback state |

### Right-click context menu

Use existing `ContextMenu.svelte` (bits-ui), triggered by `onContextMenu` event from timeline.

---

## 6. Transition Popover

**Architecture:** Same pattern as `TempoPopover.svelte` — button triggers visibility, popover content positioned via CSS/floating-ui.

**Trigger:** Click gap between two keyframe markers on timeline (or a dedicated "transition settings" button that appears on selection).

**Contents:**
- **Walk style:** Two-button toggle with icons (side-stepping / forward figure)
- **Easing:** 4 curve-icon buttons (linear, ease-in, ease-out, ease-in-out)
- **Duration display:** Read-only — "4 beats (2.0s at 120 BPM)"
- **Preview button:** Plays only this transition segment

---

## 7. Right Sidebar

Grid layout: `grid-template-columns: 1fr clamp(280px, 20vw, 340px)` (same as ArrangeTab).

### Sections (using `CollapsibleSection.svelte`)

**Transport + BPM:**
- `TransportControls` component — reused directly
- `BpmChips` compact variant — reused directly
- Both drive `stage-choreography-state` playback

**Formation Presets:**
- `FormationSelector.svelte` — reused directly (already has Grid, Line, Circle, V-Shape, Diagonal + count-awareness + disabled states)
- Performer count: `ParamSlider` or `StepperCard` (2–8)

**Selected Performer (conditional):**
- Visible when a dot is selected in overlay
- Color swatch + index
- Position fields (x, z) — number inputs
- Facing angle — rotary input or degree stepper
- Future: sequence assignment (disabled in v1)

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
  currentStep: number;          // active formation index
  totalSteps: number;           // formation count
  isPlaying: boolean;
  duration: number;             // total seconds
  elapsed: number;              // current seconds
  beatMarkerPositions: number[]; // normalized [0–1] positions of each formation
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
