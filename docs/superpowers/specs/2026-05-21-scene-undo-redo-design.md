# Scene Undo/Redo System — Design Spec

**Date:** 2026-05-21
**Scope:** Primary 3D viewer + Scene Lab
**Pattern:** Snapshot-based capture/commit (ArrangeUndoManager template)
**Architecture:** Approach B — Action Registry with Domain-Scoped Deltas

---

## Problem

Ctrl+Z does nothing in the 3D scene. Users can change effects, props, environment, planes, performers, formations, grid settings, and Scene Lab configs — but none of these are undoable. 30+ controls, zero undo coverage.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Stack model | Single stack, clear redo on new push | Industry standard (Figma, Liveblocks). Predictable UX. |
| Pattern | Snapshot capture/commit (not command pattern) | Matches 5 existing codebase managers. No per-command reverse logic. |
| Snapshot scope | Domain-scoped composite (not full state) | Efficient. Only captures what changed. |
| Coalescing | Interaction-based (mousedown→mouseup) | One undo per slider drag, not 60. |
| Camera | Excluded from undo | Blender/Unity convention. Camera undo is disorienting. |
| Persistence | Session-only (no localStorage) | Avoids stale snapshots. State itself persists through its own systems. |
| Max history | 100 entries | Domain-scoped snapshots are small (~1-2KB each). |
| Library | Hand-rolled | Matches codebase. Libraries (Reddo.js, svelte-undo) don't fit architecture. |
| Existing Viewer3DUndoManager | Replaced | One stack = predictable Ctrl+Z. Two stacks = timestamp merge bugs. |

## Architecture

```
User clicks control
    ↓
captureState(type, description)    ← snapshot BEFORE mutation
    ↓
Mutation happens (setProp, toggleEffect, etc.)
    ↓
commitState()                      ← snapshot AFTER mutation, push to undoStack
    ↓
Ctrl+Z → pop undoStack → restoreSnapshot(entry.beforeState) → toast
Ctrl+Y → pop redoStack → restoreSnapshot(entry.afterState) → toast
```

### SceneUndoManager

Single class, single instance per context. Template: ArrangeUndoManager.

```typescript
class SceneUndoManager {
  private undoStack: SceneUndoEntry[] = [];
  private redoStack: SceneUndoEntry[] = [];
  private pendingEntry: SceneUndoEntry | null = null;
  private undoDisabled = false;
  private subscribers: Set<() => void> = new Set();

  // Core API
  captureState(type: SceneUndoOperationType, description: string): void;
  commitState(): void;
  commitStateCoalescing(coalescingKey: string, windowMs?: number): void;
  cancelPending(): void;
  undo(): SceneUndoSnapshot | null;
  redo(): SceneUndoSnapshot | null;
  
  // Non-undoable mutations
  withoutUndo(fn: () => void): void;

  // Observability
  get canUndo(): boolean;
  get canRedo(): boolean;
  get undoDescription(): string | null;
  get redoDescription(): string | null;
  subscribe(cb: () => void): () => void;
  
  // Lifecycle
  clear(): void;
  init(getSnapshot: () => SceneUndoSnapshot, restoreSnapshot: (s: SceneUndoSnapshot) => void): void;
}
```

### Operation Types

```typescript
type SceneUndoOperationType =
  // Performer
  | "spawn-performer"
  | "remove-performer"
  | "apply-formation"
  | "spatial-edit"
  | "change-prop"
  | "change-staff-length"
  | "change-effort"
  // Effects
  | "toggle-effect"
  | "update-effect-config"
  | "apply-effect-preset"
  | "toggle-motion"
  // Scene
  | "change-environment"
  | "change-grid-mode"
  // Planes
  | "toggle-plane-visibility"
  | "set-hand-plane"
  | "set-beat-plane-override"
  | "toggle-grid-labels"
  // Visibility
  | "toggle-ui-visibility"
  // Scene Lab
  | "change-scene-lab-scene"
  | "update-scene-lab-config"
  | "change-cosmic-variant";
```

### Composite Snapshot

Each entry captures only the domains that changed. One entry can span multiple domains for coupled operations.

