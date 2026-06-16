---
status: shipped
value: 4
effort: M
remaining: "DONE — verified 2026-06-13. All 25 targets resolved: 9 converted to $effect+.dispose()/onDestroy, 10 deleted in the ocean Blender→GLB migration, TrailRenderer removed. Zero $derived GPU allocations remain in scenes/."
depends_on: ""
plan_path: ""
tags: [3d, performance, memory]
last_triaged: 2026-06-13
---
# GPU Memory Leak Fix — Design Spec

> **CLOSED 2026-06-13 (verified done / mooted).** A current-code sweep found
> the leak pattern eliminated across all 25 enumerated targets:
> - **Converted to the correct pattern** (`$effect` + `.dispose()` cleanup, or
>   module-scope material + `onDestroy`): EarthSphere (`$effect` w/ geo+mat
>   dispose), WaterSurface (`onDestroy(() => material.dispose())`), OceanScene
>   (rock/boulder `$derived.by` gone), NebulaLayer, IcePlatform, AutumnGround,
>   EarthGodRays, CloudIslands, CloudPlatform, GodRays, CloudDome,
>   PrismaticCaustics.
> - **Deleted since the spec** (procedural geometry removed when the ocean scene
>   moved to Blender→GLB, per `blender-first-3d-scenes.md`): ProceduralSeabed,
>   ReefStructures, RuinsPlatform, VoidPlatform, ObsidianPlatform,
>   EngawaPlatform, PrismPlatform, CraterGround, ProceduralGround, FireWisps,
>   VolcanicHaze, SkyGradient, and TrailRenderer.svelte.
>
> Verification: grep for `$derived(.by)?` blocks constructing any Three.js
> geometry/material/instanced-mesh across `scenes/` returns **zero** matches.
> No implementation work remains. Original spec retained below for history.

## Problem

24 scene components use Svelte 5's `$derived` or `$derived.by` to create Three.js geometries, materials, and instanced meshes. `$derived` has no cleanup callback. When a derived value re-evaluates (config change, prop update, reactive dependency shift), the old Three.js GPU resource is silently replaced. The JavaScript reference is garbage-collected, but the GPU-side allocation is not: compiled shader programs, vertex buffers, texture memory, and instanced matrix arrays remain resident until the WebGL context is lost or the tab is closed.

Two additional components create `ShaderMaterial` at module scope (component `<script>` top-level, outside any `$effect` or lifecycle) and never call `.dispose()` on teardown.

### Impact

Each leaked resource type carries a different GPU cost:

| Resource | Per-leak cost | Trigger |
|---|---|---|
| `ShaderMaterial` | Compiled shader program + uniform block | Any reactive re-evaluation of `$derived.by(() => new ShaderMaterial(...))` |
| `SphereGeometry(r, 48, 48)` | ~7K vertices, ~14K triangles | Config change on radius |
| `PlaneGeometry(192, 192)` | ~150K vertices (ProceduralSeabed) | Any mound-source update |
| `InstancedMesh` | Instance matrix buffer + draw-call state | Rock/boulder variant change |
| Cloned `Object3D` + materials | Traversed material tree + geometry refs | Model reload in ReefStructures |

A user toggling between scenes or adjusting scene config in the Scene Lab can accumulate hundreds of megabytes of leaked GPU memory in a single session.

## Correct Pattern (already in codebase)

Two components already handle this correctly.

### GodRayShafts.svelte (lines 98-140)

Creates geometry and instanced mesh inside `$effect`, returns a cleanup function that calls `.dispose()` on both. The material is created at module scope and disposed via `onDestroy`.

```svelte
// Module-scope material — disposed on component teardown
const material = new ShaderMaterial({ ... });

let instancedMesh = $state<InstancedMesh | null>(null);

$effect(() => {
  const geo = new PlaneGeometry(config.width, config.height);
  // ... build instanced mesh from geo + material ...
  const inst = new InstancedMesh(geo, material, count);
  // ... set instance matrices ...
  instancedMesh = inst;

  return () => {
    geo.dispose();
    inst.dispose();
  };
});

onDestroy(() => {
  material.dispose();
});
```

### FishSchool.svelte (lines 606-638)

Disposes all meshes, materials, geometries, GPU compute resources, and visitor objects in the `$effect` cleanup return.

```svelte
$effect(() => {
  // ... build meshes, materials, GPU compute ...

  return () => {
    for (const mat of materials) mat.dispose();
    for (const m of meshes) {
      m.geometry.dispose();
      m.dispose();
    }
    if (gpuCompute) gpuCompute.dispose();
    // ... clear all arrays and refs ...
  };
});
```

### The principle

1. GPU resources created inside `$effect` are disposed in its cleanup return.
2. GPU resources created at module scope are disposed in `onDestroy`.
3. `$derived` and `$derived.by` are never used for objects that hold GPU allocations.

## Wrong Pattern (24 components)

### Category 1: `$derived` creating geometry/material (22 components)

