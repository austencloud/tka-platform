# Compose Cell Editor Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat-grid CellEditor sidebar with a hybrid chip dashboard that shows per-cell state at a glance and expands inline for full controls — transforms, speed, effects, effort, visibility, and context menu.

**Architecture:** Non-destructive transform stack stored per-layer, per-cell overrides for speed/effects/visibility/effort, chip-based UI with inline expandable sections, context menu mirroring all controls.

**Tech Stack:** Svelte 5 (runes), TypeScript, ITI DI, Font Awesome 6, existing ContextMenu primitive

**Spec:** `docs/superpowers/specs/2026-03-28-compose-cell-editor-redesign-design.md`

---

## Task 1: Extend Domain Types

**Files:**
- Modify: `src/lib/features/compose/compose/domain/types.ts:68-120`
- Modify: `src/lib/features/compose/tabs/arrange/state/arrange-grid-state.svelte.ts:44-58`

- [ ] **Step 1: Update TransformType union**

At line 68, replace the existing `TransformType`:

```typescript
export type TransformType =
  | 'rotate45L' | 'rotate45R'
  | 'shiftStart'
  | 'rotate90' | 'rotate180' | 'rotate270'
  | 'mirror' | 'flip' | 'swapColors' | 'invert'
  | 'rewind';
```

- [ ] **Step 2: Add AppliedTransform interface**

After `TransformType`, add:

```typescript
export type TargetHand = 'left' | 'right' | 'both';

export interface AppliedTransform {
  type: TransformType;
  hand: TargetHand;
  timestamp: number;
}
```

- [ ] **Step 3: Update TunnelLayerConfig**

Replace the `appliedTransforms` field at line 118:

```typescript
export interface TunnelLayerConfig {
  sequence: SequenceData;
  beatOffset: number;
  propColors: PropColors;
  transformStack: AppliedTransform[];
  /** @deprecated Use transformStack. Kept for deserialization migration. */
  appliedTransforms?: TransformType[];
}
```

- [ ] **Step 4: Add CellEffect type and per-cell fields to GridCell**

After `TunnelLayerConfig`, add:

```typescript
export type CellEffect = 'none' | 'fire' | 'charcoal' | 'led' | 'trails';
```

Then find the `GridCell` interface in `arrange-grid-state.svelte.ts:44-58` and add the per-cell override fields. Import `TrailMode` from the animation engine types and `CellEffect` from the compose domain types:

```typescript
import { TrailMode } from '$lib/shared/animation-engine/domain/types/TrailTypes';
import type { CellEffect } from '$lib/features/compose/compose/domain/types';

export interface GridCell {
  id: string;
  row: number;
  col: number;
  layers: TunnelLayerConfig[];
  beatOffset: number;
  colSpan: number;
  rowSpan: number;
  mediaType: CellMediaType;
  // Per-cell overrides (undefined = global default)
  speedMultiplier?: number;
  effect?: CellEffect;
  trailMode?: TrailMode;
  effort?: string;
  blueMotionVisible?: boolean;
  redMotionVisible?: boolean;
}
```

Note: `TrailMode` is an enum with values `OFF`, `FADE`, `LOOP_CLEAR`, `PERSISTENT`. Use these enum values, not string literals.

- [ ] **Step 5: Fix all compilation errors from the TunnelLayerConfig change**

Run `npm run check`. Every place that constructs a `TunnelLayerConfig` now needs `transformStack: []` instead of or in addition to `appliedTransforms`. Search for `appliedTransforms` usage and update each site to use `transformStack`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/compose/
git commit -m "feat(compose): extend domain types for cell editor redesign

Add rotate45L/R, shiftStart, AppliedTransform, CellEffect.
Replace appliedTransforms with transformStack on TunnelLayerConfig.
Add per-cell override fields to GridCell."
```

---

## Task 2: Non-Destructive Transform Stack Service

**Files:**
- Create: `src/lib/features/compose/tabs/arrange/services/contracts/ICellTransformStack.ts`
- Create: `src/lib/features/compose/tabs/arrange/services/implementations/CellTransformStack.ts`
- Modify: `src/lib/features/compose/tabs/arrange/services/implementations/ArrangeLayerTransformer.ts:17-56`

- [ ] **Step 1: Write test for transform stack replay**

Create `tests/unit/compose/cell-transform-stack.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { CellTransformStack } from '$lib/features/compose/tabs/arrange/services/implementations/CellTransformStack';

