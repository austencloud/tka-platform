---
status: backlog
value: 3
effort: L
remaining: "UI: add/remove buttons, formation picker, undo, persistence"
depends_on: ""
plan_path: plans/backlog/2026-04-11-multi-avatar-foundation.md
tags: []
last_triaged: 2026-04-26
---
# Multi-Avatar Foundation Design

**Date:** 2026-04-11
**Status:** Design approved (revised after codebase audit), ready for implementation planning
**Scope:** Standalone 3D viewer (`src/lib/shared/3d/`) — integration + UX + undo, built on top of pre-existing multi-performer infrastructure.

## Context: Audit of pre-existing infrastructure

An initial draft of this spec proposed building a multi-avatar system from scratch. A pre-implementation codebase audit revealed that most of the underlying infrastructure already exists and is in active use by other features (realm/Village, museum, duet). This revision adopts the existing primitives and narrows the spec to what actually needs to be built.

### Pre-existing and reusable

**Domain (`src/lib/shared/3d/domain/formation.ts`):**
- `FormationPreset` union: `"grid-2x2" | "line" | "circle" | "v-shape" | "diagonal" | "custom"`
- `FacingMode` union: `"same-direction" | "face-center" | "face-outward" | "custom"`
- `Position2D`, `FormationSlot`, `Formation`, `FormationTransition` interfaces
- `createFormation`, `calculateFacingAngle`, `lerpPosition`, `lerpAngle`, `getTransitionSlotPosition` helpers

**Preset library (`src/lib/shared/3d/config/formation-presets.ts`):**
- Five preset generators: `generateGrid2x2Slots`, `generateLineSlots`, `generateCircleSlots`, `generateVShapeSlots`, `generateDiagonalSlots`
- `getSlotsForPreset(preset, count)` dispatcher
- `createFormationFromPreset(preset, count)`
- `FORMATION_PRESETS`, `FORMATION_PRESET_INFO` (with Font Awesome icons for UI display)

**State manager (`src/lib/shared/3d/state/performer-manager.svelte.ts`):**
- `createPerformerManager(deps)` factory owning a reactive `performers: AvatarInstanceState[]` array
- Already implements `addPerformer`, `removePerformer`, `selectPerformer`, `handleDrag`
- Already implements `applyFormationPreset`, `transitionToFormation` (smooth-animated), `updateFormationTransition`
- Integrates with `AvatarSyncState` for two-performer sync

**Service layer:**
- `IFormationManager` contract and `FormationManager` implementation
- `PerformerSynchronizer` factory registered in the 3D DI container
- `FormationSelector.svelte` UI component for picking a formation preset

**Constants:**
- `STAGE.MAX_PERFORMERS = 4` (shared across realm, museum, duet, viewer)
- `getDefaultPositions(count)` for 1-4 performers

### Active consumers of `PerformerManager` (not to be broken)

Found via grep: `WorldScene.svelte` (realm/Village), `Museum3DScene.svelte`, `DuetOrchestrator.svelte`, `components/panels/PerformerManager.svelte`, game-bridge tests, game-bridge types. Any additions to `PerformerManager`'s API must be backward-compatible — no method signature changes, no semantic changes to existing fields.

### Still missing (this spec's actual scope)

1. **Integration** — `createViewer3DState` still holds a single `avatarState: AvatarInstanceState | null`. It does not use `PerformerManager`. The viewer is the only 3D surface that hasn't been wired up to multi-performer state.
2. **Selection scope with "All"** — `PerformerManager.activePerformerIndex` is always a number. The viewer needs a `null`-able selection to represent "edit every performer at once."
3. **Fan-out writes** — per-performer plane toggles, effect toggles, and sequence changes from a single UI action.
4. **Click-in-scene raycasting** — hit-test performer bodies to set the selection.
5. **Chip strip UI** — compact per-performer selector pinned above the gear popover's tab bar, with an "All" chip.
6. **Missing formation presets** — my brainstorm called out six formations that aren't in the existing preset library: `solo`, `tunnel-stack`, `back-to-back`, `facing-each-other`, `stage-lr`, `side-by-side`. They need to be added to the existing `formation-presets.ts`.
7. **Undo integration** — no undo exists for spatial edits, formation changes, spawn, or remove in the 3D viewer.
8. **Per-performer persistence** — current persistence is strictly single-avatar.
9. **Viewer-specific performer cap raised to 8** — without disturbing the shared `STAGE.MAX_PERFORMERS` that realm/museum/duet depend on.

## Goal

Wire the existing `PerformerManager` into the standalone 3D viewer, add per-performer selection and fan-out editing, extend the formation preset library with the missing presets, and give the viewer an undoable multi-performer UX — all without disturbing the realm, museum, or duet features that already depend on `PerformerManager`.

### Reframing: the viewer is a 3D lens, not a 2D-sequence shadow

The current viewer layout pairs a 2D sequence card with a 3D animation pane, both locked to the same source — the active sequence in the viewer layout. This foundation deliberately treats the 3D pane as **a configurable 3D lens**, not as "the 2D card's 3D shadow." For v1, there is exactly one source ("the currently-active 2D sequence"), and the caller passes its `SequenceData` into `enter3D` exactly as today. The state factory is source-agnostic — it holds a `performers` array and doesn't assume any specific origin — so later work can add a source picker (Village villager, library sequence, Compose cell, empty sandbox, etc.) without refactoring the foundation. The source-picker UX itself is a follow-up; see Open Question #10.

