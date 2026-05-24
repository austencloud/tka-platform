---
phase: 3d-scenes-review
reviewed: 2026-05-23T14:00:00Z
depth: deep
files_reviewed: 21
files_reviewed_list:
  - src/lib/shared/3d/components/Viewer3DCanvas.svelte
  - src/lib/shared/3d/effects/post-processing/ScenePostProcessing.svelte
  - src/lib/shared/3d/environments/domain/models/scene-configs.ts
  - src/lib/shared/3d/environments/scenes/CosmicScene.svelte
  - src/lib/shared/3d/environments/scenes/OceanScene.svelte
  - src/lib/shared/3d/environments/scenes/cosmic/LunarGroundPlane.svelte
  - src/lib/shared/3d/environments/scenes/ocean/FishSchool.svelte
  - src/lib/shared/3d/environments/scenes/ocean/ReefStructures.svelte
  - src/lib/shared/3d/environments/scenes/ocean/WaterSurface.svelte
  - src/lib/shared/3d/environments/scenes/ocean/fish-behavior-shader.ts
  - src/lib/shared/3d/environments/scenes/ocean/fish-shaders.ts
  - src/lib/shared/3d/environments/scenes/ocean/ocean-instancing.ts
  - src/lib/shared/3d/state/viewer-3d-state.svelte.ts
  - src/lib/shared/3d/components/controls/PerformerHub.svelte
  - src/lib/shared/3d/effects/post-processing/godrays-light-store.svelte.ts
  - src/lib/shared/3d/environments/scenes/cosmic/CrystalFormations.svelte
  - src/lib/shared/3d/environments/scenes/cosmic/PrismaticCaustics.svelte
  - src/lib/shared/3d/environments/scenes/cosmic/cosmic-instancing.ts
  - src/lib/shared/3d/environments/scenes/cosmic/crystal-shaders.ts
  - src/lib/shared/3d/environments/scenes/ocean/BoatSilhouette.svelte
  - src/lib/shared/3d/environments/scenes/ocean/scene-sdf-baker.ts
findings:
  critical: 2
  warning: 8
  info: 5
  total: 15
status: issues_found
---

# 3D Scenes Code Review Report

**Reviewed:** 2026-05-23
**Depth:** deep (cross-file analysis with GPU resource tracking)
**Files Reviewed:** 21
**Status:** issues_found

## Summary

Reviewed the 3D rendering pipeline covering ocean, cosmic, and post-processing modules. The codebase is architecturally solid: instanced meshes are well-managed, GPGPU fish simulation has proper cleanup paths, and the SDF-based obstacle avoidance is correctly implemented. Two critical issues were found: a GPU memory leak in `WaterSurface.svelte` and `PrismaticCaustics.svelte` where `ShaderMaterial` is created at module scope without disposal, and a variable shadowing bug in `fish-shaders.ts` that silently overrides a prop-driven value. Eight warnings cover missing disposal paths, stale fog references, and shader correctness concerns.

## Critical Issues

### CR-01: GPU memory leak -- ShaderMaterial never disposed (WaterSurface)

**File:** `src/lib/shared/3d/environments/scenes/ocean/WaterSurface.svelte:199-223`
**Issue:** The `ShaderMaterial` is created at module scope (line 199) and never disposed. When the component unmounts and remounts (e.g., scene variant change), a new material is created by Svelte re-running the script block, but the old one is never cleaned up. This leaks GPU shader programs and uniform buffers on each scene transition.
**Fix:**
```svelte
<script lang="ts">
  import { onDestroy } from "svelte";
  // ... existing imports ...

  // Move material creation inside an $effect or use onDestroy:
  const material = new ShaderMaterial({ /* ... */ });

  onDestroy(() => {
    material.dispose();
  });
</script>
```

### CR-02: GPU memory leak -- ShaderMaterial never disposed (PrismaticCaustics)

