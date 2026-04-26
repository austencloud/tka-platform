# Per-Tip Effect System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable per-tip-point assignment of visual effects (fire, charcoal, LED, trails) and efforts across any prop type, with global defaults and per-cell compose overrides.

**Architecture:** `TipEffectMap` data model with hierarchical key resolution (`*` → `propIndex` → `propIndex-tipIndex`). Renderers filter tips by resolved effect before processing. Trail system rearchitected from endpoint-based to tip-based tracking. Matrix drawer UI for assignment.

**Tech Stack:** Svelte 5 (runes), TypeScript, ITI DI, WebGL (fire/charcoal/LED renderers), Canvas2D (trails)

**Spec:** `docs/superpowers/specs/2026-03-29-per-tip-effect-system-design.md`

---

## Task 1: Core Types and Resolution Logic

**Files:**
- Create: `src/lib/shared/animation-engine/domain/types/TipEffectTypes.ts`
- Create: `src/lib/shared/animation-engine/services/implementations/TipEffectResolver.ts`
- Create: `src/lib/shared/animation-engine/services/contracts/ITipEffectResolver.ts`
- Test: `tests/unit/animation-engine/tip-effect-resolver.test.ts`

- [ ] **Step 1: Write failing tests for effect resolution**

```typescript
// tests/unit/animation-engine/tip-effect-resolver.test.ts
import { describe, it, expect } from 'vitest';
import { resolveEffect, type TipEffectMap } from '$lib/shared/animation-engine/domain/types/TipEffectTypes';

describe('resolveEffect', () => {
  it('returns none when map is empty', () => {
    expect(resolveEffect(0, 0, undefined, {})).toBe('none');
  });

  it('resolves cell-wide assignment', () => {
    const map: TipEffectMap = { '*': { effect: 'fire' } };
    expect(resolveEffect(0, 0, undefined, map)).toBe('fire');
    expect(resolveEffect(1, 1, undefined, map)).toBe('fire');
  });

  it('resolves per-hand assignment', () => {
    const map: TipEffectMap = { '0': { effect: 'fire' }, '1': { effect: 'led' } };
    expect(resolveEffect(0, 0, undefined, map)).toBe('fire');
    expect(resolveEffect(0, 1, undefined, map)).toBe('fire');
    expect(resolveEffect(1, 0, undefined, map)).toBe('led');
  });

  it('resolves per-tip assignment', () => {
    const map: TipEffectMap = { '0-0': { effect: 'fire' }, '0-1': { effect: 'led' } };
    expect(resolveEffect(0, 0, undefined, map)).toBe('fire');
    expect(resolveEffect(0, 1, undefined, map)).toBe('led');
  });

  it('per-tip overrides per-hand', () => {
    const map: TipEffectMap = { '0': { effect: 'fire' }, '0-1': { effect: 'charcoal' } };
    expect(resolveEffect(0, 0, undefined, map)).toBe('fire');
    expect(resolveEffect(0, 1, undefined, map)).toBe('charcoal');
  });

  it('cell override takes priority over global', () => {
    const cellMap: TipEffectMap = { '*': { effect: 'led' } };
    const globalMap: TipEffectMap = { '*': { effect: 'fire' } };
    expect(resolveEffect(0, 0, cellMap, globalMap)).toBe('led');
  });

  it('falls through cell to global when cell has no match', () => {
    const cellMap: TipEffectMap = {};
    const globalMap: TipEffectMap = { '*': { effect: 'charcoal' } };
    expect(resolveEffect(0, 0, cellMap, globalMap)).toBe('charcoal');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/animation-engine/tip-effect-resolver.test.ts`

- [ ] **Step 3: Create TipEffectTypes.ts**

