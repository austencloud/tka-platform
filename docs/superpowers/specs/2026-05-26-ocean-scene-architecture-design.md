# Ocean Scene Architecture Redesign — Design Spec

> Date: 2026-05-26
> Status: Draft — pending user review
> Supersedes: Current monolithic OceanScene.svelte (1,865 lines + 41 supporting files, ~10,400 total)

---

## 1. Goal

Replace the monolithic ocean scene with a clean architecture that separates **Blender-authored static content** from **runtime dynamic systems**. Eliminate the variant system. Achieve AAA-quality rendering through proper subsystem isolation that enables iterative visual upgrades.

---

## 2. Architecture Philosophy

**The AAA pattern**: DCC tools (Blender) for environment art + runtime code for dynamic systems. This is what ABZU, Subnautica, and Sea of Thieves ship. No studio procedurally generates coral placement at runtime. No studio bakes fish AI into video.

**Three layers:**

| Layer | Pattern | What lives here |
|-------|---------|-----------------|
| Authored content | Blender → GLB + placements.ts | Terrain, structures, flora/rock placement |
| Runtime systems | Pipeline DAG + Threlte components | Fish, jellyfish, water, caustics, particles, god rays |
| Post-processing | RenderPipeline (Three.js r183+) | Absorption, distortion, bloom, chromatic aberration |

---

## 3. File Structure

```
src/lib/shared/3d/environments/scenes/ocean/
├── OceanScene.svelte              # ~60 lines. Loads authored scene, mounts runtime systems.
│
├── authored/
│   ├── ocean-environment.glb      # Blender export: terrain mesh + hero structures (ruins, arches)
│   ├── placements.ts              # Flora/rock positions — synced from Blender via MCP
│   ├── ocean-composer-plugin.ts   # Catalog: coral types, rock types, kelp types (for scene composer)
│   └── catalog/                   # Individual model GLBs for instanced rendering
│       ├── coral-0.glb ... coral-6.glb
│       ├── coral-large.glb
│       ├── kelp-plant.glb
│       ├── seaweed.glb
│       ├── anemone.glb
│       ├── starfish.glb
│       ├── sea-urchin.glb
│       ├── shell.glb
│       ├── rock-0.glb ... rock-5.glb
│       └── meshy/
│           ├── basalt-pinnacle.glb
│           ├── coral-encrusted-rock.glb
│           └── ... (12 formations)
│
├── runtime/
│   ├── OceanRuntimeSystems.svelte # Mounts all runtime systems, passes shared context
│   │
│   ├── water/
│   │   └── WaterSurface.svelte    # Gerstner waves, Snell's window, edge fade
│   │
│   ├── atmosphere/
│   │   ├── AtmosphereSystem.svelte   # Orchestrates fog + god rays + caustics + particles
│   │   ├── VolumetricGodRays.svelte  # three-good-godrays (replaces geometry GodRayShafts)
│   │   ├── ProjectedCaustics.svelte  # Surface-projected onto terrain (not screen-space)
│   │   └── MarineParticles.svelte    # GPU-driven sediment / marine snow
│   │
│   ├── fauna/
│   │   ├── FaunaSystem.svelte        # Mounts fish + jellyfish
│   │   ├── fish/
│   │   │   ├── FishBoids.svelte      # Thin mount — delegates to compute + render
│   │   │   ├── fish-compute.ts       # GPGPU boid simulation (WebGPU compute shader)
│   │   │   ├── fish-render.ts        # Instanced draw, species LOD switching
│   │   │   ├── fish-species.ts       # 8 species config, threat/hunt matrices
│   │   │   ├── fish-events.ts        # Stimulus system (threats, hunt triggers)
│   │   │   └── fish-locomotion.ts    # Per-species locomotion parameters
│   │   └── jellyfish/
│   │       ├── JellyfishSwarm.svelte # Mounts procedural jellyfish
│   │       ├── jellyfish-verlet.ts   # Constraint rope simulation
│   │       ├── jellyfish-geometry.ts # Bell + tentacle tessellation
│   │       └── jellyfish-shaders.ts  # Rendering shaders
│   │
│   ├── interaction/
│   │   ├── OceanInteraction.svelte   # Raycast + click inspect + audio
│   │   ├── fish-scatter.ts           # Mouse → fish flee stimulus
│   │   └── ocean-audio.ts            # Web Audio procedural synthesis
│   │
│   └── loading/
│       └── OceanLoading.svelte       # Progress screen during GLB loads
│
├── postprocessing/
│   ├── ocean-render-pipeline.ts      # RenderPipeline DAG (batches compatible effects)
│   └── nodes/
│       ├── water-absorption.ts       # Per-channel RGB absorption (red dies first)
│       ├── underwater-distortion.ts  # Depth-based refraction
│       └── bioluminescence-bloom.ts  # Selective bloom for glowing creatures
│
├── shaders/                          # All GLSL co-located by technique
│   ├── water/
│   │   ├── gerstner.vert
│   │   ├── snell-window.frag
│   │   └── caustic-projection.frag
│   ├── fish/
│   │   ├── boid-compute.glsl
│   │   ├── fish-vertex.vert
│   │   └── fish-fragment.frag
│   ├── jellyfish/
│   │   ├── bell-vertex.vert
│   │   └── tentacle-fragment.frag
│   └── atmosphere/
│       ├── god-ray-march.frag
│       ├── voronoi-caustic.frag
│       └── particle-update.glsl
│
├── quality/
│   └── ocean-quality.ts              # GPU detection → entity counts for dynamic systems
│
└── blender/
    ├── ocean_setup.py                # Builds ocean scene in Blender from catalog + placements
    ├── sync_to_scene.py              # Exports Blender → ocean-environment.glb + placements.ts
    └── README.md                     # Workflow reference
```