```typescript
interface SceneUndoSnapshot {
  // Viewer domain — performer positions, formations, count
  // Note: selectedPerformerIndex here is for structural capture only.
  // For selection restoration on undo, the `performer` domain's value takes priority.
  viewer?: {
    performers: PerformerSnapshot[];
    selectedPerformerIndex: number | null;
    activeFormation: FormationPreset | "manual";
  };
  
  // Single performer domain — settings for one performer
  performer?: {
    index: number;
    selectedPerformerIndex: number | null; // restore selection context
    settings: {
      prop: PropType;
      effortId: EffortId;
      effects: Set<EffectId>;
      staffLengthCm: number | null;
    };
    planes: {
      customBluePlane: Plane;
      customRedPlane: Plane;
      planeMode: PlaneMode;
      beatPlaneOverrides: Map<number, { blue?: Plane; red?: Plane }>;
    };
  };
  
  // Effects domain — full effects config
  effects?: EffectsConfig;
  
  // Motion domain
  motion?: Scene3DRenderConfig;
  
  // Scene domain — environment + grid
  scene?: {
    backgroundType: BackgroundType;
    gridMode: GridMode;
  };
  
  // Visibility domain
  visibility?: {
    visiblePlanes: Set<Plane>;
    showGridLabels: boolean;
    uiToggles: Record<string, boolean>; // props, stepNumbers, tkaGlyph, etc.
  };
  
  // Scene Lab domain
  sceneLab?: {
    sceneId: SceneId;
    cosmicVariant: CosmicVariant;
    configs: Record<string, unknown>; // per-scene configs, deep-cloned
  };
}
```

### Undo Entry

```typescript
interface SceneUndoEntry {
  id: string;
  type: SceneUndoOperationType;
  timestamp: number;
  description: string;
  beforeState: SceneUndoSnapshot;
  afterState?: SceneUndoSnapshot;
  coalescingKey?: string;
}
```

## Snapshot Capture Strategy

All snapshots are **deep-cloned at capture time** via `structuredClone()`. This prevents Svelte 5 rune mutations from corrupting the stored "before" state.

### Domain Capture Functions

Each domain provides a `capture()` function that returns its snapshot slice:

```typescript
// Registered at init time
const domainCaptures = {
  viewer: () => captureViewerSnapshot(),           // existing function
  performer: (index: number) => capturePerformerSnapshot(index),
  effects: () => structuredClone(effectsConfig.config),
  motion: () => structuredClone(scene3DRender.config),
  scene: () => ({ backgroundType: settings.backgroundType, gridMode: settings.gridMode }),
  visibility: () => captureVisibilitySnapshot(),
  sceneLab: () => captureSceneLabSnapshot(),
};
```

### Domain Restore Functions

Each domain provides a `restore()` function:

```typescript
const domainRestores = {
  viewer: (s) => restoreViewerSnapshot(s),         // existing function
  performer: (s) => restorePerformerSnapshot(s),
  effects: (s) => effectsConfig.replace(s),        // existing method
  motion: (s) => scene3DRender.replace(s),         // existing method
  scene: (s) => {
    settingsService.updateSetting("backgroundType", s.backgroundType);
    settingsService.updateSetting("gridMode", s.gridMode);
  },
  visibility: (s) => restoreVisibilitySnapshot(s),
  sceneLab: (s) => restoreSceneLabSnapshot(s),
};
```

## Coalescing

### Interaction-Based (Sliders, Drag)

```
pointerdown → captureState("update-effect-config", "Trail length")
  ↓
pointermove × N → mutations happen (no undo tracking)
  ↓
pointerup → commitState()
```

Result: one undo entry for entire drag gesture.

### Time-Window (Spatial Edits)

Existing 300ms window for position/facing spinner nudges. Uses `commitStateCoalescing("spatial", 300)` — same-key operations within window merge.

### Discrete (Toggles, Buttons)

```
click → captureState("toggle-effect", "Enabled trails")
     → mutation
     → commitState()
```

One entry per click. No coalescing.

## Non-Undoable Mutations