```typescript
// src/lib/shared/animation-engine/domain/types/TipEffectTypes.ts
import type { EffortId } from '$lib/features/effort-lab/domain/effort-types';

export type EffectType = 'none' | 'fire' | 'charcoal' | 'led' | 'trails';

export interface TipEffectAssignment {
  effect: EffectType;
}

export interface TipEffortAssignment {
  effort: EffortId;
}

// Key format: "*" (cell-wide), "0"/"1" (per-hand), "0-0"/"0-1"/"1-0" (per-tip)
export type TipEffectMap = Record<string, TipEffectAssignment>;
export type TipEffortMap = Record<string, TipEffortAssignment>;

/**
 * Resolve which effect applies to a specific tip.
 * Priority: cell override tip → cell hand → cell wide → global tip → global hand → global wide → none
 */
export function resolveEffect(
  propIndex: number,
  tipIndex: number,
  cellMap: TipEffectMap | undefined,
  globalMap: TipEffectMap
): EffectType {
  const tipKey = `${propIndex}-${tipIndex}`;
  const handKey = `${propIndex}`;

  if (cellMap) {
    if (cellMap[tipKey]) return cellMap[tipKey].effect;
    if (cellMap[handKey]) return cellMap[handKey].effect;
    if (cellMap['*']) return cellMap['*'].effect;
  }

  if (globalMap[tipKey]) return globalMap[tipKey].effect;
  if (globalMap[handKey]) return globalMap[handKey].effect;
  if (globalMap['*']) return globalMap['*'].effect;

  return 'none';
}

/**
 * Same resolution for efforts.
 */
export function resolveEffort(
  propIndex: number,
  tipIndex: number,
  cellMap: TipEffortMap | undefined,
  globalMap: TipEffortMap
): EffortId {
  const tipKey = `${propIndex}-${tipIndex}`;
  const handKey = `${propIndex}`;

  if (cellMap) {
    if (cellMap[tipKey]) return cellMap[tipKey].effort;
    if (cellMap[handKey]) return cellMap[handKey].effort;
    if (cellMap['*']) return cellMap['*'].effort;
  }

  if (globalMap[tipKey]) return globalMap[tipKey].effort;
  if (globalMap[handKey]) return globalMap[handKey].effort;
  if (globalMap['*']) return globalMap['*'].effort;

  return 'linear';
}
```

- [ ] **Step 4: Run tests, verify passing**

- [ ] **Step 5: Create ITipEffectResolver service contract and implementation**

The service wraps the resolution functions and provides helpers for building/modifying maps:

```typescript
// src/lib/shared/animation-engine/services/contracts/ITipEffectResolver.ts
export interface ITipEffectResolver {
  resolveEffect(propIndex: number, tipIndex: number, cellMap: TipEffectMap | undefined, globalMap: TipEffectMap): EffectType;
  resolveEffort(propIndex: number, tipIndex: number, cellMap: TipEffortMap | undefined, globalMap: TipEffortMap): EffortId;
  setCellWide(map: TipEffectMap, effect: EffectType): TipEffectMap;
  setPerHand(map: TipEffectMap, propIndex: number, effect: EffectType): TipEffectMap;
  setPerTip(map: TipEffectMap, propIndex: number, tipIndex: number, effect: EffectType): TipEffectMap;
}
```

Implementation delegates to the pure functions and returns new map objects (immutable).

- [ ] **Step 6: Register in DI container**

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(animation): add TipEffectMap types and resolution logic

Hierarchical key resolution: * → propIndex → propIndex-tipIndex.
Cell override maps take priority over global maps.
7 tests covering all resolution scenarios."
```

---

## Task 2: Global Settings Integration

**Files:**
- Modify: `src/lib/shared/animation-engine/state/animation-visibility-state.svelte.ts`

- [ ] **Step 1: Add tipEffectMap and tipEffortMap to AnimationVisibilitySettings**

In the settings interface (around line 29), add:

```typescript
tipEffectMap: TipEffectMap;
tipEffortMap: TipEffortMap;
```

- [ ] **Step 2: Add defaults**

In `getDefaultSettings()`, add:

```typescript
tipEffectMap: {},
tipEffortMap: {},
```

- [ ] **Step 3: Add migration from legacy booleans**

In the storage migration section (lines 167-278), add a migration that runs when `tipEffectMap` is absent but legacy booleans exist:

```typescript
if (!settings.tipEffectMap) {
  settings.tipEffectMap = {};
  if (settings.fireEffect) settings.tipEffectMap = { '*': { effect: 'fire' } };
  else if (settings.charcoalEffect) settings.tipEffectMap = { '*': { effect: 'charcoal' } };
  else if (settings.ledEffect) settings.tipEffectMap = { '*': { effect: 'led' } };
}
if (!settings.tipEffortMap) {
  settings.tipEffortMap = {};
  if (settings.effortPreset && settings.effortPreset !== 'linear') {
    settings.tipEffortMap = { '*': { effort: settings.effortPreset } };
  }
}
```

- [ ] **Step 4: Add getters and setters**

```typescript
getTipEffectMap(): TipEffectMap { return this.settings.tipEffectMap; }
setTipEffectMap(map: TipEffectMap): void {
  this.settings.tipEffectMap = map;
  this.saveToStorage();
  this.notifyObservers();
}
getTipEffortMap(): TipEffortMap { return this.settings.tipEffortMap; }
setTipEffortMap(map: TipEffortMap): void {
  this.settings.tipEffortMap = map;
  this.saveToStorage();
  this.notifyObservers();
}
```

- [ ] **Step 5: Remove fire/charcoal mutual exclusion**

In `setFireEffect()` (line 627), remove the lines that disable charcoal and LED. Same in `setCharcoalEffect()` and `setLedEffect()`. These effects can now coexist on different tips. Keep the dark mode auto-sync (effects still need dark mode).

- [ ] **Step 6: Run typecheck**

```bash
npm run check
```

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(animation): add tipEffectMap/tipEffortMap to global settings

Persist per-tip effect assignments in localStorage.
Migrate from legacy fire/charcoal/led booleans.
Remove fire/charcoal mutual exclusion."
```

