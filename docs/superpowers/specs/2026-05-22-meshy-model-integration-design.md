# Meshy AI 3D Model Integration — Design Spec

**Date:** 2026-05-22
**Status:** Draft
**Scope:** Compress and integrate 14 Meshy AI GLB models (coral formations, rock structures) into the ocean scene

## Source Assets in `D:\Downloads\`

| File | Size (MB) | Notes |
|---|---|---|
| `Meshy_AI_Basalt_Pinnacle_0522052340_texture.glb` | 19.7 | Rock pillar |
| `Meshy_AI_Coral_Encrusted_Rock__0522052651_texture.glb` | 19.4 | Coral/rock hybrid |
| `Meshy_AI_Coral_Mountain_0522031736_texture.glb` | 137.6 | Large coral — HIGH-RES variant |
| `Meshy_AI_Coral_Mountain_0522032130_texture.glb` | 24.9 | Large coral — standard variant |
| `Meshy_AI_Neon_Coral_Summit_0522033311_texture.glb` | 130.6 | Neon coral — HIGH-RES variant |
| `Meshy_AI_Neon_Coral_Summit_0522033714_texture.glb` | 24.1 | Neon coral — standard variant |
| `Meshy_AI_Submerged_Coral_Citad_0522031713_texture.glb` | 20.0 | Coral citadel |
| `Meshy_AI_Sunlit_Coral_Arch_0522031702_texture.glb` | 20.8 | Arch formation |
| `Meshy_AI_Underwater_Coral_Arch_0522052348_texture.glb` | 18.3 | Arch formation (variant) |
| `Meshy_AI_Underwater_Rock_Table_0522052434_texture.glb` | 18.5 | Table rock |
| `Meshy_AI_Create_a_photorea_0522052518_texture.glb` | 20.1 | Photorealistic coral/rock |
| `Meshy_AI_Create_a_photorea_0522052554_texture.glb` | 20.1 | Photorealistic coral/rock |
| `Meshy_AI_Create_a_photorea_0522052703_texture.glb` | 18.2 | Photorealistic coral/rock |
| `Meshy_AI_Create_a_photorea_0522052852_texture.glb` | 18.2 | Photorealistic coral/rock |

**Total raw size: ~530 MB** (includes two 130+ MB high-res duplicates that should be discarded in favor of the standard variants)

**Usable models: 12** (drop the two high-res 130+ MB variants — they are the same meshes at higher poly count)

## Current State

The ocean scene already loads 18 Meshy-generated GLB models via `useGltf` + `useDraco("/draco/")`:
- 5 coral species (`coral_0.glb` through `coral_3.glb` + `coral_large.glb`) — 0.1-0.2 MB each (already Draco-compressed)
- 6 hero rocks (`rock_0.glb` through `rock_5.glb`) — **18-24 MB each, 120 MB total** (NOT compressed)
- 4 reef structures in `structures/` (`coral-arch.glb`, `reef-wall.glb`, `coral-bommie.glb`, `coral-tower.glb`) — **20-25 MB each, 90 MB total** (NOT compressed)
- Plus sea life models (jellyfish, starfish, etc.) — small, already compressed

The existing rock and structure models are already from Meshy AI and are **not Draco-compressed** — they shipped at raw Meshy export size. The new batch follows the same pattern.

**Critical observation:** Before adding any new models, the existing 10 uncompressed models (6 rocks + 4 structures) totaling 210 MB should be compressed first. Adding 12 more uncompressed models would push total ocean assets above 400 MB.

## Asset Pipeline

### Tool: `@gltf-transform/cli`

The industry standard for GLB optimization in 2026. Handles Draco compression, texture resizing, mesh simplification, and deduplication in a single pipeline.

```bash
npx @gltf-transform/cli optimize input.glb output.glb \
  --compress draco \
  --texture-compress webp \
  --texture-resize 1024
```

### Compression Targets

| Category | Raw Size | Target Size | Technique |
|---|---|---|---|
| Hero coral/rock (new Meshy models) | 18-25 MB each | 1-3 MB each | Draco mesh + WebP textures 1024px |
| Existing hero rocks (`rock_0`-`rock_5`) | 18-24 MB each | 1-3 MB each | Same — these need retroactive compression |
| Existing structures (`structures/*.glb`) | 20-25 MB each | 1-3 MB each | Same — retroactive compression |
| Small corals, sea life | 0.1-1 MB each | Already fine | No change needed |

Meshy AI exports textures at 2048x2048 or 4096x4096 — these are underwater objects viewed through fog. 1024x1024 textures are more than sufficient; 512x512 is viable for models that only appear at distance.

### Processing Script

Create `scripts/compress-ocean-models.sh`:

