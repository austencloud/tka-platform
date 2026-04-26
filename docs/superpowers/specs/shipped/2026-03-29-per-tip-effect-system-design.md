# Per-Tip Effect System

**Date:** 2026-03-29
**Status:** Approved
**Module:** Animation Engine (global) + Compose (per-cell overrides)

## Problem

Visual effects (fire, charcoal, LED, trails) are currently applied canvas-wide — one effect for all props and all tips. Users want granular control: fire on the blue prop's thumb end, LED on the blue prop's pinky end, charcoal on the entire red prop. The trail system is further limited by endpoint-based tracking (`TrackingMode`: left_end / right_end / both_ends) instead of tracking by tip index, making it incompatible with a per-tip assignment model.

## Design: Unified Per-Tip Effect Assignment

Every visual effect can be assigned to any tip point on any prop. The assignment model is a map from `{propIndex, tipIndex}` to an effect type. This map lives globally in settings (user's default) and can be overridden per-cell in compose.

### Scope Selector

Three granularity levels control how the matrix UI presents:

| Scope | Rows | Description |
|-------|------|-------------|
| **Cell** | 1 | One effect for all tips on all props |
| **Per Hand** | 2 | Each prop gets its own effect (all tips on that prop share it) |
| **Per Tip** | N | Each tip on each prop gets its own effect |

The number of rows in Per Tip mode adapts to the prop type: staff = 2 tips × 2 props = 4 rows. Fan = 5 tips × 2 props = 10 rows. Club = 1 tip × 2 props = 2 rows (same as Per Hand).

### Data Model

#### TipEffectMap

The core data structure mapping tip positions to effects:

```typescript
type EffectType = 'none' | 'fire' | 'charcoal' | 'led' | 'trails';

interface TipEffectAssignment {
  effect: EffectType;
}

// Key format: "propIndex-tipIndex" (e.g. "0-0" = blue thumb, "1-2" = red tip 3)
type TipEffectMap = Record<string, TipEffectAssignment>;
```

**Default value:** Empty map `{}`. When a tip has no entry, it inherits from the scope hierarchy:
1. Check `TipEffectMap["propIndex-tipIndex"]` — per-tip assignment
2. Check `TipEffectMap["propIndex"]` — per-hand assignment (key is just propIndex, no tipIndex)
3. Check `TipEffectMap["*"]` — cell-wide assignment
4. Fall back to `'none'`

This inheritance means Cell scope writes to `"*"`, Per Hand scope writes to `"0"` and `"1"`, and Per Tip scope writes to `"0-0"`, `"0-1"`, etc.

#### TipEffortMap

Same structure for efforts:

```typescript
type EffortId = 'linear' | 'glide' | 'dab' | 'press' | 'punch' | 'elastic' | 'bounce' | 'anticipation';

interface TipEffortAssignment {
  effort: EffortId;
}

type TipEffortMap = Record<string, TipEffortAssignment>;
```

Same inheritance hierarchy as TipEffectMap. Default effort is `'linear'`.

#### Global Settings Extension

Add to `AnimationVisibilitySettings`:

```typescript
// New fields on AnimationVisibilitySettings
tipEffectMap: TipEffectMap;      // Global default per-tip effect assignments
tipEffortMap: TipEffortMap;      // Global default per-tip effort assignments
```

These persist to localStorage alongside existing effect settings. The existing `fireEffect`, `charcoalEffect`, `ledEffect` booleans remain for backward compatibility — they represent the legacy "cell-wide" assignment and are migrated to `TipEffectMap["*"]` on load.

#### Per-Cell Override in Compose

Extend `GridCell`:

```typescript
interface GridCell {
  // ... existing fields ...
  // Replace flat effect/effort fields with maps
  tipEffectMap?: TipEffectMap;    // Per-cell override (undefined = use global)
  tipEffortMap?: TipEffortMap;    // Per-cell override (undefined = use global)
}
```

The existing `effect?: CellEffect` and `effort?: string` fields on GridCell are deprecated in favor of these maps. Migration: if `effect` is set, convert to `TipEffectMap["*"] = { effect }`.

### Effect Resolution

When the renderer needs to know what effect applies to a specific tip:

```typescript
function resolveEffect(
  propIndex: number,
  tipIndex: number,
  cellMap: TipEffectMap | undefined,
  globalMap: TipEffectMap
): EffectType {
  // 1. Check cell override first
  if (cellMap) {
    const tipKey = `${propIndex}-${tipIndex}`;
    if (cellMap[tipKey]) return cellMap[tipKey].effect;
    const handKey = `${propIndex}`;
    if (cellMap[handKey]) return cellMap[handKey].effect;
    if (cellMap['*']) return cellMap['*'].effect;
  }
  // 2. Fall back to global
  const tipKey = `${propIndex}-${tipIndex}`;
  if (globalMap[tipKey]) return globalMap[tipKey].effect;
  const handKey = `${propIndex}`;
  if (globalMap[handKey]) return globalMap[handKey].effect;
  if (globalMap['*']) return globalMap['*'].effect;
  // 3. Default
  return 'none';
}
```

Same function for efforts, substituting `EffortId` for `EffectType`.

### Renderer Changes

#### Fire/Charcoal Renderer

The `WebGLFireRenderer` and `CharcoalSparkRenderer` receive all tips in a flat `PropTipData[]` array. Currently they process all tips uniformly.

**Change:** Before the simulation step, partition tips by their resolved effect:
- Tips assigned to `'fire'` → feed into fire simulation
- Tips assigned to `'charcoal'` → feed into charcoal simulation
- Tips assigned to `'none'`, `'led'`, or `'trails'` → skip

Both fire and charcoal renderers already create separate WebGL canvases. When both fire and charcoal tips exist simultaneously, both renderers run in the same frame — fire renders its assigned tips, charcoal renders its assigned tips. This removes the current mutual exclusion constraint.

The `RenderFrameParams` gains a new field:

```typescript
interface RenderFrameParams {
  // ... existing fields ...
  tipEffectMap: TipEffectMap;  // Resolved map (cell override merged with global)
}
```

The render loop filters `tips` before passing to each renderer:

```typescript
const fireTips = tips.filter(t => resolveEffect(t.propIndex, t.tipIndex, map) === 'fire');
const charcoalTips = tips.filter(t => resolveEffect(t.propIndex, t.tipIndex, map) === 'charcoal');

if (fireTips.length > 0) fireRenderer.renderFire({ ...input, tips: fireTips }, fireConfig);
if (charcoalTips.length > 0) charcoalRenderer.renderCharcoal({ ...input, tips: charcoalTips }, fireConfig);
```

#### LED Renderer

The LED renderer uses `LedTipTracker` which also produces per-tip data. Same filtering approach:

```typescript
const ledTips = tips.filter(t => resolveEffect(t.propIndex, t.tipIndex, map) === 'led');
if (ledTips.length > 0) ledRenderer.renderLeds({ ...input, tips: ledTips }, ledConfig);
```

#### Trail System Rearchitecture

**Current:** Trails track endpoints via `TrackingMode` (left_end / right_end / both_ends). Points have `endType: 0 | 1`.

**New:** Trails track any tip by index. Points have `tipIndex: number`.

Changes to `TrailPoint`:

```typescript
interface TrailPoint {
  x: number;
  y: number;
  timestamp: number;
  propIndex: 0 | 1;
  tipIndex: number;    // Was: endType: 0 | 1
}
```

Changes to `TrailCapturer.captureTrailPoint()`:

Instead of:
```typescript
const endsToTrack = trackingMode === BOTH_ENDS ? [0, 1] : [trackingMode === LEFT_END ? 0 : 1];
for (const endType of endsToTrack) {
  const endpoint = calculateEndpoint(prop, endType);
  // ... capture point with endType
}
```

Becomes:
```typescript
const tipPoints = getTipPoints(propType);
for (let tipIndex = 0; tipIndex < tipPoints.points.length; tipIndex++) {
  const effect = resolveEffect(propIndex, tipIndex, tipEffectMap);
  if (effect !== 'trails') continue;  // Only track tips assigned to trails
  const point = transformTipPoint(prop, tipPoints.points[tipIndex]);
  // ... capture point with tipIndex
}
```

The tip-to-canvas transformation reuses the same math from `FireTipTracker.emitPropTips()` (rotation matrix from prop center/angle/scale).

**TrackingMode deprecation:** The `trackingMode` field on `TrailSettings` becomes legacy. Per-tip trail assignments in `TipEffectMap` replace it. Migration: `TrackingMode.BOTH_ENDS` → assign trails to all tips. `TrackingMode.RIGHT_END` → assign trails to tip index matching the prop's "right end" (typically tipIndex 1 for staff, tipIndex 0 for club).

**Trail rendering:** The trail overlay renderer already draws lines per-point using `propIndex` for coloring. Changing `endType` to `tipIndex` doesn't affect the draw path — it's still (x, y) positions connected by lines per prop. Multiple tips on the same prop produce multiple independent trail lines in the same prop color.

### Matrix UI Component

#### EffectMatrixDrawer

A shared component used by both effects and efforts. Opens as a drawer/modal from the cell editor's Effects or Effort chip.

**Props:**
```typescript
interface EffectMatrixProps {
  mode: 'effects' | 'efforts';
  currentMap: TipEffectMap | TipEffortMap;
  bluePropType: string;
  redPropType: string;
  onUpdateMap: (map: TipEffectMap | TipEffortMap) => void;
  onClose: () => void;
}
```

**Layout:**
1. **Header** — "Effect Matrix" or "Effort Matrix" with close button
2. **Scope selector** — Cell / Per Hand / Per Tip segmented control
3. **Channel rows** — one per channel (1, 2, or N based on scope)
4. **Quick-apply bar** — "Apply to all: None | Fire | Charcoal | LED | Trails"

**Channel row contents:**
- Colored dot identifying the prop + optional tip label ("Blue thumb", "Red pinky", "Blue tip 3")
- Row of effect/effort buttons (icon-based, 36×36px, same as mockup)
- Active button gets colored highlight matching the effect

**Tip labels for Per Tip scope:**
- Staff (2 tips): "thumb" and "pinky" (matching TKA's reference system)
- Fan (5 tips): "tip 1" through "tip 5"
- Club (1 tip): just "tip" (same as Per Hand visually)
- Triad (3 tips): "tip 1" through "tip 3"

**Scope behavior:**
- Switching from Per Tip to Per Hand: If tips on the same hand have different effects, show the most common one. On confirm, write the per-hand value (overwriting per-tip).
- Switching from Per Hand to Cell: Same most-common logic.
- Switching to higher granularity: Populate all child keys with the parent's current value.

### Integration Points

#### Cell Editor (Compose)

The current `EffectsSection.svelte` changes:
- The radio chips (None/Fire/Charcoal/LED/Trails) become a "quick set" for cell-wide assignment
- A "Customize" button below opens the `EffectMatrixDrawer` for per-hand/per-tip control
- When the matrix is open, the quick chips are hidden

Same pattern for `EffortSection.svelte`: quick chips for cell-wide + "Customize" button for the matrix.

#### Context Menu

The cell context menu's Effects submenu adds a "Customize..." entry at the bottom that opens the matrix drawer. The existing radio items remain as quick cell-wide toggles.

#### Global Settings

The existing effect controls in Settings → Visibility → Animation section gain the same "Customize" button that opens the matrix for global defaults. The current fire/charcoal/LED toggles remain as cell-wide quick controls.

#### AnimatorCanvas

`AnimatorCanvas` gains a new optional prop:

```typescript
tipEffectMap?: TipEffectMap;
tipEffortMap?: TipEffortMap;
```

When provided, these override the global maps. `CellCanvas` passes the cell's maps (or undefined for global defaults).

### Migration

1. **Global settings:** On load, if `tipEffectMap` doesn't exist but `fireEffect`/`charcoalEffect`/`ledEffect` booleans do, migrate: if `fireEffect` is true → `tipEffectMap = { '*': { effect: 'fire' } }`, etc.
2. **Per-cell:** If `GridCell.effect` is set but `tipEffectMap` isn't, migrate: `tipEffectMap = { '*': { effect: cell.effect } }`.
3. **Trail settings:** If `trackingMode` is set but no trail assignments exist in `tipEffectMap`, migrate based on mode and prop tip count.
4. **Mutual exclusion removal:** Fire and charcoal can now coexist (different tips). The `setFireEffect`/`setCharcoalEffect` methods no longer disable each other — they write to `tipEffectMap["*"]` instead.

### Performance Considerations

- **Tip filtering per frame:** `resolveEffect()` is called per tip per frame. With MAX_TOTAL_TIPS = 16, this is 16 lookups per frame — negligible.
- **Multiple renderer instances:** Running fire AND charcoal simultaneously means two WebGL simulations. Each uses a 128×128 grid. Memory cost: ~200KB additional. GPU cost: 11 additional shader passes. Acceptable on modern hardware, but should be tested on mobile.
- **Trail buffer sizing:** More tips being tracked means more trail points. A fan with 5 tips tracked produces 5× the trail data of a staff tracking one tip. The existing `MAX_TOTAL_POINTS_BEFORE_PRUNE` (8000) and emergency pruning handle this.

### Files to Create/Modify

#### New Files

| File | Purpose |
|------|---------|
| `shared/animation-engine/domain/types/TipEffectTypes.ts` | TipEffectMap, TipEffortMap, TipEffectAssignment types, resolveEffect function |
| `compose/tabs/arrange/components/grid/cell-editor/sections/EffectMatrixDrawer.svelte` | Matrix UI component for per-tip effect assignment |
| `compose/tabs/arrange/components/grid/cell-editor/sections/EffortMatrixDrawer.svelte` | Matrix UI component for per-tip effort assignment (or shared with effects via mode prop) |
| `shared/animation-engine/services/implementations/TipEffectResolver.ts` | Service that resolves effect for a given tip, merging cell + global maps |

#### Modified Files

| File | Change |
|------|--------|
| `shared/animation-engine/state/animation-visibility-state.svelte.ts` | Add tipEffectMap/tipEffortMap to settings, migration, getters/setters |
| `shared/animation-engine/services/implementations/AnimationRenderLoop.ts` | Filter tips by resolved effect before passing to fire/charcoal/LED renderers |
| `shared/animation-engine/services/implementations/AnimationEngine.svelte.ts` | Remove fire/charcoal mutual exclusion, pass tipEffectMap in frame params |
| `shared/animation-engine/domain/types/TrailTypes.ts` | Change TrailPoint.endType to tipIndex, deprecate TrackingMode |
| `features/compose/services/implementations/TrailCapturer.ts` | Tip-based tracking using getTipPoints() instead of endpoint calculation |
| `features/compose/compose/domain/types.ts` | Add tipEffectMap/tipEffortMap to GridCell, deprecate flat effect/effort fields |
| `compose/tabs/arrange/components/grid/cell-editor/sections/EffectsSection.svelte` | Add "Customize" button to open matrix drawer |
| `compose/tabs/arrange/components/grid/cell-editor/sections/EffortSection.svelte` | Add "Customize" button to open matrix drawer |
| `compose/tabs/arrange/components/grid/cell-editor/CellEditorPanel.svelte` | Host matrix drawers, pass tipEffectMap/tipEffortMap |
| `compose/tabs/arrange/components/grid/CellCanvas.svelte` | Pass tipEffectMap to AnimatorCanvas |
| `compose/tabs/arrange/state/arrange-grid-state.svelte.ts` | Add setters for tipEffectMap/tipEffortMap |
| `shared/animation-engine/components/AnimatorCanvas.svelte` | Accept tipEffectMap/tipEffortMap props, pass to engine |
| `shared/animation-engine/services/implementations/fire/WebGLFireRenderer.ts` | Accept filtered tip arrays |
| `shared/animation-engine/services/implementations/charcoal/CharcoalSparkRenderer.ts` | Accept filtered tip arrays |
| `shared/animation-engine/services/implementations/led/WebGLLedRenderer.ts` | Accept filtered tip arrays |

## Visual Reference

Interactive mockup: `.superpowers/brainstorm/1020329-1774770972/effect-matrix.html`