---

## Task 3: Renderer Tip Filtering

**Files:**
- Modify: `src/lib/shared/animation-engine/services/contracts/IAnimationRenderLoop.ts:86-118`
- Modify: `src/lib/shared/animation-engine/services/implementations/AnimationRenderLoop.ts:503-597`
- Modify: `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts:2026-2125`

- [ ] **Step 1: Add tipEffectMap to RenderFrameParams**

In `IAnimationRenderLoop.ts`, add to the `RenderFrameParams` interface:

```typescript
tipEffectMap?: TipEffectMap;
```

- [ ] **Step 2: Pass tipEffectMap through getFrameParams**

In `AnimationEngine.svelte.ts`, in the `getFrameParams` method (line 2026), add the map to the returned object. Read it from the visibility manager:

```typescript
tipEffectMap: this.getVM()?.getTipEffectMap() ?? {},
```

- [ ] **Step 3: Filter tips before fire/charcoal rendering**

In `AnimationRenderLoop.ts`, after the tip tracker update (line 508), filter tips by resolved effect BEFORE passing to the fire or charcoal renderer:

```typescript
const allTips = tipResult.tips;
const tipMap = params.tipEffectMap ?? {};

const fireTips = allTips.filter(t => {
  const effect = resolveEffect(t.propIndex, t.tipIndex, undefined, tipMap);
  return effect === 'fire';
});

const charcoalTips = allTips.filter(t => {
  const effect = resolveEffect(t.propIndex, t.tipIndex, undefined, tipMap);
  return effect === 'charcoal';
});
```

Then pass `fireTips` to the fire renderer and `charcoalTips` to the charcoal renderer. When `fireTips` is empty, skip the fire render. When `charcoalTips` is empty, skip charcoal. Both can run in the same frame if both have tips.

- [ ] **Step 4: Filter tips before LED rendering**

Same approach for LED tips (line 581):

```typescript
const ledTips = allTips.filter(t => {
  const effect = resolveEffect(t.propIndex, t.tipIndex, undefined, tipMap);
  return effect === 'led';
});
```

Skip LED render when empty.

- [ ] **Step 5: Allow fire and charcoal renderers to coexist**

In `AnimationEngine.svelte.ts`, the `syncFireOverlay` and `syncCharcoalOverlay` methods currently destroy one when the other activates. Modify so both can be initialized simultaneously. The render loop already has separate renderer references (`activeFireRenderer` and `activeCharcoalRenderer`).

Check `AnimationRenderLoop.ts` — it already has the conditional: "if fire renderer, render fire, else if charcoal renderer, render charcoal." Change this to: "if fire renderer AND fireTips, render fire. If charcoal renderer AND charcoalTips, render charcoal." Both can run.

- [ ] **Step 6: Run typecheck**

```bash
npm run check
```

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(animation): filter tips by resolved effect before rendering

Fire, charcoal, and LED renderers now only receive tips assigned
to their effect. Fire and charcoal can coexist in the same frame
on different tips."
```

---

## Task 4: Trail System Rearchitecture

**Files:**
- Modify: `src/lib/shared/animation-engine/domain/types/TrailTypes.ts`
- Modify: `src/lib/features/compose/services/implementations/TrailCapturer.ts:619-785`
- Test: `tests/unit/animation-engine/trail-tip-tracking.test.ts`

- [ ] **Step 1: Write failing test for tip-based trail capture**

```typescript
// tests/unit/animation-engine/trail-tip-tracking.test.ts
import { describe, it, expect } from 'vitest';

