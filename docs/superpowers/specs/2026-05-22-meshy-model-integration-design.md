# Meshy AI 3D Model Integration — Design Spec

**Date:** 2026-05-22
**Status:** Draft
**Scope:** Compress, optimize, and integrate 14 Meshy AI GLB models (coral formations, rock structures) into the ocean scene
**Revision:** v2 — upgraded with SOTA findings from quality audit (KTX2 textures, mesh simplification, meshopt, BatchedMesh, Meshy Remesh)

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

### Phase 0: Meshy Remesh Pre-Processing

Raw Meshy text-to-3D exports have non-manifold geometry, overlapping UVs, inconsistent winding order, and wildly excessive polygon counts (100K-300K triangles per model). These defects degrade compression ratios and cause visual artifacts under tinting and fog.

**Before running gltf-transform**, re-export each model through Meshy's Smart Remesh tool:

1. **Target polycount:** 10K-20K faces. These are fog-occluded organic shapes viewed at distance — even 10K is generous.
2. Smart Remesh rebuilds clean quad topology with proper edge loops and regenerates UVs, producing geometry that compresses dramatically better downstream.
3. Re-export as GLB with standard textures (2048px is fine — the pipeline resizes later).

**Alternative:** Blender batch script using the Instant Meshes remesher addon for models where Meshy Remesh produces unsatisfactory results. The key requirement is clean, manifold geometry with consistent winding before the gltf-transform pipeline touches it.

### Phase 1: gltf-transform Optimization Pipeline

The pipeline runs four stages in order: **dedup → weld → simplify → compress + texture-compress**.

#### Tool: `@gltf-transform/cli`

The industry standard for GLB optimization. Handles mesh simplification, deduplication, texture compression, and geometry compression in a single pipeline.

#### Stage 1: Dedup + Weld + Simplify

```bash
npx @gltf-transform/cli dedup input.glb temp1.glb
npx @gltf-transform/cli weld temp1.glb temp2.glb
npx @gltf-transform/cli simplify temp2.glb temp3.glb \
  --ratio 0.5 \
  --error 0.001
```

- **dedup** merges duplicate vertex data and joins compatible primitives, reducing draw calls.
- **weld** merges vertices that share position within tolerance, eliminating seams from Meshy's export.
- **simplify** at `--ratio 0.5 --error 0.001` removes 50% of triangles with 0.001 error tolerance. Conservative for fog-occluded organic shapes. Uses meshoptimizer's simplification algorithm under the hood.

Source: gltf-transform simplify() docs, meshoptimizer v1.0

#### Stage 2: Texture Compression — KTX2/Basis Universal

**WebP is replaced by KTX2 with Basis Universal compression.** The difference is fundamental:

| Format | 1024x1024 RGBA | GPU decompression | VRAM footprint |
|---|---|---|---|
| WebP | Decompresses fully to 4 MB VRAM | CPU decode → GPU upload (uncompressed) | 4 MB per texture |
| KTX2 ETC1S | Stays compressed on GPU | Hardware transcodes to native format | ~0.5 MB per texture |
| KTX2 UASTC | Stays compressed on GPU | Hardware transcodes to native format | ~1 MB per texture |

With 12 models x ~3 textures each (~36 textures total), the difference is **~144 MB VRAM (WebP) vs ~18 MB VRAM (KTX2 ETC1S)**. An 8x VRAM reduction. When you add the 10 existing uncompressed models, the savings compound further.

**Codec selection by map type:**
- **ETC1S** for diffuse/color maps and emissive maps — smaller size, lossy compression is invisible on fog-tinted underwater surfaces
- **UASTC** for normal maps and ORM (occlusion/roughness/metalness) maps — higher fidelity preserves surface detail that affects lighting

```bash
npx @gltf-transform/cli texture-compress temp3.glb output.glb \
  --format ktx2 \
  --resize 1024
```

