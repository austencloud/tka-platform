# Unified Scene Feature System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A shared registry of toggleable 3D scene features (stage, audience, environment, campfire, tent, grid) with localStorage persistence, a loading curtain, and gear popover integration — consumed by both the sequence viewer and collision lab.

**Architecture:** A `createSceneFeatureState` factory owns toggle states and loading readiness signals. Scene components read feature flags from context and report when their assets are loaded. A loading curtain overlays the 3D canvas until all enabled async features are ready. The gear popover gets a "Scene" tab for toggling features.

**Tech Stack:** Svelte 5 runes, Threlte, TypeScript, localStorage, CSS animations

**Spec:** `docs/superpowers/specs/2026-04-13-scene-feature-system-design.md`

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `src/lib/shared/3d/scene-features/domain/scene-feature-registry.ts` | `SceneFeature` interface + `SCENE_FEATURES` array |
| `src/lib/shared/3d/scene-features/state/scene-feature-state.svelte.ts` | State factory with toggles, persistence, readiness tracking |
| `src/lib/shared/3d/scene-features/context/scene-feature-context.ts` | Svelte context set/get |
| `src/lib/shared/3d/scene-features/components/SceneLoadingCurtain.svelte` | Firefly loading overlay |
| `src/lib/shared/3d/scene-features/components/SceneFeatureToggles.svelte` | Gear popover "Scene" tab content |
| `tests/unit/scene-features/scene-feature-state.test.ts` | Unit tests for state factory |

### Modified files
| File | Change |
|------|--------|
| `src/lib/shared/3d/components/Viewer3DGearPopover.svelte` | Add "scene" tab |
| `src/lib/shared/3d/components/Viewer3DCanvas.svelte` | Create state, set context, add curtain |
| `src/lib/shared/3d/components/Viewer3DScene.svelte` | Gate scene objects on feature flags, add reportReady calls |
| `src/lib/shared/3d/environments/scenes/ForestScene.svelte` | Gate campfire/tent sections, call reportReady |
| `src/lib/shared/3d/components/SeatedAudience3D.svelte` | Call reportReady when all GLBs + FBXs loaded |
| `src/lib/features/lab/tabs/collision-lab/components/PoseViewport.svelte` | Create state with overrides, set context |

---

### Task 1: Scene Feature Registry

**Files:**
- Create: `src/lib/shared/3d/scene-features/domain/scene-feature-registry.ts`

- [ ] **Step 1: Create the registry file**

```typescript
// src/lib/shared/3d/scene-features/domain/scene-feature-registry.ts

export interface SceneFeature {
  key: string;
  label: string;
  defaultEnabled: boolean;
  requiresAsyncLoad: boolean;
}

export const SCENE_FEATURES: SceneFeature[] = [
  { key: "stage",       label: "Stage",       defaultEnabled: true,  requiresAsyncLoad: false },
  { key: "audience",    label: "Audience",     defaultEnabled: false, requiresAsyncLoad: true  },
  { key: "environment", label: "Environment",  defaultEnabled: true,  requiresAsyncLoad: true  },
  { key: "campfire",    label: "Campfire",     defaultEnabled: true,  requiresAsyncLoad: false },
  { key: "tent",        label: "Tent",         defaultEnabled: true,  requiresAsyncLoad: false },
  { key: "grid",        label: "Grid",         defaultEnabled: true,  requiresAsyncLoad: false },
];
```

- [ ] **Step 2: Verify TypeScript is happy**

Run: `npx tsc --noEmit 2>&1 | grep scene-feature-registry`
Expected: No output (no errors)

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/scene-features/domain/scene-feature-registry.ts
git commit -m "feat(scene-features): add scene feature registry with 6 feature definitions"
```

---

### Task 2: Scene Feature State Factory (Tests First)

**Files:**
- Create: `tests/unit/scene-features/scene-feature-state.test.ts`
- Create: `src/lib/shared/3d/scene-features/state/scene-feature-state.svelte.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/scene-features/scene-feature-state.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock localStorage
const mockStorage = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => mockStorage.get(key) ?? null,
  setItem: (key: string, value: string) => mockStorage.set(key, value),
  removeItem: (key: string) => mockStorage.delete(key),
});

import { createSceneFeatureState } from "$lib/shared/3d/scene-features/state/scene-feature-state.svelte";
import { SCENE_FEATURES } from "$lib/shared/3d/scene-features/domain/scene-feature-registry";