Users should be able to:

- Click `+` to add a second (or third, or eighth) performer to the scene.
- Click a performer's body in the 3D scene to select them, or pick their chip from a strip in the gear popover.
- Pick a formation preset from the existing `FormationSelector` — new presets (back-to-back, stage-lr, etc.) appear in the same dropdown alongside the existing grid/line/circle/v-shape/diagonal.
- Manually drag or nudge individual performers with Ctrl+Z to recover from accidents.
- Edit each performer's planes, effects, and sequence independently — scope follows selection.
- Toggle "All" to edit every performer at once as a convenience.

## Non-Goals (Deferred)

- **Variation presets** (mirrored, rotated, time-shifted sequences per performer) — separate spec.
- **Compose cell `mediaType: "viewer-3d"` rendering** — separate spec, builds on this one.
- **Per-performer independent playback heads** — everyone still shares the single playback loop.
- **Visual selection indicator design** (ring vs outline vs label vs combo) — confirmed requirement, needs a dedicated mockup-comparison session. A temporary placeholder ground disc ships during implementation.
- **"Home" performer / crown marker** — ships with the variation work.
- **Tunnel-mode 2D rendering of spatially-separated formations** — parked on the Compose side of the work.
- **Auto-spawn-to-match-formation** — v1 grays out formations whose `validLayerCounts` doesn't match the current count; applying them no-ops.
- **Raising the shared `STAGE.MAX_PERFORMERS`** — this spec adds a new viewer-specific constant instead, to avoid risking downstream features that assume the shared cap.
- **Renaming `AvatarInstanceState` → `PerformerInstanceState`** — the existing convention is "performer" at the manager level and "avatar" at the instance level. The rename would fight the convention and break referents across at least four feature modules.
- **Adding spatial fields to Compose's `TunnelLayerConfig`** — spatial data lives on `AvatarInstanceState` (via `position.x`, `position.z`, `setFacingAngle`) and is managed by `PerformerManager`. Compose tunnel layers never needed this field.

## Terminology

- **Performer** — the manager-level concept: one body in the scene, backed by an `AvatarInstanceState`.
- **AvatarInstanceState** — the instance-level state factory for one performer. Already exists, holds sequence, pose, position, facing, plane assignments, effect state.
- **PerformerManager** — the state factory that owns a reactive array of performers. Already exists, handles spawn/remove/select/formation transitions.
- **FormationPreset** — the string union of named formations. Already exists.
- **Formation** — a computed set of slots (position + optional facing) for a given preset and performer count. Already exists.
- **Selection scope** — the viewer-specific concept this spec adds: either a specific performer index or `null` (meaning "All"). Lives on top of `PerformerManager`, not inside it, so realm/museum/duet keep their simpler index model.

## State integration

### Wiring `PerformerManager` into `createViewer3DState`

Today, `createViewer3DState` (in `src/lib/shared/3d/state/viewer-3d-state.svelte.ts`) holds:

```ts
let avatarState = $state<AvatarInstanceState | null>(null);
```

and instantiates one `AvatarInstanceState` on `enter3D`. After this spec, it holds:

```ts
const performerManager = createPerformerManager({
  propInterpolator: deps.propInterpolator,
  sequenceConverter: deps.sequenceConverter,
  initialAvatarId: DEFAULT_AVATAR_ID,
});

// Viewer-specific selection layer (not part of PerformerManager's API):
let selectedPerformerIndex = $state<number | null>(null); // null = "All"
```

and `enter3D(sequenceData)` calls `performerManager.initialize()` once, then `performerManager.performers[0].loadSequence(sequenceData)`. Additional performers spawned later get a structural copy of the currently-selected performer's state (or performer 0's if selection is "All").

### Transitional compatibility

`createViewer3DState` temporarily exposes a getter `avatarState` that returns `performerManager.performers[0] ?? null` so existing components that read `viewer3DState.avatarState` keep compiling. The getter is removed in a later step once every component has been updated to read from `performerManager.performers[index]` or iterate the array.

### Viewer-specific scope helpers

These live in `viewer-3d-state.svelte.ts` as closures over the manager, not as methods on `PerformerManager` itself:

```ts
function scopedPerformers(): AvatarInstanceState[] {
  if (selectedPerformerIndex === null) return performerManager.performers;
  const p = performerManager.performers[selectedPerformerIndex];
  return p ? [p] : [];
}

function selectPerformerScope(index: number | null): void {
  // null = "All"
  selectedPerformerIndex = index;
}

function togglePlaneScoped(plane: Plane): void {
  for (const p of scopedPerformers()) {
    p.togglePlane(plane);  // existing method on AvatarInstanceState
  }
}

function toggleEffectScoped(name: string): void {
  for (const p of scopedPerformers()) {
    p.toggleEffect(name);  // existing method
  }
}
```

The mutators that need scope routing are: `togglePlane`, `toggleEffect`, plane assignment setters, and any per-performer sequence loading.

### Viewer-specific performer cap

A new constant is added to `scale-constants.ts`:

```ts
/** Viewer-specific max — the viewer allows up to 8 performers, while other features (realm, museum, duet) continue to use the shared STAGE.MAX_PERFORMERS = 4. */
MAX_VIEWER_PERFORMERS: 8,
```

