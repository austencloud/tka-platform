# Ocean Scene Architecture Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 10,400-line monolithic ocean scene with a Blender-hybrid architecture: authored static content (terrain, flora placement) + runtime dynamic systems (fish, jellyfish, water, caustics, particles).

**Architecture:** Blender exports static environment as GLB + placements.ts (same pattern as cosmic scene). Runtime systems (fish boids, jellyfish verlet, water surface, atmosphere, post-processing) live in isolated Svelte/TS files under `runtime/`. Quality system only controls dynamic entity counts. Variant system eliminated entirely.

**Tech Stack:** Threlte (Svelte 5), Three.js 0.182+, GPGPU compute (GPUComputationRenderer), Verlet physics, GLSL shaders, Blender MCP, BatchedMesh, `three-good-godrays` (already installed), scene-composer placement system.

---

## Phase 1: Scaffold New Architecture (Non-Destructive)

New files live alongside old ones. Nothing breaks until Phase 3 (switchover).

### Task 1: Create directory structure + quality system

**Files:**
- Create: `src/lib/shared/3d/environments/scenes/ocean-v2/quality/ocean-quality.ts`
- Source: `src/lib/shared/3d/environments/scenes/ocean/ocean-quality.ts` (copy + simplify)

The quality system is the foundation — every other file imports from it.

- [ ] **Step 1: Create the ocean-v2 directory tree**

```bash
mkdir -p src/lib/shared/3d/environments/scenes/ocean-v2/{authored,runtime/{water,atmosphere,fauna/fish,fauna/jellyfish,interaction,loading},postprocessing/nodes,shaders/{water,fish,jellyfish,atmosphere},quality,blender}
```

- [ ] **Step 2: Create simplified quality system**

Create `src/lib/shared/3d/environments/scenes/ocean-v2/quality/ocean-quality.ts`:

```typescript
import type { WebGLRenderer } from "three";

export type OceanQualityTier = "ultra" | "medium" | "low";

export interface OceanQualityConfig {
  tier: OceanQualityTier;
  // Dynamic entity counts only — static content renders the same at all tiers
  maxFishCount: number;
  maxJellyfish: number;
  particleCount: number;
  maxPixelRatio: number;
  // God ray quality
  enableGodRays: boolean;
  godRayHalfRes: boolean;
  // Post-processing
  enableBloom: boolean;
  enableChromaticAberration: boolean;
  enableAbsorption: boolean;
}

const TIER_PRESETS: Record<OceanQualityTier, OceanQualityConfig> = {
  ultra: {
    tier: "ultra",
    maxFishCount: 200,
    maxJellyfish: 20,
    particleCount: 4000,
    maxPixelRatio: 2,
    enableGodRays: true,
    godRayHalfRes: false,
    enableBloom: true,
    enableChromaticAberration: true,
    enableAbsorption: true,
  },
  medium: {
    tier: "medium",
    maxFishCount: 100,
    maxJellyfish: 8,
    particleCount: 1500,
    maxPixelRatio: 1.5,
    enableGodRays: true,
    godRayHalfRes: true,
    enableBloom: true,
    enableChromaticAberration: true,
    enableAbsorption: true,
  },
  low: {
    tier: "low",
    maxFishCount: 30,
    maxJellyfish: 0,
    particleCount: 500,
    maxPixelRatio: 1,
    enableGodRays: false,
    godRayHalfRes: false,
    enableBloom: false,
    enableChromaticAberration: false,
    enableAbsorption: true,
  },
};

export function detectOceanQuality(renderer: WebGLRenderer | null): OceanQualityTier {
  if (!renderer) return "ultra";
  const gl = renderer.getContext();
  const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
  const gpuRenderer = debugInfo
    ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
    : "";
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const isLowEnd = /SwiftShader|llvmpipe|Mali-4|Adreno [23]/i.test(gpuRenderer);
  const cores = navigator.hardwareConcurrency ?? 4;
  if (isMobile || isLowEnd || cores <= 4) return "low";
  if (/Intel|integrated|UHD|Iris/i.test(gpuRenderer)) return "medium";
  return "ultra";
}

export function getOceanQualityConfig(tier: OceanQualityTier): OceanQualityConfig {
  return { ...TIER_PRESETS[tier] };
}
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors from the new file.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/ocean-v2/
git commit -m "feat(ocean-v2): scaffold directory structure + simplified quality system"
```

---

### Task 2: Create authored content layer — placements.ts + composer plugin

**Files:**
- Create: `src/lib/shared/3d/environments/scenes/ocean-v2/authored/placements.ts`
- Create: `src/lib/shared/3d/environments/scenes/ocean-v2/authored/ocean-composer-plugin.ts`
- Reference: `src/lib/shared/3d/environments/scenes/cosmic/placements.ts` (follow this pattern exactly)
- Reference: `src/lib/shared/3d/environments/scenes/cosmic/cosmic-composer-plugin.ts`
- Reference: `src/lib/shared/3d/scene-composer/types.ts` for `ComposerPlacement`

- [ ] **Step 1: Read cosmic composer plugin to understand the pattern**

Read `src/lib/shared/3d/environments/scenes/cosmic/cosmic-composer-plugin.ts` in full to understand the `ObjectDefinition` and catalog interface.

- [ ] **Step 2: Create ocean composer plugin**

Create `src/lib/shared/3d/environments/scenes/ocean-v2/authored/ocean-composer-plugin.ts`. Define the full catalog of ocean models (7 coral types, kelp, seaweed, anemone, starfish, sea urchin, shell, 6 rocks, 12 meshy formations). Follow the cosmic plugin pattern exactly — each entry has a `key`, `label`, `modelPath`, `fallbackGeometry`, `fallbackColor`, and optional `canRotate`/`canScale` flags.