describe("createSceneFeatureState", () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  it("initializes with registry defaults when no localStorage or overrides", () => {
    const state = createSceneFeatureState();
    // Stage defaults on
    expect(state.isEnabled("stage")).toBe(true);
    // Audience defaults off
    expect(state.isEnabled("audience")).toBe(false);
    // Environment defaults on
    expect(state.isEnabled("environment")).toBe(true);
  });

  it("applies overrides over registry defaults", () => {
    const state = createSceneFeatureState({ audience: true });
    expect(state.isEnabled("audience")).toBe(true);
  });

  it("localStorage wins over overrides", () => {
    mockStorage.set("tka-scene-features", JSON.stringify({ audience: false }));
    const state = createSceneFeatureState({ audience: true });
    expect(state.isEnabled("audience")).toBe(false);
  });

  it("toggle flips state and persists to localStorage", () => {
    const state = createSceneFeatureState();
    expect(state.isEnabled("stage")).toBe(true);
    state.toggle("stage");
    expect(state.isEnabled("stage")).toBe(false);
    // Check localStorage was updated
    const stored = JSON.parse(mockStorage.get("tka-scene-features")!);
    expect(stored.stage).toBe(false);
  });

  it("allEnabledReady is true when no async features are enabled", () => {
    // Disable all async features (environment, audience)
    const state = createSceneFeatureState();
    state.toggle("environment"); // off
    // audience is already off by default
    expect(state.allEnabledReady).toBe(true);
  });

  it("allEnabledReady is false when async feature is enabled but not ready", () => {
    const state = createSceneFeatureState();
    // environment is on by default and async — not yet reported ready
    expect(state.allEnabledReady).toBe(false);
  });

  it("allEnabledReady becomes true after all enabled async features report ready", () => {
    const state = createSceneFeatureState();
    // Only environment is enabled+async by default (audience is off)
    state.reportReady("environment");
    expect(state.allEnabledReady).toBe(true);
  });

  it("readyProgress tracks fraction of ready async features", () => {
    const state = createSceneFeatureState({ audience: true });
    // 2 enabled async features: environment + audience
    expect(state.readyProgress).toBe(0);
    state.reportReady("environment");
    expect(state.readyProgress).toBe(0.5);
    state.reportReady("audience");
    expect(state.readyProgress).toBe(1);
  });

  it("disabling an async feature recalculates readiness", () => {
    const state = createSceneFeatureState({ audience: true });
    // 2 async enabled: environment + audience. Neither ready.
    expect(state.allEnabledReady).toBe(false);
    // Disable both async features
    state.toggle("environment");
    state.toggle("audience");
    // No async features enabled — should be ready
    expect(state.allEnabledReady).toBe(true);
  });

  it("reset clears localStorage and reverts to defaults", () => {
    const state = createSceneFeatureState();
    state.toggle("stage"); // off
    state.toggle("audience"); // on
    state.reset();
    expect(state.isEnabled("stage")).toBe(true);
    expect(state.isEnabled("audience")).toBe(false);
    expect(mockStorage.has("tka-scene-features")).toBe(false);
  });

  it("features exposes the full registry", () => {
    const state = createSceneFeatureState();
    expect(state.features).toBe(SCENE_FEATURES);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/scene-features/scene-feature-state.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the state factory**

```typescript
// src/lib/shared/3d/scene-features/state/scene-feature-state.svelte.ts

import { SCENE_FEATURES, type SceneFeature } from "../domain/scene-feature-registry";

const STORAGE_KEY = "tka-scene-features";

function loadPersistedToggles(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    return {};
  }
}

function persistToggles(toggles: Record<string, boolean>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toggles));
}

export function createSceneFeatureState(
  overrides?: Partial<Record<string, boolean>>
) {
  const persisted = loadPersistedToggles();

  // Three-tier precedence: localStorage > overrides > registry default
  const initialToggles: Record<string, boolean> = {};
  for (const feature of SCENE_FEATURES) {
    if (feature.key in persisted) {
      initialToggles[feature.key] = persisted[feature.key]!;
    } else if (overrides && feature.key in overrides) {
      initialToggles[feature.key] = overrides[feature.key]!;
    } else {
      initialToggles[feature.key] = feature.defaultEnabled;
    }
  }

  let enabledMap = $state<Record<string, boolean>>({ ...initialToggles });
  let readySet = $state<Set<string>>(new Set());

  const enabledAsyncFeatures = $derived(
    SCENE_FEATURES.filter(
      (f) => f.requiresAsyncLoad && enabledMap[f.key]
    )
  );

  const readyAsyncCount = $derived(
    enabledAsyncFeatures.filter((f) => readySet.has(f.key)).length
  );

  const allEnabledReady = $derived(
    enabledAsyncFeatures.length === 0 ||
    readyAsyncCount === enabledAsyncFeatures.length
  );

  const readyProgress = $derived(
    enabledAsyncFeatures.length === 0
      ? 1
      : readyAsyncCount / enabledAsyncFeatures.length
  );

  function isEnabled(key: string): boolean {
    return enabledMap[key] ?? false;
  }

  function toggle(key: string): void {
    const current = enabledMap[key] ?? false;
    enabledMap = { ...enabledMap, [key]: !current };

    // Only persist keys the user has explicitly toggled
    const stored = loadPersistedToggles();
    stored[key] = !current;
    persistToggles(stored);
  }

  function reportReady(key: string): void {
    if (readySet.has(key)) return;
    readySet = new Set([...readySet, key]);
  }

  function reset(): void {
    localStorage.removeItem(STORAGE_KEY);
    const defaults: Record<string, boolean> = {};
    for (const feature of SCENE_FEATURES) {
      if (overrides && feature.key in overrides) {
        defaults[feature.key] = overrides[feature.key]!;
      } else {
        defaults[feature.key] = feature.defaultEnabled;
      }
    }
    enabledMap = { ...defaults };
  }

  return {
    get features(): readonly SceneFeature[] {
      return SCENE_FEATURES;
    },
    isEnabled,
    toggle,
    reportReady,
    get allEnabledReady(): boolean {
      return allEnabledReady;
    },
    get readyProgress(): number {
      return readyProgress;
    },
    reset,
  };
}

export type SceneFeatureState = ReturnType<typeof createSceneFeatureState>;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/scene-features/scene-feature-state.test.ts`
Expected: All 10 tests PASS

- [ ] **Step 5: Commit**

```bash
git add tests/unit/scene-features/scene-feature-state.test.ts src/lib/shared/3d/scene-features/state/scene-feature-state.svelte.ts
git commit -m "feat(scene-features): add state factory with toggle persistence and readiness tracking"
```

---

### Task 3: Scene Feature Context

**Files:**
- Create: `src/lib/shared/3d/scene-features/context/scene-feature-context.ts`

- [ ] **Step 1: Create the context file**

Follow the exact pattern from `src/lib/shared/3d/context/viewer-3d-context.ts`:

```typescript
// src/lib/shared/3d/scene-features/context/scene-feature-context.ts

import { getContext, setContext } from "svelte";
import type { SceneFeatureState } from "../state/scene-feature-state.svelte";

const KEY = Symbol("scene-features");

export function setSceneFeatureContext(state: SceneFeatureState) {
  setContext(KEY, state);
}

export function getSceneFeatureContext(): SceneFeatureState {
  return getContext<SceneFeatureState>(KEY);
}
```

- [ ] **Step 2: Verify TypeScript is happy**

Run: `npx tsc --noEmit 2>&1 | grep scene-feature-context`
Expected: No output (no errors)

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/scene-features/context/scene-feature-context.ts
git commit -m "feat(scene-features): add Svelte context set/get for scene feature state"
```

---

### Task 4: Loading Curtain Component

**Files:**
- Create: `src/lib/shared/3d/scene-features/components/SceneLoadingCurtain.svelte`

- [ ] **Step 1: Create the loading curtain**

```svelte
<!-- src/lib/shared/3d/scene-features/components/SceneLoadingCurtain.svelte -->
<script lang="ts">
  /**
   * SceneLoadingCurtain
   *
   * Dark overlay with drifting firefly dots and a progress bar.
   * Covers the 3D canvas until all enabled async scene features
   * have reported their assets loaded. Crossfades out over 400ms.
   */

  import { getSceneFeatureContext } from "../context/scene-feature-context";
  import { fade } from "svelte/transition";

  const sceneFeatures = getSceneFeatureContext();

  const ready = $derived(sceneFeatures.allEnabledReady);
  const progress = $derived(sceneFeatures.readyProgress);

  // 8 fireflies with randomized positions and animation delays
  const fireflies = Array.from({ length: 8 }, (_, i) => ({
    id: i,
    left: 10 + ((i * 37) % 80),
    top: 10 + ((i * 53) % 80),
    delay: (i * 0.4) % 3.2,
    duration: 2.5 + (i % 3) * 0.8,
  }));
</script>

{#if !ready}
  <div class="curtain" transition:fade={{ duration: 400 }}>
    <!-- Firefly dots -->
    {#each fireflies as fly (fly.id)}
      <div
        class="firefly"
        style="
          left: {fly.left}%;
          top: {fly.top}%;
          animation-delay: {fly.delay}s;
          animation-duration: {fly.duration}s;
        "
      ></div>
    {/each}

    <!-- Progress area -->
    <div class="progress-area">
      <p class="status-text">Setting the stage...</p>
      <div class="progress-track">
        <div class="progress-fill" style="width: {progress * 100}%"></div>
      </div>
    </div>
  </div>
{/if}

<style>
  .curtain {
    position: absolute;
    inset: 0;
    z-index: 20;
    background: #0a0e14;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .firefly {
    position: absolute;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #d4e157;
    box-shadow: 0 0 8px 2px rgba(212, 225, 87, 0.4);
    opacity: 0;
    animation: drift ease-in-out infinite;
  }

  @keyframes drift {
    0%, 100% {
      opacity: 0;
      transform: translate(0, 0);
    }
    25% {
      opacity: 0.7;
      transform: translate(12px, -8px);
    }
    50% {
      opacity: 0.3;
      transform: translate(-6px, -16px);
    }
    75% {
      opacity: 0.8;
      transform: translate(8px, -4px);
    }
  }

  .progress-area {
    position: absolute;
    bottom: 48px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .status-text {
    color: rgba(255, 200, 120, 0.6);
    font-size: var(--font-size-min, 14px);
    margin: 0;
    letter-spacing: 0.04em;
  }

  .progress-track {
    width: 180px;
    height: 3px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: rgba(255, 180, 70, 0.7);
    border-radius: 2px;
    transition: width 0.3s ease;
  }
</style>
```

- [ ] **Step 2: Verify TypeScript is happy**

Run: `npx tsc --noEmit 2>&1 | grep SceneLoadingCurtain`
Expected: No output (no errors)

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/scene-features/components/SceneLoadingCurtain.svelte
git commit -m "feat(scene-features): add loading curtain with firefly animation and progress bar"
```

---

### Task 5: Scene Feature Toggles Component

**Files:**
- Create: `src/lib/shared/3d/scene-features/components/SceneFeatureToggles.svelte`

- [ ] **Step 1: Create the toggles component**

```svelte
<!-- src/lib/shared/3d/scene-features/components/SceneFeatureToggles.svelte -->
<script lang="ts">
  /**
   * SceneFeatureToggles
   *
   * Content for the "Scene" tab in Viewer3DGearPopover.
   * Renders a toggle per scene feature from the registry.
   */

  import { getSceneFeatureContext } from "../context/scene-feature-context";

  const sceneFeatures = getSceneFeatureContext();

  function handleToggle(key: string) {
    sceneFeatures.toggle(key);
  }
</script>

<div class="scene-toggles">
  {#each sceneFeatures.features as feature (feature.key)}
    {@const enabled = sceneFeatures.isEnabled(feature.key)}
    <button
      class="toggle-row"
      class:enabled
      onclick={() => handleToggle(feature.key)}
      aria-pressed={enabled}
    >
      <span class="toggle-label">{feature.label}</span>
      <span class="toggle-indicator" class:on={enabled}>
        <span class="toggle-dot"></span>
      </span>
    </button>
  {/each}

  <button class="reset-link" onclick={() => sceneFeatures.reset()}>
    Reset to defaults
  </button>
</div>

<style>
  .scene-toggles {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 4px 0;
  }

  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    border: none;
    background: transparent;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .toggle-row:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .toggle-label {
    color: rgba(255, 255, 255, 0.8);
    font-size: var(--font-size-min, 14px);
  }

  .toggle-indicator {
    width: 32px;
    height: 18px;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.12);
    position: relative;
    transition: background 0.2s ease;
    flex-shrink: 0;
  }

  .toggle-indicator.on {
    background: rgba(139, 139, 255, 0.5);
  }

  .toggle-dot {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.7);
    transition: transform 0.2s ease;
  }

  .toggle-indicator.on .toggle-dot {
    transform: translateX(14px);
    background: #fff;
  }

  .reset-link {
    margin-top: 8px;
    padding: 4px 8px;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.35);
    font-size: 12px;
    cursor: pointer;
    text-align: left;
  }

  .reset-link:hover {
    color: rgba(255, 255, 255, 0.6);
  }
</style>
```

- [ ] **Step 2: Verify TypeScript is happy**

Run: `npx tsc --noEmit 2>&1 | grep SceneFeatureToggles`
Expected: No output (no errors)

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/scene-features/components/SceneFeatureToggles.svelte
git commit -m "feat(scene-features): add scene feature toggles component for gear popover"
```

---

### Task 6: Add "Scene" Tab to Gear Popover

**Files:**
- Modify: `src/lib/shared/3d/components/Viewer3DGearPopover.svelte`

- [ ] **Step 1: Add the import and tab entry**

At the top of the script (after the existing imports around line 22), add:

```typescript
import SceneFeatureToggles from "../scene-features/components/SceneFeatureToggles.svelte";
```

Update the `TabId` type (line 26) and `TABS` array (lines 28-33):

Change:
```typescript
type TabId = "camera" | "planes" | "performers" | "effects";

const TABS: { id: TabId; label: string; disabled?: boolean }[] = [
  { id: "camera", label: "Camera" },
  { id: "planes", label: "Planes" },
  { id: "performers", label: "Performers" },
  { id: "effects", label: "Effects", disabled: true },
];
```

To:
```typescript
type TabId = "camera" | "planes" | "performers" | "scene" | "effects";

const TABS: { id: TabId; label: string; disabled?: boolean }[] = [
  { id: "camera", label: "Camera" },
  { id: "planes", label: "Planes" },
  { id: "performers", label: "Performers" },
  { id: "scene", label: "Scene" },
  { id: "effects", label: "Effects", disabled: true },
];
```

- [ ] **Step 2: Add the tab panel**

Find the Effects tab panel section (around line 282-287, the block that shows "Effects coming soon"). Just before it, add the Scene tab panel:

```svelte
  {:else if activeTab === "scene"}
    <div class="tab-panel" role="tabpanel">
      <SceneFeatureToggles />
    </div>
```

- [ ] **Step 3: Verify TypeScript is happy**

Run: `npx tsc --noEmit 2>&1 | grep Viewer3DGearPopover`
Expected: No output (no errors)

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/components/Viewer3DGearPopover.svelte
git commit -m "feat(scene-features): add Scene tab to gear popover with feature toggles"
```

---

### Task 7: Integrate into Sequence Viewer (Viewer3DCanvas)

**Files:**
- Modify: `src/lib/shared/3d/components/Viewer3DCanvas.svelte`

- [ ] **Step 1: Create scene feature state and set context**

Add imports at the top of the script block (after the existing imports around line 24):

```typescript
import { createSceneFeatureState } from "../scene-features/state/scene-feature-state.svelte";
import { setSceneFeatureContext } from "../scene-features/context/scene-feature-context";
import SceneLoadingCurtain from "../scene-features/components/SceneLoadingCurtain.svelte";
```

After the existing `getViewer3DContext()` call (line 45), add:

```typescript
const sceneFeatureState = createSceneFeatureState();
setSceneFeatureContext(sceneFeatureState);
```

- [ ] **Step 2: Add the loading curtain to the template**

Find the Canvas block (line 63-74). After the closing `</Canvas>` tag (line 74), before the progress bar `{#if}` on line 76, add:

```svelte
    <SceneLoadingCurtain />
```

- [ ] **Step 3: Verify TypeScript is happy**

Run: `npx tsc --noEmit 2>&1 | grep Viewer3DCanvas`
Expected: No output (no errors)

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/components/Viewer3DCanvas.svelte
git commit -m "feat(scene-features): wire scene feature state + loading curtain into sequence viewer"
```

---

### Task 8: Gate Scene Objects in Viewer3DScene

**Files:**
- Modify: `src/lib/shared/3d/components/Viewer3DScene.svelte`

- [ ] **Step 1: Import context and add scene feature reads**

Add import at the top of the script (after the existing imports around line 22):

```typescript
import { getSceneFeatureContext } from "../scene-features/context/scene-feature-context";
import Stage3D from "./Stage3D.svelte";
import SeatedAudience3D from "./SeatedAudience3D.svelte";
import Grid3D from "./Grid3D.svelte";
import { WALL_OFFSET } from "../domain/constants/performer-positions";
```

After the existing context calls (around line 44), add:

```typescript
const sceneFeatures = getSceneFeatureContext();
```

- [ ] **Step 2: Add scene feature components to the template**

Find the Environment3D block (lines 219-222). Replace:

```svelte
<!-- Environment (no STAGE_LIFT wrapper — sits at ground level) -->
{#if hasEnvironment}
  <Environment3D {backgroundType} />
{/if}
```

With:

```svelte
<!-- Environment (gated by scene feature toggle) -->
{#if hasEnvironment && sceneFeatures.isEnabled("environment")}
  <Environment3D {backgroundType} />
{/if}

<!-- Performance stage (gated by scene feature toggle) -->
{#if sceneFeatures.isEnabled("stage")}
  <Stage3D />
{/if}

<!-- Seated audience (gated by scene feature toggle) -->
{#if sceneFeatures.isEnabled("audience")}
  <SeatedAudience3D />
{/if}
```

The grid is already rendered inside PerformerRig, so it doesn't need to be added here. Grid toggling will be handled by passing the feature flag into PerformerRig's `showGrid` prop. Update the existing `showGrid` prop on PerformerRig (line 245):

Change:
```svelte
      showGrid={viewer3DState.showGrid}
```

To:
```svelte
      showGrid={viewer3DState.showGrid && sceneFeatures.isEnabled("grid")}
```

- [ ] **Step 3: Verify TypeScript is happy**

Run: `npx tsc --noEmit 2>&1 | grep Viewer3DScene`
Expected: No output (no errors)

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/components/Viewer3DScene.svelte
git commit -m "feat(scene-features): gate stage, audience, environment, grid on feature toggles in sequence viewer"
```

---

### Task 9: Add reportReady Calls to Scene Components

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/ForestScene.svelte`
- Modify: `src/lib/shared/3d/components/SeatedAudience3D.svelte`

- [ ] **Step 1: Add reportReady to ForestScene**

In `ForestScene.svelte`, add the import at the top of the script (after the existing imports around line 17):

```typescript
import { getSceneFeatureContext } from "../../scene-features/context/scene-feature-context";
```

After the existing state declarations (around line 62, after `tentScale`), add:

```typescript
// Scene feature context — gate campfire/tent visibility and report loading readiness
let sceneFeatures: ReturnType<typeof getSceneFeatureContext> | null = null;
try {
  sceneFeatures = getSceneFeatureContext();
} catch {
  // ForestScene may be rendered outside the scene feature system (e.g. standalone environments).
  // In that case, all features are shown and no readiness reporting is needed.
}
```

Add a reactive effect to report ready when all GLBs are loaded. Place it after the fog effect (around line 253):

```typescript
// Report environment readiness when all forest GLBs have loaded
$effect(() => {
  if (!sceneFeatures) return;
  const allLoaded = $tree1 && $tree2 && $tree3 && $rock1 && $rock2 && $bush1 && $bush2 && $campfire && $tent && $fallenLog && $fallenLogSmall;
  if (allLoaded) {
    sceneFeatures.reportReady("environment");
  }
});
```

Gate the campfire section (around line 361, the `{#if $campfire}` block). Change:

```svelte
{#if $campfire}
```

To:

```svelte
{#if $campfire && (sceneFeatures?.isEnabled("campfire") ?? true)}
```

Gate the tent section (around line 422, the `{#if $tent}` block). Change:

```svelte
{#if $tent}
```

To:

```svelte
{#if $tent && (sceneFeatures?.isEnabled("tent") ?? true)}
```

- [ ] **Step 2: Add reportReady to SeatedAudience3D**

In `SeatedAudience3D.svelte`, add the import (after the existing imports around line 16):

```typescript
import { getSceneFeatureContext } from "../scene-features/context/scene-feature-context";
```

After the existing state declarations (around line 28), add:

```typescript
let sceneFeatures: ReturnType<typeof getSceneFeatureContext> | null = null;
try {
  sceneFeatures = getSceneFeatureContext();
} catch {
  // May be rendered outside scene feature system
}
```

In the `onMount` callback (lines 75-77), after the preload call, add a `.then` to report readiness:

Change:
```typescript
onMount(() => {
  seatedAudienceLoader.preloadAnimations(ANIMATION_URLS);
});
```

To:
```typescript
onMount(() => {
  seatedAudienceLoader.preloadAnimations(ANIMATION_URLS).then(() => {
    sceneFeatures?.reportReady("audience");
  });
});
```

Note: The GLBs are loaded by individual `SeatedFigure3D` components via `useGltf`. The FBX preload is the last async step. Since `useGltf` caches internally and the audience only mounts after SeatedAudience3D mounts, reporting ready after FBX preload is sufficient — the GLBs will load in parallel and be cached by Threlte.

- [ ] **Step 3: Verify TypeScript is happy**

Run: `npx tsc --noEmit 2>&1 | grep -E "ForestScene|SeatedAudience3D"`
Expected: No output (no errors)

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/ForestScene.svelte src/lib/shared/3d/components/SeatedAudience3D.svelte
git commit -m "feat(scene-features): add reportReady calls and campfire/tent gating to scene components"
```

---

### Task 10: Integrate into Collision Lab

**Files:**
- Modify: `src/lib/features/lab/tabs/collision-lab/components/PoseViewport.svelte`

- [ ] **Step 1: Create scene feature state with audience override**

Add imports near the top of the script:

```typescript
import { createSceneFeatureState } from "$lib/shared/3d/scene-features/state/scene-feature-state.svelte";
import { setSceneFeatureContext } from "$lib/shared/3d/scene-features/context/scene-feature-context";
```

After the existing context/state setup, add:

```typescript
const sceneFeatureState = createSceneFeatureState({ audience: true });
setSceneFeatureContext(sceneFeatureState);
```

- [ ] **Step 2: Remove hardcoded showAudience/audienceCount from Scene3D props**

Find the Scene3D invocation (around line 201-212). Remove the `showAudience={true}` and `audienceCount={6}` props since these are now controlled by the scene feature system. The Scene3D component still accepts these props for backward compatibility, but the scene feature state is the source of truth.

Change:
```svelte
<Scene3D
  cameraPreset="perspective"
  customCameraPosition={[2.2, 2.8, -4.0]}
  customCameraTarget={[0, 0.2, 1.1]}
  showGrid={true}
  showLabels={false}
  {visiblePlanes}
  avatarPositions={gridAnchorPositions}
  backgroundType={BackgroundType.FIREFLY_FOREST}
  showAudience={true}
  audienceCount={6}
>
```

To:
```svelte
<Scene3D
  cameraPreset="perspective"
  customCameraPosition={[2.2, 2.8, -4.0]}
  customCameraTarget={[0, 0.2, 1.1]}
  showGrid={true}
  showLabels={false}
  {visiblePlanes}
  avatarPositions={gridAnchorPositions}
  backgroundType={BackgroundType.FIREFLY_FOREST}
>
```

Note: The collision lab's Scene3D still renders stage/audience/environment via its own `showStage`/`showAudience` props. The scene feature system integration for Scene3D (used by collision lab) is separate from Viewer3DScene (used by sequence viewer). For now, PoseViewport sets the context so the gear popover's Scene tab works, but the actual gating in Scene3D will be a follow-up. The sequence viewer path (Viewer3DScene) is fully gated in Task 8.

- [ ] **Step 3: Verify TypeScript is happy**

Run: `npx tsc --noEmit 2>&1 | grep PoseViewport`
Expected: No output (no errors)

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/lab/tabs/collision-lab/components/PoseViewport.svelte
git commit -m "feat(scene-features): wire scene feature state into collision lab with audience override"
```

---

### Task 11: Manual Verification

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: All tests pass, including the new scene-feature-state tests

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No new errors (pre-existing sequence-engine errors are fine)

- [ ] **Step 3: Verify in browser — sequence viewer**

Open the sequence viewer in the browser. Load a sequence.
- The loading curtain should appear with firefly animation and progress bar
- Once the environment loads, the curtain should fade out
- Open the gear popover — the "Scene" tab should be visible
- Toggle features on/off — stage, grid, environment should appear/disappear
- Toggle audience on — the curtain should briefly reappear while audience GLBs load

- [ ] **Step 4: Verify in browser — collision lab**

Open the collision lab.
- Audience should be on by default (override)
- The gear popover Scene tab should work
- Toggling audience off should hide the seated figures

- [ ] **Step 5: Commit any fixes from verification**

```bash
git add -A
git commit -m "fix(scene-features): address issues found during manual verification"
```
