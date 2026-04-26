# Compose Cell Editor Redesign

**Date:** 2026-03-28
**Status:** Approved
**Module:** Compose → ArrangeTab

## Problem

The current CellEditor sidebar presents 8 transform buttons in a flat 4×2 grid of identical gray rectangles. All controls are the same size, shape, and color. There's no visual hierarchy, no feedback on current state, and no room to grow. The data model already supports per-cell trail settings, effects, and timing that aren't exposed in the UI. The panel needs to become a proper creative tool that surfaces per-cell configuration with clear feedback and room for expansion.

## Design: Hybrid Chip Dashboard

A compact sidebar where **chips show current state at a glance** and **expand inline to reveal full controls**. Only one section expands at a time. Active chips glow with their associated color so you can scan a cell's configuration without opening anything.

### Panel Structure (top to bottom)

#### 1. Header

`Cell {N}` with grid size badge (e.g. "2×2"), layer count ratio (e.g. "1/4"), and close button.

#### 2. Layer Section

- **Layer chip** — prop color dots (blue/red), sequence word, beat count, layer number. Action buttons: copy, remove.
- **Add Layer** button (dashed green border, shows count: "Add Layer (2/4)")
- **Paste** button (dashed purple border, visible when clipboard has data)

#### 3. Control Chips Grid

A flex-wrap grid of pill-shaped chips. Each chip shows an icon, the current value, and optionally a chevron indicating it expands.

