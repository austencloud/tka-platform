# 3D Viewer First-Open Guidance + Presets Surfacing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A first-ever 3D open gets a live guided setup (scene → performer count → formation → presets); a Presets panel lands in the 3D rail with one-tap apply; plain 3D opens follow the current app prop instead of restoring stale prop configs. Scope is the sequence-viewer 3D only: one sequence, many forms — per-performer sequences belong to the Stage module and stay out (spec decision 5).

**Architecture:** Prop-follow is a hydrate-policy change in `viewer-3d-state.svelte.ts` gated by a one-shot sessionStorage "preset intent" that `applyScene3DLook` sets. Live preset apply is a new `applyPersistConfig` method on the viewer state driven by a config-builder extracted from `applyScene3DLook`. The intro and presets panel are new presentations composing existing owners: `SceneSelectorPopover`, `FormationPopover`, `scene3dCollectionState`, `SaveSceneModal` (per `never-hand-roll.md`: **Composing** existing capabilities; the only **Create** is the live-apply method, whose owner is `viewer-3d-state`).

**Tech Stack:** Svelte 5 runes, vitest (plain-TS unit tests on extracted pure functions), existing onboarding persister (localStorage + Firestore), Chrome DevTools MCP for visual verification.

**Spec:** `docs/superpowers/specs/2026-08-23-viewer3d-intro-presets-design.md`

**Executor discipline (every task):** Re-read this plan file at the start of the task. Prove completion with tool output. Commit with explicit pathspec (`git commit -m "..." -- <paths>`), never broad staging. Do not delegate further.

---

## Ledger

- [ ] Task 1: Plain-open policy pure helpers (TDD)
- [ ] Task 2: Wire prop-follow into viewer-3d-state + preset intent
- [ ] Task 3: Extract `buildScene3DPersistConfig` (TDD) and refactor `applyScene3DLook`
- [ ] Task 4: Live preset apply (`applyPersistConfig` + `applyScene3DLookLive`)
- [ ] Task 5: Presets tool in the 3D rail
- [ ] Task 6: Intro flag + persistence
- [ ] Task 7: `Viewer3DIntro` component, mount, test route
- [ ] Task 8: Full verification pass

---

### Task 1: Plain-open policy pure helpers (TDD)

New pure module so the policy is unit-testable without instantiating the runes state.

**Files:**
- Create: `src/lib/shared/3d/domain/plain-open-policy.ts`
- Test: `tests/unit/plain-open-policy.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/plain-open-policy.test.ts
import { describe, expect, it } from "vitest";
import {
  resolvePlainOpenPerformerSettings,
  resolveInitialDefaultProp,
} from "../../src/lib/shared/3d/domain/plain-open-policy";

const fullSettings = {
  prop: "fans",
  effortId: "linear",
  effect: "fire",
  staffLengthCm: 120,
};

describe("resolvePlainOpenPerformerSettings", () => {
  it("passes settings through verbatim on a preset-sourced open", () => {
    expect(resolvePlainOpenPerformerSettings(fullSettings, true)).toEqual(
      fullSettings
    );
  });

  it("strips prop and staffLengthCm on a plain open, keeping effort/effect", () => {
    expect(resolvePlainOpenPerformerSettings(fullSettings, false)).toEqual({
      prop: null,
      effortId: "linear",
      effect: "fire",
      staffLengthCm: null,
    });
  });

  it("returns undefined for absent settings", () => {
    expect(resolvePlainOpenPerformerSettings(undefined, false)).toBeUndefined();
  });
});

describe("resolveInitialDefaultProp", () => {
  it("prefers the app prop on a plain open", () => {
    expect(
      resolveInitialDefaultProp({
        presetSourced: false,
        appProp: "fans",
        persistedProp: "staff",
      })
    ).toBe("fans");
  });

  it("prefers the persisted prop on a preset-sourced open", () => {
    expect(
      resolveInitialDefaultProp({
        presetSourced: true,
        appProp: "fans",
        persistedProp: "buugeng",
      })
    ).toBe("buugeng");
  });

  it("falls back to the persisted prop when the app prop is absent", () => {
    expect(
      resolveInitialDefaultProp({
        presetSourced: false,
        appProp: null,
        persistedProp: "staff",
      })
    ).toBe("staff");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/plain-open-policy.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the module**

```ts
// src/lib/shared/3d/domain/plain-open-policy.ts
/**
 * Plain-open prop-follow policy (spec 2026-08-23-viewer3d-intro-presets).
 *
 * A PLAIN 3D open (no saved preset applied) restores structure — performer
 * count, formation, camera, effects — but props follow the CURRENT app prop.
 * A PRESET-SOURCED open (applyScene3DLook ran) restores everything verbatim.
 *
 * Pure functions; the runes state consumes them at hydrate time.
 */

/** Structural mirror of viewer-3d-state's StoredPerformerSettings. */
export interface PlainOpenPerformerSettings {
  prop: string | null;
  effortId: string | null;
  effect: string | null;
  staffLengthCm: number | null;
}