Use model paths from the current OceanScene.svelte imports (lines 100-138):
- Corals: `/models/ocean/coral_0.glb` through `coral_6.glb` + `coral_large.glb`
- Flora: `/models/ocean/seaweed.glb`, `/models/ocean/kelp_plant.glb`
- Deco: `/models/ocean/starfish.glb`, `/models/ocean/sea_urchin.glb`, `/models/ocean/shell.glb`, `/models/ocean/anemone.glb`
- Rocks: `/models/ocean/rock_0.glb` through `rock_5.glb`
- Meshy: `/models/ocean/meshy/basalt_pinnacle.glb` etc.

- [ ] **Step 3: Create initial placements.ts**

Create `src/lib/shared/3d/environments/scenes/ocean-v2/authored/placements.ts`. Start with an empty array — Blender will populate it. Follow the cosmic pattern:

```typescript
import type { ComposerPlacement } from "$lib/shared/3d/scene-composer/types";

function q(rotY: number): [number, number, number, number] {
	return [0, Math.sin(rotY / 2), 0, Math.cos(rotY / 2)];
}

// <!-- PLACEMENTS_START -->
export const OCEAN_PLACEMENTS: ComposerPlacement[] = [];
// <!-- PLACEMENTS_END -->
```

The sentinel comments allow `sync_to_scene.py` to replace content between them.

- [ ] **Step 4: Verify typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/ocean-v2/authored/
git commit -m "feat(ocean-v2): add ocean composer plugin + placements scaffold"
```

---

### Task 3: Create Blender setup + sync scripts

**Files:**
- Create: `scripts/blender/ocean_setup.py`
- Create: `scripts/blender/ocean_sync_to_placements.py`
- Create: `scripts/blender/ocean_export_environment.py`
- Reference: `scripts/blender/cosmic_setup.py` (adapt this pattern)
- Reference: `scripts/blender/sync_to_placements.py` (adapt this pattern)

- [ ] **Step 1: Create ocean_setup.py**

Adapt `cosmic_setup.py` for ocean scene. Key differences:
- Model catalog = ocean corals/rocks/kelp instead of crystals
- Ground = sculpted seabed terrain (start with subdivided plane, apply FBM displacement via Python)
- Stage = cleared circle at center (performance zone, radius ~5m)
- Lighting = underwater lighting (blue-tinted sun from above, ambient fill)
- Water surface = plane at y=10 (translucent blue material)
- Collection names: `Flora`, `Rocks`, `Structures`, `Terrain` instead of `Crystals`
- Same coordinate conversion: `(x, y, z)_three → (x, -z, y)_blender`

The script imports all ocean GLBs from `static/models/ocean/`, creates a seabed plane with subdivision + noise displacement, sets up underwater lighting, and places template objects from the catalog.

- [ ] **Step 2: Create ocean_sync_to_placements.py**

Adapt `sync_to_placements.py`. Read all objects in `Flora`, `Rocks`, `Structures` collections. Convert Z-up → Y-up. Output TypeScript between sentinel markers targeting `src/lib/shared/3d/environments/scenes/ocean-v2/authored/placements.ts`.

- [ ] **Step 3: Create ocean_export_environment.py**

New script that exports the terrain mesh + hero structures (from `Terrain` and `Structures` collections) as a single `ocean-environment.glb` to `static/models/ocean/`. Uses Blender's glTF exporter with meshopt compression.

- [ ] **Step 4: Create README.md**

Create `scripts/blender/ocean_README.md` documenting the 3-script workflow:
1. `ocean_setup.py` — initial scene build
2. Edit in Blender
3. `ocean_sync_to_placements.py` — sync positions back
4. `ocean_export_environment.py` — export terrain GLB

- [ ] **Step 5: Commit**

```bash
git add scripts/blender/ocean_*.py scripts/blender/ocean_README.md
git commit -m "feat(ocean-v2): add Blender setup, sync, and export scripts"
```

---

### Task 4: Create OceanScene.svelte orchestrator + FloraInstances

**Files:**
- Create: `src/lib/shared/3d/environments/scenes/ocean-v2/OceanScene.svelte`
- Create: `src/lib/shared/3d/environments/scenes/ocean-v2/authored/FloraInstances.svelte`

- [ ] **Step 1: Create FloraInstances.svelte**

This component loads catalog GLBs and renders them at placements from `placements.ts` using `BatchedMesh` or `InstancedMesh` (check Three.js 0.182 — BatchedMesh may need r183+; if not available, use per-model InstancedMesh groups like the current ocean does, but driven by placements.ts instead of procedural generation).

```svelte
<script lang="ts">
  import { useGltf } from "@threlte/extras";
  import { T } from "@threlte/core";
  import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
  import { InstancedMesh, Object3D, Matrix4, Quaternion, Vector3 } from "three";
  import { OCEAN_PLACEMENTS } from "./placements";
  import { OCEAN_CATALOG } from "./ocean-composer-plugin";
  import type { OceanQualityConfig } from "../quality/ocean-quality";

  interface Props {
    quality: OceanQualityConfig;
  }

  let { quality }: Props = $props();

  const opts = { meshoptDecoder: MeshoptDecoder };

  // Group placements by objectKey for instanced rendering
  const placementsByKey = $derived.by(() => {
    const map = new Map<string, typeof OCEAN_PLACEMENTS>();
    for (const p of OCEAN_PLACEMENTS) {
      const arr = map.get(p.objectKey) ?? [];
      arr.push(p);
      map.set(p.objectKey, arr);
    }
    return map;
  });

  // Load each unique model once
  // Implementation: for each unique objectKey in placements, useGltf to load,
  // then create InstancedMesh with count = number of placements for that key.
  // Set instance matrices from placement position/rotation/scale.