The viewer reads this constant when showing the "+" button enabled/disabled state and when calling `addPerformer`. `PerformerManager`'s existing `addPerformer()` checks the shared `STAGE.MAX_PERFORMERS`:

```ts
function addPerformer() {
  if (performerStates.length >= MAX_PERFORMERS) return;  // too restrictive for viewer
  // ...
}
```

Two options:

- **A)** Add a new method `addPerformerUpTo(cap: number)` to `PerformerManager` that takes a caller-specified cap. Backward-compatible; the existing `addPerformer()` keeps its `MAX_PERFORMERS = 4` behavior for realm/museum/duet.
- **B)** Parameterize `PerformerManager`'s cap at factory-creation time via a `maxPerformers?: number` option on `PerformerManagerDeps`, defaulting to `STAGE.MAX_PERFORMERS`. The viewer passes 8 at construction; other callers pass nothing and get the default.

**Recommendation: B.** It's a one-field addition to an existing deps interface, strictly backward-compatible (defaulted), and each caller configures its own cap at the natural place (the DI wiring or factory call site).

## Formation preset additions

The existing `src/lib/shared/3d/config/formation-presets.ts` gains six new preset generators and the `FormationPreset` union in `domain/formation.ts` gains six new members.

### Expanded `FormationPreset` union

```ts
// domain/formation.ts
export type FormationPreset =
  // Existing
  | "grid-2x2"
  | "line"
  | "circle"
  | "v-shape"
  | "diagonal"
  | "custom"
  // New
  | "solo"
  | "tunnel-stack"
  | "back-to-back"
  | "facing-each-other"
  | "stage-lr"
  | "side-by-side";
```

### New preset generators

Added to `formation-presets.ts`, each following the shape of the existing `generateLineSlots` / `generateCircleSlots` / etc.:

```ts
function generateSoloSlots(count: number): FormationSlot[] {
  return [{ index: 0, position: { x: 0, z: FORMATION_WALL_OFFSET } }];
}

function generateTunnelStackSlots(count: number): FormationSlot[] {
  // Conga line along -Z (receding from audience), all facing +Z
  const depth = DEFAULT_FORMATION_SPACING * 0.6; // 1.2m between stacked performers
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    position: { x: 0, z: FORMATION_WALL_OFFSET + i * -depth },
  }));
}

function generateBackToBackSlots(count: number): FormationSlot[] {
  // Both performers at origin, facing opposite directions
  if (count < 2) return generateSoloSlots(count);
  return [
    { index: 0, position: { x: 0, z: FORMATION_WALL_OFFSET }, facingAngle: 0 },
    { index: 1, position: { x: 0, z: FORMATION_WALL_OFFSET }, facingAngle: Math.PI },
  ];
}

function generateFacingEachOtherSlots(count: number): FormationSlot[] {
  // Performers at ±0.5m, facing inward
  if (count < 2) return generateSoloSlots(count);
  return [
    { index: 0, position: { x: -0.5, z: FORMATION_WALL_OFFSET }, facingAngle: Math.PI / 2 },
    { index: 1, position: { x:  0.5, z: FORMATION_WALL_OFFSET }, facingAngle: -Math.PI / 2 },
  ];
}

function generateStageLRSlots(count: number): FormationSlot[] {
  // Left and right at the front of the stage, both facing audience
  if (count < 2) return generateSoloSlots(count);
  return [
    { index: 0, position: { x: -2.5, z: FORMATION_WALL_OFFSET } },
    { index: 1, position: { x:  2.5, z: FORMATION_WALL_OFFSET } },
  ];
}

function generateSideBySideSlots(count: number): FormationSlot[] {
  // Evenly spaced along X, all facing audience
  const spacing = 1.8;
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    position: { x: (i - (count - 1) / 2) * spacing, z: FORMATION_WALL_OFFSET },
  }));
}
```

### Dispatcher update

`getSlotsForPreset` gains six new switch cases:

```ts
case "solo":              return generateSoloSlots(count);
case "tunnel-stack":      return generateTunnelStackSlots(count);
case "back-to-back":      return generateBackToBackSlots(count);
case "facing-each-other": return generateFacingEachOtherSlots(count);
case "stage-lr":          return generateStageLRSlots(count);
case "side-by-side":      return generateSideBySideSlots(count);
```

### `FORMATION_PRESET_INFO` additions

Six new entries with Font Awesome icons for the UI picker:

```ts
{ id: "solo",              name: "Solo",              description: "Single performer, centered",       icon: "user" },
{ id: "tunnel-stack",      name: "Tunnel Stack",      description: "Conga line behind each other",      icon: "layer-group" },
{ id: "back-to-back",      name: "Back-to-Back",      description: "Two performers, opposite facings",  icon: "user-friends" },
{ id: "facing-each-other", name: "Facing Each Other", description: "Two performers, facing inward",     icon: "people-arrows" },
{ id: "stage-lr",          name: "Stage L/R",         description: "Left and right of stage",           icon: "arrows-alt-h" },
{ id: "side-by-side",      name: "Side-by-Side",      description: "Evenly spaced in one row",          icon: "grip-lines" },
```

### Valid performer counts per preset