export function resolvePlainOpenPerformerSettings(
  settings: PlainOpenPerformerSettings | undefined,
  presetSourced: boolean
): PlainOpenPerformerSettings | undefined {
  if (!settings) return undefined;
  if (presetSourced) return settings;
  return {
    ...settings,
    // Prop identity and its size override follow the app on plain opens.
    prop: null,
    staffLengthCm: null,
  };
}

export function resolveInitialDefaultProp(args: {
  presetSourced: boolean;
  appProp: string | null | undefined;
  persistedProp: string;
}): string {
  if (!args.presetSourced && args.appProp) return args.appProp;
  return args.persistedProp;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/plain-open-policy.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(3d): plain-open prop-follow policy helpers" -- src/lib/shared/3d/domain/plain-open-policy.ts tests/unit/plain-open-policy.test.ts
```

---

### Task 2: Wire prop-follow into viewer-3d-state + preset intent

**Files:**
- Modify: `src/lib/shared/3d/state/viewer-3d-state.svelte.ts`
- Modify: `src/lib/features/scene-3d-collection/services/open-3d-scene.ts`
- Modify: `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte:175-179`
- Modify: `src/lib/features/stage/scene/SceneStudio.svelte:48`

- [ ] **Step 1: Add the one-shot preset intent to viewer-3d-state**

Near `writeViewer3DConfig` (bottom of `viewer-3d-state.svelte.ts`), add:

```ts
/**
 * One-shot marker that the NEXT viewer mount was seeded by a saved preset
 * (applyScene3DLook). Consumed at construct; without it, a plain open
 * re-seeds prop identity from the app prop (plain-open-policy.ts).
 * Same pattern as SCENE_BPM_INTENT_KEY.
 */
export const VIEWER3D_PRESET_INTENT_KEY = "tka-viewer3d-preset-intent";

export function markViewer3DPresetIntent(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(VIEWER3D_PRESET_INTENT_KEY, "1");
  } catch {
    // Quota/unavailable — worst case the next open follows the app prop.
  }
}