describe('TrailPoint tipIndex', () => {
  it('uses tipIndex instead of endType', () => {
    // Verify TrailPoint type has tipIndex field
    const point: import('$lib/shared/animation-engine/domain/types/TrailTypes').TrailPoint = {
      x: 100, y: 200, timestamp: 1000, propIndex: 0, tipIndex: 0
    };
    expect(point.tipIndex).toBe(0);
  });
});
```

- [ ] **Step 2: Update TrailPoint type**

In `TrailTypes.ts`, change:
```typescript
// Old
endType: 0 | 1;
// New
tipIndex: number;
```

- [ ] **Step 3: Fix all compilation errors from TrailPoint change**

Search for `endType` in the trail system and update to `tipIndex`. Key locations:
- `TrailCapturer.ts` — point creation (lines 671-677, 759-764)
- Trail rendering code that reads `endType` for coloring
- Any type assertions or interfaces referencing `endType`

- [ ] **Step 4: Update captureTrailPoint to use tip-based tracking**

In `TrailCapturer.ts`, replace the `endsToTrack` logic (lines 635-643) with tip enumeration:

```typescript
// Import getTipPoints
import { getTipPoints } from '$lib/shared/animation-engine/domain/types/PropTipPoints';

// Replace endsToTrack with tip enumeration
const tipConfig = getTipPoints(propType);
const tipsToTrack: number[] = [];

// Check which tips are assigned to trails
for (let tipIdx = 0; tipIdx < tipConfig.points.length; tipIdx++) {
  const effect = resolveEffect(propIndex, tipIdx, cellTipEffectMap, globalTipEffectMap);
  if (effect === 'trails') {
    tipsToTrack.push(tipIdx);
  }
}
```

Then for each tip in `tipsToTrack`, compute the canvas-space position using the same rotation math from `FireTipTracker.emitPropTips()` (prop center + angle + scale → transformed point).

- [ ] **Step 5: Update TrailCapturer to accept TipEffectMap**

Add `tipEffectMap` to the `TrailCaptureConfig` interface (lines 165-187) or pass it through `captureFrame`. The capturer needs the map to know which tips should produce trail points.

- [ ] **Step 6: Update trail rendering to use tipIndex**

The trail overlay renderer draws lines connecting points by `propIndex`. The `endType` distinction was used to draw separate lines per endpoint. Replace with `tipIndex` — draw separate trail lines per (propIndex, tipIndex) pair.

- [ ] **Step 7: Run tests and typecheck**

```bash
npx vitest run tests/unit/animation-engine/
npm run check
```

- [ ] **Step 8: Commit**

```bash
git commit -m "feat(animation): rearchitect trails from endpoint to tip-based tracking

TrailPoint.endType replaced with tipIndex. TrailCapturer uses
getTipPoints() and resolveEffect() to determine which tips produce
trail points. Supports variable tip counts per prop type."
```

---

## Task 5: Per-Cell TipEffectMap in Compose

**Files:**
- Modify: `src/lib/features/compose/compose/domain/types.ts`
- Modify: `src/lib/features/compose/tabs/arrange/state/arrange-grid-state.svelte.ts`
- Modify: `src/lib/features/compose/tabs/arrange/components/grid/CellCanvas.svelte`
- Modify: `src/lib/shared/animation-engine/components/AnimatorCanvas.svelte`

- [ ] **Step 1: Add tipEffectMap/tipEffortMap to GridCell**

In `types.ts`, add to GridCell:

```typescript
tipEffectMap?: TipEffectMap;
tipEffortMap?: TipEffortMap;
```

Deprecate the existing `effect?: CellEffect` and `effort?: string` fields.

- [ ] **Step 2: Add migration for existing GridCell.effect**

In arrange-grid-state, where cells are loaded/deserialized, migrate:

```typescript
if (cell.effect && !cell.tipEffectMap) {
  cell.tipEffectMap = { '*': { effect: cell.effect } };
}
```

- [ ] **Step 3: Add setter methods to arrange-grid-state**

```typescript
setCellTipEffectMap(cellId: string, map: TipEffectMap) {
  const idx = cells.findIndex(c => c.id === cellId);
  if (idx < 0) return;
  withUndo("SET_TIP_EFFECT_MAP", "Update effects", () => {
    const newCells = [...cells];
    newCells[idx] = { ...cells[idx], tipEffectMap: map };
    cells = newCells;
    save();
  });
},