```typescript
sceneUndoManager.withoutUndo(() => {
  performer.loadSequence(data);      // programmatic, not user-initiated
  effectsConfig.replace(savedConfig); // loading saved state
});
```

Mutations inside `withoutUndo()` don't enter the undo stack. Prevents `loadSequence()`, initial state setup, and automated transitions from polluting user history.

## Stale Reference Handling

When undoing an operation on a performer that no longer exists (e.g., performer was removed after the prop change):

```typescript
function restorePerformerSnapshot(snapshot: PerformerSnapshot): void {
  const performer = performerManager.performers[snapshot.index];
  if (!performer) {
    toast.info("Cannot undo — performer no longer exists", 1500);
    return;
  }
  // ... restore
}
```

Matches Figma/Liveblocks approach: silently skip with informative toast.

## Keyboard Binding

```
Ctrl+Z       → undo()
Ctrl+Shift+Z → redo()
Ctrl+Y       → redo()  (Windows convention)
```

Global `keydown` listener on the 3D scene container element. `preventDefault()` stops browser default Ctrl+Z. Does NOT fire when focus is in `<input>`, `<textarea>`, or `contenteditable`.

Priority: Create/Compose modules' existing undo handlers take precedence in their contexts. Scene undo only fires when the 3D viewer or Scene Lab is the active context.

## Toast Feedback

| Action | Toast message | Duration |
|---|---|---|
| Successful undo | "Undid: {description}" | 1500ms |
| Successful redo | "Redid: {description}" | 1500ms |
| Stale reference | "Cannot undo — {reason}" | 2000ms |
| Empty stack | No toast (Ctrl+Z does nothing) | — |

## Selection Context Restoration

Performer-specific undo entries include `selectedPerformerIndex`. On undo:

1. Restore the state change
2. Switch selected performer to the one that was affected
3. User sees the undo in both the 3D viewport AND the controls panel

Example: User selects P2 → changes prop to Fan → selects P1 → Ctrl+Z → P2 selected again, prop restored to Staff.

## Animation Cancellation

Before any snapshot restoration, `cancelActiveTransitions()` is called. Prevents in-progress formation lerps from overwriting restored positions.

## Instrumentation Map

### Viewer3DState (replace existing Viewer3DUndoManager calls)

| Method | Operation type | Domain | Coalescing |
|---|---|---|---|
| `spawnPerformerFromUI()` | `spawn-performer` | `viewer` | None |
| `removeLastPerformerFromUI()` | `remove-performer` | `viewer` | None |
| `applyFormationFromUI()` | `apply-formation` | `viewer` | None |
| `recordSpatialEdit()` | `spatial-edit` | `viewer` | 300ms window |
| `selectPerformerScope()` | Not undoable | — | — |

### AvatarInstanceState

| Method | Operation type | Domain | Coalescing |
|---|---|---|---|
| `setProp()` | `change-prop` | `performer` | None |
| `setStaffLengthCm()` | `change-staff-length` | `performer` | Interaction |
| `toggleEffect()` | `toggle-effect` | `performer` | None |
| `setEffort()` | `change-effort` | `performer` | None |
| `setHandPlane()` | `set-hand-plane` | `performer` | None |
| `setStepHandPlane()` | `set-beat-plane-override` | `performer` | None |

### EffectsConfigState

| Method | Operation type | Domain | Coalescing |
|---|---|---|---|
| `setTipEffectMap()` | `toggle-effect` | `effects` | None |
| `updateTrails()` | `update-effect-config` | `effects` | Interaction |
| `updateFire()` | `update-effect-config` | `effects` | Interaction |
| (all 16 `update*()` methods) | `update-effect-config` | `effects` | Interaction |
| `applyPreset()` | `apply-effect-preset` | `effects` | None |

### Scene3DRenderState

| Method | Operation type | Domain | Coalescing |
|---|---|---|---|
| `updateMotion()` | `toggle-motion` | `motion` | Interaction |

### SettingsState

| Method | Operation type | Domain | Coalescing |
|---|---|---|---|
| `updateSetting("backgroundType")` | `change-environment` | `scene` | None |
| `updateSetting("gridMode")` | `change-grid-mode` | `scene` | None |

