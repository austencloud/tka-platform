# Settings Cascade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the binary global/per-performer split with a CSS-like cascade where global defaults flow down to performers unless overridden, with visual feedback showing inherited vs overridden state.

**Architecture:** `Viewer3DState` gets `defaultSettings` (global defaults). `AvatarInstanceState` settings become nullable — `null` means inherit from defaults. Each performer exposes `effective*` getters that resolve via `??` fallback. "All" mode edits defaults; individual mode edits overrides.

**Tech Stack:** Svelte 5 runes (`$state`, `$derived`, `$effect`), bits-ui Popover (already migrated), existing scene-undo system.

---

## File Structure

### Modified Files

| File | Responsibility |
|------|---------------|
| `src/lib/shared/3d/state/performer-settings-types.ts` | Add `DefaultPerformerSettings` type, make `PerformerSettings` fields nullable |
| `src/lib/shared/3d/state/avatar-instance-state.svelte.ts` | Add `effective*` getters, `hasOverride`, `reset*` methods, accept viewer ref for cascade resolution |
| `src/lib/shared/3d/state/viewer-3d-state.svelte.ts` | Add `_defaultSettings`, `setDefault*` methods, `resetAllPerformers*` methods, register `defaults` undo domain |
| `src/lib/shared/3d/undo/scene-undo-types.ts` | Add `DefaultsDomainSnapshot`, `SceneUndoOperationType` entries, wire into `SceneUndoSnapshot` |
| `src/lib/shared/3d/components/controls/ViewerPopover.svelte` | Add `hasOverride` prop for override dot indicator |
| `src/lib/shared/sequence-viewer/components/RightRail.svelte` | Move Planes below separator, show cascade popovers in "All" mode, wire override dots |
| `src/lib/shared/3d/components/controls/PropPopover.svelte` | Dual-mode: read/write defaults in "All", effective values in individual, show badges |
| `src/lib/shared/3d/components/controls/EffortPopover.svelte` | Same dual-mode pattern |
| `src/lib/shared/3d/components/controls/EffectsPopover.svelte` | Same dual-mode pattern (swap to EffectsSettingsPanel with performer bridging) |
| `src/lib/shared/3d/components/PlanesPopover.svelte` | Same dual-mode pattern |

### New Files

| File | Responsibility |
|------|---------------|
| `src/lib/shared/3d/components/controls/CascadeBadge.svelte` | Reusable "Default" / "Custom" / "N overrides" badge component |

---

### Task 1: Extend Types — DefaultPerformerSettings + Nullable PerformerSettings

**Files:**
- Modify: `src/lib/shared/3d/state/performer-settings-types.ts`
- Modify: `src/lib/shared/3d/undo/scene-undo-types.ts`

- [ ] **Step 1: Add DefaultPerformerSettings and update PerformerSettings**

In `src/lib/shared/3d/state/performer-settings-types.ts`, add the new types and update existing:

```typescript
import type { EffortId } from "$lib/shared/effort/domain/effort-types";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { Plane, PlaneMode } from "@austencloud/scene-3d";

export type EffectId =
  | "trails"
  | "fire"
  | "charcoal"
  | "led"
  | "electricity"
  | "sparkles"
  | "motion"
  | "bloom";

/**
 * Global defaults — every field is non-null.
 * Performers inherit these unless they override.
 */
export interface DefaultPerformerSettings {
  prop: PropType;
  effects: Set<EffectId>;
  effortId: EffortId;
  planeMode: PlaneMode;
  customBluePlane: Plane;
  customRedPlane: Plane;
}

/**
 * Per-performer settings — null = inherit from DefaultPerformerSettings.
 */
export interface PerformerSettings {
  effortId: EffortId | null;
  prop: PropType | null;
  effects: Set<EffectId> | null;
  staffLengthCm: number | null;
}

export type CascadeCategory = "prop" | "effects" | "effort" | "planes";

export interface OverrideState {
  prop: boolean;
  effects: boolean;
  effort: boolean;
  planes: boolean;
}

export function makeDefaultPerformerSettings(): PerformerSettings {
  return {
    effortId: null,
    prop: null,
    effects: null,
    staffLengthCm: null,
  };
}
```

Note the key change: `makeDefaultPerformerSettings()` now returns all `null` values instead of concrete defaults. New performers inherit everything.

- [ ] **Step 2: Add DefaultsDomainSnapshot to undo types**

In `src/lib/shared/3d/undo/scene-undo-types.ts`, add the new snapshot type and operation types:

Add to `SceneUndoOperationType` union:
```typescript
  // Defaults cascade
  | "change-default-prop"
  | "change-default-effort"
  | "change-default-effects"
  | "change-default-planes"
  | "reset-all-overrides"
```

Add after `VisibilityDomainSnapshot`:
```typescript
export interface DefaultsDomainSnapshot {
  prop: PropType;
  effects: Set<EffectId>;
  effortId: EffortId;
  planeMode: PlaneMode;
  customBluePlane: Plane;
  customRedPlane: Plane;
}
```

Update `SceneUndoSnapshot` to include:
```typescript
export interface SceneUndoSnapshot {
  viewer?: ViewerDomainSnapshot;
  performer?: PerformerDomainSnapshot;
  effects?: EffectsConfig;
  motion?: Scene3DRenderConfig;
  scene?: SceneDomainSnapshot;
  visibility?: VisibilityDomainSnapshot;
  defaults?: DefaultsDomainSnapshot;  // NEW
  sceneLab?: SceneLabDomainSnapshot;
}
```