setCellTipEffortMap(cellId: string, map: TipEffortMap) {
  const idx = cells.findIndex(c => c.id === cellId);
  if (idx < 0) return;
  withUndo("SET_TIP_EFFORT_MAP", "Update efforts", () => {
    const newCells = [...cells];
    newCells[idx] = { ...cells[idx], tipEffortMap: map };
    cells = newCells;
    save();
  });
},
```

- [ ] **Step 4: Add tipEffectMap/tipEffortMap props to AnimatorCanvas**

In `AnimatorCanvas.svelte` props (line 51), add:

```typescript
tipEffectMap?: TipEffectMap;
tipEffortMap?: TipEffortMap;
```

Pass these through to the engine via the update effect (line 345).

- [ ] **Step 5: Pass cell maps from CellCanvas to AnimatorCanvas**

In `CellCanvas.svelte`, replace the existing `cellFireConfig`/`cellLedConfig` derived values with:

```typescript
<AnimatorCanvas
  ...
  tipEffectMap={cell.tipEffectMap}
  tipEffortMap={cell.tipEffortMap}
/>
```

Remove the old `cellFireConfig`/`cellLedConfig` deriveds since the renderer now uses the tip effect map directly.

- [ ] **Step 6: Engine reads per-canvas tipEffectMap**

In `AnimationEngine.svelte.ts`, when `tipEffectMap` is passed via props, use it instead of the global map in `getFrameParams`. The merge logic: if canvas-level map exists, pass it as the `cellMap` parameter to `resolveEffect`; the global map is always the fallback.

- [ ] **Step 7: Run typecheck**

```bash
npm run check
```

- [ ] **Step 8: Commit**

```bash
git commit -m "feat(compose): per-cell tipEffectMap/tipEffortMap in compose grid

GridCell stores per-cell effect/effort maps. CellCanvas passes
maps to AnimatorCanvas. Engine uses cell map with global fallback."
```

---

## Task 6: Effect Matrix Drawer UI

**Files:**
- Create: `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/sections/EffectMatrixDrawer.svelte`
- Modify: `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/sections/EffectsSection.svelte`
- Modify: `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/CellEditorPanel.svelte`

- [ ] **Step 1: Create EffectMatrixDrawer component**

Props:
```typescript
let {
  currentMap,
  bluePropType,
  redPropType,
  onUpdateMap,
  onClose,
}: {
  currentMap: TipEffectMap;
  bluePropType: string;
  redPropType: string;
  onUpdateMap: (map: TipEffectMap) => void;
  onClose: () => void;
} = $props();
```

Internal state:
- `scope`: `'cell' | 'hand' | 'tip'` — controls how many rows show
- `localMap`: working copy of the map, committed on close

Layout from mockup:
1. Header with title + close button
2. Scope selector (Cell / Per Hand / Per Tip segmented control)
3. Channel rows — dynamically generated from prop tip counts:
   - Cell scope: 1 row, dot shows both colors
   - Per Hand: 2 rows (blue, red)
   - Per Tip: N rows based on `getTipPoints(propType).points.length` per prop
4. Each row: colored dot + label, then 5 effect icon buttons (None/Fire/Charcoal/LED/Trails)
5. Quick-apply bar: "Apply to all: None | Fire | Charcoal | LED | Trails"

Effect button styling (from mockup):
- 36×36px, border-radius 8px
- Active states: fire = orange tint, charcoal = purple tint, LED = green tint, trails = blue tint, none = white tint
- Icons: fa-ban (none), fa-fire (fire), fa-fire with purple (charcoal), fa-lightbulb (LED), fa-wind (trails)

Tip labels:
- Staff (2 tips): "thumb", "pinky"
- Fan (5 tips): "tip 1" through "tip 5"
- Club (1 tip): "tip" (same as hand scope)
- Use `getTipPoints(propType).points.length` for count

- [ ] **Step 2: Add "Customize" button to EffectsSection**

Below the existing radio chips, add a button:

```svelte
<button class="customize-btn" onclick={() => onOpenMatrix()}>
  <i class="fas fa-sliders"></i> Customize per tip
</button>
```

When clicked, opens the EffectMatrixDrawer.

- [ ] **Step 3: Wire drawer into CellEditorPanel**

Add state to track whether the effect matrix is open. When open, render `EffectMatrixDrawer` as an overlay/drawer. Pass `cell.tipEffectMap`, prop types from the cell's sequence data, and the update callback that calls `arrangeGridState.setCellTipEffectMap`.

- [ ] **Step 4: Run typecheck and verify drawer opens**

```bash
npm run check
npm run build
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(compose): add EffectMatrixDrawer for per-tip effect assignment