**EarthSphere.svelte** — 4 GPU objects leaked per config change:

```svelte
// WRONG: $derived has no cleanup callback
const geometry = $derived(new SphereGeometry(config.radius, 48, 48));
const material = $derived.by(() => {
  return new ShaderMaterial({ ... });
});
const glowGeometry = $derived(new SphereGeometry(config.radius * 1.15, 32, 32));
const glowMaterial = $derived.by(() => {
  return new ShaderMaterial({ ... });
});
// No onDestroy. No dispose anywhere.
```

When `config.radius` changes, four new GPU objects are allocated. The previous four are abandoned without `.dispose()`.

**ProceduralSeabed.svelte** — 150K-vertex geometry leaked per mound update:

```svelte
// WRONG: $derived.by for a 192x192 PlaneGeometry
const geometry = $derived.by(() => {
  const geo = new PlaneGeometry(size, size, segments, segments);
  // ... 150K vertices of terrain height computation ...
  return geo;
});
// No dispose anywhere.
```

**OceanScene.svelte (lines 823-876)** — instanced meshes leaked per variant change:

```svelte
// WRONG: $derived.by creating InstancedMesh arrays
const rockInstances = $derived.by((): InstancedMesh[] => {
  // ... creates one InstancedMesh per rock variant ...
  return rockVariants.map((variant, vi) => {
    const inst = new InstancedMesh(variant.geometry, variant.material, placements.length);
    // ... set matrices ...
    return inst;
  });
});

const boulderInstances = $derived.by(() => {
  // ... creates InstancedMesh per variant, clones materials ...
  const mat = variant.material.clone();  // cloned material also leaked
  const inst = new InstancedMesh(variant.geometry, mat, placements.length);
  return inst;
});
// No dispose anywhere.
```

### Category 2: `$derived.by` cloning models + materials (1 component)

**ReefStructures.svelte (lines 114-141)**:

```svelte
// WRONG: $derived.by cloning entire Object3D trees
const structures = $derived.by((): PreparedStructure[] => {
  for (let i = 0; i < placements.length; i++) {
    const clone = model.scene.clone();  // clones geometry refs + materials
    tintModel(clone, tintColor, tintBlend);
    results.push({ clone, ... });
  }
  return results;
});
// Old clones abandoned on re-evaluation. Materials tinted in-place on clones never disposed.
```

### Category 3: Module-scope ShaderMaterial without onDestroy (2 components)

**WaterSurface.svelte (line 199)**:

```svelte
// Module scope — created once, never disposed on teardown
const material = new ShaderMaterial({
  transparent: true,
  side: DoubleSide,
  depthWrite: false,
  uniforms: { uTime: { value: 0 }, uColor: { value: new Color() }, ... },
  vertexShader,
  fragmentShader,
});
// No onDestroy(() => material.dispose())
```

**PrismaticCaustics.svelte (line 121)** — identical pattern, no `onDestroy`.

## Fix Strategy

### For Category 1 and 2: Replace `$derived` with `$effect` + cleanup

Before (broken):

```svelte
const geometry = $derived(new SphereGeometry(config.radius, 48, 48));
const material = $derived.by(() => new ShaderMaterial({ ... }));
```

After (correct):

```svelte
let geometry = $state<SphereGeometry | null>(null);
let material = $state<ShaderMaterial | null>(null);

$effect(() => {
  const geo = new SphereGeometry(config.radius, 48, 48);
  geometry = geo;
  return () => geo.dispose();
});

$effect(() => {
  const mat = new ShaderMaterial({ ... });
  material = mat;
  return () => mat.dispose();
});
```

For components that create multiple related objects in a single `$derived.by` (e.g., EarthSphere's 4 objects, OceanScene's instanced mesh arrays), group them into a single `$effect` with a cleanup that disposes all:

```svelte
let rockInstances = $state<InstancedMesh[]>([]);

$effect(() => {
  if (rockVariants.length === 0 || rockPlacements.length === 0) {
    rockInstances = [];
    return;
  }
  const instances: InstancedMesh[] = [];
  // ... build instances ...
  rockInstances = instances;

  return () => {
    for (const inst of instances) {
      inst.dispose();
    }
  };
});
```

For ReefStructures, the cleanup must traverse cloned Object3D trees:

```svelte
return () => {
  for (const s of results) {
    s.clone.traverse((child) => {
      if (child instanceof Mesh) {
        child.geometry?.dispose();
        if (child.material instanceof Material) child.material.dispose();
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
      }
    });
  }
};
```

### For Category 3: Add `onDestroy` for module-scope materials

```svelte
import { onDestroy } from "svelte";

const material = new ShaderMaterial({ ... });

onDestroy(() => {
  material.dispose();
});
```

This matches the existing pattern in GodRayShafts.svelte (line 153-155).

## Affected Files — Full List

All paths relative to `src/lib/shared/3d/environments/scenes/`.

### Category 1: `$derived` / `$derived.by` creating GPU resources