For per-channel codec control, the script selects ETC1S or UASTC based on texture slot (see processing script below).

**Infrastructure requirement:** Add Basis Universal transcoder WASM files to `static/basis/`, mirroring the existing `static/draco/` setup. Three.js ships `KTX2Loader` with an integrated Basis transcoder — load it the same way as the Draco loader.

Source: Khronos Asset Creation Guidelines 2.0 (SIGGRAPH 2025), Don McCurdy's texture format guide

#### Stage 3: Geometry Compression — Meshopt (Primary) or Draco (Fallback)

**meshoptimizer v1.0** (Dec 2025) is the new recommendation over Draco for this use case:

| | Draco | meshopt |
|---|---|---|
| Compression ratio | ~10-12x | ~8-10x (comparable) |
| Client decode speed | Baseline | **2-3x faster** |
| WASM decoder size | ~300 KB | **~40 KB** |
| Morph target support | No | Yes |
| Animation compression | No | Yes |
| Khronos recommendation | "Test both" | "Test both" |

The 40 KB decoder is significant — Draco's 300 KB WASM is a non-trivial cold-start cost, and this scene loads many models in parallel.

```bash
# Primary: meshopt compression
npx @gltf-transform/cli optimize temp3.glb output.glb \
  --compress meshopt \
  --texture-compress ktx2 \
  --texture-resize 1024

# Fallback: Draco (if meshopt produces larger files for specific models)
npx @gltf-transform/cli optimize temp3.glb output.glb \
  --compress draco \
  --texture-compress ktx2 \
  --texture-resize 1024
```

**Decision:** Benchmark both compressors on 2-3 representative models. Use whichever produces smaller files with acceptable decode time. The script supports a `--compressor` flag to switch. If meshopt wins (likely for these organic meshes), the Draco WASM in `static/draco/` is still needed for the existing compressed coral models.

Source: meshoptimizer v1.0 release notes, Khronos Asset Creation Guidelines 2.0

### Compression Targets (Revised)

| Category | Raw Size | After Remesh | After Full Pipeline | Technique |
|---|---|---|---|---|
| Hero coral/rock (new Meshy models) | 18-25 MB each | 5-8 MB each | **0.5-1.5 MB each** | Remesh 15K → dedup → weld → simplify 0.5 → KTX2 1024 → meshopt |
| Existing hero rocks (`rock_0`-`rock_5`) | 18-24 MB each | N/A (skip remesh) | **0.5-1.5 MB each** | dedup → weld → simplify 0.5 → KTX2 1024 → meshopt |
| Existing structures (`structures/*.glb`) | 20-25 MB each | N/A (skip remesh) | **0.5-1.5 MB each** | Same pipeline |
| Small corals, sea life | 0.1-1 MB each | Already fine | No change needed | Already Draco-compressed |

Meshy AI exports textures at 2048x2048 or 4096x4096 — these are underwater objects viewed through fog. 1024x1024 KTX2 textures are more than sufficient; 512x512 is viable for models that only appear at distance.

### Processing Script

Create `scripts/compress-ocean-models.sh`:

```bash
#!/usr/bin/env bash
# Compress Meshy AI GLB exports for ocean scene
# Prerequisites: npm i -g @gltf-transform/cli
# Usage: ./scripts/compress-ocean-models.sh [--compressor meshopt|draco]
#
# Expects models to be pre-processed through Meshy Smart Remesh (10K-20K target)
# before running this script.

set -euo pipefail

COMPRESSOR="${1:---compressor}"
COMPRESSOR="${2:-meshopt}"  # Default to meshopt; pass "draco" to override

INPUT_DIR="D:/Downloads/remeshed"  # Post-Meshy-Remesh exports
OUTPUT_DIR="static/models/ocean/meshy"
TEMP_DIR=$(mktemp -d)

mkdir -p "$OUTPUT_DIR"

for f in "$INPUT_DIR"/Meshy_AI_*.glb; do
  base=$(basename "$f" .glb)
  # Skip the 130+ MB high-res variants (shouldn't exist post-remesh, but safety check)
  [[ $(stat -c%s "$f" 2>/dev/null || stat -f%z "$f") -gt 50000000 ]] && continue
  
  echo "Processing: $base"
  
  # Stage 1: Dedup + Weld + Simplify
  npx @gltf-transform/cli dedup "$f" "$TEMP_DIR/dedup.glb"
  npx @gltf-transform/cli weld "$TEMP_DIR/dedup.glb" "$TEMP_DIR/weld.glb"
  npx @gltf-transform/cli simplify "$TEMP_DIR/weld.glb" "$TEMP_DIR/simplified.glb" \
    --ratio 0.5 \
    --error 0.001
  
  # Stage 2+3: Texture compress (KTX2) + Geometry compress (meshopt or draco)
  npx @gltf-transform/cli optimize "$TEMP_DIR/simplified.glb" "$OUTPUT_DIR/${base}.glb" \
    --compress "$COMPRESSOR" \
    --texture-compress ktx2 \
    --texture-resize 1024
  
  echo "  $(du -h "$OUTPUT_DIR/${base}.glb" | cut -f1) (was $(du -h "$f" | cut -f1))"
done

rm -rf "$TEMP_DIR"

echo ""
echo "Done. Final sizes:"
ls -lh "$OUTPUT_DIR"/*.glb
echo ""
echo "Total:"
du -sh "$OUTPUT_DIR"
```