Matrix UI with Cell/Per Hand/Per Tip scope. Channel rows adapt
to prop tip count. Accessible from Effects section via Customize."
```

---

## Task 7: Effort Matrix Integration

**Files:**
- Create: `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/sections/EffortMatrixDrawer.svelte`
- Modify: `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/sections/EffortSection.svelte`

- [ ] **Step 1: Create EffortMatrixDrawer**

Same structure as EffectMatrixDrawer but with effort options instead of effect options. Columns show the 8 EFFORTS from `effort-lab/domain/effort-types.ts` with their colored dots.

Props:
```typescript
let {
  currentMap,
  bluePropType,
  redPropType,
  onUpdateMap,
  onClose,
}: {
  currentMap: TipEffortMap;
  bluePropType: string;
  redPropType: string;
  onUpdateMap: (map: TipEffortMap) => void;
  onClose: () => void;
} = $props();
```

Effort buttons show colored dots (not icons) since there are 8 options. Use a scrollable row or 2-row grid for the 8 efforts per channel.

- [ ] **Step 2: Add "Customize" button to EffortSection**

Same pattern as EffectsSection.

- [ ] **Step 3: Wire into CellEditorPanel**

Same pattern — state tracking, overlay rendering, callback wiring.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(compose): add EffortMatrixDrawer for per-tip effort assignment

8 effort presets per tip channel. Same scope selector as effects."
```

---

## Task 8: Context Menu Integration

**Files:**
- Modify: `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/context-menu/CellContextMenuBuilder.ts`

- [ ] **Step 1: Add "Customize Effects..." entry**

In `buildEffectChildren`, add a separator and a "Customize..." entry at the bottom that fires a callback to open the EffectMatrixDrawer:

```typescript
{ id: 'effect-sep', label: '', disabled: true },
{
  id: 'customize-effects',
  label: 'Customize...',
  icon: 'fa-sliders',
  action: () => callbacks.onOpenEffectMatrix?.(),
},
```

- [ ] **Step 2: Add "Customize Efforts..." entry**

Same for the effort submenu.

- [ ] **Step 3: Add callbacks to CellContextMenuCallbacks interface**

```typescript
onOpenEffectMatrix?: () => void;
onOpenEffortMatrix?: () => void;
```

- [ ] **Step 4: Wire in CompositionGrid**

Pass the matrix-opening callbacks through to the context menu host.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(compose): add Customize entries to cell context menu

Opens EffectMatrixDrawer or EffortMatrixDrawer from context menu."
```

---

## Task 9: Global Settings UI

**Files:**
- Modify: `src/lib/shared/settings/components/tabs/visibility/` (find the animation effects section)

- [ ] **Step 1: Add "Customize" button to global effect settings**

In the Settings → Visibility → Animation section where fire/charcoal/LED toggles exist, add a "Customize per tip" button that opens the EffectMatrixDrawer with the global `tipEffectMap`.

The EffectMatrixDrawer is generic — it works the same for global settings and per-cell compose. The only difference is which map it reads/writes and what prop types it shows (global uses the current prop type from settings).

- [ ] **Step 2: Same for efforts**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(settings): add per-tip effect/effort customization to global settings"
```

---

## Task 10: Polish and Edge Cases

**Files:**
- Various

- [ ] **Step 1: Scope switching logic**

When switching from Per Tip to Per Hand: find the most common effect per hand, write as per-hand key, remove per-tip keys.
When switching from Per Hand to Cell: find the most common effect across hands, write as cell-wide key.
When switching to higher granularity: populate child keys with parent's current value.

- [ ] **Step 2: ChipGrid effect display update**

Update the effect chip in ChipGrid to read from `tipEffectMap` instead of the flat `cell.effect`. Show "Mixed" when different tips have different effects. Show the effect name when all tips share the same one.

- [ ] **Step 3: Handle prop type changes**

When the user changes prop type (e.g., staff → fan), the tip count changes. Existing per-tip assignments for tips that no longer exist should be cleaned up. New tips should inherit from the per-hand or cell-wide assignment.

- [ ] **Step 4: 44px touch targets on matrix buttons**

Verify all matrix channel buttons meet 44px minimum. The 36×36px effect buttons are acceptable within a 48px+ row height.

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run
npm run check
npm run build
```

- [ ] **Step 6: Commit**

```bash
git commit -m "fix(animation): polish per-tip effect system edge cases

Scope switching, mixed effect display, prop type changes,
touch targets verified."
```