**File:** `src/lib/shared/3d/environments/scenes/cosmic/PrismaticCaustics.svelte:121-135`
**Issue:** Same pattern as CR-01. The `ShaderMaterial` at line 121 is created at module scope with no disposal. On scene transitions or variant switches, the old material leaks. Each material holds compiled shader programs and texture references.
**Fix:**
```svelte
<script lang="ts">
  import { onDestroy } from "svelte";

  const material = new ShaderMaterial({ /* ... */ });

  onDestroy(() => {
    material.dispose();
  });
</script>
```

## Warnings

### WR-01: Variable shadowing in velocity shader hides prop-driven speedMult

**File:** `src/lib/shared/3d/environments/scenes/ocean/fish-shaders.ts:351`
**Issue:** Inside the flee state handler (lines 331-358), a local `float speedMult` is declared at line 351. This shadows the `speedMult` variable from line 196 (`float speedMult = traits.r`). The local declaration re-uses the same name, making it look like it modifies the trait-based multiplier, but actually it creates a new independent variable. While this works because the local is the intended value, the shadowing makes the code fragile: any refactor that moves the speed application earlier will silently use the wrong multiplier.
**Fix:** Rename the local variable to `fleeSpeedMult` to avoid confusion:
```glsl
float fleeSpeedMult = mix(burstMult, sustainMult, smoothstep(0.0, 0.3, timeSinceStartle));
fleeSpeedMult = mix(fleeSpeedMult, elevatedMult, smoothstep(0.8, 2.5, timeSinceStartle));
fleeSpeedMult = mix(fleeSpeedMult, calmMult, smoothstep(3.0, 6.0, timeSinceStartle));
adjMax *= fleeSpeedMult;
```

### WR-02: OceanScene rockInstances and boulderInstances created as $derived -- no disposal on reactive re-creation

**File:** `src/lib/shared/3d/environments/scenes/OceanScene.svelte:814-867`
**Issue:** `rockInstances` (line 814) and `boulderInstances` (line 840) are created via `$derived.by()`. Unlike `$effect()`, `$derived` has no teardown callback. When dependencies change and the derived value recomputes, the previous `InstancedMesh` objects (including their geometries and cloned materials for boulders at line 853) are orphaned without disposal. The `onDestroy` at line 1043 only disposes the final set. Every intermediate re-creation leaks GPU geometry buffers.

The `boulderInstances` path is worse because it calls `variant.material.clone()` (line 853), creating a new material each time that is never disposed on re-derivation.

**Fix:** Convert these to `$effect`-managed state (matching the pattern already used for `coralInstances`, `kelpInstances`, `heroRockInstances`, and `decorationInstances`):
```typescript
let rockInstances = $state<InstancedMesh[]>([]);
$effect(() => {
  // ... build new instances ...
  const newInstances = /* ... */;
  rockInstances = newInstances;
  return () => {
    for (const inst of newInstances) {
      inst.geometry.dispose();
      (inst.material as any)?.dispose?.();
      inst.dispose();
    }
  };
});
```

### WR-03: CosmicScene creates new FogExp2 on every config change

**File:** `src/lib/shared/3d/environments/scenes/CosmicScene.svelte:57-64`
**Issue:** The `$effect` at line 57 creates a new `FogExp2` object every time `activeConfig.fog` changes (which happens whenever the variant or any config slider updates). While the old fog is removed from the scene, the Three.js `FogExp2` object itself is just a data class with no GPU resources, so this is not a true leak. However, the cleanup function at line 62 runs when the effect re-fires, potentially setting `scene.current.fog = null` for one frame before the new fog is set, causing a flash.

In contrast, `OceanScene.svelte` (lines 947-964) correctly caches the `FogExp2` instance and mutates its properties in place.

**Fix:** Apply the same pattern used in OceanScene:
```typescript
let fogInstance: FogExp2 | null = null;
$effect(() => {
  if (!scene.current) return;
  const fog = activeConfig.fog;
  if (!fogInstance) {
    fogInstance = new FogExp2(fog.color, fog.density);
    scene.current.fog = fogInstance;
  } else {
    fogInstance.color.set(fog.color);
    fogInstance.density = fog.density;
  }
  return () => {
    if (scene.current) scene.current.fog = null;
    fogInstance = null;
  };
});
```