To support "grayed out in dropdown if not applicable," each preset declares its valid counts. A new table in `formation-presets.ts`:

```ts
export const PRESET_VALID_COUNTS: Record<FormationPreset, number[]> = {
  "solo":              [1],
  "grid-2x2":          [1, 2, 3, 4],
  "line":              [1, 2, 3, 4, 5, 6, 7, 8],
  "circle":            [1, 2, 3, 4, 5, 6, 7, 8],
  "v-shape":           [1, 2, 3, 4, 5, 7],  // odd counts work best, but even still renders
  "diagonal":          [1, 2, 3, 4, 5, 6, 7, 8],
  "tunnel-stack":      [2, 3, 4, 5, 6, 7, 8],
  "back-to-back":      [2],
  "facing-each-other": [2],
  "stage-lr":          [2],
  "side-by-side":      [2, 3, 4, 5, 6, 7, 8],
  "custom":            [1, 2, 3, 4, 5, 6, 7, 8],
};
```

The existing presets are extended to accept counts up to 8 where they gracefully handle it (line, circle, diagonal already use count-agnostic math; grid-2x2 stays capped at 4 because it's specifically a 2x2 shape).

## Selection & Scope UI

### Click-in-scene raycasting

`Viewer3DScene.svelte` adds a Three.js raycaster wired to the performer body meshes. On pointerdown:

- Hit a performer body → `viewer3DState.selectPerformerScope(index)`
- Hit empty space (or any non-performer mesh) → `viewer3DState.selectPerformerScope(null)` ("All")

The raycaster ignores ground geometry, grid planes, and props — only performer body meshes are hit targets. The test is no-op during camera drag (`OrbitControls` drag state is read to suppress selection during rotations).

### Chip strip

A new component `PerformerChipStrip.svelte` lives at the top of `Viewer3DGearPopover.svelte`, above the tab bar, visible whenever `performerManager.performers.length ≥ 2`. Layout:

```
[All] · [1] [2] [3] [+]
```

- **"All" chip.** Pinned leftmost, visually distinct (pill shape, wider, labeled "All"). Represents `selectedPerformerIndex === null`.
- **Performer chips.** One per performer, ~28px circles, tinted with the performer's prop color scheme (read from `AvatarInstanceState.propColors` if exposed, or derived from the existing `TUNNEL_LAYER_COLORS` indexing pattern). Displays the performer index as a single digit. Active chip has a glow matching the color.
- **"+" spawn button.** Rightmost, same size as performer chips, enabled when `performers.length < STAGE.MAX_VIEWER_PERFORMERS` (8). Disabled at cap.

The strip stays synchronized with scene selection in both directions: clicking a chip calls `viewer3DState.selectPerformerScope`, which updates the scene highlight; clicking a body in the scene updates the active chip.

### Visual selection indicator

**Status: deferred.** Confirmed requirement — the selected performer must be visually distinguishable in the 3D scene — but specific visual treatment (ring, outline, floating label, combo) needs a dedicated mockup-comparison session. Implementation ships with a simple translucent ground disc as a temporary placeholder.

## Formation Picker UI

The existing `FormationSelector.svelte` already renders a dropdown of `FormationPreset` values. Two changes:

1. **Filter/gray-out based on performer count.** After this spec's preset additions, the dropdown shows every entry in `FORMATION_PRESET_INFO`, but entries whose preset is not in `PRESET_VALID_COUNTS[preset].includes(currentCount)` are visually grayed out and clicking them no-ops (with a tooltip: "Requires N performers").
2. **Expose it inside the gear popover's Performers tab.** The existing `FormationSelector.svelte` may be currently embedded elsewhere (realm, museum). Keeping its original embedding intact, mount a second instance inside the viewer's Performers tab. Or lift the component into a shared location and mount from both places. Implementation picks whichever is less invasive.

### Performers tab contents (the renamed "Avatar" tab)

```
┌─ Performers tab ─────────────────────┐
│  Formation: [ Back-to-Back ▼ ]       │
│                                      │
│  ── Selected performer ──            │
│  Position X:  [-2.5 ] [  +  ] [  - ] │
│  Position Z:  [ 0.0 ] [  +  ] [  - ] │
│  Facing:      [ 180° ] [ ↻ dial ]    │
│                                      │
│  Sequence:    [sequence-name] [Change] │
│                                      │
│  [ Remove Performer ]                │
└──────────────────────────────────────┘
```

When "All" is selected, the per-performer fields hide or disable; only the formation dropdown remains active.

## Spawn & Remove Flow

### Spawn

The "+" chip (or "+" button inside the Performers tab) calls:

```ts
function addPerformerFromUI(): void {
  if (performerManager.performers.length >= STAGE.MAX_VIEWER_PERFORMERS) return;

  // 1. Determine source: currently selected, or performer[0] if "All"
  const sourceIndex = selectedPerformerIndex ?? 0;
  const source = performerManager.performers[sourceIndex];
  if (!source) return;

  // 2. Snapshot source state for undo
  undoManager.pushSnapshot("spawn", captureViewerSnapshot());

  // 3. Delegate to PerformerManager (existing method)
  performerManager.addPerformer();

  // 4. Copy source's editable state onto the new performer
  const newIndex = performerManager.performers.length - 1;
  const newPerf = performerManager.performers[newIndex];
  if (newPerf && source !== newPerf) {
    newPerf.loadSequence(source.sequence);
    newPerf.setCustomBluePlane(source.customBluePlane);
    newPerf.setCustomRedPlane(source.customRedPlane);
    // etc. — match the AvatarInstanceState public surface
  }

  // 5. Select the new performer
  selectedPerformerIndex = newIndex;
}
```

`PerformerManager.addPerformer()` already handles spawning at the formation-managed position and calls `updatePositions()`. We delegate to it rather than computing positions ourselves.

### Remove

```ts
function removePerformerFromUI(index: number): void {
  if (performerManager.performers.length === 1) return;

  undoManager.pushSnapshot("remove", captureViewerSnapshot());
  performerManager.removePerformer();  // existing — removes last

  // If removed index was selected, fall back to previous
  if (selectedPerformerIndex === index) {
    selectedPerformerIndex = Math.max(0, index - 1);
  } else if (selectedPerformerIndex !== null && selectedPerformerIndex > index) {
    selectedPerformerIndex -= 1;
  }
}
```

**Caveat:** `PerformerManager.removePerformer()` always removes the *last* performer, not a specific index. For v1 this is acceptable — the chip strip's remove-button targets the currently selected performer, and we reorder internally by always acting on the last one. If UX needs "remove performer #3 from a 5-performer scene keeping 1/2/4/5," that's a follow-up enhancement to `PerformerManager` itself and lives outside this spec.

Right-click "Duplicate" on a chip calls the spawn path with the right-clicked performer as the explicit source.

## Formation Application (with undo)

Picking a formation from `FormationSelector` triggers:

```ts
function applyFormationFromUI(preset: FormationPreset): void {
  // Guard: preset must support the current count
  const validCounts = PRESET_VALID_COUNTS[preset];
  if (!validCounts.includes(performerManager.performers.length)) return;

  // Snapshot for undo
  undoManager.pushSnapshot("formation", captureViewerSnapshot());

  // Delegate to PerformerManager's smooth transition (default 500ms)
  performerManager.transitionToFormation(
    createFormationFromPreset(preset, performerManager.performers.length),
    500
  );
}
```

Using `transitionToFormation` rather than `applyFormationPreset` gets the existing smooth-animation path for free. The earlier draft proposed a hard snap; the existing code already does something better, so we adopt it.

Manual position/facing edits push separate snapshots of type `"spatial"`, coalesced within a 300ms window so a held numeric spinner doesn't flood the undo stack with one entry per tick.

## Undo Integration

### Pattern

The existing Create module (`src/lib/features/create/shared/services/implementations/UndoManager.ts`) uses a **snapshot pattern**: each push captures a full serializable state snapshot; undo restores the snapshot. This is simpler than a command pattern for a small, bounded scope and matches project conventions. We adopt it.

### Interface

```ts
// src/lib/shared/3d/services/contracts/IViewer3DUndoManager.ts
export interface ViewerSnapshot {
  performers: Array<{
    id: string;
    position: { x: number; z: number };
    facingAngle: number;
    customBluePlane: Plane;
    customRedPlane: Plane;
    effectToggles: Record<string, boolean>;
    // sequence is referenced, not inlined
    sequenceRef: { ownerId: string; sequenceId: string } | null;
  }>;
  selectedPerformerIndex: number | null;
  activeFormation: FormationPreset | "manual";
  timestamp: number;
}

export type ViewerOperationType = "spawn" | "remove" | "formation" | "spatial";

export interface ViewerUndoEntry {
  id: string;
  type: ViewerOperationType;
  beforeState: ViewerSnapshot;
  afterState?: ViewerSnapshot;
  timestamp: number;
}

export interface IViewer3DUndoManager {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly maxHistorySize: number;

  pushSnapshot(type: ViewerOperationType, before: ViewerSnapshot): string;
  undo(): ViewerUndoEntry | null;
  redo(): ViewerUndoEntry | null;
  clearHistory(): void;
  clearRedoHistory(): void;
}
```

### Implementation

Follows the pattern from `src/lib/features/create/shared/services/implementations/UndoManager.ts`:

- Internal `_undoHistory: ViewerUndoEntry[]` and `_redoHistory: ViewerUndoEntry[]`.
- Max history: 50 entries (drops oldest on overflow).
- Push clears the redo stack.
- **Snapshot lifecycle:** `pushSnapshot(type, beforeState)` creates an entry with `beforeState` set and `afterState: undefined`. Immediately after the mutation completes, the caller updates the same entry with `afterState = captureViewerSnapshot()`. This two-step pattern matches the Create module's approach — one captures on push, the caller completes the entry at commit time.
- **Undo:** pops the top entry off the undo stack onto the redo stack. The viewer state factory restores the entry's `beforeState` onto the live state.
- **Redo:** pops the top entry off the redo stack back onto the undo stack. The viewer state factory restores the entry's `afterState` onto the live state. Redo is a no-op if `afterState` is undefined (shouldn't happen in practice because the mutation either completes or the push is rolled back).
- No persistence across page reloads — the undo history is ephemeral, same as the Compose `ArrangeUndoManager`.