</script>

<!-- Render instanced groups per model type -->
<!-- Each group = one InstancedMesh draw call -->
```

The full implementation reads each catalog entry's `modelPath`, loads via `useGltf`, extracts the mesh geometry + material, creates an `InstancedMesh` with one instance per placement for that `objectKey`, and sets the transform matrix from each placement's `position`, `rotation`, `scale`.

- [ ] **Step 2: Create OceanScene.svelte orchestrator**

```svelte
<script lang="ts">
  import { T, useThrelte } from "@threlte/core";
  import { useGltf } from "@threlte/extras";
  import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
  import { FogExp2, Color } from "three";
  import FloraInstances from "./authored/FloraInstances.svelte";
  import OceanLoading from "./runtime/loading/OceanLoading.svelte";
  import { detectOceanQuality, getOceanQualityConfig } from "./quality/ocean-quality";
  import { userProportionsState } from "@austencloud/scene-3d";

  interface Props {
    performerCount?: number;
    stageWidth?: number;
    stageDepth?: number;
    stageZOffset?: number;
  }

  let {
    performerCount = 1,
    stageWidth = 6,
    stageDepth = 6,
    stageZOffset = 0,
  }: Props = $props();

  const { renderer, scene } = useThrelte();

  const quality = $derived.by(() => {
    const r = (renderer as any)?.current ?? renderer;
    return getOceanQualityConfig(detectOceanQuality(r));
  });

  const environmentGlb = useGltf("/models/ocean/ocean-environment.glb", {
    meshoptDecoder: MeshoptDecoder,
  });

  const sceneReady = $derived(!!$environmentGlb);

  // Set underwater fog
  $effect(() => {
    const s = (scene as any)?.current ?? scene;
    if (s?.isScene) {
      s.fog = new FogExp2(new Color("#0a1a2a").getHex(), 0.04);
    }
    return () => {
      if (s?.isScene) s.fog = null;
    };
  });
</script>

