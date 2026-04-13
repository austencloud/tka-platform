# Unified Scene Feature System

## Problem

The 3D scene contains multiple toggleable elements (stage, audience, campfire, tent, environment, grid) that are currently hardcoded per-consumer. The collision lab hardcodes `showAudience={true}` and `backgroundType={BackgroundType.FIREFLY_FOREST}`. The sequence viewer has no stage or audience at all. There is no loading gate — scene objects pop in one by one as their GLBs arrive.

We need:
1. A shared registry of scene features that any 3D viewer can consume.
2. Per-user toggle persistence (localStorage).
3. A loading curtain over the 3D canvas that holds until all enabled async features are ready.
4. A gear popover "Scene" tab for toggling features.
5. Integration into both the sequence viewer and collision lab.

## Architecture

Three new units, plus modifications to existing components:

```
SceneFeatureRegistry (static data)
    |
    v
createSceneFeatureState (factory)  -->  localStorage
    |
    v
SceneFeatureContext (context)
    |
    +---> Viewer3DGearPopover "Scene" tab (reads features, renders toggles)
    +---> SceneLoadingCurtain (reads allEnabledReady, shows/hides curtain)
    +---> Scene components (read isEnabled per feature, call reportReady)
```

### Not in scope

- Firebase sync for scene toggles (these are viewport preferences, not account settings)
- Drag-to-reposition or build-mode editing of scene objects
- New scene features beyond the initial six

## Scene Feature Registry

A static array of feature definitions. Not dynamically registered — all features are known at compile time.

```typescript
interface SceneFeature {
  key: string;
  label: string;
  defaultEnabled: boolean;
  requiresAsyncLoad: boolean;
}

const SCENE_FEATURES: SceneFeature[] = [
  { key: "stage",       label: "Stage",       defaultEnabled: true,  requiresAsyncLoad: false },
  { key: "audience",    label: "Audience",     defaultEnabled: false, requiresAsyncLoad: true  },
  { key: "environment", label: "Environment",  defaultEnabled: true,  requiresAsyncLoad: true  },
  { key: "campfire",    label: "Campfire",     defaultEnabled: true,  requiresAsyncLoad: false },
  { key: "tent",        label: "Tent",         defaultEnabled: true,  requiresAsyncLoad: false },
  { key: "grid",        label: "Grid",         defaultEnabled: true,  requiresAsyncLoad: false },
];
```

### Adding new features later

Add an entry to `SCENE_FEATURES`. The gear popover, loading gate, and persistence all pick it up automatically. No other files need to change unless the new feature has a rendering component that needs to be wired into the scene.

## State Factory

`createSceneFeatureState(overrides?)` follows the project's factory + context pattern.

### Inputs

- `overrides?: Partial<Record<string, boolean>>` — per-consumer default overrides. Collision lab passes `{ audience: true }` so audience defaults on there. These are superseded by localStorage if the user has explicitly toggled.

### Internal state

- `enabledMap: Map<string, boolean>` — initialized from localStorage, falling back to overrides, falling back to registry defaults. Three-tier precedence: localStorage > overrides > registry default.
- `readySet: Set<string>` — features that have called `reportReady`.

### Public API

| Method/Property | Description |
|----------------|-------------|
| `features` | The full `SCENE_FEATURES` array (for rendering toggles) |
| `isEnabled(key): boolean` | Whether a feature is currently on |
| `toggle(key): void` | Flip a feature, persist to localStorage |
| `reportReady(key): void` | Mark a feature's assets as loaded |
| `allEnabledReady: boolean` | Derived. True when every enabled feature with `requiresAsyncLoad: true` has reported ready |
| `readyProgress: number` | Derived. Fraction (0-1) of enabled async features that are ready |
| `reset(): void` | Clear localStorage overrides, revert to defaults |

### Persistence

localStorage key: `"tka-scene-features"`. Stored as a JSON object mapping feature keys to booleans. Only features the user has explicitly toggled are stored — absent keys fall through to overrides/defaults.

### Toggle-while-loading behavior

If the user enables an async feature that hasn't loaded yet, `allEnabledReady` drops to false and the curtain reappears. The Canvas stays mounted underneath so the feature's component can load its assets. When it reports ready, the curtain fades out again.

If the user disables an async feature that was holding up the curtain, `allEnabledReady` recalculates and the curtain may clear immediately.

## Loading Curtain

`SceneLoadingCurtain.svelte` — a pure presentation component overlaying the 3D canvas.

### Behavior

- Visible when `!allEnabledReady`
- Covers only the 3D canvas area (not the surrounding UI — beat controls, sequence info, gear popover remain interactive)
- Crossfades out over 400ms when `allEnabledReady` becomes true
- The Canvas is mounted underneath at all times so assets load in parallel

### Visual design

Dark backdrop matching the forest scene palette. CSS-animated firefly dots (6-8 small circles with randomized drift keyframes and opacity pulses). A thin amber progress bar near the bottom, width driven by `readyProgress`. Subtle text: "Setting the stage..." in a muted warm tone.

The fireflies and text fade out during the crossfade, then the element unmounts.

### No-async fast path