---

## 4. What Gets Deleted From Current Codebase

| Current file | Why it's gone |
|---|---|
| `scene-configs.ts` (2,305 lines) | No variants. One ocean. Runtime params live in `ocean-quality.ts`. |
| `terrain-height.ts` (162 lines) | Terrain sculpted in Blender, not noise-generated. |
| `placement-cache.ts` (78 lines) | Placements authored, not computed. No cache needed. |
| `reef-ecology.ts` (52 lines) | You place coral by eye in Blender. |
| `poisson-disc.ts` (ocean usage) | Not needed for authored placement. |
| `sdf-generator.ts` (239 lines) | Fish avoidance uses simplified bounding volumes from GLB. |
| `sdf-cache.ts` (130 lines) | No SDF to cache. |
| `scene-sdf-baker.ts` (111 lines) | See above. |
| `ocean-instancing.ts` (276 lines) | BatchedMesh from catalog replaces custom instancing. |
| `procedural-rock.ts` (412 lines) | Rocks are authored models. |
| `RuinsPlatform.svelte` | Baked into `ocean-environment.glb`. |
| `ReefStructures.svelte` (236 lines) | Baked into GLB. |
| All 4 variant config factories | Dead. One ocean. |
| `OceanScene.svelte` (1,865 lines) | Replaced by ~60-line orchestrator. |

**Estimated removal:** ~5,500 lines of placement/terrain/config/instancing code.

---

## 5. OceanScene.svelte (The Orchestrator)