| Chip | Icon | Default Display | Expands? | Active Color |
|------|------|----------------|----------|-------------|
| Transform | `fa-rotate` | "Transform" | Yes (chevron) | — |
| Speed | `fa-gauge-high` | "1.0x" | Yes (chevron) | — |
| Effects | `fa-wind` | "Trails: Fade" | Yes (chevron) | Orange |
| Blue Visibility | `fa-eye` / `fa-eye-slash` | "Blue" | No (direct toggle) | Blue (#5b9aff) |
| Red Visibility | `fa-eye` / `fa-eye-slash` | "Red" | No (direct toggle) | Red (#f87171) |
| Effort | Colored dot | "Effort: Flow" | Yes (chevron) | Purple |
| Beat Offset | `fa-drum` | "Offset: 0" | Yes (chevron) | — |
| Display | `fa-film` | "Animation" | Yes (chevron) | — |

**Chip states:**
- **Default** — `rgba(255,255,255,0.05)` background, `rgba(255,255,255,0.08)` border
- **Active** — tinted background and border matching the control's semantic color
- **Muted** (visibility OFF) — near-transparent, dimmed icon with `fa-eye-slash`

**Interaction rules:**
- **Blue/Red visibility** — single tap toggles. No expansion needed.
- **All others** — tap to expand controls inline below the chip grid. Tapping another chip closes the current section and opens the new one.
- **"Done" button** in each expanded section closes it.

#### 4. Expanded Sections

Each section animates in with a slide-down (180ms ease-out).

##### Transform

Three sub-groups:

**Apply To** — segmented control: Left | Both | Right. Determines which hand(s) transforms affect. Default: Both.

**Rotate** — two-button strip:
- 45° L (`fa-rotate-left`)
- 45° R (`fa-rotate-right`)

Each tap applies a cumulative 45° rotation. Multiple taps stack.

**Rearrange** — 2×3 grid, each button color-coded with an icon badge and short description:

| Button | Icon | Color | Description | Hotkey |
|--------|------|-------|-------------|--------|
| Mirror | `fa-left-right` | Blue (#60a5fa) | Flip left/right | M |
| Flip | `fa-up-down` | Purple (#a78bfa) | Flip top/bottom | V |
| Swap | `fa-right-left` | Pink (#fb7185) | Switch hands | S |
| Invert | `fa-circle-half-stroke` | Gold (#fbbf24) | Reverse direction | I |
| Shift Start | `fa-step-backward` | Indigo (#818cf8) | Advance starting beat | F |
| Rewind | `fa-backward` | Green (#34d399) | Play backwards | ⇧R |

##### Speed Multiplier

- Large numeric display (e.g. "1.0x")
- Slider: 0.25x to 2.0x range
- Preset buttons: 0.25x, 0.5x, 1.0x, 1.5x, 2.0x

Speed is a multiplier of the global BPM. All cells reset together at loop boundaries. A cell at 0.5x plays half as fast; at 2.0x, double speed. Cells drift within a loop but re-sync at the loop point.

##### Effects

Radio-style chip options: None, Fire, Charcoal, LED, Trails.

When Trails is selected, a sub-group appears with trail mode options: Fade, Persistent, Loop Clear.

##### Effort

8 color-coded chip options matching the existing effort presets. Each shows a colored dot and label.

##### Beat Offset

+/– stepper with large numeric display. Offsets the cell's playback start relative to the global timeline. Unit: beats.

##### Display Mode

Radio-style options: Animation, Choreo Card. (Choreo Card only available for single-layer cells, matching current behavior.)

#### 5. Footer

- **Copy All** — copies entire cell configuration
- **Clear All** — removes all layers and resets cell (red/danger styling)

### Touch Targets

All interactive elements meet 44px minimum height (WCAG AAA). This applies to:
- Chips (min-height: 44px)
- Transform buttons (min-height: 52px)
- Segmented control segments (min-height: 44px)
- Layer action buttons (min-height: 32px but within a 44px-tall chip row)
- Footer buttons (min-height: 44px)
- Speed presets (min-height: 36px — acceptable as supplementary to slider)

### Context Menu (Secondary Access)

Right-click or long-press (500ms) on any cell opens a context menu mirroring all chip controls. Built using the existing `ContextMenu` primitive and builder pattern.

**Menu structure:**
```
├─ Transform (submenu)
│  ├─ Apply To: Left / Both / Right (radio, keepOpen)
│  ├─ ─────────
│  ├─ Rotate 45° L
│  ├─ Rotate 45° R
│  ├─ ─────────
│  ├─ Mirror [M]
│  ├─ Flip [V]
│  ├─ Swap [S]
│  ├─ Invert [I]
│  ├─ Shift Start [F]
│  └─ Rewind [⇧R]
├─ Speed (submenu)
│  ├─ 0.25x
│  ├─ 0.5x
│  ├─ 1.0x (checked)
│  ├─ 1.5x
│  └─ 2.0x
├─ Effects (submenu)
│  ├─ None
│  ├─ Fire
│  ├─ Charcoal
│  ├─ LED
│  └─ Trails → Fade / Persistent / Loop Clear
├─ Visibility (submenu, keepOpen)
│  ├─ Blue Motion (toggle)
│  └─ Red Motion (toggle)
├─ Effort (submenu)
│  └─ 8 effort presets (radio)
├─ ─────────
├─ Copy Cell
└─ Clear Cell (danger)
```

## Transform Architecture: Non-Destructive Stack

Transforms are stored as an ordered stack on each layer, not baked into the sequence data.

### Data Model Changes

Extend `TunnelLayerConfig`:

```typescript
interface TunnelLayerConfig {
  sequence: SequenceData;           // Original, untouched
  transformStack: AppliedTransform[];  // Ordered list of applied transforms
  beatOffset: number;
  propColors: PropColors;
  // Remove: appliedTransforms?: TransformType[]  (replaced by transformStack)
}

interface AppliedTransform {
  type: TransformType;
  hand: TargetHand;   // Reuse existing TargetHand = 'left' | 'right' | 'both'
  timestamp: number;  // For undo ordering
}
```

Add new transform types while preserving legacy values for backward compatibility:
```typescript
type TransformType =
  // New
  | 'rotate45L' | 'rotate45R'
  | 'shiftStart'
  // Preserved from legacy (still valid in persisted data)
  | 'rotate90' | 'rotate180' | 'rotate270'
  // Shared
  | 'mirror' | 'flip' | 'swapColors' | 'invert'
  | 'rewind';
```

**Rotation direction convention:** `rotate45L` = `rotateSequence(seq, -1)` (counterclockwise 45°). `rotate45R` = `rotateSequence(seq, 1)` (clockwise 45°). The underlying `rotateSequence` uses 45-degree increments, so `rotate90` = amount 2, `rotate180` = amount 4, etc.

### Migration from `appliedTransforms`

Existing persisted compositions store `appliedTransforms?: TransformType[]` on `TunnelLayerConfig`. During deserialization (in `ArrangeGridSerializer`), if `appliedTransforms` exists and `transformStack` does not, convert:

```typescript
transformStack = appliedTransforms.map(type => ({
  type,
  hand: 'both' as const,
  timestamp: 0
}));
```

The old `rotate90`/`rotate180`/`rotate270` types remain valid in the `TransformType` union and are handled by `CellTransformStack` — they map to their existing `rotateSequence` amounts (2, 4, 6).

### Rendering

When a cell renders, it computes the effective sequence by replaying the transform stack against the original:

```
effectiveSequence = transformStack.reduce(
  (seq, transform) => applyTransform(seq, transform),
  originalSequence
)
```

This happens in `ArrangeLayerTransformer`. The computed result can be memoized and invalidated when the stack changes.

### Undo

Pop the last transform off the stack. The existing `ArrangeUndoManager` records stack mutations as undo-able actions with descriptions (e.g. "Mirror (both hands)").

### Reset

Clear the entire transform stack to restore the original sequence.

## Per-Cell State Model

Each `GridCell` gains per-cell overrides for settings that are currently global:

```typescript
interface GridCell {
  id: string;
  row: number;
  col: number;
  layers: TunnelLayerConfig[];
  colSpan: number;
  rowSpan: number;
  mediaType: CellMediaType;

  // New per-cell overrides (undefined = use global default)
  speedMultiplier?: number;        // 0.25 to 2.0, default 1.0
  effect?: CellEffect;             // none | fire | charcoal | led | trails
  trailMode?: TrailMode;           // fade | persistent | loop_clear
  effort?: string;                 // effort preset key
  blueMotionVisible?: boolean;     // default true
  redMotionVisible?: boolean;      // default true
}

type CellEffect = 'none' | 'fire' | 'charcoal' | 'led' | 'trails';
```

### Speed Sync Model

Global BPM drives the master clock. Each cell's effective BPM = `globalBPM × cell.speedMultiplier`.

At loop boundaries (when the global timeline resets), all cells reset their local beat position to 0. Between loop points, cells advance at their own rate. A cell at 2.0x will complete its sequence twice per loop; a cell at 0.5x will only play half its sequence before the loop resets.

**Implementation:** The engine continues to track a single global beat. Each cell computes its local beat as `(globalBeat * speedMultiplier) % cellTotalBeats`. This keeps the engine simple and moves the per-cell math to the rendering layer in `CellCanvas.svelte`.

### Beat Offset Relationship

Per-cell beat offset shifts the entire cell's playback start on the global timeline. Per-layer beat offset (existing on `TunnelLayerConfig`) creates stagger between layers within a cell. They are additive: `effectiveBeat = (globalBeat + cellOffset) * speedMultiplier + layerOffset`.

### Effect/Trail Relationship

`CellEffect` replaces the top-level effect selection for each cell. When `effect` is `'trails'`, `trailMode` controls which trail behavior applies. The existing `trailSettings: TrailSettings` on `CellConfig` is the implementation detail — `CellEffect` and `trailMode` are the user-facing controls that map to `TrailSettings` values. The existing `trailSettings` field is preserved for serialization but the cell editor UI writes through `effect` and `trailMode`.

### Effort Presets

The 8 effort presets are sourced from the animation engine's effort system. Canonical list: Flow, Sharp, Smooth, Pulse, Heavy, Light, Staccato, Neutral. Each has an associated color and easing curve. The `effort` field on `GridCell` stores the preset key string.

### Panel-Local UI State

The "Apply To" hand selector is **panel-local state** (not persisted). It defaults to "Both" each time a cell is selected. The currently expanded section is also panel-local. This state lives in `cell-editor-panel-state.svelte.ts`.

### Shift Start Behavior

Each tap of "Shift Start" advances the starting beat by 1. On a sequence with N beats, tapping N times returns to the original starting position.

### Keyboard Shortcuts

Keyboard shortcuts (M, V, S, I, F, Shift+R) are scoped to the CellEditorPanel component via a `keydown` handler. They fire only when the panel is open and no text input is focused. Shortcuts apply to the currently selected cell using the current "Apply To" hand selection.

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `compose/tabs/arrange/components/grid/cell-editor/CellEditorPanel.svelte` | Root component replacing current CellEditor |
| `compose/tabs/arrange/components/grid/cell-editor/ChipGrid.svelte` | Control chips grid |
| `compose/tabs/arrange/components/grid/cell-editor/LayerSection.svelte` | Layer chip + add/paste |
| `compose/tabs/arrange/components/grid/cell-editor/sections/TransformSection.svelte` | Expanded transform controls |
| `compose/tabs/arrange/components/grid/cell-editor/sections/SpeedSection.svelte` | Speed multiplier controls |
| `compose/tabs/arrange/components/grid/cell-editor/sections/EffectsSection.svelte` | Effects radio + trail options |
| `compose/tabs/arrange/components/grid/cell-editor/sections/EffortSection.svelte` | Effort preset picker |
| `compose/tabs/arrange/components/grid/cell-editor/sections/OffsetSection.svelte` | Beat offset stepper |
| `compose/tabs/arrange/components/grid/cell-editor/context-menu/CellContextMenuHost.svelte` | Context menu host for cells |
| `compose/tabs/arrange/components/grid/cell-editor/context-menu/CellContextMenuBuilder.ts` | Builds context menu items from cell state |
| `compose/tabs/arrange/services/contracts/ICellTransformStack.ts` | Transform stack interface |
| `compose/tabs/arrange/services/implementations/CellTransformStack.ts` | Non-destructive transform stack logic |
| `compose/tabs/arrange/components/grid/cell-editor/state/cell-editor-panel-state.svelte.ts` | Panel-local UI state (expanded section, Apply To selection) |

### Modified Files

| File | Change |
|------|--------|
| `compose/compose/domain/types.ts` | Add `AppliedTransform`, update `TransformType`, add per-cell fields to `GridCell` |
| `compose/tabs/arrange/state/arrange-grid-state.svelte.ts` | Per-cell speed/effect/visibility state, speed-aware playback loop |
| `compose/tabs/arrange/services/implementations/ArrangeLayerTransformer.ts` | Stack-based transform application, 45° rotation, shift start |
| `compose/tabs/arrange/services/implementations/ArrangeGridSerializer.ts` | Migration from `appliedTransforms` to `transformStack` during deserialization |
| `compose/tabs/arrange/components/grid/CellCanvas.svelte` | Pass per-cell visibility/effect overrides to renderer, local beat computation |
| `compose/tabs/arrange/components/grid/CompositionGrid.svelte` | Wire context menu host to cells |
| `compose/tabs/arrange/services/implementations/ArrangePlaybackEngine.ts` | Per-cell speed multiplier in RAF loop, loop-boundary sync |

### Deleted Files

| File | Reason |
|------|--------|
| `compose/tabs/arrange/components/grid/CellEditor.svelte` | Replaced by `cell-editor/CellEditorPanel.svelte` |

## Visual Reference

Interactive mockup: `.superpowers/brainstorm/677496-1774734773/hybrid-panel-final.html`