A second pass should retroactively compress the existing uncompressed models in `static/models/ocean/rock_*.glb` and `static/models/ocean/structures/*.glb` using the same pipeline (skip remesh for these — they're already in production and geometry quality is acceptable).

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
static/basis/                     # NEW — Basis Universal transcoder WASM
    basis_transcoder.js
    basis_transcoder.wasm
```

Short, descriptive names derived from the Meshy prompt. The `meshy/` subdirectory keeps them grouped and distinguishes from the existing hand-curated models.

## Loading Pattern

### KTX2Loader + Meshopt/Draco Decoder Setup

```typescript
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";

// Set up KTX2 loader with Basis transcoder (mirrors existing Draco pattern)
const ktx2Loader = new KTX2Loader()
  .setTranscoderPath("/basis/")
  .detectSupport(renderer);

// If using meshopt compression
const dracoLoader = useDraco("/draco/");  // Still needed for existing Draco-compressed corals
const meshoptDecoder = useMeshopt();       // @threlte/extras meshopt support

const opts = { ktx2Loader, meshoptDecoder };
// OR if staying with Draco: { ktx2Loader, dracoLoader }

// Load each Meshy model
const meshyModels = [
  useGltf("/models/ocean/meshy/basalt_pinnacle.glb", opts),
  useGltf("/models/ocean/meshy/coral_encrusted_rock.glb", opts),
  // ... etc
];
```

### Disposal on Scene Exit

OceanScene already calls `disposeSceneGraph()` from `src/lib/shared/3d/environments/utils/dispose-scene.ts` on every clone in its `onDestroy` handler. New models follow the same pattern — clone, tint, place, push to a cleanup array. KTX2 textures are disposed the same way as standard textures.

### Loading Progress

OceanScene tracks GLB loading progress via `sceneFeatures.reportProgress("environment", loaded/total)`. Adding models to the `glbs` tracking array at line 940 keeps the loading indicator accurate.

## Rendering: BatchedMesh for Draw Call Reduction

### Problem

The current spec places 30-40 individual mesh clones. Each clone is a separate draw call. Combined with existing scene objects, this pushes total draw calls unnecessarily high for what is essentially 12 geometries at different transforms.

### Solution: Three.js BatchedMesh

`BatchedMesh` (stable since r162) renders multiple **different** geometries in a single draw call. Unlike `InstancedMesh` (which the existing OceanScene already uses for procedural rocks — same geometry, different transforms), `BatchedMesh` handles the case where each instance can be a different model.

All 12 Meshy models share material characteristics: they all receive the same underwater tint, same fog attenuation, same lighting. This makes them ideal candidates for batching.

### Implementation

```typescript
import { BatchedMesh, MeshStandardMaterial } from "three";

// After all 12 models load:
const underwaterMaterial = new MeshStandardMaterial({
  // Shared underwater-tinted material
  color: new Color(config.meshyFormations.tintColor),
  // ... fog, roughness, etc.
});

const batchedMesh = new BatchedMesh(
  40,      // max instance count (30-40 placements)
  200000,  // max vertex count across all geometries
  400000,  // max index count across all geometries
  underwaterMaterial
);

// Add each of the 12 unique geometries
const geometryIds: number[] = [];
for (const model of loadedModels) {
  const geo = model.scene.children[0].geometry;
  geometryIds.push(batchedMesh.addGeometry(geo));
}

// Place instances using the placement system
for (const placement of meshyPlacements) {
  const instanceId = batchedMesh.addInstance(geometryIds[placement.modelIdx]);
  const matrix = new Matrix4()
    .makeRotationY(placement.rotation)
    .scale(new Vector3(placement.scale, placement.scale, placement.scale))
    .setPosition(placement.position);
  batchedMesh.setMatrixAt(instanceId, matrix);
}

// Result: 30-40 draw calls → 1 draw call
```

### Fallback

If `BatchedMesh` shows issues with per-model texture variation (each model has its own diffuse map), fall back to grouping models by texture similarity and using 2-3 `BatchedMesh` instances instead of 1. Still a massive reduction from 30-40 individual draw calls.

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
2. **Post-pipeline models will be 0.5-1.5 MB each** — small enough that loading all 12 is feasible.
3. **BatchedMesh collapses draw calls** — the GPU cost is dominated by texture memory (solved by KTX2) and vertex count (solved by remesh + simplify), not draw call overhead.

### What to do instead

- **frustumCulled = true** on all Meshy clones (default in Three.js, costs nothing)
- **Distance-based visibility**: skip rendering clones beyond `backgroundRadius` (already implicit in the zone-based placement system)
- **KTX2 GPU-compressed textures eliminate the VRAM concern** that would have required texture atlasing with WebP

### When to revisit

If GPU profiling shows >16ms frame time with Meshy models loaded, consider:
1. Reducing texture resolution to 512x512 (still KTX2)
2. Further simplification ratio (0.3 instead of 0.5)
3. Adding `mesh.layers.set(CULLING_LAYER)` and camera distance checks in `useTask`

## Additional Models to Generate (Nice-to-Have)

Visual gaps in the current scene that new Meshy generations could fill:

| Model | Role | Why |
|---|---|---|
| Sea fans / gorgonians | Flat branching coral | Catches god rays, adds silhouette variety against open water |
| Tube sponges | Vertical color accent | Bright yellow/orange breaks the blue-green monotony; strong vertical rhythm |
| Shipwreck fragment / anchor | Recognizable human artifact | Adds narrative depth, matches RuinsPlatform thematic layer |
| Giant clam | Near-field detail | Recognizable organic shape near performance area; anchors sense of scale |
| Manta ray / sea turtle | Distant hero creature | Single slow-moving silhouette at fog edge; parallax depth cue |

These are lower priority than integrating the existing 12 models. Generate when the current batch is in-scene and validated.

## Progressive Loading (Nice-to-Have)

Two-phase load strategy to improve perceived performance:

1. **Phase 1 (critical path):** Load landmark models (4-6 models visible through fog at scene entry). These define the visual composition the user sees immediately.
2. **Phase 2 (deferred):** Load cluster-fill and formation-anchor models after `reportReady()` fires. These populate the mid-ground as the user begins interacting.

The existing `sceneFeatures.reportProgress("environment", loaded/total)` infrastructure supports this — Phase 1 models count toward the ready threshold, Phase 2 models load silently in background.

Implementation: split the `meshyModels` array into `landmarkModels` and `fillModels`, load landmarks first with a Promise.all gate, then kick off fill loading.

## Files to Create

| File | Purpose |
|---|---|
| `scripts/compress-ocean-models.sh` | Batch remesh-aware pipeline: dedup → weld → simplify → KTX2 → meshopt |
| `static/models/ocean/meshy/*.glb` | 12 compressed model files |
| `static/basis/basis_transcoder.js` | Basis Universal transcoder (from Three.js examples) |
| `static/basis/basis_transcoder.wasm` | Basis Universal transcoder WASM |

## Files to Modify

| File | Change |
|---|---|
| `src/lib/shared/3d/environments/domain/models/scene-configs.ts` | Add `MeshyModelEntry`, `MeshyFormationsConfig` interfaces; add `meshyFormations` to `OceanSceneConfig`; populate defaults in `createDefaultOceanAbyssConfig()` |
| `src/lib/shared/3d/environments/scenes/OceanScene.svelte` | Add KTX2Loader + meshopt decoder setup; add `useGltf` calls for Meshy models; implement `BatchedMesh` rendering; add `meshyFormations` placement category to `scenePlacements`; add to `onDestroy` cleanup; add to loading progress tracking |

## Execution Order

1. **Remesh models** — run each of the 12 models through Meshy Smart Remesh at 10K-20K target polys
2. **Compress models** — run the pipeline script on remeshed exports, verify output sizes are 0.5-1.5 MB each
3. **Set up Basis transcoder** — copy `basis_transcoder.js` + `.wasm` to `static/basis/`
4. **Compress existing uncompressed models** — retroactively run the pipeline (skip remesh) on `rock_0`-`rock_5` and `structures/*.glb` (saves ~200 MB from the current build)
5. **Add config types** — add interfaces and defaults to `scene-configs.ts`
6. **Wire into OceanScene** — KTX2Loader setup, loading, BatchedMesh rendering, placement, cleanup
7. **Benchmark meshopt vs Draco** — compare file sizes and decode times on 2-3 models, pick the winner
8. **Visual verification** — load scene, confirm models appear at formation sites, check for floating/sinking, verify fog hides distant ones, confirm VRAM usage via Chrome DevTools Performance tab

## Risk: Total Asset Budget (Revised)

After full pipeline (remesh + dedup + weld + simplify + KTX2 + meshopt):

| Category | Raw | After Pipeline | VRAM (KTX2) |
|---|---|---|---|
| 12 new Meshy models | 250 MB | **~12 MB** (1 MB avg) | ~18 MB |
| 6 existing rocks (retroactive) | 120 MB | **~6 MB** | ~9 MB |
| 4 existing structures (retroactive) | 90 MB | **~4 MB** | ~6 MB |
| Existing small models (coral, sea life) | ~25 MB | ~25 MB (no change) | ~10 MB |
| **Total ocean scene** | **~485 MB** | **~47 MB** | **~43 MB VRAM** |

Compare to the original v1 spec's WebP-based estimate of ~70 MB download / ~180+ MB VRAM. The KTX2 + mesh simplification pipeline cuts download size by ~33% and VRAM by ~75%.

The retroactive compression of existing models alone saves ~200 MB of download size. Combined with KTX2's GPU-compressed textures, the entire ocean scene fits comfortably within mobile GPU VRAM budgets (~128-256 MB typical).

### Draw Call Budget

| Approach | Draw Calls for Meshy Models |
|---|---|
| Individual clones (v1 spec) | 30-40 |
| BatchedMesh (v2 spec) | **1-3** |

Combined with existing `InstancedMesh` usage for procedural rocks, the ocean scene's total draw call count stays well within budget for 60fps.