### WR-04: BoatSilhouette shadow light target not added to scene

**File:** `src/lib/shared/3d/environments/scenes/ocean/BoatSilhouette.svelte:66-87`
**Issue:** The `DirectionalLight` created at line 68 has its `target.position` set at line 70, but the target object must be added to the scene for Three.js shadow mapping to work correctly. In the template (lines 126-129), the target is rendered as `<T is={godRayLight.target} />` which should add it to the scene graph. However, the light itself is set on `godraysLightStore` at line 81 and then consumed by `ScenePostProcessing` to create a `GodraysPass`. The `GodraysPass` requires the light's shadow camera to be properly configured, which depends on the target being in the scene. If the template rendering order causes the `GodraysPass` to initialize before the target is in the scene graph, the shadow camera will point at world origin instead of the boat.

**Fix:** Ensure the target is added as a child of the light immediately after creation:
```typescript
const light = new DirectionalLight(0x88bbdd, 1.5);
light.add(light.target); // Ensure target is in scene graph via parent
light.target.position.set(0, -20, 0); // Relative to light
light.position.set(config.offsetX, boatY + 15, config.offsetZ);
```

### WR-05: FishSchool O(n^2) boids loop in GPU compute shaders

**File:** `src/lib/shared/3d/environments/scenes/ocean/fish-shaders.ts:210-239` and `fish-behavior-shader.ts:78-145`
**Issue:** Both the velocity shader and state shader iterate over every fish texel in a nested loop (`for y ... for x ...`). With `texSize = ceil(sqrt(RESIDENT_FISH_COUNT + 100))`, a 150-fish school yields texSize ~16, meaning 256 texels iterated per fish per frame. This is manageable at 150 fish. However, if `RESIDENT_FISH_COUNT` grows (e.g., to 500+), texSize jumps to 25+ and the per-fish loop body becomes 625+ iterations, which will cause frame drops on mid-range GPUs. The `qualityConfig` caps don't appear to limit `RESIDENT_FISH_COUNT` directly.

This is noted as a code quality warning rather than a performance issue because the current fish count (150) keeps it within budget, but the architecture has no guard rail preventing it from scaling past GPU limits.

**Fix:** Add a documented upper bound or spatial-hash optimization comment:
```typescript
// PERF CEILING: texSize > 20 causes O(n^2) GPU compute to exceed 16ms.
// If RESIDENT_FISH_COUNT exceeds ~350, implement spatial binning or
// reduce neighbor search radius in the shader.
const totalFish = Math.min(RESIDENT_FISH_COUNT, 350);
```

### WR-06: ReefStructures clones model scene on every $derived re-evaluation

**File:** `src/lib/shared/3d/environments/scenes/ocean/ReefStructures.svelte:114-141`
**Issue:** The `structures` derived block (line 114) calls `model.scene.clone()` and `tintModel(clone, ...)` (which further clones materials) every time any dependency changes. The `onDestroy` at line 200 only disposes the final set of clones. Intermediate clones from re-derivation are leaked. Additionally, `tintModel` creates new material clones (line 91-98) each time, compounding the leak.

**Fix:** Convert to `$effect` with cleanup:
```typescript
let structures = $state<PreparedStructure[]>([]);
$effect(() => {
  // ... build structures ...
  const newStructures = /* ... */;
  structures = newStructures;
  return () => {
    for (const s of newStructures) disposeSceneGraph(s.clone);
  };
});
```

### WR-07: CrystalFormations uses non-reactive GLB paths from initial config