### Wiring

- Registered in `3d-container.ts` as a new tier-3 entry:
  ```ts
  viewer3DUndoManager: () => new Viewer3DUndoManager(),
  ```
- `createViewer3DState` receives it as a constructor dep (add to `Viewer3DStateDeps`).
- Ctrl+Z / Ctrl+Shift+Z keybindings registered via a new `Viewer3DKeyboardHandler` when the viewer is focused. Disabled when the user is typing in a text input anywhere in the popover.

### Scope

**In scope for v1 undo:**
- Formation application (via `transitionToFormation`)
- Spatial edits (position nudges, facing dial commits)
- Performer spawn
- Performer remove

**Out of scope for v1:**
- Plane toggles
- Effect toggles
- Sequence changes per performer
- Camera moves
- Grid plane visibility toggles

Rationale: undo is expensive to build correctly, and the operations above are either cheap to redo manually (plane/effect toggles) or have their own affordances (camera presets).

## Persistence

### New localStorage keys

```
tka-viewer3d-performers       // JSON: PerformerSnapshot[]
tka-viewer3d-activeFormation  // JSON: FormationPreset | "manual"
tka-viewer3d-selectedIndex    // JSON: number | null
```

### `PerformerSnapshot` shape

```ts
interface PerformerSnapshot {
  sequenceRef: { ownerId: string; sequenceId: string } | null;
  position: { x: number; z: number };
  facingAngle: number;
  customBluePlane: Plane;
  customRedPlane: Plane;
  effectToggles: Record<string, boolean>;
}
```