function consumeViewer3DPresetIntent(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  try {
    const present = sessionStorage.getItem(VIEWER3D_PRESET_INTENT_KEY) === "1";
    sessionStorage.removeItem(VIEWER3D_PRESET_INTENT_KEY);
    return present;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Extend `Viewer3DStateOptions` and the construct-time default prop**

Add `appDefaultProp?: string | null;` to the `Viewer3DStateOptions` interface (the one carrying `firstUseEnvironment`).

In `buildViewer3DState`, right after `const persistent = seed === undefined;` (line ~490), add:

```ts
// Preset intent is only meaningful for the persistent (real) viewer; seeded
// previews always apply their seed verbatim.
const _presetSourcedOpen = persistent ? consumeViewer3DPresetIntent() : false;
```

Change the `_defaultSettings` prop init (line ~563-572) to route through the policy. Import `resolveInitialDefaultProp` and `resolvePlainOpenPerformerSettings` from `../domain/plain-open-policy`:

```ts
prop: (() => {
  const seededProp =
    seed?.defaultProp &&
    Object.values(PropType).includes(seed.defaultProp as PropType)
      ? (seed.defaultProp as PropType)
      : null;
  if (seededProp) return seededProp;
  const resolved = resolveInitialDefaultProp({
    presetSourced: _presetSourcedOpen,
    appProp:
      options.appDefaultProp &&
      Object.values(PropType).includes(options.appDefaultProp as PropType)
        ? options.appDefaultProp
        : null,
    persistedProp: loadPersistedDefaultProp(),
  });
  return resolved as PropType;
})(),
```

- [ ] **Step 3: Apply the policy in `enter3D`'s restore loop**

In `enter3D` (line ~1283-1292), replace the direct `snap.settings` use:

```ts
const settings = resolvePlainOpenPerformerSettings(
  snap.settings,
  _presetSourcedOpen
);
if (settings) {
  if (settings.prop !== null) p.setProp(settings.prop as PropType);
  if (settings.effortId !== null)
    p.setEffort(settings.effortId as EffortId);
  if (settings.effect !== null)
    p.setEffect(settings.effect as EffectType);
  if (settings.staffLengthCm !== null)
    p.setStaffLengthCm(settings.staffLengthCm);
}
```

(Performers with a stripped prop override inherit `_defaultSettings.prop`, which Step 2 pointed at the app prop — that is the whole mechanism.)

- [ ] **Step 4: Mark the intent when a preset is applied**

In `open-3d-scene.ts`, import `markViewer3DPresetIntent` from viewer-3d-state and call it as the LAST line of `applyScene3DLook` (after `persistViewerMode("animation-3d")`).

- [ ] **Step 5: Pass the app prop from both persistent hosts**

`SequenceViewerOrchestrator.svelte:175`:

```ts
const viewer3DState = createViewer3DState(undefined, {
  firstUseEnvironment: sceneEnvironmentIdForBackground(
    getSettings().backgroundType
  ),
  appDefaultProp: getSettings().bluePropType ?? null,
});
```

`SceneStudio.svelte:48`: add the same `appDefaultProp` option, importing whatever settings accessor that file already uses (add the orchestrator's `getSettings` import if it has none).

- [ ] **Step 6: Typecheck the touched area and run the unit tests**

Run: `npx vitest run tests/unit/plain-open-policy.test.ts` → PASS.
Run: `npm run check:fast > "$TEMP/check-task2.log" 2>&1; grep -icE "error" "$TEMP/check-task2.log"` → 0 new errors in touched files (compare against pre-existing failures if the baseline is red; list any pre-existing ones in the commit message).

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(3d): plain opens follow the app prop; presets mark a one-shot intent" -- src/lib/shared/3d/state/viewer-3d-state.svelte.ts src/lib/features/scene-3d-collection/services/open-3d-scene.ts src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte src/lib/features/stage/scene/SceneStudio.svelte
```

---

### Task 3: Extract `buildScene3DPersistConfig` (TDD) and refactor `applyScene3DLook`

The group-filtered snapshot→config mapping currently lives inline in `applyScene3DLook` (`open-3d-scene.ts:49-82`). Task 4 needs it standalone.

**Files:**
- Create: `src/lib/features/scene-3d-collection/domain/scene-3d-look.ts`
- Modify: `src/lib/features/scene-3d-collection/services/open-3d-scene.ts`
- Test: `tests/unit/scene-3d-look.test.ts`

- [ ] **Step 1: Write the failing test**

Build a minimal `Collected3DScene` fixture (import the type; fill required snapshot fields — copy a valid shape from `scene-3d-collection-types.ts`'s Zod schema). Assert:

```ts
// tests/unit/scene-3d-look.test.ts
import { describe, expect, it } from "vitest";
import { buildScene3DPersistConfig } from "../../src/lib/features/scene-3d-collection/domain/scene-3d-look";
import type { Collected3DScene } from "../../src/lib/features/scene-3d-collection/domain/scene-3d-collection-types";

function makeScene(groups?: string[]): Collected3DScene {
  return {
    id: "s1",
    name: "Test scene",
    poster: null,
    createdAt: "2026-08-23T00:00:00.000Z",
    snapshot: {
      scene: { backgroundType: "ocean", oceanVariant: "abyss" },
      camera: {
        position: { x: 0, y: 2, z: 6 },
        rotation: { x: 0, y: 0, z: 0 },
        fov: 50,
        target: { x: 0, y: 1, z: 0 },
        timestamp: 0,
      },
      performers: [
        {
          position: { x: 0, z: 0 },
          facingAngle: 0,
          customBluePlane: "wall",
          customRedPlane: "wall",
          name: null,
          settings: {
            prop: "buugeng",
            effortId: "linear",
            effect: "fire",
            staffLengthCm: null,
          },
        },
      ],
      selectedPerformerIndex: null,
      activeFormation: "circle",
      propSizeLinked: true,
      defaultSettings: { prop: "buugeng", effortId: "linear", planeMode: "wall" },
      visiblePlanes: ["wall"],
      navMode: "orbit",
      activePreset: null,
      activeCameraPreset: "main",
      showGridLabels: false,
      effectToggles: { trails: true },
      sceneFeatures: {},
      props: { bluePropType: "buugeng", redPropType: "buugeng" },
      ...(groups ? { groups } : {}),
    },
  } as unknown as Collected3DScene;
}

describe("buildScene3DPersistConfig", () => {
  it("maps every group when no groups mask is present", () => {
    const config = buildScene3DPersistConfig(makeScene());
    expect(config.performers).toHaveLength(1);
    expect(config.defaultProp).toBe("buugeng");
    expect(config.effectToggles).toEqual({ trails: true });
    expect(config.environmentId).toBeDefined();
    expect(config.camera).not.toBeNull();
  });

  it("omits prop data when the props group is not saved", () => {
    const config = buildScene3DPersistConfig(makeScene(["performers"]));
    expect(config.defaultProp).toBeUndefined();
    expect(config.performers?.[0]?.settings?.prop).toBeNull();
    expect(config.effectToggles).toBeUndefined();
    expect(config.camera).toBeUndefined();
  });
});
```

Adjust the fixture until the Zod schema in `scene-3d-collection-types.ts` accepts it (the test file is the place to encode the real minimal shape — read the schema, don't guess).

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/scene-3d-look.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the module by MOVING the mapping out of `applyScene3DLook`**

`scene-3d-look.ts` contains the exact logic of `open-3d-scene.ts:49-82` plus `filterPerformerSettings` (`open-3d-scene.ts:108-118`), as:

```ts
import type {
  Collected3DScene,
  StoredPerformerSettings,
} from "./scene-3d-collection-types";
import { getScene3DEnvironmentId, isGroupSaved } from "./scene-3d-collection-types";
import type { Viewer3DPersistConfig, ViewerNavMode } from "$lib/shared/3d/state/viewer-3d-state.svelte";

/** Group-filtered mapping from a saved scene to the viewer's persist config. */
export function buildScene3DPersistConfig(
  scene: Collected3DScene
): Partial<Viewer3DPersistConfig> {
  // ...body moved verbatim from applyScene3DLook steps 1 (performers/props/
  // effects/scene/camera branches), returning `config`.
}
```

(Type-only imports from `viewer-3d-state.svelte` are erased at runtime, so the test does not pull the runes module.)

`applyScene3DLook` becomes: `const config = buildScene3DPersistConfig(scene);` then `writeViewer3DConfig(config);` — the sceneFeatures write, settings prop update, viewer-mode persist, and (from Task 2) `markViewer3DPresetIntent()` stay where they are.

- [ ] **Step 4: Run tests + verify no behavior change**

Run: `npx vitest run tests/unit/scene-3d-look.test.ts` → PASS.
Run: `npx vitest run tests/unit/` filtered to any existing scene-3d tests (`npx vitest run tests/unit/scene-3d-render-state.test.ts`) → PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "refactor(scene-3d): extract buildScene3DPersistConfig for reuse" -- src/lib/features/scene-3d-collection/domain/scene-3d-look.ts src/lib/features/scene-3d-collection/services/open-3d-scene.ts tests/unit/scene-3d-look.test.ts
```

---

### Task 4: Live preset apply

Applying a preset from INSIDE a mounted viewer must update the live state, not just localStorage seeds.

**Files:**
- Modify: `src/lib/shared/3d/state/viewer-3d-state.svelte.ts`
- Modify: `src/lib/features/scene-3d-collection/services/open-3d-scene.ts`

- [ ] **Step 1: Add `applyPersistConfig` to the viewer state**

Inside `buildViewer3DState`, add (near `restoreViewerSnapshot`):

```ts
/**
 * Apply a persist config to the LIVE state — the in-viewer "load preset"
 * path. Mirrors what a fresh mount reads from localStorage, minus render
 * mode. Camera snaps via the registered callback when present.
 */
function applyPersistConfig(config: Partial<Viewer3DPersistConfig>): void {
  sceneUndo.withoutUndo(() => {
    if (config.performers) {
      while (performerManager.performers.length < config.performers.length)
        performerManager.addPerformer();
      while (performerManager.performers.length > config.performers.length)
        performerManager.removePerformer();
      performerManager.cancelFormationTransition();
      config.performers.forEach((snap, i) => {
        const p = performerManager.performers[i];
        if (!p) return;
        p.position.x = snap.position.x;
        p.position.z = snap.position.z;
        p.setFacingAngle(snap.facingAngle);
        p.setHandPlane("blue", snap.customBluePlane);
        p.setHandPlane("red", snap.customRedPlane);
        p.setDisplayName(snap.name ?? null);
        p.resetProp();
        p.resetEffort();
        p.resetEffects();
        if (snap.settings) {
          if (snap.settings.prop !== null)
            p.setProp(snap.settings.prop as PropType);
          if (snap.settings.effortId !== null)
            p.setEffort(snap.settings.effortId as EffortId);
          if (snap.settings.effect !== null)
            p.setEffect(snap.settings.effect as EffectType);
          if (snap.settings.staffLengthCm !== null)
            p.setStaffLengthCm(snap.settings.staffLengthCm);
        }
        if (_currentSequenceData && !p.totalSteps)
          p.loadSequence(_currentSequenceData);
      });
    }
    if (config.activeFormation !== undefined)
      activeFormation = config.activeFormation;
    if (config.selectedPerformerIndex !== undefined)
      selectedPerformerIndex = config.selectedPerformerIndex;
    if (
      config.defaultProp &&
      Object.values(PropType).includes(config.defaultProp as PropType)
    ) {
      _defaultSettings.prop = config.defaultProp as PropType;
      persistDefaultProp(_defaultSettings.prop);
    }
    if (config.effectToggles) {
      for (const key of Object.keys(effectToggles)) delete effectToggles[key];
      Object.assign(effectToggles, config.effectToggles);
      persistEffectToggles({ ...effectToggles });
    }
    if (config.environmentId) setEnvironmentIdInternal(config.environmentId);
    if (config.oceanVariant) oceanVariant = config.oceanVariant as OceanVariant;
    if (config.camera) {
      snapCameraTo(config.camera.position, config.camera.target, undefined, true);
    } else if (config.performers) {
      // No saved camera in this preset — reframe to fit the new cast.
      frameAllPerformers(undefined, true);
    }
  });
}
```

Adapt the details to the file's real internals: `setEnvironmentIdInternal` means "whatever the exported `setEnvironmentId` setter (line ~1461) does — call the same code path"; `frameAllPerformers` already exists on the state (SceneControlWorkspace calls `viewer.frameAllPerformers`). Reset calls (`resetProp` etc., line ~820) exist on performer instances. Export `applyPersistConfig` on the returned object.

- [ ] **Step 2: Add the in-viewer apply service**

In `open-3d-scene.ts`:

```ts
import { buildScene3DPersistConfig } from "../domain/scene-3d-look";
import type { Viewer3DState } from "$lib/shared/3d/state/viewer-3d-state.svelte";
import { revertSettingsCheckpoint } from "$lib/shared/collections/settings-checkpoint.svelte";

/**
 * Apply a saved scene while a viewer is MOUNTED: persist the seeds (so a
 * refresh keeps it) AND push the config into the live state. Toast offers
 * Undo, restoring both the settings checkpoint and the live viewer state.
 */
export function applyScene3DLookLive(
  scene: Collected3DScene,
  viewer: Viewer3DState
): void {
  const before = viewer.serialize();
  applyScene3DLook(scene); // checkpoints settings, writes seeds, marks intent
  viewer.applyPersistConfig(buildScene3DPersistConfig(scene));
  showToast({
    message: `Applied "${scene.name}"`,
    type: "success",
    duration: 6000,
    action: {
      label: "Undo",
      onclick: () => {
        revertSettingsCheckpoint();
        writeViewer3DConfig(before);
        viewer.applyPersistConfig(before);
      },
    },
  });
}
```

Check `showToast`'s action API in `toast-state.svelte.ts` (the Undo toast in `Scene3DCollectionModule.svelte` is the working reference — copy its exact shape) and `revertSettingsCheckpoint`'s exported name in `settings-checkpoint.svelte.ts`; also verify `serialize()` is exposed on the returned state object (it exists at line ~1352 — export it if it is not already on the return).

- [ ] **Step 3: Typecheck**

Run: `npm run check:fast > "$TEMP/check-task4.log" 2>&1; grep -icE "error" "$TEMP/check-task4.log"` → no new errors.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(3d): live preset apply with undo" -- src/lib/shared/3d/state/viewer-3d-state.svelte.ts src/lib/features/scene-3d-collection/services/open-3d-scene.ts
```

---

### Task 5: Presets tool in the 3D rail

**Files:**
- Modify: `src/lib/shared/3d/domain/scene-control-layout.ts:1-6` (union)
- Modify: `src/lib/shared/3d/components/controls/SceneControlRail.svelte`
- Modify: `src/lib/shared/3d/components/controls/SceneControlWorkspace.svelte`
- Modify: `src/lib/shared/3d/components/controls/SceneControlInspector.svelte`
- Create: `src/lib/shared/3d/components/controls/PresetsPanel.svelte`

- [ ] **Step 1: Extend the tool union**

```ts
export type SceneControlTool =
  | "performer"
  | "formation"
  | "camera"
  | "scene"
  | "presets"
  | "dev";
```

- [ ] **Step 2: Lift the SaveSceneModal to SceneControlWorkspace**

Move `saveSceneOpen` state and the `<SaveSceneModal bind:open={saveSceneOpen} {bpm} {onSettingChange} {onAction} />` mount from `SceneControlRail.svelte` into `SceneControlWorkspace.svelte` (it has `bpm`/`onSettingChange`/`onAction` in scope). Rail gets a new prop `onOpenSaveScene: () => void` and its existing `openSaveScene()` calls it (keep the analytics `reportViewerControlChange` call in the rail). `SceneControlInspector` gets an optional `onOpenSaveScene?: () => void` prop, passed by the workspace.

- [ ] **Step 3: Add the Presets rail button**

In `SceneControlRail.svelte`'s utility group, ABOVE the Save bookmark:

```svelte
<SceneChromeButton
  icon="fa-swatchbook"
  label="Presets"
  active={activeTool === "presets"}
  aria-pressed={activeTool === "presets"}
  data-scene-tool="presets"
  onclick={() => chooseTool("presets")}
/>
```

- [ ] **Step 4: Build PresetsPanel**

`PresetsPanel.svelte` — a load + save-current surface (full management stays in Browse → My Collections):

```svelte
<script lang="ts">
  import { scene3dCollectionState } from "$lib/features/scene-3d-collection/state/scene-3d-collection-state.svelte";
  import { applyScene3DLookLive } from "$lib/features/scene-3d-collection/services/open-3d-scene";
  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";

  interface Props {
    onOpenSaveScene?: () => void;
  }
  let { onOpenSaveScene }: Props = $props();

  const viewer = getViewer3DContext();
  const scenes = $derived(scene3dCollectionState.collection);

  $effect(() => {
    const uid = authState.user?.uid;
    if (uid) scene3dCollectionState.ensureStarted(uid);
    else scene3dCollectionState.initLocal();
  });
</script>
```

Body: a pinned "Save current setup" `PanelButton` calling `onOpenSaveScene`; then the saved-scene list — one `<button>` per scene with `scene.poster` as an `<img>` (fixed `aspect-ratio` box so load causes no shift — `no-layout-shift.md`), the scene name, and apply-on-click via `applyScene3DLookLive(scene, viewer)`. States: `scene3dCollectionState.loading` → skeleton rows matching the final row layout; empty → "Nothing saved yet. Build a setup you like, then save it." with the save button; error (if `CollectionState` exposes one — check; otherwise omit) → retry via re-running `ensureStarted`. Styling: consume `--theme-*` tokens like `SceneControlInspector`'s body; 44px touch targets; selection/hover per `clickables-look-like-buttons.md`; NO left-edge accent bars (`no-left-edge-accent-bar.md`); words through `simplifyRepeatedWord` are NOT needed (scene names are user-chosen, not sequence words).

- [ ] **Step 5: Route the tool in SceneControlInspector**

Add to `titles`/`icons`: `presets: "Presets"` / `presets: "fa-swatchbook"`. Add branch:

```svelte
{:else if tool === "presets"}
  <PresetsPanel {onOpenSaveScene} />
```

- [ ] **Step 6: Typecheck + grep-proof no raw chips/checkboxes**

Run: `npm run check:fast > "$TEMP/check-task5.log" 2>&1; grep -icE "error" "$TEMP/check-task5.log"` → no new errors.
Run: `git diff -U0 -- src/lib/shared/3d/components/controls | grep -nE 'type="checkbox"|class="(chip|pill)"|inset [0-9]+px 0 0'` → no matches.

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(3d): presets panel in the scene control rail" -- src/lib/shared/3d/domain/scene-control-layout.ts src/lib/shared/3d/components/controls/SceneControlRail.svelte src/lib/shared/3d/components/controls/SceneControlWorkspace.svelte src/lib/shared/3d/components/controls/SceneControlInspector.svelte src/lib/shared/3d/components/controls/PresetsPanel.svelte
```

---

### Task 6: Intro flag + persistence

**Files:**
- Modify: `src/lib/shared/onboarding/domain/onboarding-flags.ts`
- Modify: `src/lib/shared/onboarding/services/types.ts` (OnboardingStatus)
- Modify: `src/lib/shared/onboarding/services/onboarding-persister.ts`
- Modify: `src/lib/shared/onboarding/config/storage-keys.ts`
- Create: `src/lib/shared/onboarding/state/viewer3d-intro-state.svelte.ts`
- Test: `tests/unit/viewer3d-intro-state.test.ts`

- [ ] **Step 1: Add the feature flag**

In `onboarding-flags.ts`:

```ts
/**
 * First-ever 3D-viewer open guided setup (scene → formation → presets).
 * Spec: docs/superpowers/specs/2026-08-23-viewer3d-intro-presets-design.md.
 * Independent of AUTO_TOURS_ENABLED — this is a one-shot overlay on the 3D
 * pane, not an auto-popping coach mark.
 */
export const VIEWER3D_INTRO_ENABLED = true;
```

- [ ] **Step 2: Extend OnboardingStatus + persister**

Storage key in `storage-keys.ts`: `export const VIEWER3D_INTRO_SEEN_KEY = "tka-viewer3d-intro-seen";`
`types.ts`: add `viewer3DIntroSeen: boolean;` to `OnboardingStatus`.
`onboarding-persister.ts`: default `false` in `createDefaultStatus`; read/write the localStorage key in `loadFromLocalStorage`/`saveToLocalStorage` (same guarded-write style as the other booleans); map the field in `loadStatus` and `subscribe` (`data.viewer3DIntroSeen ?? false`); OR-merge in `syncLocalToCloud` (`local || cloud` — seen anywhere means seen).

- [ ] **Step 3: Write the failing test for the state module**

```ts
// tests/unit/viewer3d-intro-state.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import {
  shouldShowViewer3DIntro,
  markViewer3DIntroSeenLocal,
} from "../../src/lib/shared/onboarding/state/viewer3d-intro-state.svelte";

describe("viewer3d intro state", () => {
  beforeEach(() => localStorage.clear());

  it("shows on a first-ever open", () => {
    expect(shouldShowViewer3DIntro()).toBe(true);
  });

  it("never shows again after being marked seen", () => {
    markViewer3DIntroSeenLocal();
    expect(shouldShowViewer3DIntro()).toBe(false);
  });
});
```

Run: `npx vitest run tests/unit/viewer3d-intro-state.test.ts` → FAIL (module not found). If the vitest environment lacks `localStorage`, follow the setup used by an existing localStorage-touching unit test in `tests/unit/` (grep `localStorage` there and mirror its harness).

- [ ] **Step 4: Implement the state module**

```ts
// src/lib/shared/onboarding/state/viewer3d-intro-state.svelte.ts
import { VIEWER3D_INTRO_ENABLED } from "../domain/onboarding-flags";
import { VIEWER3D_INTRO_SEEN_KEY } from "../config/storage-keys";
import { getOnboardingPersister } from "$lib/shared/onboarding/get-onboarding-persister";

/** Synchronous gate — no flash: localStorage is the fast path. */
export function shouldShowViewer3DIntro(): boolean {
  if (!VIEWER3D_INTRO_ENABLED) return false;
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(VIEWER3D_INTRO_SEEN_KEY) !== "true";
  } catch {
    return false;
  }
}

/** Local mark only — used by tests and as the synchronous half. */
export function markViewer3DIntroSeenLocal(): void {
  try {
    localStorage.setItem(VIEWER3D_INTRO_SEEN_KEY, "true");
  } catch {
    // Quota — the intro may show once more on this device.
  }
}

/** Full mark: local immediately, cloud in the background. */
export function markViewer3DIntroSeen(): void {
  markViewer3DIntroSeenLocal();
  try {
    const persister = getOnboardingPersister();
    void persister.loadStatus().then((status) => {
      status.viewer3DIntroSeen = true;
      return persister.saveStatus(status);
    });
  } catch {
    // Unauthenticated/persister unavailable — local flag stands.
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/unit/viewer3d-intro-state.test.ts` → PASS.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(onboarding): viewer3d intro flag with local+cloud persistence" -- src/lib/shared/onboarding/domain/onboarding-flags.ts src/lib/shared/onboarding/services/types.ts src/lib/shared/onboarding/services/onboarding-persister.ts src/lib/shared/onboarding/config/storage-keys.ts src/lib/shared/onboarding/state/viewer3d-intro-state.svelte.ts tests/unit/viewer3d-intro-state.test.ts
```

---

### Task 7: `Viewer3DIntro` component, mount, test route

**Files:**
- Create: `src/lib/shared/3d/components/onboarding/Viewer3DIntro.svelte`
- Modify: `src/lib/shared/sequence-viewer/components/ViewerMotionSurface.svelte:345-358`
- Create: `src/routes/test/viewer3d-intro/+page.svelte`

- [ ] **Step 1: Build Viewer3DIntro**

A floating card overlay anchored **bottom-LEFT** of the 3D pane (`position: absolute`, max-width ~28rem, theme-token surface matching `SceneControlInspector`'s panel styling) — never bottom-center, which parks it on top of the performers it configures (Austen, 2026-08-23). While mounted, reframe performers into the clear width the same way `SceneControlWorkspace` does when the dock opens: call `viewer.frameAllPerformers((workspaceWidth - cardWidth) / workspaceHeight, true)` on mount and `viewer.frameAllPerformers(workspaceWidth / workspaceHeight, true)` on dismiss (pattern at `SceneControlWorkspace.svelte:98-109`). Four steps with a dot indicator, Skip (always visible, top-right of the card), Back/Next/Done. Content per step:

1. **Scene** — heading "Pick your stage", `SceneSelectorPopover` (`src/lib/shared/3d/components/SceneSelectorPopover.svelte`, props `onSettingChange`). No theme copy — the scene is viewer-scoped (spec decision 3).
2. **Performers** — heading "How many performers?", count chips 1 / 2 / 4 / 8 (a `SegmentedControl` with the current count selected; per `chip-primitives.md` this is exactly-one selection). On change, call the viewer state's `addPerformerFromUI()` / `removePerformerFromUI()` in a loop until `performerManager.performers.length` matches. One line of copy under the chips: *"Everyone performs this sequence."*
3. **Formation** — heading "Arrange your performers", `FormationPopover` (`./controls/FormationPopover.svelte`, prop `onSettingChange`). **Auto-skipped when count is 1**: Next from the Performers step jumps to Presets, Back from Presets returns to Performers, and the dot indicator renders only the reachable steps (3 dots for a solo, 4 otherwise) — recompute the step list from the live count so raising the count later in the same run restores the Formation dot.
4. **Presets** — heading "Save and reload setups". If `scene3dCollectionState.collection.length > 0`: a horizontal poster strip (`scene.poster` `<img>`s, fixed aspect boxes) with tap-to-apply via `applyScene3DLookLive(scene, viewer)`. Else: copy *"Build something you like, then tap the bookmark in the rail to save it. Your saved setups will appear here and in the Presets panel."*

Mechanics:
- Props: `{ onSettingChange?: ViewerControlSink; force?: boolean }` (`force` for the test route — bypasses the seen check but never writes the flag).
- Step content swaps inside a FIXED-height card body via the shared `<Crossfade>` primitive with `fill` (`src/lib/shared/components/Crossfade.svelte`, `key={stepIndex}`, `duration={DURATION.normal}`) — per `crossfade-primitive.md` (cheap content, sized parent, no layout shift). The heading/dots/buttons chrome lives OUTSIDE the crossfade.
- Skip and Done both call `markViewer3DIntroSeen()` (unless `force`) and unmount.
- Buttons are real buttons via existing panel button primitives; 44px targets; `aria-label`s; reduced-motion handled by the Crossfade primitive — do not reimplement.
- Report step progression through `onSettingChange` with `reportViewerControlChange(onSettingChange, "viewer_3d_intro", ...)` mirroring the rail's analytics calls.

- [ ] **Step 2: Mount in ViewerMotionSurface**

In the `side === "left" && is3DMounted && !requiresContactViewer` block (line ~345), after `<SceneControlWorkspace ...>`:

```svelte
{#if is3DActive && scene3DReady && showViewer3DIntro}
  <Viewer3DIntro
    onSettingChange={onViewer3DSettingChange}
  />
{/if}
```

with `let showViewer3DIntro = $state(shouldShowViewer3DIntro());` in the script (module import from `$lib/shared/onboarding/state/viewer3d-intro-state.svelte`) and the component signalling dismissal via an `onDismiss` prop that sets `showViewer3DIntro = false` (add `onDismiss: () => void` to the intro's props; it calls it after marking seen). Gate mount so it renders above the canvas but below dialogs (z-index between the canvas layer and `SceneControlWorkspace`'s inspector, i.e. z-index ~28 given the rail is 30 and inspector 29 — pick a value and verify overlap visually in Task 8).

- [ ] **Step 3: Test route**

`src/routes/test/viewer3d-intro/+page.svelte`: creates `createViewer3DState(undefined, {})`, `setViewer3DContext(state)`, renders a full-viewport dark gradient stand-in stage div with `<Viewer3DIntro force />` mounted. Follow the structure of an existing minimal test route (e.g. `src/routes/test/viewer-3d/+page.svelte` and its `+layout@.svelte` bypass) so it loads unauthenticated. This route exists for visual iteration; the REAL surface is verified in Task 8.

- [ ] **Step 4: Typecheck**

Run: `npm run check:fast > "$TEMP/check-task7.log" 2>&1; grep -icE "error" "$TEMP/check-task7.log"` → no new errors.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(3d): first-open guided setup overlay (Viewer3DIntro)" -- src/lib/shared/3d/components/onboarding/Viewer3DIntro.svelte src/lib/shared/sequence-viewer/components/ViewerMotionSurface.svelte src/routes/test/viewer3d-intro/+page.svelte
```

(Include the test route's `+layout@.svelte` in the pathspec if one was created.)

---

### Task 8: Full verification pass

- [ ] **Step 1: Unit suite**

Run: `npx vitest run tests/unit/plain-open-policy.test.ts tests/unit/scene-3d-look.test.ts tests/unit/viewer3d-intro-state.test.ts tests/unit/sequence-viewer-shell-contract.test.ts`
Expected: all PASS. The shell-contract test guards the ViewerMotionSurface change — if it fails, fix the host, never the test.

- [ ] **Step 2: Whole-project check (once, captured)**

Run: `npm run check > "$TEMP/check-final.log" 2>&1; grep -niE "error" "$TEMP/check-final.log" | head -50`
Expected: no errors introduced by this work (diff against the pre-work baseline if `main` is red).

- [ ] **Step 3: Runtime + visual verification (Chrome DevTools MCP; per `visual-verification-mandatory.md`)**

Launch the shared browser via `pwsh -NoProfile -File scripts/launch-chrome-debug.ps1 -Url about:blank`; task-owned background page; HTTPS `https://localhost:5173`. Verify and screenshot (webp/70):

1. **Prop-follow:** in the app set prop to fans; seed a stale 3D config (`localStorage["tka-viewer3d-defaultProp"]="staff"`, performers with prop overrides via a saved elaborate setup); open a sequence's 3D pane → performers hold fans. Then apply a saved buugeng preset from the new panel → buugeng applies live; close/reopen the viewer in the same session → buugeng persists ONLY when arriving via a preset (fresh plain open follows the app prop again).
2. **Presets panel:** open from the rail — list renders posters, apply works live, Undo toast reverts, "Save current setup" opens SaveSceneModal, empty state renders when the collection is empty.
3. **Intro:** clear `tka-viewer3d-intro-seen`; first 3D open shows the card; scene selection swaps the world live WITHOUT changing the app theme (spot-check the 2D background setting is untouched); the performer-count step adds/removes performers live; formation step rearranges (and is skipped when count is 1 — verify the dot indicator drops to 3); skip/done sets the flag (verify the localStorage value flips and the overlay never remounts on reopen). **Occlusion check at every viewport:** the card must never sit on top of the performers — performers reframe into the clear width while the card is up and re-center on dismiss; same check for the presets panel in overlay presentation.
4. **Viewports:** the intro card and presets panel at 1920×1080, 2560×1440, 3840×2160, 1440×900, 820×1180, 960×412, 375×667. The compact (`<768px` workspace) presentation hides the rail — state which surfaces are legitimately unreachable per viewport instead of skipping silently. Read every frame against the checklist (absurd widths, dead space, orphans, contrast, legibility).

- [ ] **Step 4: Deliver in the in-app Browser pane**

Open the real surface (a sequence's 3D viewer route) in the Browser pane with the completion message, per `deliver-in-the-app-browser.md`.

- [ ] **Step 5: Update the ledger + commit any verification fixes**

Mark ledger boxes `[x]`; commit fixes with scoped pathspecs.

---

## Out of scope (from spec)

- Mobile/compact (`MobileSceneControls`) presets entry — the compact sheet has no save entry today either; a follow-up gets both at once.
- Per-performer sequences (Stage module territory — spec decision 5); scene↔theme copy or coupling work (already decoupled); per-sequence 3D memory; reviving AUTO_TOURS; Browse "3D Scenes" management changes.

## Known risks

- `viewer-3d-state.svelte.ts` is ~1850 lines with intertwined persistence; Task 2/4 edits stay inside documented seams (`enter3D`, `_defaultSettings`, `restoreViewerSnapshot` pattern). If the file fights back, stop and report rather than restructure.
- `applyPersistConfig`'s effects reset (`resetEffects`) API name must be confirmed against the performer instance (`resetProp`/`resetEffort`/`resetEffects` appear at viewer-3d-state.svelte.ts:820-840).
- The intro overlay's z-order vs. the rail/inspector is a visual judgment — Task 8 owns it.