**File:** `src/lib/shared/3d/environments/scenes/cosmic/CrystalFormations.svelte:38-44`
**Issue:** The `useGltf` calls at lines 38-44 use `config.models[N]?.path` where `config` is a prop that could change if the parent passes a different config object. However, `useGltf` is a Threlte loader hook that fires once at component creation. If the config changes (e.g., scene lab slider updates), the GLB paths are stale. This means switching crystal model sets at runtime would not load new models.

Since the current usage always passes the same config per scene variant, this is a latent bug rather than an active one.

**Fix:** Document that model paths are read once at mount, or guard against config.models changing:
```typescript
// NOTE: useGltf reads paths at mount time only. If config.models changes,
// the component must be unmounted/remounted (use {#key config.seed}).
```

### WR-08: ScenePostProcessing casts useThrelte context to `any`

**File:** `src/lib/shared/3d/effects/post-processing/ScenePostProcessing.svelte:39`
**Issue:** `const _ctx = useThrelte() as any;` bypasses all type checking for the Threlte context. If Threlte updates its context API (renaming `renderStage`, changing `autoRender` from `{current, set}` to something else), this code will silently break at runtime with no compile-time warning. Lines 40-44 destructure specific properties that depend on the internal structure.

**Fix:** Type the context properly or at minimum document the expected shape:
```typescript
interface ThrelteContext {
  renderer: import("three").WebGLRenderer;
  camera: { current: import("three").Camera };
  scene: import("three").Scene;
  autoRender: { current: boolean; set: (v: boolean) => void };
  renderStage: unknown;
}
const _ctx = useThrelte() as ThrelteContext;
```

## Info

### IN-01: Debug diagnostics exposed on window object in production

**File:** `src/lib/shared/3d/environments/scenes/OceanScene.svelte:983-1036`
**Issue:** `window.__oceanDiag` and `window.__oceanPerf` are unconditionally attached in `onMount`. These are useful development tools but pollute the global namespace in production. Consider gating behind `import.meta.env.DEV`.
**Fix:**
```typescript
if (import.meta.env.DEV) {
  (window as any).__oceanDiag = () => { /* ... */ };
  (window as any).__oceanPerf = () => { /* ... */ };
}
```

### IN-02: Duplicate `DecoType` type alias

**File:** `src/lib/shared/3d/environments/scenes/OceanScene.svelte:451,503`
**Issue:** The type `DecoType = "starfish" | "urchin" | "shell" | "anemone"` is defined twice: once inside `scenePlacements` at line 451 and again at line 503. The second declaration shadows the first without adding value.
**Fix:** Remove the duplicate at line 503 and use the type from the `ScenePlacements` interface.

### IN-03: Unused import in OceanScene

**File:** `src/lib/shared/3d/environments/scenes/OceanScene.svelte:40`
**Issue:** `Mesh` is imported and then immediately aliased to `ThreeMesh` at line 41. Only `Mesh` is used (in the debug diagnostic), and `ThreeMesh` is never used.
**Fix:** Remove the duplicate import: `import { ... Mesh, ... } from "three"` and remove the `Mesh as ThreeMesh` alias.

### IN-04: Console.log statements in production code paths

**File:** `src/lib/shared/3d/environments/scenes/ocean/FishSchool.svelte:524,661,672`
**Issue:** `console.log` calls report GPU init success, SDF binding, and scene SDF binding. These are informational but produce noise in production console output.
**Fix:** Replace with `console.debug` or gate behind `import.meta.env.DEV`.

### IN-05: Hardcoded glow light color in CrystalFormations

**File:** `src/lib/shared/3d/environments/scenes/cosmic/CrystalFormations.svelte:185`
**Issue:** The glow light color `"#4488ff"` is hardcoded rather than derived from the config. The cosmic aurora variant uses `#00ccaa` as its accent color, but the crystal glow lights will always be blue regardless of variant.
**Fix:** Derive the color from the config or from the models' palette:
```typescript
color: config.models[0]?.path.includes('aurora') ? "#00ccaa" : "#4488ff",
```
Or better, add a `glowLightColor` field to `CrystalFormationsConfig`.

---

_Reviewed: 2026-05-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