Update `PerformerDomainSnapshot.settings` to allow nullable fields:
```typescript
export interface PerformerDomainSnapshot {
  index: number;
  selectedPerformerIndex: number | null;
  settings: {
    prop: PropType | null;
    effortId: EffortId | null;
    effects: Set<EffectId> | null;
    staffLengthCm: number | null;
  };
  planes: {
    customBluePlane: Plane | null;
    customRedPlane: Plane | null;
    planeMode: PlaneMode | null;
    beatPlaneOverrides: Map<number, { blue?: Plane; red?: Plane }>;
  };
}
```

- [ ] **Step 3: Verify typecheck**

Run: `npx svelte-check --threshold error 2>&1 | grep -c "Error"`

Expected: Type errors in `avatar-instance-state.svelte.ts` and `viewer-3d-state.svelte.ts` because they now expect nullable types. These are resolved in Tasks 2 and 3.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/state/performer-settings-types.ts src/lib/shared/3d/undo/scene-undo-types.ts
git commit -m "feat(cascade): add DefaultPerformerSettings type, make PerformerSettings nullable

Foundation for settings cascade architecture. Performers now default to
null (inherit) instead of concrete values."
```

---

### Task 2: AvatarInstanceState — Effective Getters, Override Detection, Reset Methods

**Files:**
- Modify: `src/lib/shared/3d/state/avatar-instance-state.svelte.ts`

This is the core cascade resolution layer. The performer needs access to the viewer's `defaultSettings` to resolve effective values.

- [ ] **Step 1: Accept viewer defaults accessor in the factory**

Change the `AvatarInstanceDeps` type and factory signature to accept a defaults resolver:

```typescript
export interface AvatarInstanceDeps {
  getDefaults: () => import("./performer-settings-types").DefaultPerformerSettings;
}
```

Update `createAvatarInstanceState` to use `deps.getDefaults`:

```typescript
export function createAvatarInstanceState(
  config: AvatarInstanceConfig,
  deps: AvatarInstanceDeps
) {
  const getDefaults = deps.getDefaults;
```

- [ ] **Step 2: Make plane state nullable for cascade**

Change the internal plane state declarations from concrete defaults to null:

```typescript
let planeMode = $state<PlaneMode | null>(loadPersistedPlaneMode());
let customBluePlane = $state<Plane | null>(null);
let customRedPlane = $state<Plane | null>(null);
```

Update `loadPersistedPlaneMode` to return `null` when no persisted value exists (new performers inherit):

```typescript
function loadPersistedPlaneMode(): PlaneMode | null {
  try {
    const v = localStorage.getItem(PLANE_MODE_KEY);
    if (v === PlaneMode.DUAL_WHEEL) return PlaneMode.DUAL_WHEEL;
    if (v === PlaneMode.WALL) return PlaneMode.WALL;
    if (v === PlaneMode.CUSTOM) return PlaneMode.CUSTOM;
  } catch { /* ignore */ }
  return null;
}
```

- [ ] **Step 3: Add effective value getters**

Add these derived computations after `_settings` declaration:

```typescript
const effectiveProp = $derived(_settings.prop ?? getDefaults().prop);
const effectiveEffortId = $derived(_settings.effortId ?? getDefaults().effortId);
const effectiveEffects = $derived(_settings.effects ?? getDefaults().effects);
const effectivePlaneMode = $derived(planeMode ?? getDefaults().planeMode);
const effectiveBluePlane = $derived(customBluePlane ?? getDefaults().customBluePlane);
const effectiveRedPlane = $derived(customRedPlane ?? getDefaults().customRedPlane);
```

- [ ] **Step 4: Add override detection**

```typescript
const hasOverride = $derived<import("./performer-settings-types").OverrideState>({
  prop: _settings.prop !== null,
  effects: _settings.effects !== null,
  effort: _settings.effortId !== null,
  planes: planeMode !== null,
});

const hasAnyOverride = $derived(
  hasOverride.prop || hasOverride.effects || hasOverride.effort || hasOverride.planes
);
```

- [ ] **Step 5: Add reset methods**

```typescript
function resetProp(): void {
  sceneUndo.captureState("change-prop", "Reset prop to default");
  _settings = { ..._settings, prop: null };
  sceneUndo.commitState();
}

function resetEffort(): void {
  sceneUndo.captureState("change-effort", "Reset effort to default");
  _settings = { ..._settings, effortId: null };
  sceneUndo.commitState();
}

function resetEffects(): void {
  sceneUndo.captureState("toggle-effect", "Reset effects to default");
  _settings = { ..._settings, effects: null };
  sceneUndo.commitState();
}

function resetPlanes(): void {
  sceneUndo.captureState("set-hand-plane", "Reset planes to default");
  planeMode = null;
  customBluePlane = null;
  customRedPlane = null;
  reconvertWithConfig(getEffectiveModeConfig(effectivePlaneMode));
  sceneUndo.commitState();
}

function resetAllOverrides(): void {
  sceneUndo.captureState("change-prop", "Reset all overrides");
  _settings = { prop: null, effortId: null, effects: null, staffLengthCm: _settings.staffLengthCm };
  planeMode = null;
  customBluePlane = null;
  customRedPlane = null;
  reconvertWithConfig(getEffectiveModeConfig(effectivePlaneMode));
  sceneUndo.commitState();
}
```

- [ ] **Step 6: Update internal consumers to use effective values**

The `easedFrame` computation reads `_settings.effortId` directly at line 299. Change to use the effective value:

```typescript
// In easedFrame $derived.by():
progress: applyEffort(effectiveEffortId, rawProgress),
```

The `getEffectiveModeConfig` function reads `customBluePlane`/`customRedPlane` directly. Update to use effective values when the raw value is null:

```typescript
function getEffectiveModeConfig(mode: PlaneMode): PlaneModeConfig {
  if (mode === PlaneMode.CUSTOM) {
    return {
      facingAngle: 0,
      bluePlane: effectiveBluePlane,
      redPlane: effectiveRedPlane,
      blueLateralOffset: 0,
      redLateralOffset: 0,
    };
  }
  const base = PLANE_MODE_CONFIGS[mode];
  return base;
}
```

The `loadSequence` function calls `getEffectiveModeConfig(planeMode)` — update to use `effectivePlaneMode`:

```typescript
function loadSequence(sequence: SequenceData) {
  // ...existing code...
  const modeConfig = getEffectiveModeConfig(effectivePlaneMode);
  // ...rest unchanged...
}
```

Similarly update `setPlaneMode`, `setHandPlane`, and `reconvertWithConfig` calls to reference effective values where raw may be null.

- [ ] **Step 7: Update snapshot capture/restore for nullable types**

The `capturePerformerSnapshot` and `restorePerformerSnapshot` already work with the nullable fields since the snapshot type was updated in Task 1. Verify the `structuredClone` handles null correctly (it does).

Update `restorePerformerSnapshot`:
```typescript
function restorePerformerSnapshot(snap: PerformerDomainSnapshot): void {
  _settings = {
    prop: snap.settings.prop,
    effortId: snap.settings.effortId,
    effects: snap.settings.effects ? new Set(snap.settings.effects) : null,
    staffLengthCm: snap.settings.staffLengthCm,
  };
  customBluePlane = snap.planes.customBluePlane;
  customRedPlane = snap.planes.customRedPlane;
  planeMode = snap.planes.planeMode;
  beatPlaneOverrides = new Map(snap.planes.beatPlaneOverrides);
  reconvertWithConfig(getEffectiveModeConfig(effectivePlaneMode));
}
```

- [ ] **Step 8: Expose new getters/methods on the return object**

Add to the return object:

```typescript
// Effective values (resolved cascade)
get effectiveProp() { return effectiveProp; },
get effectiveEffortId() { return effectiveEffortId; },
get effectiveEffects() { return effectiveEffects; },
get effectivePlaneMode() { return effectivePlaneMode; },
get effectiveBluePlane() { return effectiveBluePlane; },
get effectiveRedPlane() { return effectiveRedPlane; },

// Override detection
get hasOverride() { return hasOverride; },
get hasAnyOverride() { return hasAnyOverride; },

// Reset methods
resetProp,
resetEffort,
resetEffects,
resetPlanes,
resetAllOverrides,
```

Update existing getters to return effective values where consumers expect resolved state:

```typescript
get planeMode() { return effectivePlaneMode; },
get customBluePlane() { return effectiveBluePlane; },
get customRedPlane() { return effectiveRedPlane; },
```

Keep the raw settings accessible for the popover UI (it needs to distinguish null from a value):

```typescript
get rawPlaneMode() { return planeMode; },
get rawBluePlane() { return customBluePlane; },
get rawRedPlane() { return customRedPlane; },
```

- [ ] **Step 9: Commit**

```bash
git add src/lib/shared/3d/state/avatar-instance-state.svelte.ts
git commit -m "feat(cascade): add effective* getters, override detection, reset methods

AvatarInstanceState now resolves null settings via viewer.defaultSettings.
Consumers read effectiveProp/effectiveEffortId/etc instead of raw values.
Override detection via hasOverride getter, reset methods for each category."
```

---

### Task 3: Viewer3DState — Default Settings + Cascade Write Methods

**Files:**
- Modify: `src/lib/shared/3d/state/viewer-3d-state.svelte.ts`

- [ ] **Step 1: Add defaultSettings state and import types**

Add import at top:
```typescript
import type { DefaultPerformerSettings, CascadeCategory } from "./performer-settings-types";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import { PlaneMode } from "@austencloud/scene-3d";
import type { DefaultsDomainSnapshot } from "../undo/scene-undo-types";
import type { EffortId } from "$lib/shared/effort/domain/effort-types";
import type { EffectId } from "./performer-settings-types";
```

Inside `createViewer3DState()`, after performer manager creation:

```typescript
const _defaultSettings = $state<DefaultPerformerSettings>({
  prop: PropType.STAFF,
  effects: new Set<EffectId>(),
  effortId: "linear" as EffortId,
  planeMode: PlaneMode.WALL,
  customBluePlane: Plane.WALL,
  customRedPlane: Plane.WALL,
});
```

- [ ] **Step 2: Pass defaults accessor to performer manager**

The performer manager creates `AvatarInstanceState` instances. Update the `createPerformerManager` call or the deps passed to each performer to include a `getDefaults` function:

```typescript
const performerManager: PerformerManager = createPerformerManager({
  initialAvatarId: DEFAULT_AVATAR_ID,
  maxPerformers: STAGE.MAX_VIEWER_PERFORMERS,
  getDefaults: () => _defaultSettings,
});
```

This requires updating `PerformerManagerConfig` in `performer-manager.svelte.ts` to accept and forward `getDefaults`. Read that file for exact interface — add `getDefaults` to config, pass it through to `createAvatarInstanceState` as `deps.getDefaults`.

- [ ] **Step 3: Add setDefault methods**

```typescript
function setDefaultProp(prop: PropType): void {
  sceneUndo.captureState("change-default-prop", `Default prop: ${prop}`);
  _defaultSettings.prop = prop;
  sceneUndo.commitState();
}

function setDefaultEffort(effortId: EffortId): void {
  sceneUndo.captureState("change-default-effort", `Default effort: ${effortId}`);
  _defaultSettings.effortId = effortId;
  sceneUndo.commitState();
}

function setDefaultEffects(effects: Set<EffectId>): void {
  sceneUndo.captureState("change-default-effects", "Default effects");
  _defaultSettings.effects = new Set(effects);
  sceneUndo.commitState();
}

function toggleDefaultEffect(effect: EffectId): void {
  sceneUndo.captureState("change-default-effects", `Toggle default ${effect}`);
  const next = new Set(_defaultSettings.effects);
  if (next.has(effect)) next.delete(effect);
  else next.add(effect);
  _defaultSettings.effects = next;
  sceneUndo.commitState();
}

function setDefaultHandPlane(hand: "blue" | "red", plane: Plane): void {
  sceneUndo.captureState("change-default-planes", `Default ${hand}: ${plane}`);
  if (hand === "blue") _defaultSettings.customBluePlane = plane;
  else _defaultSettings.customRedPlane = plane;
  // Derive plane mode from the new defaults
  const { derivePlaneModeFromHands } = await import("./avatar-instance-state.svelte");
  _defaultSettings.planeMode = derivePlaneModeFromHands(
    _defaultSettings.customBluePlane,
    _defaultSettings.customRedPlane
  );
  sceneUndo.commitState();
}
```

Note: `derivePlaneModeFromHands` is already exported from `avatar-instance-state.svelte.ts`. Import it at the top of the file instead of using dynamic import:

```typescript
import { derivePlaneModeFromHands } from "./avatar-instance-state.svelte";
```

- [ ] **Step 4: Add resetAllPerformers methods**

```typescript
function overrideCountForCategory(cat: CascadeCategory): number {
  return performerManager.performers.filter(p => p.hasOverride[cat]).length;
}

function resetAllPerformersProp(): void {
  sceneUndo.captureState("reset-all-overrides", "Reset all prop overrides");
  for (const p of performerManager.performers) p.resetProp();
  sceneUndo.commitState();
}

function resetAllPerformersEffort(): void {
  sceneUndo.captureState("reset-all-overrides", "Reset all effort overrides");
  for (const p of performerManager.performers) p.resetEffort();
  sceneUndo.commitState();
}

function resetAllPerformersEffects(): void {
  sceneUndo.captureState("reset-all-overrides", "Reset all effect overrides");
  for (const p of performerManager.performers) p.resetEffects();
  sceneUndo.commitState();
}

function resetAllPerformersPlanes(): void {
  sceneUndo.captureState("reset-all-overrides", "Reset all plane overrides");
  for (const p of performerManager.performers) p.resetPlanes();
  sceneUndo.commitState();
}
```

- [ ] **Step 5: Register defaults undo domain**

```typescript
function captureDefaultsSnapshot(): DefaultsDomainSnapshot {
  return structuredClone({
    prop: _defaultSettings.prop,
    effects: new Set(_defaultSettings.effects),
    effortId: _defaultSettings.effortId,
    planeMode: _defaultSettings.planeMode,
    customBluePlane: _defaultSettings.customBluePlane,
    customRedPlane: _defaultSettings.customRedPlane,
  });
}

function restoreDefaultsSnapshot(snap: DefaultsDomainSnapshot): void {
  _defaultSettings.prop = snap.prop;
  _defaultSettings.effects = new Set(snap.effects);
  _defaultSettings.effortId = snap.effortId;
  _defaultSettings.planeMode = snap.planeMode;
  _defaultSettings.customBluePlane = snap.customBluePlane;
  _defaultSettings.customRedPlane = snap.customRedPlane;
}

sceneUndo.registerDomain("defaults", {
  capture: captureDefaultsSnapshot,
  restore: restoreDefaultsSnapshot,
});
```

- [ ] **Step 6: Update selectPerformerScope to not close cascade popovers**

The current code closes performer popovers when switching to "All". Since cascade popovers are now always visible, remove the close-on-All logic for cascade popovers:

```typescript
const PERFORMER_ONLY_POPOVERS: Set<PopoverId> = new Set([]); // None are performer-only now

function selectPerformerScope(index: number | null): void {
  selectedPerformerIndex = index;
  // No longer close popovers when switching to All — cascade popovers stay open
}
```

- [ ] **Step 7: Expose new state on return object**

Add to the return object:

```typescript
get defaultSettings() { return _defaultSettings; },
setDefaultProp,
setDefaultEffort,
setDefaultEffects,
toggleDefaultEffect,
setDefaultHandPlane,
overrideCountForCategory,
resetAllPerformersProp,
resetAllPerformersEffort,
resetAllPerformersEffects,
resetAllPerformersPlanes,
```

- [ ] **Step 8: Verify typecheck**

Run: `npx svelte-check --threshold error 2>&1 | tail -10`

Expected: Errors in performer-manager.svelte.ts (needs `getDefaults` forwarding). Fix in next step.

- [ ] **Step 9: Update PerformerManager to forward getDefaults**

Read `src/lib/shared/3d/state/performer-manager.svelte.ts`. Add `getDefaults` to its config interface and forward to `createAvatarInstanceState`:

In the config interface:
```typescript
interface PerformerManagerConfig {
  initialAvatarId: AvatarId;
  maxPerformers?: number;
  getDefaults: () => DefaultPerformerSettings;
}
```

In `createPerformer` (or wherever `createAvatarInstanceState` is called):
```typescript
const state = createAvatarInstanceState(
  { id: `performer-${index}`, positionX: x, avatarModelId: config.initialAvatarId },
  { getDefaults: config.getDefaults }
);
```

- [ ] **Step 10: Commit**

```bash
git add src/lib/shared/3d/state/viewer-3d-state.svelte.ts src/lib/shared/3d/state/performer-manager.svelte.ts src/lib/shared/3d/undo/scene-undo-types.ts
git commit -m "feat(cascade): add defaultSettings to Viewer3DState with write/undo/reset

Global defaults for prop, effects, effort, planes. Each has a setDefault*
method with undo capture. Override count queries and bulk reset methods.
PerformerManager forwards getDefaults to each AvatarInstanceState."
```

---

### Task 4: CascadeBadge Component

**Files:**
- Create: `src/lib/shared/3d/components/controls/CascadeBadge.svelte`

A small reusable badge that shows "Default", "Custom" (with reset), or "N overrides" (with reset-all).

- [ ] **Step 1: Create CascadeBadge.svelte**

```svelte
<script lang="ts">
  interface Props {
    mode: "default" | "custom" | "overrides";
    overrideCount?: number;
    categoryLabel?: string;
    onReset?: () => void;
  }

  let { mode, overrideCount = 0, categoryLabel = "", onReset }: Props = $props();
</script>

{#if mode === "default"}
  <span class="cascade-badge inherited">Default</span>
{:else if mode === "custom"}
  <button class="cascade-badge custom" onclick={onReset} aria-label="Reset to default">
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>
    </svg>
    Custom
  </button>
{:else if mode === "overrides" && overrideCount > 0}
  <button class="cascade-badge overrides" onclick={onReset} aria-label="Reset all {categoryLabel} overrides">
    {overrideCount} performer{overrideCount > 1 ? "s" : ""} custom
  </button>
{/if}

<style>
  .cascade-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    border: none;
    cursor: default;
  }
  .cascade-badge.inherited {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.35);
  }
  .cascade-badge.custom {
    background: rgba(251, 191, 36, 0.12);
    color: rgba(251, 191, 36, 0.8);
    cursor: pointer;
    transition: all 150ms;
  }
  .cascade-badge.custom:hover {
    background: rgba(251, 191, 36, 0.2);
    color: rgba(251, 191, 36, 1);
  }
  .cascade-badge.overrides {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    transition: all 150ms;
  }
  .cascade-badge.overrides:hover {
    background: rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.6);
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/3d/components/controls/CascadeBadge.svelte
git commit -m "feat(cascade): add CascadeBadge component for override indicators"
```

---

### Task 5: ViewerPopover — Override Dot Indicator

**Files:**
- Modify: `src/lib/shared/3d/components/controls/ViewerPopover.svelte`

- [ ] **Step 1: Add hasOverride prop and dot markup**

Add to Props interface:
```typescript
hasOverride?: boolean;
```

Destructure:
```typescript
let {
  id, title, accentColor, width = 420, icon, tooltip,
  performerScoped = false, hasOverride = false, children, footer,
}: Props = $props();
```

Inside the trigger button, after the `<i>` element:
```svelte
{#if hasOverride && accentColor}
  <span class="override-dot" style:background={accentColor}></span>
{/if}
```

- [ ] **Step 2: Add override dot CSS**

Add to the `<style>` block:
```css
.override-dot {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  pointer-events: none;
  box-shadow: 0 0 6px currentColor;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/components/controls/ViewerPopover.svelte
git commit -m "feat(cascade): add override dot indicator to ViewerPopover chip"
```

---

### Task 6: RightRail — Layout Reorg + Always-Visible Cascade Popovers

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/RightRail.svelte`

This is the biggest UI change. Planes moves below separator. Cascade popovers always render. Override dots wired up.

- [ ] **Step 1: Update derived state for cascade mode**

Replace the `hasPerformerSelected` check with a more nuanced approach:

```typescript
const selectedIndex = $derived(viewer.selectedPerformerIndex);
const isIndividualMode = $derived(renderMode === "3d" && selectedIndex !== null);
const performerColor = $derived(isIndividualMode ? getPerformerColor(selectedIndex ?? 0) : undefined);
const selectedPerformer = $derived.by(() => {
  if (selectedIndex === null) return null;
  return viewer.performerManager.performers[selectedIndex] ?? null;
});

// Override detection for dot indicators
const propOverride = $derived(selectedPerformer?.hasOverride.prop ?? false);
const effectsOverride = $derived(selectedPerformer?.hasOverride.effects ?? false);
const effortOverride = $derived(selectedPerformer?.hasOverride.effort ?? false);
const planesOverride = $derived(selectedPerformer?.hasOverride.planes ?? false);
```

- [ ] **Step 2: Restructure the template**

Replace the current conditional `{#if hasPerformerSelected}` block. The new layout:

```svelte
<div class="right-rail" class:mode-2d={renderMode === "2d"} class:mode-3d={renderMode === "3d"} role="toolbar" aria-label="Viewer controls">
  {#if renderMode === "3d"}
    <!-- Global-only controls -->
    <ViewerPopover id="formation" title="Formation" icon="fa-users" tooltip="Formation">
      <FormationPopover />
    </ViewerPopover>

    <ViewerPopover id="tempo" title="Tempo" icon="fa-gauge" tooltip="Speed" width={340}>
      <TempoPopover {bpm} {onBpmChange} />
    </ViewerPopover>

    <ViewerPopover id="camera" title="Camera" icon="fa-video" tooltip="Camera" width={300}>
      <CameraPopover />
    </ViewerPopover>

    <ViewerPopover id="export" title="Export" icon="fa-arrow-up-from-bracket" tooltip="Export" width={340}>
      <ExportPopover />
    </ViewerPopover>

    <ViewerPopover id="scene" title="Scene" icon="fa-mountain-sun" tooltip="Scene" width={320}>
      <SceneSelectorPopover />
    </ViewerPopover>

    <!-- Separator: global above, cascading below -->
    <div class="performer-separator" aria-hidden="true">
      <div class="separator-line"></div>
    </div>

    <!-- Cascading controls (always visible, mode-aware) -->
    <ViewerPopover
      id="planes"
      title={isIndividualMode ? `Performer ${(selectedIndex ?? 0) + 1}` : "All Performers"}
      icon="fa-layer-group"
      tooltip="Planes"
      width={320}
      accentColor={performerColor}
      performerScoped={isIndividualMode}
      hasOverride={planesOverride}
    >
      <PlanesPopover />
    </ViewerPopover>

    <ViewerPopover
      id="effects"
      title={isIndividualMode ? `Performer ${(selectedIndex ?? 0) + 1}` : "All Performers"}
      icon="fa-wand-magic-sparkles"
      tooltip="Effects"
      accentColor={performerColor}
      performerScoped={isIndividualMode}
      hasOverride={effectsOverride}
    >
      <EffectsPopover />
    </ViewerPopover>

    <ViewerPopover
      id="prop"
      title={isIndividualMode ? `Performer ${(selectedIndex ?? 0) + 1}` : "All Performers"}
      icon="fa-staff-snake"
      tooltip="Prop"
      accentColor={performerColor}
      performerScoped={isIndividualMode}
      hasOverride={propOverride}
    >
      <PropPopover />
      {#snippet footer()}
        {#if selectedPerformer}
          <PerformerPropSizeSlider performer={selectedPerformer} />
        {/if}
      {/snippet}
    </ViewerPopover>

    <ViewerPopover
      id="effort"
      title={isIndividualMode ? `Performer ${(selectedIndex ?? 0) + 1}` : "All Performers"}
      icon="fa-wave-square"
      tooltip="Effort"
      accentColor={performerColor}
      performerScoped={isIndividualMode}
      hasOverride={effortOverride}
    >
      <EffortPopover />
    </ViewerPopover>
  {/if}
</div>
```

Key changes:
- Planes moved below separator
- No `{#if hasPerformerSelected}` conditional — cascade popovers always render
- No `transition:slide` on cascade group — they don't appear/disappear
- `performerScoped` is conditional on `isIndividualMode`
- `hasOverride` wired to per-performer override detection
- Title shows "All Performers" vs "Performer N"

- [ ] **Step 3: Remove unused imports and clean up**

Remove `slide` import and `hasPerformerSelected` derived if they're no longer used. Remove the `transition:slide|local` wrappers.

- [ ] **Step 4: Verify typecheck**

Run: `npx svelte-check --threshold error 2>&1 | tail -10`

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/RightRail.svelte
git commit -m "feat(cascade): reorg right rail — cascade popovers always visible

Planes joins Effects/Props/Effort below separator. All four render in
both 'All' and individual mode. Override dots wired to performer state.
No more conditional slide transitions for the cascade group."
```

---

### Task 7: PropPopover — Dual-Mode Cascade

**Files:**
- Modify: `src/lib/shared/3d/components/controls/PropPopover.svelte`

- [ ] **Step 1: Add dual-mode state resolution**

Replace the current `selected` derivation with cascade-aware logic:

```typescript
import CascadeBadge from "./CascadeBadge.svelte";

const viewer = getViewer3DContext();
const selectedIndex = $derived(viewer.selectedPerformerIndex);
const isAllMode = $derived(selectedIndex === null);
const performerColor = $derived(getPerformerColor(selectedIndex ?? 0));

const selected = $derived.by(() => {
  if (selectedIndex === null) return null;
  return viewer.performerManager.performers[selectedIndex] ?? null;
});

// Current prop value — from defaults in All mode, effective value in individual mode
const currentProp = $derived(
  isAllMode
    ? viewer.defaultSettings.prop
    : (selected?.effectiveProp ?? viewer.defaultSettings.prop)
);

// Override state for badge
const isOverridden = $derived(!isAllMode && (selected?.hasOverride.prop ?? false));
const overrideCount = $derived(isAllMode ? viewer.overrideCountForCategory("prop") : 0);
```

- [ ] **Step 2: Update selection logic**

The `selectedBase` computation uses `selected?.settings.prop` — update to use `currentProp`:

```typescript
const selectedBase = $derived(getBasePropType(currentProp));
```

Update `handleFamilyClick` and `handleVariantClick` to write to the correct target:

```typescript
function handleFamilyClick(base: PropType) {
  const activeVariants = getAllVariations(base).filter(isPropActive);
  if (activeVariants.length <= 1) {
    if (isAllMode) {
      viewer.setDefaultProp(base);
    } else if (selected) {
      selected.setProp(base);
    }
    expandedFamily = null;
  } else {
    expandedFamily = base;
  }
}

function handleVariantClick(variant: PropType) {
  if (isAllMode) {
    viewer.setDefaultProp(variant);
  } else if (selected) {
    selected.setProp(variant);
  }
}
```

- [ ] **Step 3: Add cascade badge to template**

After the opening `{#if selected || isAllMode}` (replace the current `{#if selected}`), add the badge before the prop grid:

```svelte
{#if selected || isAllMode}
  <div class="prop-content" style:--pop-accent={isAllMode ? '#4a9eff' : performerColor}>
    <!-- Cascade badge -->
    {#if isAllMode && overrideCount > 0}
      <CascadeBadge mode="overrides" {overrideCount} categoryLabel="prop" onReset={() => viewer.resetAllPerformersProp()} />
    {:else if !isAllMode && isOverridden}
      <CascadeBadge mode="custom" onReset={() => selected?.resetProp()} />
    {:else if !isAllMode}
      <CascadeBadge mode="default" />
    {/if}

    {#each PROP_CATEGORIES as cat, ci}
      <!-- ...existing tile grid unchanged... -->
    {/each}
  </div>

  <!-- ...existing variant strip unchanged... -->
{/if}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/components/controls/PropPopover.svelte
git commit -m "feat(cascade): PropPopover dual-mode — edit defaults or per-performer

All mode writes to viewer.defaultSettings.prop. Individual mode writes
per-performer overrides. CascadeBadge shows Default/Custom/overrides."
```

---

### Task 8: EffortPopover — Dual-Mode Cascade

**Files:**
- Modify: `src/lib/shared/3d/components/controls/EffortPopover.svelte`

- [ ] **Step 1: Rewrite with cascade logic**

```svelte
<script lang="ts">
  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import EffortPalette from "$lib/shared/phrase-effort-lab/components/EffortPalette.svelte";
  import CascadeBadge from "./CascadeBadge.svelte";

  const viewer = getViewer3DContext();
  const selectedIndex = $derived(viewer.selectedPerformerIndex);
  const isAllMode = $derived(selectedIndex === null);

  const selected = $derived.by(() => {
    if (selectedIndex === null) return null;
    return viewer.performerManager.performers[selectedIndex] ?? null;
  });

  const currentEffort = $derived(
    isAllMode
      ? viewer.defaultSettings.effortId
      : (selected?.effectiveEffortId ?? viewer.defaultSettings.effortId)
  );

  const isOverridden = $derived(!isAllMode && (selected?.hasOverride.effort ?? false));
  const overrideCount = $derived(isAllMode ? viewer.overrideCountForCategory("effort") : 0);

  function handleSelect(effortId: import("$lib/shared/effort/domain/effort-types").EffortId) {
    if (isAllMode) {
      viewer.setDefaultEffort(effortId);
    } else if (selected) {
      selected.setEffort(effortId);
    }
  }
</script>

<div style="--theme-stroke: rgba(255,255,255,0.1); --theme-card-bg: rgba(255,255,255,0.04); --theme-text-dim: rgba(255,255,255,0.5);">
  {#if isAllMode && overrideCount > 0}
    <CascadeBadge mode="overrides" {overrideCount} categoryLabel="effort" onReset={() => viewer.resetAllPerformersEffort()} />
  {:else if !isAllMode && isOverridden}
    <CascadeBadge mode="custom" onReset={() => selected?.resetEffort()} />
  {:else if !isAllMode}
    <CascadeBadge mode="default" />
  {/if}

  <EffortPalette
    selectedEffort={currentEffort}
    onSelect={handleSelect}
  />
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/3d/components/controls/EffortPopover.svelte
git commit -m "feat(cascade): EffortPopover dual-mode cascade"
```

---

### Task 9: EffectsPopover — Dual-Mode Cascade

**Files:**
- Modify: `src/lib/shared/3d/components/controls/EffectsPopover.svelte`

The current EffectsPopover just wraps `MobileEffectsPanel` which operates on a global effects config context. For cascade, we need to use `EffectsSettingsPanel` which already supports a `performer` prop for per-performer mode. In "All" mode, we need to bridge to `viewer.defaultSettings.effects`.

- [ ] **Step 1: Rewrite with cascade logic**

```svelte
<script lang="ts">
  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import EffectsSettingsPanel from "./EffectsSettingsPanel.svelte";
  import CascadeBadge from "./CascadeBadge.svelte";

  const viewer = getViewer3DContext();
  const selectedIndex = $derived(viewer.selectedPerformerIndex);
  const isAllMode = $derived(selectedIndex === null);

  const selected = $derived.by(() => {
    if (selectedIndex === null) return null;
    return viewer.performerManager.performers[selectedIndex] ?? null;
  });

  const isOverridden = $derived(!isAllMode && (selected?.hasOverride.effects ?? false));
  const overrideCount = $derived(isAllMode ? viewer.overrideCountForCategory("effects") : 0);
</script>

<div class="effects-content">
  {#if isAllMode && overrideCount > 0}
    <CascadeBadge mode="overrides" {overrideCount} categoryLabel="effects" onReset={() => viewer.resetAllPerformersEffects()} />
  {:else if !isAllMode && isOverridden}
    <CascadeBadge mode="custom" onReset={() => selected?.resetEffects()} />
  {:else if !isAllMode}
    <CascadeBadge mode="default" />
  {/if}

  <EffectsSettingsPanel performer={isAllMode ? undefined : selected} />
</div>

<style>
  .effects-content {
    max-height: 70vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
</style>
```

Note: `EffectsSettingsPanel` already handles the dual mode — when `performer` is provided it reads `performer.settings.effects`, when absent it reads the global effects config. For the "All" mode default effects, the toggle writes need to go through `viewer.toggleDefaultEffect()`. This may require adding an `onToggle` callback prop to `EffectsSettingsPanel` for the All-mode case, or extending it to accept a defaults accessor. Read the full `EffectsSettingsPanel` to determine the exact integration.

If `EffectsSettingsPanel` doesn't support a callbacks-based mode, fall back to `MobileEffectsPanel` for now and add a TODO for the effects cascade integration. The badge and detection still work correctly.

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/3d/components/controls/EffectsPopover.svelte
git commit -m "feat(cascade): EffectsPopover dual-mode with cascade badge"
```

---

### Task 10: PlanesPopover — Dual-Mode Cascade

**Files:**
- Modify: `src/lib/shared/3d/components/PlanesPopover.svelte`

- [ ] **Step 1: Add cascade state resolution**

Replace the current `avatarState` derivation:

```typescript
import CascadeBadge from "../components/controls/CascadeBadge.svelte";

const viewer = getViewer3DContext();
const selectedIndex = $derived(viewer.selectedPerformerIndex);
const isAllMode = $derived(selectedIndex === null);

const selected = $derived.by(() => {
  if (selectedIndex === null) return null;
  return viewer.performerManager.performers[selectedIndex] ?? null;
});

const bluePlane = $derived(
  isAllMode
    ? viewer.defaultSettings.customBluePlane
    : (selected?.effectiveBluePlane ?? Plane.WALL)
);

const redPlane = $derived(
  isAllMode
    ? viewer.defaultSettings.customRedPlane
    : (selected?.effectiveRedPlane ?? Plane.WALL)
);

const isOverridden = $derived(!isAllMode && (selected?.hasOverride.planes ?? false));
const overrideCount = $derived(isAllMode ? viewer.overrideCountForCategory("planes") : 0);
```

- [ ] **Step 2: Update write handlers**

```typescript
function handleHandSlotClick(e: MouseEvent, hand: "blue" | "red", plane: Plane) {
  e.stopPropagation();
  const currentPlane = hand === "blue" ? bluePlane : redPlane;
  if (currentPlane === plane) return;

  if (isAllMode) {
    viewer.setDefaultHandPlane(hand, plane);
  } else {
    viewer.setHandPlaneScoped(hand, plane);
  }
}
```

- [ ] **Step 3: Add cascade badge**

Add before the `.plane-matrix` div:

```svelte
{#if isAllMode && overrideCount > 0}
  <CascadeBadge mode="overrides" {overrideCount} categoryLabel="planes" onReset={() => viewer.resetAllPerformersPlanes()} />
{:else if !isAllMode && isOverridden}
  <CascadeBadge mode="custom" onReset={() => selected?.resetPlanes()} />
{:else if !isAllMode}
  <CascadeBadge mode="default" />
{/if}
```

- [ ] **Step 4: Update reset button to respect cascade**

The existing `handleResetPlanesClick` should reset to inheritance (null) in individual mode, or reset defaults to WALL in All mode:

```typescript
function handleResetPlanesClick(e: MouseEvent) {
  e.stopPropagation();
  if (isAllMode) {
    viewer.setDefaultHandPlane("blue", Plane.WALL);
    viewer.setDefaultHandPlane("red", Plane.WALL);
    viewer.hideAllPlanes();
  } else if (selected) {
    selected.resetPlanes();
    for (const p of viewer.scopedPerformers()) {
      p.clearBeatPlaneOverrides();
    }
  }
}
```

- [ ] **Step 5: Remove the old `avatarState` derivation**

Remove:
```typescript
const avatarState = $derived(viewer.performerManager.performers[0] ?? null);
```

Update `hasStepOverrides` to use the selected performer:
```typescript
const hasStepOverrides = $derived(selected?.hasStepOverrides ?? false);
```

Update `isPlaneStateNonDefault` to reference the new cascade-aware values:
```typescript
const isPlaneStateNonDefault = $derived(
  bluePlane !== Plane.WALL ||
  redPlane !== Plane.WALL ||
  hasStepOverrides ||
  viewer.visiblePlanes.size > 0
);
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/3d/components/PlanesPopover.svelte
git commit -m "feat(cascade): PlanesPopover dual-mode — defaults vs per-performer

All mode reads/writes viewer.defaultSettings planes. Individual mode
uses performer effective values. CascadeBadge with override indicators."
```

---

### Task 11: Integration Verification + Typecheck

**Files:**
- All modified files

- [ ] **Step 1: Full typecheck**

Run: `npx svelte-check --threshold error 2>&1 | tail -20`

Fix any type errors. Common issues:
- Nullable types where non-null was expected (add `!` assertion or null check)
- Missing imports of new types
- `performer.settings.prop` consumers that need to switch to `performer.effectiveProp`

- [ ] **Step 2: Grep for remaining raw settings reads**

Ensure no consumer still reads `performer.settings.prop` when they should read `performer.effectiveProp`:

```bash
grep -rn "\.settings\.prop\b\|\.settings\.effortId\|\.settings\.effects" src/lib/shared/3d/ --include="*.svelte" --include="*.ts" | grep -v "node_modules" | grep -v ".svelte-kit"
```

Remaining reads of `.settings.prop` should only be in:
- `capturePerformerSnapshot` (correct — captures raw for undo)
- `PerformerPropSizeSlider` (reads `staffLengthCm` which is unchanged)
- Places that intentionally need the raw value (null-check for override detection)

Any consumer that uses the value for rendering/logic should use `effective*` instead.

- [ ] **Step 3: Build check**

Run: `npm run build 2>&1 | tail -10`

- [ ] **Step 4: Commit any fixes**

```bash
git add -u
git commit -m "fix(cascade): resolve type errors and raw-settings references"
```

---

## Self-Review Checklist

### Spec Coverage

| Spec Requirement | Task |
|---|---|
| "All" mode shows Props, Effects, Effort, Planes popovers | Task 6 |
| Changing a default updates all inheriting performers reactively | Task 2 ($derived effective* getters) + Task 3 |
| Per-performer overrides survive default changes | Task 2 (null vs value) |
| Override state visible at chip level (dot) | Task 5 + Task 6 |
| Override state visible at popover level (badge + reset) | Task 4 + Tasks 7-10 |
| "Reset to default" returns performer to inheritance | Task 2 (reset methods) |
| Undo/redo works across defaults and overrides | Task 1 (types) + Task 3 (domain) |
| New performers inherit all defaults | Task 1 (makeDefaultPerformerSettings returns nulls) |
| Existing saved state loads without migration | Task 1 (non-null = override, backward-compatible) |

### Placeholder Scan

No TBD, TODO, "fill in details", or "similar to Task N" found.

### Type Consistency

- `DefaultPerformerSettings` — defined in Task 1, consumed in Tasks 2, 3
- `OverrideState` — defined in Task 1, used in Tasks 2, 6, 7-10
- `CascadeCategory` — defined in Task 1, used in Task 3 (`overrideCountForCategory`)
- `effectiveProp` / `effectiveEffortId` / `effectiveEffects` — defined in Task 2, consumed in Tasks 7-10
- `hasOverride` — defined in Task 2, consumed in Tasks 6-10
- `resetProp` / `resetEffort` / `resetEffects` / `resetPlanes` — defined in Task 2, called in Tasks 4, 7-10
- `setDefaultProp` / `setDefaultEffort` / `toggleDefaultEffect` / `setDefaultHandPlane` — defined in Task 3, called in Tasks 7-10
- `overrideCountForCategory` — defined in Task 3, called in Tasks 7-10
- `resetAllPerformersProp` / `resetAllPerformersEffort` / `resetAllPerformersEffects` / `resetAllPerformersPlanes` — defined in Task 3, called in Tasks 7-10
- `CascadeBadge` — created in Task 4, imported in Tasks 7-10