If all enabled features are geometry-only (`requiresAsyncLoad: false`), `allEnabledReady` is true from the start and the curtain never appears.

## Gear Popover "Scene" Tab

A new tab in `Viewer3DGearPopover.svelte` alongside the existing Camera, Planes, Performers, and Effects tabs.

### Content

A list of toggles, one per entry in `SCENE_FEATURES`. Each toggle shows:
- The feature label
- An on/off toggle (same toggle component used elsewhere in the popover)
- A subtle loading indicator (spinner or dot) if the feature is enabled but hasn't reported ready yet

### Interaction

Toggling calls `sceneFeatureState.toggle(key)`. The scene responds reactively — components mount/unmount based on `isEnabled`. If an async feature is toggled on, the curtain reappears.

A "Reset to defaults" link at the bottom clears localStorage overrides.

## Ready Reporting

Each scene component is responsible for calling `reportReady(key)` when its assets are loaded.

| Feature | What triggers ready |
|---------|-------------------|
| `stage` | Always ready (geometry only) |
| `grid` | Always ready (geometry only) |
| `audience` | All 6 `useGltf` calls resolved + FBX animations preloaded |
| `environment` | All tree/rock/bush/campfire/tent `useGltf` calls resolved + ground textures loaded |
| `campfire` | Part of environment — see note below |
| `tent` | Part of environment — see note below |

**Note on campfire and tent:** These are currently rendered inside `ForestScene.svelte` alongside trees, rocks, and the ground plane. Rather than extracting them into separate components now, campfire and tent are toggled by conditionally rendering their sections within ForestScene. ForestScene reads `isEnabled("campfire")` and `isEnabled("tent")` from context and skips those blocks when disabled. The environment feature's `reportReady` fires when all of ForestScene's `useGltf` calls resolve (trees, rocks, bushes, campfire GLB, tent GLB, fallen logs). Individual campfire/tent GLBs don't gate the curtain separately — they're part of the environment bundle.

Geometry-only features (stage, grid) are always ready — the factory pre-populates them in the `readySet` since they have `requiresAsyncLoad: false`.

For async features, the component calls `reportReady` in an `$effect` that watches the `useGltf` result. The `reportReady` call is idempotent — calling it twice is harmless.

### Feature disabled = not counted

If a feature is disabled, it doesn't count toward `allEnabledReady`. Disabling audience means we don't wait for its 6 GLBs.

## Sequence Viewer Integration

The sequence viewer currently renders via `Viewer3DCanvas` → `Viewer3DScene`. Integration:

1. `Viewer3DCanvas.svelte` creates the scene feature state (`createSceneFeatureState()` with no overrides — uses registry defaults) and sets context.
2. `Viewer3DCanvas.svelte` wraps its Canvas with `SceneLoadingCurtain`.
3. `Viewer3DScene.svelte` renders scene features gated on `isEnabled(key)`:
   - `{#if isEnabled("stage")} <Stage3D /> {/if}`
   - `{#if isEnabled("audience")} <SeatedAudience3D /> {/if}`
   - `{#if isEnabled("environment")} <ForestScene /> {/if}`
   - etc.
4. The gear popover (already rendered in the sequence viewer) gets the new "Scene" tab.

### Collision lab

`PoseViewport.svelte` creates its own scene feature state with `createSceneFeatureState({ audience: true })` so audience defaults on. Otherwise identical behavior.

The existing `showAudience`, `showStage`, `backgroundType` props on Scene3D become unnecessary for consumers that use the scene feature system. They remain for backward compatibility during migration but Scene3D can eventually be simplified.

## File Structure

New files:
- `src/lib/shared/3d/scene-features/domain/scene-feature-registry.ts` — feature definitions + `SceneFeature` interface
- `src/lib/shared/3d/scene-features/state/scene-feature-state.svelte.ts` — factory
- `src/lib/shared/3d/scene-features/context/scene-feature-context.ts` — context set/get
- `src/lib/shared/3d/scene-features/components/SceneLoadingCurtain.svelte` — loading overlay
- `src/lib/shared/3d/scene-features/components/SceneFeatureToggles.svelte` — gear popover tab content

Modified files:
- `src/lib/shared/3d/components/Viewer3DGearPopover.svelte` — add "Scene" tab
- `src/lib/shared/sequence-viewer/components/Viewer3DCanvas.svelte` — create state, set context, add curtain
- `src/lib/shared/sequence-viewer/components/Viewer3DScene.svelte` — gate scene objects on feature flags, call reportReady
- `src/lib/features/lab/tabs/collision-lab/components/PoseViewport.svelte` — create state with overrides, set context
- `src/lib/shared/3d/environments/scenes/ForestScene.svelte` — gate campfire/tent sections on feature flags, add reportReady
- `src/lib/shared/3d/components/SeatedAudience3D.svelte` — add reportReady call

## Testing

Unit tests for the state factory:
- Toggle persistence round-trip (toggle → reload → state matches)
- Override precedence (localStorage > overrides > defaults)
- `allEnabledReady` logic (enabled+async features must report; disabled features don't count)
- `readyProgress` fraction calculation
- Toggle-while-loading recalculates readiness correctly

No UI tests for the curtain or popover tab — those are visible when broken.