Sequences are referenced, not inlined, matching the rest of the app.

### Deprecated keys

```
tka-viewer3d-visiblePlanes   // deprecated: planes are now per-performer
```

### Migration path on load

1. If `tka-viewer3d-performers` exists → parse and use it to reconstruct the performer array after `enter3D`.
2. Else if the deprecated `tka-viewer3d-visiblePlanes` exists → construct a single-performer snapshot with those plane assignments, save to the new key, delete the old key.
3. Else → initialize with zero persisted performers (the default single-performer scene on `enter3D` is the baseline).

Migration runs once per user on the first load after this spec ships.

## File Structure

Only the files that change or are created. Unchanged files not listed.

```
src/lib/shared/3d/
├── scale/scale-constants.ts                          [MODIFY — add MAX_VIEWER_PERFORMERS = 8]
├── domain/formation.ts                               [MODIFY — extend FormationPreset union with 6 new values]
├── config/formation-presets.ts                       [MODIFY — add 6 generators, update dispatcher, add PRESET_VALID_COUNTS, update FORMATION_PRESET_INFO]
├── state/
│   ├── viewer-3d-state.svelte.ts                     [MAJOR: wire in PerformerManager, add selection scope, fan-out helpers, undo wiring, persistence]
│   └── performer-manager.svelte.ts                   [MINOR: add optional maxPerformers to PerformerManagerDeps, gate addPerformer on it]
├── services/
│   ├── contracts/IViewer3DUndoManager.ts             [NEW]
│   └── implementations/Viewer3DUndoManager.ts        [NEW]
├── keyboard/Viewer3DKeyboardHandler.ts               [NEW — Ctrl+Z/Ctrl+Shift+Z bindings]
├── components/
│   ├── Viewer3DScene.svelte                          [MODIFY — iterate performers, add raycaster, render ground-disc placeholder for selected]
│   ├── Viewer3DGearPopover.svelte                    [MODIFY — mount PerformerChipStrip, rename Avatar tab → Performers]
│   └── controls/
│       ├── PerformerChipStrip.svelte                 [NEW]
│       └── PerformerTab.svelte                       [NEW — holds FormationSelector, position/facing controls, sequence picker, remove button]

src/lib/shared/di/containers/3d-container.ts          [MODIFY — register viewer3DUndoManager in tier 3]

tests/unit/3d-viewer/
├── formation-presets.test.ts                         [NEW — tests the 6 new generators]
├── viewer3d-scope.test.ts                            [NEW — tests selection scope and fan-out]
├── viewer3d-undo-manager.test.ts                     [NEW — tests the snapshot undo manager]
└── viewer3d-integration.test.ts                      [NEW — end-to-end spawn/formation/undo flow]
```

## Implementation Steps

Each step is a compilable, shippable commit. None break other features.

### Step 1 — Add `MAX_VIEWER_PERFORMERS = 8` to `scale-constants.ts`

One-line addition to the `STAGE` record. No behavior change until a consumer reads it.

### Step 2 — Parameterize `PerformerManager`'s cap

Add optional `maxPerformers?: number` to `PerformerManagerDeps`, default to `STAGE.MAX_PERFORMERS`. Gate `addPerformer` on the passed cap. Existing callers (realm, museum, duet) pass nothing and retain the 4-cap. No public signature break.

### Step 3 — Extend `FormationPreset` union with 6 new values

Edit `domain/formation.ts`. No behavior change until the dispatcher is updated (step 4).

### Step 4 — Add 6 new preset generators and `PRESET_VALID_COUNTS` to `formation-presets.ts`

Six new `generate*Slots` functions, six new `case` branches in `getSlotsForPreset`, six new entries in `FORMATION_PRESET_INFO`, plus the `PRESET_VALID_COUNTS` record. TDD: unit tests for each new generator's output shape, position bounds, and facing angles.

### Step 5 — Wire `PerformerManager` into `createViewer3DState` (additive phase)