{#if !sceneReady}
  <OceanLoading progress={0} />
{:else}
  <!-- Authored static environment (terrain + hero structures) -->
  {@const envScene = $environmentGlb.scene}
  <T is={envScene} />

  <!-- Instanced flora/rocks from catalog + placements.ts -->
  <FloraInstances {quality} />

  <!-- Runtime systems will be mounted here in Phase 2 -->
  <!-- <OceanRuntimeSystems {quality} {performerCount} {stageWidth} {stageDepth} {stageZOffset} /> -->
{/if}
```

- [ ] **Step 3: Create loading component stub**

Create `src/lib/shared/3d/environments/scenes/ocean-v2/runtime/loading/OceanLoading.svelte`:

```svelte
<script lang="ts">
  interface Props {
    progress?: number;
  }

  let { progress = 0 }: Props = $props();
</script>

<!-- Loading screen — port from ocean/OceanLoadingScreen.svelte in Phase 2 -->
```

- [ ] **Step 4: Verify typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/ocean-v2/
git commit -m "feat(ocean-v2): add OceanScene orchestrator + FloraInstances + loading stub"
```

---

## Phase 2: Migrate Runtime Systems

Each task extracts one subsystem from the monolith into the new architecture. The old code stays untouched — we're copying + refactoring, not moving.

### Task 5: Migrate water surface

**Files:**
- Create: `src/lib/shared/3d/environments/scenes/ocean-v2/runtime/water/WaterSurface.svelte`
- Create: `src/lib/shared/3d/environments/scenes/ocean-v2/shaders/water/gerstner.vert`
- Create: `src/lib/shared/3d/environments/scenes/ocean-v2/shaders/water/snell-window.frag`
- Source: `src/lib/shared/3d/environments/scenes/ocean/WaterSurface.svelte` (278 lines)

- [ ] **Step 1: Extract shaders to separate files**

The current `WaterSurface.svelte` has inline GLSL strings for vertex and fragment shaders. Extract the vertex shader (Gerstner wave computation) to `shaders/water/gerstner.vert` and the fragment shader (Snell's window + caustic pattern) to `shaders/water/snell-window.frag`.

- [ ] **Step 2: Create new WaterSurface.svelte**

Copy the component logic but:
- Remove the `OceanWaterSurfaceConfig` dependency — hardcode the water surface parameters directly (no variant system, one ocean)
- Import shaders from external files via `?raw` suffix
- Accept only `size`, `segments`, and `groundY` as props
- Keep all Gerstner wave logic, Snell's window, edge fade, caustic animation

Target: under 120 lines (shader code extracted to files).

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/ocean-v2/runtime/water/ src/lib/shared/3d/environments/scenes/ocean-v2/shaders/water/
git commit -m "feat(ocean-v2): migrate water surface with extracted shaders"
```

---

### Task 6: Migrate atmosphere system (god rays, caustics, particles)

**Files:**
- Create: `src/lib/shared/3d/environments/scenes/ocean-v2/runtime/atmosphere/AtmosphereSystem.svelte`
- Create: `src/lib/shared/3d/environments/scenes/ocean-v2/runtime/atmosphere/GodRayShafts.svelte`
- Create: `src/lib/shared/3d/environments/scenes/ocean-v2/runtime/atmosphere/VoronoiCaustics.svelte`
- Create: `src/lib/shared/3d/environments/scenes/ocean-v2/runtime/atmosphere/MarineParticles.svelte`
- Source: `src/lib/shared/3d/environments/scenes/ocean/GodRayShafts.svelte` (160 lines)
- Source: `src/lib/shared/3d/environments/scenes/ocean/VoronoiCaustics.svelte` (105 lines)
- Source: `src/lib/shared/3d/environments/scenes/ocean/UnderwaterParticles.svelte` (134 lines)

- [ ] **Step 1: Create GodRayShafts.svelte**

Port from current `GodRayShafts.svelte`. Remove `OceanGodRayShaftConfig` dependency — hardcode params for the single ocean scene. Extract GLSL to `shaders/atmosphere/god-ray.vert` and `shaders/atmosphere/god-ray.frag`. Accept `quality: OceanQualityConfig` to conditionally enable/disable.

Note: This task ports the CURRENT geometry-based god rays. Phase 4 upgrades to `three-good-godrays` volumetric — that's a swap of this one component later.

- [ ] **Step 2: Create VoronoiCaustics.svelte**

Port from current. Remove config dependency. Hardcode caustic parameters. Extract GLSL to `shaders/atmosphere/voronoi-caustic.frag`. Accept quality config for enable/disable.

- [ ] **Step 3: Create MarineParticles.svelte**

Port from current `UnderwaterParticles.svelte`. Remove config dependencies. Hardcode particle params. Accept `count` from quality config. Extract GLSL to shader files.

- [ ] **Step 4: Create AtmosphereSystem.svelte orchestrator**

Thin component that mounts the three subsystems based on quality tier:

```svelte
<script lang="ts">
  import type { OceanQualityConfig } from "../../quality/ocean-quality";
  import GodRayShafts from "./GodRayShafts.svelte";
  import VoronoiCaustics from "./VoronoiCaustics.svelte";
  import MarineParticles from "./MarineParticles.svelte";

  interface Props {
    quality: OceanQualityConfig;
  }

  let { quality }: Props = $props();
</script>

{#if quality.enableGodRays}
  <GodRayShafts halfRes={quality.godRayHalfRes} />
{/if}

<VoronoiCaustics />

<MarineParticles count={quality.particleCount} />
```

- [ ] **Step 5: Verify typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/ocean-v2/runtime/atmosphere/ src/lib/shared/3d/environments/scenes/ocean-v2/shaders/atmosphere/
git commit -m "feat(ocean-v2): migrate atmosphere system (god rays, caustics, particles)"
```

---

### Task 7: Migrate fish system

**Files:**
- Create: `src/lib/shared/3d/environments/scenes/ocean-v2/runtime/fauna/fish/FishBoids.svelte`
- Create: `src/lib/shared/3d/environments/scenes/ocean-v2/runtime/fauna/fish/fish-compute.ts`
- Create: `src/lib/shared/3d/environments/scenes/ocean-v2/runtime/fauna/fish/fish-render.ts`
- Create: `src/lib/shared/3d/environments/scenes/ocean-v2/runtime/fauna/fish/fish-species.ts`
- Create: `src/lib/shared/3d/environments/scenes/ocean-v2/runtime/fauna/fish/fish-events.ts`
- Create: `src/lib/shared/3d/environments/scenes/ocean-v2/runtime/fauna/fish/fish-locomotion.ts`
- Create: `src/lib/shared/3d/environments/scenes/ocean-v2/shaders/fish/boid-compute.glsl`
- Create: `src/lib/shared/3d/environments/scenes/ocean-v2/shaders/fish/fish-vertex.vert`
- Create: `src/lib/shared/3d/environments/scenes/ocean-v2/shaders/fish/fish-fragment.frag`
- Source: `src/lib/shared/3d/environments/scenes/ocean/FishSchool.svelte` (980 lines)
- Source: `src/lib/shared/3d/environments/scenes/ocean/fish-shaders.ts` (577 lines)
- Source: `src/lib/shared/3d/environments/scenes/ocean/fish-species-config.ts` (129 lines)
- Source: `src/lib/shared/3d/environments/scenes/ocean/fish-behavior-shader.ts` (161 lines)
- Source: `src/lib/shared/3d/environments/scenes/ocean/fish-locomotion-params.ts` (91 lines)
- Source: `src/lib/shared/3d/environments/scenes/ocean/FishEventSystem.ts` (68 lines)
- Source: `src/lib/shared/3d/environments/scenes/ocean/SpeciesRotationManager.ts` (133 lines)

This is the largest migration. The 980-line FishSchool.svelte currently handles: model loading, geometry normalization, GPU computation setup (GPUComputationRenderer), instanced mesh rendering, CPU fallback, SDF integration, species rotation, event system wiring, and lifecycle.

- [ ] **Step 1: Create fish-species.ts**

Port `fish-species-config.ts` (129 lines) directly. Remove any variant-conditional species lists. All 8 species + threat/hunt matrices stay. Add the `SpeciesRotationManager` logic (133 lines) as an export from this same file — it's species management, not rendering.

Target: ~250 lines (species config + rotation manager combined).

- [ ] **Step 2: Create fish-locomotion.ts**

Port `fish-locomotion-params.ts` (91 lines) directly. No changes needed — it's already clean.

- [ ] **Step 3: Create fish-events.ts**

Port `FishEventSystem.ts` (68 lines) directly. Remove `ReefSDFData` import — fish avoidance in v2 uses simple bounding spheres, not SDF. The event system (threat/hunt stimulus) stays unchanged.

- [ ] **Step 4: Extract shaders to files**

From `fish-shaders.ts` (577 lines) and `fish-behavior-shader.ts` (161 lines), extract:
- `shaders/fish/boid-compute.glsl` — velocity + position computation shaders
- `shaders/fish/fish-vertex.vert` — instanced vertex shader with locomotion animation
- `shaders/fish/fish-fragment.frag` — PBR-lite fragment with fog

Keep the shader strings importable via `?raw` suffix.

- [ ] **Step 5: Create fish-compute.ts**

Extract GPGPU computation setup from FishSchool.svelte into a standalone module. This handles:
- `GPUComputationRenderer` initialization
- Position/velocity/state texture setup
- Uniform management per frame
- The `initGPU()` and `updateGPU(delta)` functions

Interface:

```typescript
export interface FishComputeSystem {
  init(renderer: WebGLRenderer, count: number, species: FishSpeciesConfig[]): void;
  update(delta: number, uniforms: FishFrameUniforms): void;
  getPositionTexture(): Texture;
  getVelocityTexture(): Texture;
  dispose(): void;
}
```

Target: ~300 lines.

- [ ] **Step 6: Create fish-render.ts**

Extract instanced mesh rendering from FishSchool.svelte. Handles:
- Model loading + geometry normalization + Z-reorientation
- InstancedMesh creation per species
- Per-frame uniform updates (position/velocity textures from compute system)
- LOD switching
- CPU fallback when GPU compute fails

Interface:

```typescript
export interface FishRenderSystem {
  init(renderer: WebGLRenderer, camera: Camera, species: FishSpeciesConfig[], count: number): Promise<void>;
  update(delta: number, positionTexture: Texture, velocityTexture: Texture): void;
  getMeshes(): InstancedMesh[];
  dispose(): void;
}
```

Target: ~200 lines.

- [ ] **Step 7: Create FishBoids.svelte**

Thin Svelte component that wires compute + render together:

```svelte
<script lang="ts">
  import { T, useTask, useThrelte } from "@threlte/core";
  import { onDestroy } from "svelte";
  import type { OceanQualityConfig } from "../../../quality/ocean-quality";
  import type { Vector3 } from "three";
  import { createFishComputeSystem } from "./fish-compute";
  import { createFishRenderSystem } from "./fish-render";
  import { FishEventSystem } from "./fish-events";
  import { ALL_SPECIES } from "./fish-species";

  interface Props {
    quality: OceanQualityConfig;
    rayPosition?: Vector3;
  }

  let { quality, rayPosition }: Props = $props();

  const { renderer, camera } = useThrelte();
  // ... init compute, init render, useTask for per-frame update
</script>

{#each meshes as mesh}
  <T is={mesh} />
{/each}
```

Target: ~60 lines. All complexity lives in fish-compute.ts and fish-render.ts.

- [ ] **Step 8: Verify typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 9: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/ocean-v2/runtime/fauna/fish/ src/lib/shared/3d/environments/scenes/ocean-v2/shaders/fish/
git commit -m "feat(ocean-v2): migrate fish system (boids, species, events, shaders)"
```

---

### Task 8: Migrate jellyfish system

**Files:**
- Create: `src/lib/shared/3d/environments/scenes/ocean-v2/runtime/fauna/jellyfish/JellyfishSwarm.svelte`
- Create: `src/lib/shared/3d/environments/scenes/ocean-v2/runtime/fauna/jellyfish/jellyfish-verlet.ts`
- Create: `src/lib/shared/3d/environments/scenes/ocean-v2/runtime/fauna/jellyfish/jellyfish-geometry.ts`
- Create: `src/lib/shared/3d/environments/scenes/ocean-v2/runtime/fauna/jellyfish/jellyfish-shaders.ts`
- Source: `src/lib/shared/3d/environments/scenes/ocean/ProceduralJellyfish.svelte` (67 lines)
- Source: `src/lib/shared/3d/environments/scenes/ocean/jellyfish/medusae.ts` (714 lines)
- Source: `src/lib/shared/3d/environments/scenes/ocean/jellyfish/verlet-physics.ts` (281 lines)
- Source: `src/lib/shared/3d/environments/scenes/ocean/jellyfish/jellyfish-shaders.ts` (159 lines)
- Source: `src/lib/shared/3d/environments/scenes/ocean/jellyfish/geometry-utils.ts` (75 lines)

- [ ] **Step 1: Create jellyfish-verlet.ts**

Port `verlet-physics.ts` (281 lines) directly. This is pure physics — no ocean-specific dependencies to remove.

- [ ] **Step 2: Create jellyfish-geometry.ts**

Port `medusae.ts` (714 lines) + `geometry-utils.ts` (75 lines). The `Medusae` class handles bell geometry, tentacle tessellation, animation, and rendering. Merge `geometry-utils.ts` helpers into this file since they're only used here.

Split the 714-line `medusae.ts` into two concerns:
- `jellyfish-geometry.ts` — bell mesh generation, tentacle chain construction (~300 lines)
- Move the verlet update loop and animation timing into `jellyfish-verlet.ts` if not already there

Target: `jellyfish-geometry.ts` ~350 lines (geometry + material setup from medusae.ts).

- [ ] **Step 3: Create jellyfish-shaders.ts**

Port `jellyfish-shaders.ts` (159 lines) directly. These are the vertex/fragment shaders for the translucent bell and bioluminescent tentacles.

- [ ] **Step 4: Create JellyfishSwarm.svelte**

This replaces the pattern where `OceanScene.svelte` mounts N `ProceduralJellyfish` instances. Instead, `JellyfishSwarm` manages all jellyfish as a group:

```svelte
<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { onDestroy } from "svelte";
  import type { OceanQualityConfig } from "../../../quality/ocean-quality";
  import { Medusae, OCEAN_COLORS } from "./jellyfish-geometry";
  import { userProportionsState } from "@austencloud/scene-3d";

  interface Props {
    quality: OceanQualityConfig;
  }

  let { quality }: Props = $props();

  const count = $derived(quality.maxJellyfish);
  const groundY = $derived(userProportionsState.groundY);

  // Spawn jellyfish at random positions above stage
  const jellies = $derived.by(() => {
    return Array.from({ length: count }, (_, i) => {
      const seed = i * 1.618;
      return new Medusae(OCEAN_COLORS);
    });
  });

  // ... useTask for physics update, drift animation, disposal
</script>

{#each jellies as jelly, i}
  <T is={jelly.item} />
{/each}
```

Target: ~60 lines.

- [ ] **Step 5: Create FaunaSystem.svelte**

Create `src/lib/shared/3d/environments/scenes/ocean-v2/runtime/fauna/FaunaSystem.svelte`:

```svelte
<script lang="ts">
  import type { OceanQualityConfig } from "../../quality/ocean-quality";
  import type { Vector3 } from "three";
  import FishBoids from "./fish/FishBoids.svelte";
  import JellyfishSwarm from "./jellyfish/JellyfishSwarm.svelte";

  interface Props {
    quality: OceanQualityConfig;
    rayPosition?: Vector3;
  }

  let { quality, rayPosition }: Props = $props();
</script>

<FishBoids {quality} {rayPosition} />

{#if quality.maxJellyfish > 0}
  <JellyfishSwarm {quality} />
{/if}
```

- [ ] **Step 6: Verify typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/ocean-v2/runtime/fauna/
git commit -m "feat(ocean-v2): migrate jellyfish system + fauna orchestrator"
```

---

### Task 9: Migrate interaction + audio system

**Files:**
- Create: `src/lib/shared/3d/environments/scenes/ocean-v2/runtime/interaction/OceanInteraction.svelte`
- Create: `src/lib/shared/3d/environments/scenes/ocean-v2/runtime/interaction/fish-scatter.ts`
- Create: `src/lib/shared/3d/environments/scenes/ocean-v2/runtime/interaction/ocean-audio.ts`
- Source: `src/lib/shared/3d/environments/scenes/ocean/OceanMouseRaycast.svelte` (102 lines)
- Source: `src/lib/shared/3d/environments/scenes/ocean/OceanClickInspect.svelte` (61 lines)
- Source: `src/lib/shared/3d/environments/scenes/ocean/OceanAmbientAudio.svelte` (70 lines)
- Source: `src/lib/shared/3d/audio/ocean-audio-engine.ts` (291 lines)
- Source: `src/lib/shared/3d/audio/ocean-audio-tracks.ts` (120 lines)

- [ ] **Step 1: Create fish-scatter.ts**

Extract mouse raycast → fish flee logic from `OceanMouseRaycast.svelte`. Pure function: takes mouse NDC coordinates, camera, swim plane → outputs world position for fish scatter stimulus.

- [ ] **Step 2: Create ocean-audio.ts**

Thin wrapper that initializes `OceanAudioEngine` on first interaction and plays the default track. Remove variant-based track selection (no variants). The `OceanAudioEngine` and `ocean-audio-tracks` modules in `src/lib/shared/3d/audio/` stay where they are — they're shared infrastructure, not ocean-v2 internal.

- [ ] **Step 3: Create OceanInteraction.svelte**

Combines raycast, click inspect, and audio into one component:

```svelte
<script lang="ts">
  import { useThrelte, useTask } from "@threlte/core";
  import { Vector3 } from "three";
  import { createFishScatterRaycast } from "./fish-scatter";
  import { initOceanAudio } from "./ocean-audio";

  let rayPosition = $state(new Vector3(0, -999, 0));

  // ... raycast setup, audio init on interaction
</script>
```

Expose `rayPosition` as bindable for FishBoids to consume.

- [ ] **Step 4: Verify typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/ocean-v2/runtime/interaction/
git commit -m "feat(ocean-v2): migrate interaction + audio system"
```

---

### Task 10: Create OceanRuntimeSystems orchestrator + wire everything

**Files:**
- Create: `src/lib/shared/3d/environments/scenes/ocean-v2/runtime/OceanRuntimeSystems.svelte`
- Modify: `src/lib/shared/3d/environments/scenes/ocean-v2/OceanScene.svelte` (uncomment runtime mount)
- Create: `src/lib/shared/3d/environments/scenes/ocean-v2/runtime/loading/OceanLoading.svelte` (full port)

- [ ] **Step 1: Port OceanLoading.svelte**

Port `ocean/OceanLoadingScreen.svelte` (115 lines) into the new loading directory. Remove variant references. Simplify to show loading progress bar.

- [ ] **Step 2: Create OceanRuntimeSystems.svelte**

This mounts all runtime subsystems and passes shared state:

```svelte
<script lang="ts">
  import { T, useThrelte } from "@threlte/core";
  import { FogExp2, Color } from "three";
  import type { OceanQualityConfig } from "../quality/ocean-quality";
  import WaterSurface from "./water/WaterSurface.svelte";
  import AtmosphereSystem from "./atmosphere/AtmosphereSystem.svelte";
  import FaunaSystem from "./fauna/FaunaSystem.svelte";
  import OceanInteraction from "./interaction/OceanInteraction.svelte";
  import { userProportionsState } from "@austencloud/scene-3d";
  import SkyGradient from "../../../primitives/SkyGradient.svelte";

  interface Props {
    quality: OceanQualityConfig;
    performerCount?: number;
    stageWidth?: number;
    stageDepth?: number;
    stageZOffset?: number;
  }

  let { quality, performerCount = 1, stageWidth = 6, stageDepth = 6, stageZOffset = 0 }: Props = $props();

  const groundY = $derived(userProportionsState.groundY);
</script>

<!-- Sky gradient (underwater blue) -->
<SkyGradient config={{ topColor: "#0a1520", bottomColor: "#1a3a5a", size: 60 }} />

<!-- Lighting -->
<T.HemisphereLight args={["#1a4060", "#0a1a2a", 0.6]} />
<T.DirectionalLight
  position={[10, 30, -20]}
  intensity={0.8}
  color="#6699cc"
/>

<!-- Water surface -->
<WaterSurface {groundY} />

<!-- Atmosphere (god rays, caustics, particles) -->
<AtmosphereSystem {quality} />

<!-- Fauna (fish, jellyfish) -->
<FaunaSystem {quality} />

<!-- Interaction (raycast, audio) -->
<OceanInteraction />
```

- [ ] **Step 3: Update OceanScene.svelte to mount runtime systems**

Uncomment the `OceanRuntimeSystems` import and mount.

- [ ] **Step 4: Verify typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 5: Verify build**

Run: `npm run build 2>&1 | tail -20`

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/ocean-v2/
git commit -m "feat(ocean-v2): wire all runtime systems into orchestrator"
```

---

## Phase 3: Switchover + Delete Old Code

### Task 11: Wire ocean-v2 into Environment3D

**Files:**
- Modify: `src/lib/shared/3d/environments/components/Environment3D.svelte`
- Modify: `src/lib/shared/3d/environments/domain/enums/environment-enums.ts` (remove OceanVariant if only used for ocean)

- [ ] **Step 1: Update Environment3D import**

Change the OceanScene import from `../scenes/OceanScene.svelte` to `../scenes/ocean-v2/OceanScene.svelte`.

- [ ] **Step 2: Remove variant prop passing**

The ocean case in `getSceneConfig` currently returns `{ scene: "ocean", variant: "abyss" | "reef" | "mystical" | "cinematic" }`. Change to just `{ scene: "ocean" }` — no variant.

Update the template: `<OceanScene {performerCount} {stageWidth} {stageDepth} {stageZOffset} />` — no `variant` prop.

- [ ] **Step 3: Remove oceanVariant prop from Environment3D**

The `oceanVariant` prop on `Environment3D` is dead. Remove it from the interface and all call sites.

Grep for `oceanVariant` across the codebase to find all call sites that pass it.

- [ ] **Step 4: Clean up OceanVariant type**

Check if `OceanVariant` type in `environment-enums.ts` is used anywhere else. If only for the old ocean scene, remove it. If Scene Lab or other code references it, leave it for now and remove in Task 12.

- [ ] **Step 5: Verify typecheck + build**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Run: `npm run build 2>&1 | tail -20`

- [ ] **Step 6: Commit**

```bash
git add -u
git commit -m "feat(ocean-v2): wire into Environment3D, remove variant system"
```

---

### Task 12: Delete old ocean code

**Files to delete:**
- `src/lib/shared/3d/environments/scenes/OceanScene.svelte` (1,865 lines)
- `src/lib/shared/3d/environments/scenes/ocean/terrain-height.ts` (162 lines)
- `src/lib/shared/3d/environments/scenes/ocean/placement-cache.ts` (78 lines)
- `src/lib/shared/3d/environments/scenes/ocean/sdf-generator.ts` (239 lines)
- `src/lib/shared/3d/environments/scenes/ocean/sdf-cache.ts` (130 lines)
- `src/lib/shared/3d/environments/scenes/ocean/scene-sdf-baker.ts` (111 lines)
- `src/lib/shared/3d/environments/scenes/ocean/ocean-instancing.ts` (276 lines)
- `src/lib/shared/3d/environments/scenes/ocean/procedural-rock.ts` (412 lines)
- `src/lib/shared/3d/environments/scenes/ocean/RuinsPlatform.svelte`
- `src/lib/shared/3d/environments/scenes/ocean/ReefStructures.svelte` (236 lines)
- `src/lib/shared/3d/environments/scenes/ocean/OceanClickInspect.svelte` (61 lines)
- `src/lib/shared/3d/environments/scenes/ocean/OceanLoadingScreen.svelte` (115 lines)
- `src/lib/shared/3d/environments/scenes/ocean/OceanMouseRaycast.svelte` (102 lines)
- `src/lib/shared/3d/environments/scenes/ocean/OceanAmbientAudio.svelte` (70 lines)
- `src/lib/shared/3d/environments/scenes/ocean/BoatSilhouette.svelte` (143 lines)
- `src/lib/shared/3d/environments/scenes/ocean/HeroKelp.svelte` (54 lines)
- All old ocean component files now superseded by ocean-v2

**Files to keep (shared by ocean-v2 via direct port):**
- `src/lib/shared/3d/audio/ocean-audio-engine.ts` — shared audio infrastructure
- `src/lib/shared/3d/audio/ocean-audio-tracks.ts` — shared audio infrastructure
- `src/lib/shared/3d/environments/utils/poisson-disc.ts` — used by other scenes
- `src/lib/shared/3d/environments/utils/reef-ecology.ts` — check if used elsewhere; delete if ocean-only
- `src/lib/shared/3d/environments/utils/dla.ts` — check if used elsewhere; delete if ocean-only

**Files to clean:**
- `src/lib/shared/3d/environments/domain/models/scene-configs.ts` — remove all `OceanSceneConfig` types and the 4 variant factory functions. Keep non-ocean configs.

- [ ] **Step 1: Grep for imports of old ocean files**

Before deleting, grep the entire `src/` directory for imports from `scenes/ocean/` (not `ocean-v2/`) to find any remaining references. Fix them before deleting.

- [ ] **Step 2: Check ocean-only utilities**

Grep for imports of `reef-ecology`, `dla`, `poisson-disc` outside the old ocean directory. Keep shared ones, delete ocean-only ones.

- [ ] **Step 3: Delete old ocean files**

Delete all files listed above. The old `scenes/ocean/` directory should be empty after this (except files that were ported to ocean-v2 and are no longer imported).

- [ ] **Step 4: Clean scene-configs.ts**

Remove all ocean-related types and functions from `scene-configs.ts`:
- `OceanSceneConfig` interface
- `OceanWaterSurfaceConfig`, `OceanGodRayShaftConfig`, etc.
- `createDefaultOceanAbyssConfig()`, `createDefaultOceanReefConfig()`, `createDefaultOceanMysticalConfig()`, `createDefaultOceanCinematicConfig()`
- Any ocean-specific sub-interfaces

This will significantly shrink the 2,305-line file.

- [ ] **Step 5: Clean Scene Lab references**

Grep for old ocean references in `src/lib/features/lab/tabs/scene-lab/`. The Scene Lab may reference `OceanVariant` or ocean config factories. Update or remove those references.

- [ ] **Step 6: Verify typecheck + build**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Run: `npm run build 2>&1 | tail -20`

Both must pass clean.

- [ ] **Step 7: Commit**

```bash
git add -u
git commit -m "refactor(ocean): delete old monolith (5,500+ lines removed)"
```

---

### Task 13: Rename ocean-v2 → ocean

**Files:**
- Rename: `src/lib/shared/3d/environments/scenes/ocean-v2/` → `src/lib/shared/3d/environments/scenes/ocean/`
- Update: All import paths referencing `ocean-v2`

- [ ] **Step 1: Rename directory**

```bash
git mv src/lib/shared/3d/environments/scenes/ocean-v2 src/lib/shared/3d/environments/scenes/ocean
```

- [ ] **Step 2: Update import paths**

Grep for `ocean-v2` across the codebase. Update all import paths to `ocean`.

- [ ] **Step 3: Verify typecheck + build**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Run: `npm run build 2>&1 | tail -20`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(ocean): rename ocean-v2 to ocean"
```

---

## Phase 4: Blender Scene Authoring

This phase uses the Blender MCP to create the actual ocean environment.

### Task 14: Build initial ocean scene in Blender

**Files:**
- Modify: `static/models/ocean/ocean-environment.glb` (created by Blender export)
- Modify: `src/lib/shared/3d/environments/scenes/ocean/authored/placements.ts` (synced from Blender)

- [ ] **Step 1: Execute ocean_setup.py via Blender MCP**

Run the setup script to build the initial scene: terrain, lighting, model templates, stage exclusion zone.

- [ ] **Step 2: Art-direct initial placement**

Use Blender MCP to place corals, rocks, kelp in art-directed positions. Focus on:
- Hero reef structures framing the performer
- Dense foreground coral gardens
- Mid-ground rock formations
- Background kelp forests
- Negative space where needed

- [ ] **Step 3: Sculpt terrain in Blender**

Use subdivision + sculpt to create natural seabed topology. Sand dunes, rock outcrops, gentle slopes.

- [ ] **Step 4: Export via ocean_export_environment.py**

Export terrain + structures as `ocean-environment.glb`.

- [ ] **Step 5: Sync placements via ocean_sync_to_placements.py**

Sync flora positions back to `placements.ts`.

- [ ] **Step 6: Verify in browser**

Load the ocean scene in the browser. Check that terrain renders, flora instances appear at correct positions, runtime systems activate.

- [ ] **Step 7: Commit**

```bash
git add static/models/ocean/ocean-environment.glb src/lib/shared/3d/environments/scenes/ocean/authored/placements.ts
git commit -m "feat(ocean): initial Blender-authored scene with art-directed placement"
```

---

## Verification Checklist

After all tasks complete, verify these success criteria from the spec:

- [ ] `OceanScene.svelte` under 80 lines → count lines
- [ ] No file in `runtime/` over 350 lines → `find . -name '*.svelte' -o -name '*.ts' | xargs wc -l | sort -rn | head -20`
- [ ] All fish functionality preserved → load scene, verify 8 species, boid behavior, scatter on mouse, species rotation
- [ ] All jellyfish functionality preserved → verify verlet tentacles, drift, bioluminescence
- [ ] Scene loads from Blender-exported GLB → verify `ocean-environment.glb` loads
- [ ] Flora placement editable in Blender without code changes → run sync script, verify hot-reload
- [ ] Quality system adapts runtime entity counts → test with forced tiers
- [ ] Zero references to variant system remain → `grep -r "OceanVariant\|oceanVariant\|variant.*abyss\|variant.*reef\|variant.*mystical\|variant.*cinematic" src/`
- [ ] `npm run check` passes
- [ ] Visual parity with current scene (at minimum)