### Viewer3DState (visibility)

| Method | Operation type | Domain | Coalescing |
|---|---|---|---|
| `togglePlane()` | `toggle-plane-visibility` | `visibility` | None |
| `toggleGridLabels()` | `toggle-grid-labels` | `visibility` | None |
| `toggleVisibility()` | `toggle-ui-visibility` | `visibility` | None |

### SceneLabState

| Method | Operation type | Domain | Coalescing |
|---|---|---|---|
| `setSceneId()` | `change-scene-lab-scene` | `sceneLab` | None |
| `setCosmicVariant()` | `change-cosmic-variant` | `sceneLab` | None |
| All config mutations | `update-scene-lab-config` | `sceneLab` | Interaction |

## File Structure

### New Files

```
src/lib/shared/3d/undo/
├── SceneUndoManager.ts              # Core manager class
├── scene-undo-types.ts              # Operation types, entry, snapshot interfaces
├── scene-undo-domains.ts            # Domain capture/restore registrations
├── scene-undo-keyboard.ts           # Ctrl+Z/Y binding
├── getSceneUndoManager.ts           # Singleton factory
└── __tests__/
    ├── scene-undo-manager.test.ts   # Unit tests
    └── scene-undo-integration.test.ts # Integration tests
```

### Modified Files

```
viewer-3d-state.svelte.ts           # Replace Viewer3DUndoManager → SceneUndoManager
avatar-instance-state.svelte.ts     # Add undo hooks to setProp, toggleEffect, etc.
effects-config-state.svelte.ts      # Add undo hooks to all update*() methods
scene-3d-render-state.svelte.ts     # Add undo hook to updateMotion
SettingsState.svelte.ts             # Add undo hooks to backgroundType/gridMode
scene-lab-state.svelte.ts           # Add undo hooks to all mutations
Viewer3DScene.svelte                # Register keyboard handler
```

## Testing Strategy

### Unit Tests (SceneUndoManager)

- Push/undo/redo cycle — state transitions correct
- Max history (100) — oldest entries trimmed
- Redo cleared on new push
- Coalescing — same key within window merges entries
- Coalescing — different key creates new entry
- Coalescing — expired window creates new entry
- `withoutUndo()` — mutations inside don't create entries
- `cancelPending()` — discards uncommitted capture
- Empty stack — undo/redo return null
- Subscribe/unsubscribe — callbacks fire on changes

### Domain Snapshot Tests

- Per-domain capture → restore roundtrip (every domain)
- Composite snapshot with multiple domains
- `structuredClone` isolation — mutating source after capture doesn't corrupt snapshot
- Stale performer reference — graceful skip with toast

### Integration Tests

- Full cycle: prop change → undo → verify state → redo → verify state
- Multi-domain: effect → prop → undo → only prop reverts → undo → effect reverts
- Coalescing: simulated slider drag → one undo entry
- Formation undo: restores positions AND formation label
- Selection restoration: undo performer-specific change switches selected performer
- Keyboard: Ctrl+Z fires undo, Ctrl+Shift+Z fires redo
- Keyboard: no fire when focus is in text input
- `withoutUndo`: loadSequence doesn't create undo entry

## Edge Cases

| Edge case | Handling |
|---|---|
| Undo while formation transition is animating | `cancelActiveTransitions()` before restore |
| Undo prop change on deleted performer | Skip silently, toast "performer no longer exists" |
| Ctrl+Z in text input | Don't intercept — let browser handle it |
| Rapid Ctrl+Z spam | Each fires synchronously; no debounce needed |
| 101st entry pushed | Oldest entry discarded (FIFO) |
| Undo during `withoutUndo()` execution | Undo still works — only captures are suppressed |
| Scene Lab and viewer both active | Separate manager instances, separate stacks |
| Create/Compose module active | Their existing undo handlers take priority |

## Future Extensibility

New control added to 3D scene? Three lines:

```typescript
// In the new control's mutation method:
sceneUndoManager.captureState("new-operation-type", "Description");
// ... mutation ...
sceneUndoManager.commitState();
```

Add the operation type string to the union. Done. No new classes, no new interfaces, no registration ceremony.