`createViewer3DState` now instantiates `createPerformerManager({ ...deps, maxPerformers: STAGE.MAX_VIEWER_PERFORMERS })` and exposes `performerManager` via a getter. A transitional `avatarState` getter still returns `performerManager.performers[0] ?? null` so existing components compile. `enter3D` now calls `performerManager.initialize()` then loads the sequence on performer 0. No UI changes yet.

### Step 6 — Add viewer-specific selection scope

`selectedPerformerIndex` state, `selectPerformerScope` method, `scopedPerformers` derived view, and the scope-routing helpers (`togglePlaneScoped`, `toggleEffectScoped`). Unit tests for the scope logic.

### Step 7 — Build `Viewer3DUndoManager`

Contract + implementation + unit tests. No wiring into the state yet.

### Step 8 — Wire undo into state factory

`createViewer3DState` accepts `viewer3DUndoManager` as a constructor dep. Four mutation paths snapshot before mutating and write `afterState` on completion: **spawn**, **remove**, **formation-apply** (via `transitionToFormation`), and **spatial edit** (per-performer position and facing updates, coalesced within a 300ms window). `undo()` restores the snapshot's `beforeState` onto the live state; `redo()` restores `afterState`. `Viewer3DKeyboardHandler` binds Ctrl+Z / Ctrl+Shift+Z and no-ops when the user is focused in any text input inside the popover.

### Step 9 — Build `PerformerChipStrip.svelte`

Renders chips, handles clicks, syncs with `selectedPerformerIndex`. Shows "+" enabled when `performers.length < STAGE.MAX_VIEWER_PERFORMERS`. Hidden when `performers.length < 2`.

### Step 10 — Mount chip strip in `Viewer3DGearPopover`

Slot it above the tab bar. Rename the "Avatar" tab to "Performers." Update the tab contents component to show the formation picker, per-performer numeric controls, sequence picker, and remove button.

### Step 11 — Build raycasting in `Viewer3DScene.svelte`

Add a Three.js raycaster on pointerdown that tests only performer body meshes. Hit → `selectPerformerScope(index)`. Empty-space click → `selectPerformerScope(null)`. Suppress during OrbitControls drag. Also render the temporary ground-disc indicator under the selected performer(s).

### Step 12 — Persistence: save/load performer snapshots

Replace the old `tka-viewer3d-visiblePlanes` load path with the new `tka-viewer3d-performers` path. On load, if the old key exists and the new key does not, migrate once. On any state mutation that changes per-performer fields, write the new performers array to localStorage.

### Step 13 — Remove the `avatarState` shim

Update all remaining call sites that read `viewer3DState.avatarState` to either read `viewer3DState.performerManager.performers[selectedPerformerIndex ?? 0]` or iterate `performers`. Delete the shim getter.

### Step 14 — Integration test

One end-to-end test exercising the full path: spawn 3 performers, apply `tunnel-stack`, apply `v-shape`, undo twice, verify state returns to the post-spawn defaults.

## Testing Strategy

### Formation presets (`formation-presets.test.ts`)

For every new preset (`solo`, `tunnel-stack`, `back-to-back`, `facing-each-other`, `stage-lr`, `side-by-side`), for every valid count in `PRESET_VALID_COUNTS`:

- `getSlotsForPreset(preset, count).length === count`
- Every `position.x`, `position.z` finite and within `[-10, 10]`
- Every explicit `facingAngle` within `[-Math.PI, Math.PI * 2]` (allows for 0..2π or -π..π conventions)
- For presets that declare a fixed count (`back-to-back`, `facing-each-other`, `stage-lr`): calling with a count not in `validCounts` returns a gracefully-degraded result (e.g., solo-style) rather than crashing
- For `tunnel-stack`: consecutive performers are ≥1.0m apart along the Z axis
- For `side-by-side`: consecutive performers are ≥1.5m apart along the X axis

### Selection scope (`viewer3d-scope.test.ts`)

- `scopedPerformers()` returns all performers when `selectedPerformerIndex === null`
- `scopedPerformers()` returns a single-element array when `selectedPerformerIndex` is a valid index
- `scopedPerformers()` returns an empty array when `selectedPerformerIndex` is out of bounds
- `togglePlaneScoped(plane)` calls `togglePlane(plane)` on the expected performers for each scope mode
- `toggleEffectScoped(name)` same

### Undo manager (`viewer3d-undo-manager.test.ts`)

- Push → undo → redo round-trips: initial state equals post-round-trip state
- Cap enforcement: pushing 51 snapshots drops the oldest
- Redo stack clears on new push
- `canUndo` / `canRedo` reflect stack contents
- `clearHistory()` empties both stacks

### Integration test (`viewer3d-integration.test.ts`)

One test that wires an ephemeral `createViewer3DState` with mocked DI deps, spawns 3 performers, applies `tunnel-stack`, applies `v-shape`, undoes twice, and verifies the live state matches the post-spawn defaults (same 3 performers, same initial spatial data). Exercises the state factory, formation library, performer manager integration, and undo manager together.

### Not tested

- Visual regressions in the 3D scene (belongs to the visual-indicator spec)
- Chip strip rendering (standard Svelte component, eye-test suffices)
- Raycasting hit-test in isolation (integration testing requires a full scene; eye-test suffices)
- Popover tab wiring (glue code)