```svelte
<script lang="ts">
  import { useGltf } from "@threlte/extras";
  import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
  import FloraInstances from "./authored/FloraInstances.svelte";
  import OceanRuntimeSystems from "./runtime/OceanRuntimeSystems.svelte";
  import OceanLoading from "./runtime/loading/OceanLoading.svelte";
  import { detectOceanQuality, getOceanQualityConfig } from "./quality/ocean-quality";
  import { useThrelte } from "@threlte/core";

  const { renderer } = useThrelte();
  const quality = $derived(getOceanQualityConfig(detectOceanQuality(renderer.current)));

  const environmentGlb = useGltf("/models/ocean/ocean-environment.glb", {
    meshoptDecoder: MeshoptDecoder,
  });

  const sceneReady = $derived(!!$environmentGlb);
</script>

{#if !sceneReady}
  <OceanLoading />
{:else}
  <!-- Authored static environment -->
  <primitive object={$environmentGlb.scene} />

  <!-- Instanced flora/rocks from catalog + placements.ts -->
  <FloraInstances {quality} />

  <!-- All runtime dynamic systems -->
  <OceanRuntimeSystems {quality} environmentScene={$environmentGlb.scene} />
{/if}
```

~30 lines. The monolith is dead.

---

## 6. Blender Workflow

Extends the cosmic scene pattern already proven:

### Setup (one-time)
1. Claude executes `ocean_setup.py` via Blender MCP
2. Script imports all catalog GLBs, places them per `placements.ts`
3. Creates terrain mesh, hero structures, stage exclusion zone
4. Coordinate conversion: `(x, y, z)_three → (x, -z, y)_blender`

### Iteration loop
1. Austen opens Blender scene, moves/adds/removes flora
2. Sculpts terrain, adjusts hero structures
3. Runs `sync_to_scene.py` → exports `ocean-environment.glb` + updates `placements.ts`
4. Vite hot-reloads → sees changes in browser immediately

### What Claude can do via MCP
- Add new coral placements programmatically
- Adjust terrain displacement
- Generate variations
- Run compression pipeline (meshopt + KTX2)
- Validate scene against quality budget

---

## 7. Runtime Systems Design

### 7.1 Fish System

All current functionality preserved, re-architected:

| File | Responsibility | Lines (target) |
|------|---------------|----------------|
| `FishBoids.svelte` | Svelte mount, lifecycle, quality-based counts | ~60 |
| `fish-compute.ts` | GPGPU boid simulation (separation/alignment/cohesion + obstacle avoidance) | ~300 |
| `fish-render.ts` | Instanced mesh setup, LOD switching, species coloring | ~200 |
| `fish-species.ts` | 8 species definitions, threat/hunt matrices | ~130 |
| `fish-events.ts` | Stimulus system (threat sources, hunt triggers, performer proximity) | ~80 |
| `fish-locomotion.ts` | Per-species/per-behavior locomotion params | ~90 |

**Total: ~860 lines** (down from ~2,000) through elimination of variant-handling code and cleaner separation.

**Obstacle avoidance**: Instead of full SDF baking, fish read simplified bounding spheres from the authored GLB's node metadata. Cheaper, sufficient for convincing avoidance.

### 7.2 Jellyfish System

Verlet physics preserved. Clean file split:

| File | Responsibility | Lines (target) |
|------|---------------|----------------|
| `JellyfishSwarm.svelte` | Mount, spawn count from quality config | ~50 |
| `jellyfish-verlet.ts` | Constraint rope simulation (bell → tentacle chain) | ~250 |
| `jellyfish-geometry.ts` | Procedural bell + tentacle tessellation | ~300 |
| `jellyfish-shaders.ts` | Vertex (pulse) + fragment (translucent + bioluminescent) | ~150 |

**Total: ~750 lines** (down from ~1,300) by removing variant-conditional paths.

### 7.3 Water Surface

Single component, shader-driven:
- Gerstner wave simulation (4-layer composition)
- Snell's window effect (97° critical angle, wave-wobbled)
- Caustic light pattern for surface projection
- Edge fade at scene boundaries

### 7.4 Atmosphere

- **VolumetricGodRays**: `three-good-godrays` (npm package, screen-space raymarched with shadow occlusion). Drop-in replacement for current geometry `GodRayShafts`.
- **ProjectedCaustics**: Wave geometry refraction → projected texture on terrain surfaces. Not screen-space post-process.
- **MarineParticles**: GPU particle system. Sediment, marine snow, bubbles. Quality-scaled count.