```bash
#!/usr/bin/env bash
# Compress Meshy AI GLB exports for ocean scene
# Prerequisites: npm i -g @gltf-transform/cli
# Usage: ./scripts/compress-ocean-models.sh

INPUT_DIR="D:/Downloads"
OUTPUT_DIR="static/models/ocean/meshy"

mkdir -p "$OUTPUT_DIR"

for f in "$INPUT_DIR"/Meshy_AI_*.glb; do
  base=$(basename "$f" .glb)
  # Skip the 130+ MB high-res variants
  [[ $(stat -c%s "$f" 2>/dev/null || stat -f%z "$f") -gt 50000000 ]] && continue
  
  echo "Compressing: $base"
  npx @gltf-transform/cli optimize "$f" "$OUTPUT_DIR/${base}.glb" \
    --compress draco \
    --texture-compress webp \
    --texture-resize 1024
done

echo "Done. Check sizes:"
ls -lh "$OUTPUT_DIR"/*.glb
```

A second pass should retroactively compress the existing uncompressed models in `static/models/ocean/rock_*.glb` and `static/models/ocean/structures/*.glb`.

### Output Location

```
static/models/ocean/
  meshy/                          # NEW — Meshy coral/rock formations
    basalt_pinnacle.glb
    coral_encrusted_rock.glb
    coral_mountain.glb
    neon_coral_summit.glb
    submerged_coral_citadel.glb
    sunlit_coral_arch.glb
    underwater_coral_arch.glb
    underwater_rock_table.glb
    photorealistic_coral_0.glb
    photorealistic_coral_1.glb
    photorealistic_coral_2.glb
    photorealistic_coral_3.glb
```

Short, descriptive names derived from the Meshy prompt. The `meshy/` subdirectory keeps them grouped and distinguishes from the existing hand-curated models.

## Loading Pattern

### Lazy Loading with `useGltf` + `useDraco`

The codebase already uses `@threlte/extras` `useGltf` with Draco decoder at `/draco/`. The Draco WASM decoder files already exist in `static/draco/`. No new infrastructure needed.

```typescript
const dracoLoader = useDraco("/draco/");
const opts = { dracoLoader };

// Load each Meshy model
const meshyModels = [
  useGltf("/models/ocean/meshy/basalt_pinnacle.glb", opts),
  useGltf("/models/ocean/meshy/coral_encrusted_rock.glb", opts),
  // ... etc
];
```

### Disposal on Scene Exit

OceanScene already calls `disposeSceneGraph()` from `src/lib/shared/3d/environments/utils/dispose-scene.ts` on every clone in its `onDestroy` handler. New models follow the same pattern — clone, tint, place, push to a cleanup array.

### Loading Progress

OceanScene tracks GLB loading progress via `sceneFeatures.reportProgress("environment", loaded/total)`. Adding models to the `glbs` tracking array at line 940 keeps the loading indicator accurate.

## Placement Strategy

### Reuse the Existing Formation System

OceanScene already has a sophisticated placement system that generates `ReefFormation` centers via Poisson disc sampling, then populates each formation with mixed species. The new Meshy models slot into this as a **new species category** alongside the existing coral and rock categories.

### New Category: "Meshy Formations"

These models are coral/rock formations at a scale between individual coral pieces (0.1-0.5m) and reef structures (3-8m). They work as mid-scale variety pieces:

- **Formation anchors** — replace or supplement hero rocks at formation centers
- **Landmark features** — arches, tables, pinnacles placed as unique pieces at specific scenic spots (similar to how `ReefStructures.svelte` places its 4 models)
- **Cluster fill** — smaller instances scattered near formation centers

### Integration into `scenePlacements`

Add a new placement category to `ScenePlacements`:

```typescript
interface MeshyPlacement extends Placement {
  modelIdx: number;
  category: "formation" | "landmark" | "cluster";
}

interface ScenePlacements {
  // ... existing categories
  meshyFormations: MeshyPlacement[];
}
```

Placement priority: hero rocks > **meshy formations** > procedural rocks > coral > kelp > decorations.

### Placement Rules

1. **Landmarks** (arches, pinnacles, citadel): 4-6 unique placements at background distances (12-22m), each model used once. Similar to `ReefStructures.svelte` placement logic.
2. **Formation anchors**: 8-12 placements at formation centers that don't already have a hero rock. Randomly selected from the 12 models.
3. **Cluster fill**: 15-25 smaller instances (scale 0.3-0.6x) scattered within formation radii, checked against the `PlacementGrid` for large-item clearance.

Total new instances: 30-40 (compared to current 40 hero rocks, 200 procedural rocks, 280 corals).

## Config Interface

### Model Catalog

Add to `scene-configs.ts`:

```typescript
export interface MeshyModelEntry {
  /** Path relative to /models/ocean/meshy/ */
  path: string;
  /** Display name for debug/lab UI */
  name: string;
  /** Base scale multiplier (1.0 = normalize to 1m extent) */
  baseScale: number;
  /** Random Y rotation range [min, max] in radians */
  rotationRange: [number, number];
  /** Placement weight — higher = more likely to be selected */
  weight: number;
  /** Category constraint */
  category: "formation" | "landmark" | "any";
}

export interface MeshyFormationsConfig {
  enabled: boolean;
  /** Max instances to place */
  count: number;
  /** Models to use */
  models: MeshyModelEntry[];
  /** Tint color for underwater color grading */
  tintColor: string;
  /** Tint blend strength (0-1) */
  tintBlend: number;
}
```

Add `meshyFormations: MeshyFormationsConfig` to `OceanSceneConfig`.

### Default Config Values

```typescript
meshyFormations: {
  enabled: true,
  count: 35,
  models: [
    { path: "basalt_pinnacle.glb", name: "Basalt Pinnacle", baseScale: 1.0, rotationRange: [0, Math.PI * 2], weight: 1.0, category: "landmark" },
    { path: "coral_encrusted_rock.glb", name: "Coral Encrusted Rock", baseScale: 0.8, rotationRange: [0, Math.PI * 2], weight: 1.5, category: "formation" },
    { path: "coral_mountain.glb", name: "Coral Mountain", baseScale: 1.2, rotationRange: [0, Math.PI * 2], weight: 1.0, category: "landmark" },
    { path: "neon_coral_summit.glb", name: "Neon Coral Summit", baseScale: 1.0, rotationRange: [0, Math.PI * 2], weight: 1.0, category: "landmark" },
    // ... etc
  ],
  tintColor: "#708898",
  tintBlend: 0.15,
}
```

## LOD Strategy

### Decision: Fog-Based Distance Culling, Not Geometric LOD

Geometric LOD (multiple mesh resolutions per model) is overkill here for three reasons:

1. **Fog density is 0.035** — objects beyond ~20m are barely visible. The fog acts as a natural LOD by hiding distant geometry.
2. **Draco-compressed 1024-texture models will be 1-3 MB each** — small enough that loading all 12 is feasible.
3. **Clone count is modest** (30-40 instances) — the GPU cost is dominated by draw calls and texture memory, not vertex count.

### What to do instead

- **frustumCulled = true** on all Meshy clones (default in Three.js, costs nothing)
- **Distance-based visibility**: skip rendering clones beyond `backgroundRadius` (already implicit in the zone-based placement system)
- **Texture atlas consideration**: if 12 separate textures cause VRAM pressure, a future pass could atlas them into 2-3 sheets. Measure first.

### When to revisit

If GPU profiling shows >16ms frame time with Meshy models loaded, consider:
1. Reducing texture resolution to 512x512
2. Using `InstancedMesh` for models that repeat >5 times (same geometry, different transform)
3. Adding `mesh.layers.set(CULLING_LAYER)` and camera distance checks in `useTask`

## Files to Create

| File | Purpose |
|---|---|
| `scripts/compress-ocean-models.sh` | Batch Draco + WebP compression of Meshy exports |
| `static/models/ocean/meshy/*.glb` | 12 compressed model files |

## Files to Modify

| File | Change |
|---|---|
| `src/lib/shared/3d/environments/domain/models/scene-configs.ts` | Add `MeshyModelEntry`, `MeshyFormationsConfig` interfaces; add `meshyFormations` to `OceanSceneConfig`; populate defaults in `createDefaultOceanAbyssConfig()` |
| `src/lib/shared/3d/environments/scenes/OceanScene.svelte` | Add `useGltf` calls for Meshy models; add `meshyFormations` placement category to `scenePlacements`; add clone/tint/render logic; add to `onDestroy` cleanup; add to loading progress tracking |

## Execution Order

1. **Compress models** — run the compression script, verify output sizes are 1-3 MB each
2. **Compress existing uncompressed models** — retroactively compress `rock_0`-`rock_5` and `structures/*.glb` (saves ~200 MB from the current build)
3. **Add config types** — add interfaces and defaults to `scene-configs.ts`
4. **Wire into OceanScene** — loading, placement, rendering, cleanup
5. **Visual verification** — load scene, confirm models appear at formation sites, check for floating/sinking, verify fog hides distant ones

## Risk: Total Asset Budget

After compression:
- 12 new Meshy models at 2 MB avg = **24 MB**
- 6 existing rocks (retroactively compressed) = **12 MB** (was 120 MB)
- 4 existing structures (retroactively compressed) = **8 MB** (was 90 MB)
- Existing small models (coral, sea life, fish pack) = **~25 MB**
- **Total ocean scene assets: ~70 MB** (down from current 235 MB even with 12 new models)

The retroactive compression alone is a massive win. The new models add variety at negligible marginal cost once compressed.