## Open Questions for Follow-up Specs

1. **Visual selection indicator design** — which treatment (ring / outline / label / combo), what color rules, how it behaves for "All" scope, how it interacts with fire/LED/trails effects.
2. **Variation preset system** — how mirrored/rotated/time-shifted sequences are defined, where the "Home" crown concept lives, how variation UI integrates with the Performers tab.
3. **Compose cell 3D rendering** — how a `mediaType: "viewer-3d"` cell renders inside a Compose grid, how cell-level selection interacts with scene-level performer selection, how performance scales with multiple 3D cells.
4. **2D separate-canvas rendering for spatially-separated formations** — how non-tunnel formations render inside a 2D Compose cell.
5. **Smart formation apply** — auto-spawn or auto-remove performers when switching to a formation whose `validCounts` doesn't match the current count.
6. **Index-specific remove on `PerformerManager`** — current API only removes the last performer; v1 UX accepts this, but a "delete performer #3 from a 5-performer scene keeping 1/2/4/5" enhancement lives in a follow-up.
7. **Drag-in-scene positioning** — direct spatial manipulation via mouse/touch, beyond numeric spinners. Needs the visual-indicator spec first.
8. **Raising shared `STAGE.MAX_PERFORMERS`** — if realm, museum, and duet are audited and found safe, the viewer-specific `MAX_VIEWER_PERFORMERS` could be removed in favor of raising the shared cap.
9. **Viewer ↔ Village data bridges** — a follow-up opportunity enabled by this foundation, NOT in scope for this spec. The Village feature (`src/lib/features/village/`) is an ECS-based cultural simulation where autonomous avatars learn sequences from each other, age, die, and recombine sequences across generations. It already uses the same `PerformerRig` + `AvatarInstanceState` primitives as the viewer (primitive-level unification is already complete), and has an unused `selectedAvatarId` field in its state waiting to be wired to UI. The natural bridge is two one-way data flows, not scene unification:
   - **Viewer → Village** ("Introduce this sequence to the Village"): inject the viewer's current sequence into a villager's `knownSequences`. The Village's `TeachingSystem`, `ProximityLearningSystem`, and `RecombinationSystem` then propagate and mutate it through the population over generations.
   - **Village → Viewer** ("Inspect this villager"): click a villager in the Village tab, freeze or read the current state, load their current sequence into the viewer's multi-performer editor for close inspection — possibly with their companions loaded as additional performers.

   This is deliberately a *data bridge*, not *scene unification*. The viewer remains a choreographer's design tool; the Village remains an emergent cultural simulation. They talk via sequence data flowing between them. Full scene unification is rejected for two concrete reasons: (1) the Village has no scrub/rewind (only pause/run), so editing a villager mid-simulation requires the viewer-level state control the Village doesn't expose, and (2) forcing editing semantics into a simulation creates weird edge cases like "what if the villager I'm editing dies mid-edit." This foundation (multi-performer + selection/scoping in the viewer) is what makes the Village→Viewer bridge possible — without it, you'd have no way to usefully inspect a villager in the viewer. Viable as a follow-up spec once this foundation ships, and naturally subsumed by #10 below.

10. **3D source decoupling / source picker** — the unifying follow-up. The current viewer layout shows a 2D sequence card and a 3D animation pane locked to the same source. This follow-up decouples them: the 3D pane becomes a configurable lens with its own source picker, independent of whatever's in the card. Candidate sources:
    - **Current 2D sequence** (v1 default — identical to today's behavior)
    - **Library browse** (pick any saved sequence and view it in the 3D lens)
    - **Village villager** (click a villager in the Village tab, inspect their current sequence in the viewer's lens — subsumes the "Village → Viewer" half of #9)
    - **Compose cell** (pick any tunnel-layer-backed cell from an open composition and view it)
    - **Empty sandbox** (no source, just performers you manually spawn and choreograph from scratch)
    - **Create preview** (while writing a new sequence in Create, see it in the 3D lens alongside its in-progress state)

    The foundation's state factory is already source-agnostic — `enter3D(sequenceData)` is called by *whoever has sequence data to show*, and the viewer holds its own `performers` array regardless of origin. A source picker is therefore a purely additive UI-layer change: one new control in the viewer chrome, one switch statement that dispatches on picked-source-type to obtain a `SequenceData` from the right place, and the existing `enter3D` / `addPerformer` paths work unchanged. Estimated cost: small per source (one picker entry + one data-obtainer), so the follow-up ships incrementally — land the picker with "current sequence" + "library browse" first, then add Village / Compose / Create one at a time. This single follow-up subsumes the Village data-bridge work from #9 and gives the viewer a coherent long-term identity: "the 3D lens for any TKA performance data, viewable side-by-side with anything else in the app."

Each is a real feature; none block this foundation.

## Summary

Rather than building a multi-avatar system from scratch, this spec **wires the existing `PerformerManager` into the standalone 3D viewer**, adds viewer-specific selection scope and fan-out editing, extends the existing formation preset library with six missing presets, parameterizes the performer cap so the viewer gets 8 without disturbing realm/museum/duet, and gives the viewer a snapshot-based undo system following the project's established pattern. The existing smooth-animated formation transitions are adopted as-is. Ships in 14 small compilable steps, with no breaking changes to any feature currently consuming `PerformerManager`.