describe('CellTransformStack', () => {
  it('replays transform stack in order', async () => {
    const stack = new CellTransformStack();
    const mockSequence = { /* minimal SequenceData */ } as any;
    const transforms = [
      { type: 'mirror' as const, hand: 'both' as const, timestamp: 1 },
      { type: 'rotate45R' as const, hand: 'both' as const, timestamp: 2 },
    ];
    // Verify it calls through to ArrangeLayerTransformer in order
    const result = await stack.computeEffective(mockSequence, transforms);
    expect(result).toBeDefined();
  });

  it('returns original sequence when stack is empty', async () => {
    const stack = new CellTransformStack();
    const seq = { steps: [{ letter: 'A' }] } as any;
    const result = await stack.computeEffective(seq, []);
    expect(result).toBe(seq);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/compose/cell-transform-stack.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create ICellTransformStack interface**

```typescript
// src/lib/features/compose/tabs/arrange/services/contracts/ICellTransformStack.ts
import type { SequenceData } from '$lib/shared/foundation/domain/models/SequenceData';
import type { AppliedTransform } from '$lib/features/compose/compose/domain/types';

export interface ICellTransformStack {
  computeEffective(original: SequenceData, stack: AppliedTransform[]): Promise<SequenceData>;
  push(stack: AppliedTransform[], type: AppliedTransform['type'], hand: AppliedTransform['hand']): AppliedTransform[];
  pop(stack: AppliedTransform[]): AppliedTransform[];
  clear(): AppliedTransform[];
}
```

- [ ] **Step 4: Implement CellTransformStack**

Receives `IArrangeLayerTransformer` as a constructor argument (not resolved from container):

```typescript
// src/lib/features/compose/tabs/arrange/services/implementations/CellTransformStack.ts
import type { ICellTransformStack } from '../contracts/ICellTransformStack';
import type { SequenceData } from '$lib/shared/foundation/domain/models/SequenceData';
import type { AppliedTransform } from '$lib/features/compose/compose/domain/types';
import type { IArrangeLayerTransformer } from '../contracts/IArrangeLayerTransformer';

export class CellTransformStack implements ICellTransformStack {
  constructor(private readonly transformer: IArrangeLayerTransformer) {}

  async computeEffective(original: SequenceData, stack: AppliedTransform[]): Promise<SequenceData> {
    if (stack.length === 0) return original;

    let current = original;
    for (const transform of stack) {
      const result = await this.transformer.applyTransform(current, transform.type);
      if (result.success && result.transformed) {
        current = result.transformed;
      }
    }
    return current;
  }

  push(stack: AppliedTransform[], type: AppliedTransform['type'], hand: AppliedTransform['hand']): AppliedTransform[] {
    return [...stack, { type, hand, timestamp: Date.now() }];
  }

  pop(stack: AppliedTransform[]): AppliedTransform[] {
    return stack.slice(0, -1);
  }

  clear(): AppliedTransform[] {
    return [];
  }
}
```

**Note on `hand` field:** The `hand` field on `AppliedTransform` is stored for undo descriptions and future per-hand transform support. Currently `ArrangeLayerTransformer.applyTransform` applies to both hands. When per-hand transforms are implemented, the `hand` field will be passed through to the underlying `SequenceTransformer`.

- [ ] **Step 4b: Register CellTransformStack in DI container**

Find the compose/arrange DI container and add:

```typescript
cellTransformStack: ({ arrangeLayerTransformer }) =>
  new CellTransformStack(arrangeLayerTransformer),
```

Update the test in Step 1 to instantiate with a mock transformer instead of relying on the DI container.

- [ ] **Step 5: Add rotate45L, rotate45R, and shiftStart to ArrangeLayerTransformer**

In `ArrangeLayerTransformer.ts`, add cases to the switch at line 27:

```typescript
case 'rotate45L':
  transformed = await sequenceTransformer.rotateSequence(sequence, -1);
  break;
case 'rotate45R':
  transformed = await sequenceTransformer.rotateSequence(sequence, 1);
  break;
case 'shiftStart':
  transformed = sequenceTransformer.shiftStartPosition(sequence, 2);
  break;
```

Note: `shiftStartPosition` is synchronous (returns `SequenceData`, not a Promise). Calling with `targetStepNumber: 2` means "make step 2 the new first step." When replaying the transform stack, each chained `shiftStart` advances by 1 beat from the previous result, so repeated applications cycle through all starting positions correctly. Check that this method exists on `SequenceTransformer` — if not, implement it as rotating the `steps` array by 1 position.

- [ ] **Step 6: Run tests, verify passing**

Run: `npx vitest run tests/unit/compose/cell-transform-stack.test.ts`

- [ ] **Step 7: Commit**

```bash
git add src/lib/features/compose/tabs/arrange/services/ tests/unit/compose/
git commit -m "feat(compose): add non-destructive CellTransformStack service

Replays transform stack against original sequence for rendering.
Adds rotate45L/R and shiftStart to ArrangeLayerTransformer."
```

---

## Task 3: Migration & Serialization

**Files:**
- Modify: `src/lib/features/compose/tabs/arrange/services/implementations/ArrangeGridSerializer.ts`
- Modify: `src/lib/features/compose/tabs/arrange/state/arrange-grid-state.svelte.ts`

- [ ] **Step 1: Write migration test**

```typescript
// tests/unit/compose/transform-migration.test.ts
import { describe, it, expect } from 'vitest';
import { migrateAppliedTransforms } from '$lib/features/compose/tabs/arrange/services/implementations/ArrangeGridSerializer';

describe('migrateAppliedTransforms', () => {
  it('converts legacy appliedTransforms to transformStack', () => {
    const legacy = { appliedTransforms: ['rotate90', 'mirror'] };
    const result = migrateAppliedTransforms(legacy);
    expect(result.transformStack).toHaveLength(2);
    expect(result.transformStack[0]).toEqual({ type: 'rotate90', hand: 'both', timestamp: 0 });
    expect(result.transformStack[1]).toEqual({ type: 'mirror', hand: 'both', timestamp: 0 });
  });

  it('preserves existing transformStack', () => {
    const existing = { transformStack: [{ type: 'mirror', hand: 'left', timestamp: 123 }] };
    const result = migrateAppliedTransforms(existing);
    expect(result.transformStack).toEqual(existing.transformStack);
  });

  it('returns empty stack when neither field exists', () => {
    const result = migrateAppliedTransforms({});
    expect(result.transformStack).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/compose/transform-migration.test.ts`

- [ ] **Step 3: Add migration function to ArrangeGridSerializer**

Export a named function with this signature:

```typescript
export function migrateAppliedTransforms(
  layer: { appliedTransforms?: TransformType[]; transformStack?: AppliedTransform[] }
): { transformStack: AppliedTransform[] } {
  if (layer.transformStack) return { transformStack: layer.transformStack };
  if (layer.appliedTransforms) {
    return {
      transformStack: layer.appliedTransforms.map(type => ({
        type,
        hand: 'both' as const,
        timestamp: 0,
      })),
    };
  }
  return { transformStack: [] };
}
```

Apply this migration in the deserialization path where layers are reconstructed.

- [ ] **Step 4: Update serialization to write transformStack**

In `buildLayerQualifiers` (line 134), update to read from `transformStack` instead of `appliedTransforms`. Also update lines 51-55 where `appliedTransforms` is directly accessed (e.g., `l.appliedTransforms?.length`) — these must read from `transformStack` instead.

- [ ] **Step 5: Update arrange-grid-state construction sites**

Every place in `arrange-grid-state.svelte.ts` that creates `TunnelLayerConfig` objects (e.g., `addLayerToCell` at line 490) must initialize `transformStack: []`.

- [ ] **Step 6: Run full test suite and typecheck**

```bash
npx vitest run tests/unit/compose/
npm run check
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/features/compose/ tests/unit/compose/
git commit -m "feat(compose): migrate appliedTransforms to transformStack

Add migration function for legacy persisted data.
Update serializer to read/write transformStack."
```

---

## Task 4: Per-Cell Speed in Playback Engine

**Files:**
- Modify: `src/lib/features/compose/tabs/arrange/services/implementations/ArrangePlaybackEngine.ts:116-135`
- Modify: `src/lib/features/compose/tabs/arrange/components/grid/CellCanvas.svelte:77-98`

- [ ] **Step 1: Add per-cell local beat computation to CellCanvas**

In `CellCanvas.svelte`, replace the `effectiveBeat` derived at line 77:

```typescript
const effectiveBeat = $derived.by(() => {
  const speed = cell.speedMultiplier ?? 1.0;
  return (currentBeat + cell.beatOffset) * speed;
});
```

This is the only playback change needed — the engine stays simple, each cell multiplies the global beat by its speed.

- [ ] **Step 2: Verify the playback engine loop-boundary reset still works**

The existing `% total` in ArrangePlaybackEngine line 130 resets globalBeat to 0 at loop point. With the speed multiplier in CellCanvas, each cell will naturally wrap via the existing `layerBeat % actualBeats` at line 94. No engine changes needed.

- [ ] **Step 3: Run typecheck**

```bash
npm run check
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/compose/tabs/arrange/
git commit -m "feat(compose): per-cell speed multiplier in beat computation

CellCanvas multiplies global beat by cell.speedMultiplier.
Engine remains single-clock; cells diverge within loops."
```

---

## Task 5: Panel-Local State Factory

**Files:**
- Create: `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/state/cell-editor-panel-state.svelte.ts`

- [ ] **Step 1: Create the panel state factory**

```typescript
import type { TargetHand } from '$lib/features/compose/compose/domain/types';

export type ExpandableSection =
  | 'transform' | 'speed' | 'effects' | 'effort' | 'offset' | 'display'
  | null;

export function createCellEditorPanelState() {
  let expandedSection = $state<ExpandableSection>(null);
  let applyToHand = $state<TargetHand>('both');

  return {
    get expandedSection() { return expandedSection; },
    get applyToHand() { return applyToHand; },

    toggleSection(section: ExpandableSection) {
      expandedSection = expandedSection === section ? null : section;
    },

    closeSection() {
      expandedSection = null;
    },

    setApplyToHand(hand: TargetHand) {
      applyToHand = hand;
    },

    resetForNewCell() {
      expandedSection = null;
      applyToHand = 'both';
    },
  };
}

export type CellEditorPanelState = ReturnType<typeof createCellEditorPanelState>;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/compose/tabs/arrange/components/grid/cell-editor/
git commit -m "feat(compose): add cell editor panel state factory

Tracks expanded section and Apply To hand selection.
Resets to defaults when switching cells."
```

---

## Task 6: CellEditorPanel Root Component

**Files:**
- Create: `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/CellEditorPanel.svelte`
- Create: `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/LayerSection.svelte`
- Create: `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/ChipGrid.svelte`

- [ ] **Step 1: Create LayerSection.svelte**

Extracts the layer chip display, copy/remove actions, add layer button, and paste button from the current CellEditor. Props:

```typescript
let {
  cell,
  clipboardHasData,
  onAddSequence,
  onRemoveLayer,
  onCopyLayer,
  onPasteLayer,
}: { /* typed props */ } = $props();
```

Port the layer chip markup from `CellEditor.svelte` lines 133–197, updating to use the new chip design with prop color dots, sequence word, beat count, and layer number.

- [ ] **Step 2: Create ChipGrid.svelte**

The control chips grid component. Props:

```typescript
let {
  cell,
  panelState,
  onToggleBlueVisibility,
  onToggleRedVisibility,
}: { /* typed props */ } = $props();
```

Renders the 8 chips from the spec. Blue/Red chips toggle directly via callbacks. Others call `panelState.toggleSection()`. Chips derive their display values and active states from `cell` props (e.g., `cell.speedMultiplier ?? 1.0`, `cell.effect ?? 'none'`).

- [ ] **Step 3: Create CellEditorPanel.svelte**

The root component that replaces `CellEditor.svelte`. Same props interface as the current `CellEditor.svelte` (lines 14–46), plus new callbacks for per-cell overrides:

```typescript
onSetSpeed: (speed: number) => void;
onSetEffect: (effect: CellEffect) => void;
onSetTrailMode: (mode: TrailMode) => void;
onSetEffort: (effort: string) => void;
onSetBlueVisible: (visible: boolean) => void;
onSetRedVisible: (visible: boolean) => void;
```

Instantiates `createCellEditorPanelState()`. Resets state when `cell.id` changes via `$effect`. Composes: Header → LayerSection → ChipGrid → conditional expanded section → Footer.

- [ ] **Step 4: Wire CellEditorPanel into ArrangeTab**

Find where `CellEditor` is imported in the parent component and replace with `CellEditorPanel`. Add the new per-cell override callbacks that write to `arrangeGridState`.

- [ ] **Step 5: Run typecheck and verify the panel renders**

```bash
npm run check
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/compose/tabs/arrange/
git commit -m "feat(compose): add CellEditorPanel with chip dashboard

LayerSection for layer management, ChipGrid for control chips.
Replaces flat CellEditor with hybrid expandable design."
```

---

## Task 7: Expanded Sections — Transform

**Files:**
- Create: `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/sections/TransformSection.svelte`

- [ ] **Step 1: Build TransformSection component**

Three sub-groups:

1. **Apply To** — segmented control using `panelState.applyToHand`. Three buttons: Left | Both | Right. Active segment gets purple highlight with bottom border.

2. **Rotate** — two-button strip: 45° L (`fa-rotate-left`) and 45° R (`fa-rotate-right`). Each calls `onTransformLayer(layerIndex, 'rotate45L' or 'rotate45R')`.

3. **Rearrange** — 2×3 grid matching the spec table. Each button has:
   - Color-coded icon badge (36×36px rounded square with tinted background)
   - Label + short description
   - Hotkey badge in top-right corner
   - 52px min-height

Props:
```typescript
let {
  panelState,
  onTransform,
}: {
  panelState: CellEditorPanelState;
  onTransform: (type: TransformType) => void;
} = $props();
```

- [ ] **Step 2: Add keyboard shortcut handler to CellEditorPanel**

Add a `keydown` handler scoped to the panel. Only fires when panel is open and no input focused:

```typescript
function handleKeydown(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement) return;
  const key = e.key.toLowerCase();
  const shift = e.shiftKey;
  const map: Record<string, TransformType> = {
    m: 'mirror', v: 'flip', s: 'swapColors', i: 'invert', f: 'shiftStart',
  };
  if (shift && key === 'r') { applyTransform('rewind'); e.preventDefault(); }
  else if (map[key]) { applyTransform(map[key]); e.preventDefault(); }
}
```

- [ ] **Step 3: Wire TransformSection into CellEditorPanel**

Show conditionally when `panelState.expandedSection === 'transform'`. Pass `onTransform` callback that reads `panelState.applyToHand` and pushes to the transform stack via the state.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/compose/tabs/arrange/components/grid/cell-editor/
git commit -m "feat(compose): add TransformSection with rotation, rearrange grid

Apply To hand selector, 45-degree rotation strip, 2x3 color-coded
rearrange grid with hotkeys. Keyboard shortcuts scoped to panel."
```

---

## Task 8: Expanded Sections — Speed, Effects, Effort, Offset, Display

**Files:**
- Create: `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/sections/SpeedSection.svelte`
- Create: `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/sections/EffectsSection.svelte`
- Create: `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/sections/EffortSection.svelte`
- Create: `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/sections/OffsetSection.svelte`
- Create: `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/sections/DisplaySection.svelte`

- [ ] **Step 1: Create SpeedSection**

- Large numeric display (font-size: 22px, font-weight: 600)
- Range input: min 0.25, max 2.0, step 0.25
- 5 preset buttons: 0.25x, 0.5x, 1.0x, 1.5x, 2.0x
- Active preset highlighted with blue tint
- Calls `onSetSpeed(value)` on change

- [ ] **Step 2: Create EffectsSection**

- Radio-style chips: None, Fire, Charcoal, LED, Trails
- Each chip has a colored dot or icon
- When Trails selected, show sub-group: Fade, Persistent, Loop Clear
- Calls `onSetEffect(effect)` and `onSetTrailMode(mode)`

- [ ] **Step 3: Create EffortSection**

- 8 chips in a flex-wrap grid: Flow, Sharp, Smooth, Pulse, Heavy, Light, Staccato, Neutral
- Each has a colored dot matching its effort color
- Active chip gets purple-tinted border
- Calls `onSetEffort(key)`

- [ ] **Step 4: Create OffsetSection**

- +/– buttons (44px square) flanking a large numeric display
- Unit label "beats"
- Min value: 0
- Calls `onSetOffset(value)` on change

- [ ] **Step 5: Create DisplaySection**

- Radio-style: Animation, Choreo Card
- Choreo Card disabled when cell has multiple layers (show tooltip explaining why)
- Calls `onMediaTypeChange(type)`

- [ ] **Step 6: Wire all sections into CellEditorPanel**

Each section renders conditionally based on `panelState.expandedSection`. Pass the corresponding callbacks.

- [ ] **Step 7: Run typecheck**

```bash
npm run check
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/features/compose/tabs/arrange/components/grid/cell-editor/
git commit -m "feat(compose): add Speed, Effects, Effort, Offset, Display sections

All expandable sections for the cell editor chip dashboard.
Per-cell speed multiplier, visual effects, effort presets,
beat offset stepper, and display mode selection."
```

---

## Task 9: Per-Cell Overrides in Grid State

**Files:**
- Modify: `src/lib/features/compose/tabs/arrange/state/arrange-grid-state.svelte.ts`

- [ ] **Step 1: Add setter methods for per-cell overrides**

The arrange grid state is a factory function (not a class). Add these methods following the existing pattern (cells are accessed via `cells` array with `findIndex`):

```typescript
setCellSpeed(cellId: string, speed: number) {
  const idx = cells.findIndex(c => c.id === cellId);
  if (idx >= 0) cells[idx].speedMultiplier = Math.max(0.25, Math.min(2.0, speed));
},

setCellEffect(cellId: string, effect: CellEffect) {
  const idx = cells.findIndex(c => c.id === cellId);
  if (idx >= 0) cells[idx].effect = effect;
},

setCellTrailMode(cellId: string, mode: TrailMode) {
  const idx = cells.findIndex(c => c.id === cellId);
  if (idx >= 0) cells[idx].trailMode = mode;
},

setCellEffort(cellId: string, effort: string) {
  const idx = cells.findIndex(c => c.id === cellId);
  if (idx >= 0) cells[idx].effort = effort;
},

setCellMotionVisibility(cellId: string, color: 'blue' | 'red', visible: boolean) {
  const idx = cells.findIndex(c => c.id === cellId);
  if (idx < 0) return;
  if (color === 'blue') cells[idx].blueMotionVisible = visible;
  else cells[idx].redMotionVisible = visible;
},

setCellBeatOffset(cellId: string, offset: number) {
  const idx = cells.findIndex(c => c.id === cellId);
  if (idx >= 0) cells[idx].beatOffset = Math.max(0, offset);
},
```

Note: `setCellBeatOffset` writes to the existing `beatOffset` field on `GridCell`. The OffsetSection in Task 8 calls this via `onSetOffset`.

- [ ] **Step 2: Pass per-cell visibility to CellCanvas renderers**

In `CellCanvas.svelte`, derive visibility from cell state and pass to `AnimatorCanvas`:

```typescript
const blueVisible = $derived(cell.blueMotionVisible ?? true);
const redVisible = $derived(cell.redMotionVisible ?? true);
```

Pass these to the animation renderer to control per-hand opacity.

- [ ] **Step 3: Run typecheck**

```bash
npm run check
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/compose/tabs/arrange/
git commit -m "feat(compose): add per-cell override setters to grid state

Speed, effect, trail mode, effort, and motion visibility
can now be set per-cell via arrange grid state methods."
```

---

## Task 10: Cell Context Menu

**Files:**
- Create: `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/context-menu/CellContextMenuBuilder.ts`
- Create: `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/context-menu/CellContextMenuHost.svelte`
- Modify: `src/lib/features/compose/tabs/arrange/components/grid/CompositionGrid.svelte`

- [ ] **Step 1: Create CellContextMenuBuilder**

Follow the `CanvasContextMenuBuilder` pattern. Build menu items from `GridCell` state:

```typescript
export class CellContextMenuBuilder {
  build(cell: GridCell, callbacks: CellContextMenuCallbacks): ContextMenuItem[] {
    return [
      this.buildTransformSubmenu(cell, callbacks),
      this.buildSpeedSubmenu(cell, callbacks),
      this.buildEffectsSubmenu(cell, callbacks),
      this.buildVisibilitySubmenu(cell, callbacks),
      this.buildEffortSubmenu(cell, callbacks),
      { type: 'separator' },
      { id: 'copy-cell', label: 'Copy Cell', icon: 'fas fa-copy', action: callbacks.onCopyCell },
      { id: 'clear-cell', label: 'Clear Cell', icon: 'fas fa-trash-can', danger: true, action: callbacks.onClearCell },
    ];
  }
  // ... submenu builder methods
}
```

- [ ] **Step 2: Create CellContextMenuHost**

Wrap the shared `ContextMenu` component. Accept `cell` and `callbacks` props. Expose `openContextMenu(x, y)` function. Build items via `CellContextMenuBuilder`.

- [ ] **Step 3: Wire into CompositionGrid**

Add right-click and long-press handlers to each cell in the grid. On trigger, call `cellContextMenuHost.openContextMenu(e.clientX, e.clientY)` with the targeted cell.

- [ ] **Step 4: Run typecheck**

```bash
npm run check
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/compose/tabs/arrange/
git commit -m "feat(compose): add cell context menu with full control mirroring

Right-click or long-press any cell for transform, speed, effects,
visibility, effort, copy, and clear actions. Uses existing
ContextMenu primitive with builder pattern."
```

---

## Task 11: Delete Old CellEditor & Final Integration

**Files:**
- Delete: `src/lib/features/compose/tabs/arrange/components/grid/CellEditor.svelte`
- Modify: parent component that imports `CellEditor`

- [ ] **Step 1: Search for all CellEditor imports**

```bash
grep -r "CellEditor" src/lib/features/compose/ --include="*.svelte" --include="*.ts"
```

Replace every import of `CellEditor.svelte` with `cell-editor/CellEditorPanel.svelte`.

- [ ] **Step 2: Delete the old CellEditor.svelte**

```bash
rm src/lib/features/compose/tabs/arrange/components/grid/CellEditor.svelte
```

- [ ] **Step 3: Run full typecheck and build**

```bash
npm run check
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add -A src/lib/features/compose/
git commit -m "feat(compose): remove old CellEditor, complete cell editor redesign

Delete flat-grid CellEditor.svelte, replaced by hybrid chip
dashboard in cell-editor/CellEditorPanel.svelte."
```

---

## Task 12: Visual Polish & Touch Target Audit

**Files:**
- Various `.svelte` files in `cell-editor/`

- [ ] **Step 1: Audit all interactive elements for 44px min-height**

Check every button, chip, segmented control segment, and list item in the cell editor. Add `min-height: 44px` where missing.

- [ ] **Step 2: Verify chip active states match spec colors**

- Blue visibility: `rgba(37,99,235,0.12)` bg, `rgba(37,99,235,0.35)` border
- Red visibility: `rgba(220,38,38,0.12)` bg, `rgba(220,38,38,0.35)` border
- Trails/Effects: `rgba(249,115,22,0.1)` bg, `rgba(249,115,22,0.3)` border
- Effort: `rgba(168,85,247,0.1)` bg, `rgba(168,85,247,0.3)` border
- Muted: `rgba(255,255,255,0.02)` bg, `rgba(255,255,255,0.05)` border

- [ ] **Step 3: Verify slide-down animation on section expand**

```css
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}
/* 180ms ease-out */
```

- [ ] **Step 4: Test on mobile viewport (375px width)**

Verify chips wrap properly, touch targets are reachable, and expanded sections don't overflow.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/compose/
git commit -m "fix(compose): polish cell editor touch targets and active states

44px minimum touch targets throughout. Chip colors match spec.
Slide-down animation on section expand. Mobile-verified."
```