| # | File | Leaked objects | Trigger |
|---|---|---|---|
| 1 | `cosmic/EarthSphere.svelte` | 2 geometries + 2 ShaderMaterials | config.radius or config.rimColor change |
| 2 | `cosmic/NebulaLayer.svelte` | ShaderMaterial | config change |
| 3 | `ocean/ProceduralSeabed.svelte` | PlaneGeometry (150K vertices) | mound source update |
| 4 | `cosmic/RuinsPlatform.svelte` | geometry + material | config change |
| 5 | `void/VoidPlatform.svelte` | geometry + material | config change |
| 6 | `void/ObsidianPlatform.svelte` | geometry + material | config change |
| 7 | `zen/EngawaPlatform.svelte` | geometry + material | config change |
| 8 | `celestial/PrismPlatform.svelte` | geometry + material | config change |
| 9 | `winter/IcePlatform.svelte` | geometry + material | config change |
| 10 | `autumn/AutumnGround.svelte` | geometry + material | config change |
| 11 | `cosmic/CraterGround.svelte` | geometry + material | config change |
| 12 | `cosmic/EarthGodRays.svelte` | geometry + material | config change |
| 13 | `cherry/ProceduralGround.svelte` | geometry + material | config change |
| 14 | `celestial/CloudIslands.svelte` | geometry + material | config change |
| 15 | `celestial/CloudPlatform.svelte` | geometry + material | config change |
| 16 | `celestial/GodRays.svelte` | geometry + material | config change |
| 17 | `TrailRenderer.svelte` | geometry + material | config change |
| 18 | `cosmic/FireWisps.svelte` | geometry + material | config change |
| 19 | `volcano/VolcanicHaze.svelte` | geometry + material | config change |
| 20 | `celestial/CloudDome.svelte` | geometry + material | config change |
| 21 | `celestial/SkyGradient.svelte` | geometry + material | config change |
| 22 | `OceanScene.svelte` (lines 823-876) | InstancedMesh[] + cloned materials | rock/boulder variant change |

### Category 2: `$derived.by` cloning Object3D trees

| # | File | Leaked objects | Trigger |
|---|---|---|---|
| 23 | `ocean/ReefStructures.svelte` (lines 114-141) | Cloned Object3D + traversed materials | model reload or placement change |

### Category 3: Module-scope ShaderMaterial without `onDestroy`

| # | File | Leaked objects | Trigger |
|---|---|---|---|
| 24 | `ocean/WaterSurface.svelte` (line 199) | ShaderMaterial | component teardown (scene switch) |
| 25 | `cosmic/PrismaticCaustics.svelte` (line 121) | ShaderMaterial | component teardown (scene switch) |

## Execution Plan

### Phase 1: High-impact fixes (5 components)

Target the components with the largest per-leak memory cost first:

1. **ProceduralSeabed.svelte** — 150K vertices per leak
2. **OceanScene.svelte** (rockInstances + boulderInstances) — multiple InstancedMesh + cloned materials
3. **ReefStructures.svelte** — cloned Object3D trees
4. **EarthSphere.svelte** — 4 GPU objects per leak
5. **WaterSurface.svelte** — module-scope material (scene switch leak)

### Phase 2: Medium-impact fixes (10 components)

Platform components that leak geometry + material on config change. These are exercised whenever a user adjusts scene settings in the Scene Lab:

6-15: All platform components (RuinsPlatform, VoidPlatform, ObsidianPlatform, EngawaPlatform, PrismPlatform, IcePlatform, AutumnGround, CraterGround, ProceduralGround, CloudPlatform)

### Phase 3: Remaining components (10 components)

Atmospheric and effect components:

16-25: NebulaLayer, EarthGodRays, CloudIslands, GodRays, TrailRenderer, FireWisps, VolcanicHaze, CloudDome, SkyGradient, PrismaticCaustics

### Per-component checklist

For each component:

1. Identify all `$derived` / `$derived.by` expressions that create GPU resources (geometry, material, instanced mesh, texture).
2. Convert to `$effect` with `let x = $state<Type | null>(null)` and cleanup return calling `.dispose()`.
3. For module-scope materials: add `onDestroy(() => material.dispose())`.
4. Grep the modified file for remaining `$derived` expressions — confirm none create Three.js objects.
5. Build passes (`npm run check`).

## Verification

- `npm run check` green after each phase.
- Before/after comparison in Scene Lab: open Chrome DevTools Performance Monitor, toggle scene configs repeatedly, confirm GPU memory (via `performance.measureUserAgentSpecificMemory()` or WebGL inspector) stabilizes instead of climbing.
- Spot-check: EarthSphere config change should show flat GPU memory, not staircase growth.

## Non-Goals

- Refactoring the scene architecture or config system. This spec only adds cleanup to existing allocation patterns.
- Pooling or caching GPU resources across components. That belongs in a future optimization pass.
- Auditing non-scene components. This spec covers only `src/lib/shared/3d/environments/scenes/` and `TrailRenderer.svelte`.