### 7.5 Post-Processing (RenderPipeline)

Uses Three.js r183+ `RenderPipeline` (DAG-based, not linear EffectComposer):

```
WaterAbsorption → UnderwaterDistortion → BioluminescenceBloom
         ↘                                      ↗
          ChromaticAberration ──────────────────
```

Effects batched where possible (pmndrs/postprocessing pattern: merge compatible effects into single pass for fewer texture reads).

---

## 8. Quality System

Simplified. Only controls runtime entity counts:

| Parameter | Ultra | Medium | Low |
|-----------|-------|--------|-----|
| Fish count | 200 | 100 | 30 |
| Jellyfish count | 20 | 8 | 0 |
| Particle count | 4000 | 1500 | 500 |
| God ray quality | full | half-res | off |
| Post-processing | all effects | absorption only | off |

Static authored content (terrain, flora, structures) renders the same at all tiers — it's already optimized at export time via meshopt + KTX2.

---

## 9. Migration Strategy

### Phase 1: Scaffold new architecture (non-destructive)
- Create `ocean/` directory structure
- Build `OceanScene.svelte` orchestrator
- Set up Blender scripts (extend cosmic pattern)
- Author initial scene in Blender, export GLB

### Phase 2: Migrate runtime systems
- Extract fish code into `runtime/fauna/fish/` with clean interfaces
- Extract jellyfish into `runtime/fauna/jellyfish/`
- Port water surface, particles, god rays
- Wire up post-processing with RenderPipeline

### Phase 3: Delete old code
- Remove old `OceanScene.svelte` (1,865 lines)
- Remove all procedural placement/terrain/SDF/config code
- Remove variant system entirely
- Delete `scene-configs.ts` ocean sections

### Phase 4: Visual upgrades (post-architecture)
- Upgrade god rays → `three-good-godrays`
- Add projected caustics
- Implement RGB absorption fog
- Art-direct scene in Blender to AAA standard

---

## 10. What This Enables

Once architecture is clean:
- **Volumetric god ray upgrade** = swap one component, touch nothing else
- **New creature type** = add folder under `runtime/fauna/`, mount in `FaunaSystem.svelte`
- **Scene art direction** = Blender only, zero code
- **Performance debugging** = isolate one system, profile independently
- **WebGPU migration** = upgrade shaders per-system, not all-at-once
- **TSL migration** = convert `shaders/` folder incrementally

---

## 11. Dependencies

| Dependency | Purpose | Status |
|---|---|---|
| `three-good-godrays` | Volumetric god rays | npm package, ready |
| `@threlte/extras` useGltf | GLB loading | Already in use |
| Three.js r183+ RenderPipeline | Post-processing DAG | Requires Three.js upgrade check |
| Blender MCP | Scene authoring pipeline | Already working (cosmic precedent) |
| meshopt + KTX2 | Asset compression | Spec exists, tooling needed |
| BatchedMesh (Three.js r178+) | Flora instancing | Requires Three.js version check |

---

## 12. Success Criteria

- [ ] `OceanScene.svelte` under 80 lines
- [ ] No file in `runtime/` over 350 lines
- [ ] All fish functionality preserved (8 species, boids, threat/hunt, scatter, LOD)
- [ ] All jellyfish functionality preserved (verlet, procedural geometry, bioluminescence)
- [ ] Scene loads from Blender-exported GLB
- [ ] Flora placement editable in Blender without code changes
- [ ] Quality system adapts runtime entity counts by GPU tier
- [ ] Post-processing uses RenderPipeline (not EffectComposer)
- [ ] Zero references to variant system remain
- [ ] `npm run check` passes
- [ ] Visual parity with current scene (at minimum) before Phase 4 upgrades
