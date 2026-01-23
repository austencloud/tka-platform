# Terrain Upgrade Agent Prompts

Five comprehensive prompts for Opus agents to implement terrain system upgrades. Each agent has access to the codebase and can read files, but the research context and repo links are provided here.

---

## 1. SKIRTS Agent: Replace T-Junction Stitching with Skirts

### Task
Replace the complex T-junction stitching system with simpler "skirts" - vertical mesh extensions at chunk edges that hide LOD gaps.

### Research Context

**What are skirts?**
Skirts are vertical "curtains" that drop down from terrain chunk edges. They're the industry-standard solution used by Unity Terrain, Unreal, and most production engines. Instead of trying to perfectly align vertices at different LOD levels (which is mathematically complex), skirts simply hide any gaps by extending geometry below the visible terrain surface.

**Why replace T-junction stitching?**
The current T-junction stitching implementation in TKA is complex (~150 lines of code in the worker), requires tracking neighbor LODs, needs re-stitching when neighbors change, and still has edge cases that cause visual seams. Skirts are simpler, more robust, and eliminate the neighbor coordination problem entirely.

**Reference implementation:**
- https://github.com/bharling/webgl-lod-landscape - Working on skirts for LOD gaps

### Current Implementation to Replace

Read these files to understand what to replace:
- `src/lib/features/realm/workers/chunk-generator.worker.ts` - Contains `interpolateToCoarseEdge()`, `needsStitching()`, and the T-junction stitching logic (lines ~180-270)
- `src/lib/features/realm/core/chunk-manager.ts` - Contains `stitchedNeighborGenerations` Map, `notifyNeighborsOfLoad()`, and restitch coordination (lines ~100-140, 559-614)
- `src/lib/features/realm/generation/gpu/terrain-compute-generator.ts` - Already has `addSkirtGeometry()` method (lines ~799-1027) that can serve as a reference

### Implementation Plan

1. **Remove T-junction stitching from the worker:**
   - Remove `interpolateToCoarseEdge()` function
   - Remove `getEdgeVertexCount()` function
   - Remove `needsStitching()` function
   - Remove all edge vertex height interpolation logic
   - Simplify `generateChunk()` to generate vertices without neighbor awareness

2. **Simplify ChunkManager:**
   - Remove `stitchedNeighborGenerations` Map
   - Remove `recordNeighborGenerations()` method
   - Remove `notifyNeighborsOfLoad()` method
   - Remove `chunksNeedingRestitch` Set and related logic
   - Remove the restitch queue processing in `updateInternal()`

3. **Add skirt geometry in the worker:**
   - Port the `addSkirtGeometry()` pattern from `terrain-compute-generator.ts` to the worker
   - Add skirt vertices at all four edges (not just when neighbors differ)
   - Make skirt depth adaptive: `SKIRT_DEPTH = BASE_DEPTH * pow(2, lod) + variance * 0.5`
   - Ensure skirts copy all vertex attributes (normals, colors, blend weights)

4. **Update NeighborLODs interface:**
   - Remove this interface entirely since skirts don't need neighbor info
   - Update `GenerateChunkMessage` to remove `neighborLODs` field
   - Update `ChunkManager.loadChunk()` to stop passing neighbor LODs

### Success Criteria

- [ ] No visible gaps/seams between chunks at any LOD level
- [ ] Code complexity reduced (T-junction code removed)
- [ ] No neighbor coordination required
- [ ] Performance maintained or improved
- [ ] Build passes (`npm run build`)
- [ ] TypeScript checks pass (`npm run check`)

### Files to Modify

1. `src/lib/features/realm/workers/chunk-generator.worker.ts`
2. `src/lib/features/realm/core/chunk-manager.ts`
3. `src/lib/features/realm/core/hybrid-chunk-manager.ts` (if it exists and extends ChunkManager)

---

## 2. EROSION Agent: Add Erosion Simulation Pass

### Task
Add an optional erosion simulation pass after noise generation to create more natural-looking terrain with realistic river valleys and mountain features.

### Research Context

**What is erosion simulation?**
Instead of pure noise-based terrain, erosion simulation models how water flows across terrain and carves features over time. The basic formula is: "terrain rises while water flows." This creates natural features like:
- V-shaped river valleys
- Drainage networks that flow logically
- Realistic mountain ridges and peaks
- Natural-looking terrain without the "noise blob" appearance

**Reference implementations:**
- https://github.com/GPU-Gang/WebGPU-Erosion-Simulation - WebGPU compute erosion with ping-pong buffers
- https://gitlab.com/veloren/veloren - Rust voxel game with "Large Scale Terrain Generation from Tectonic Uplift and Fluvial Erosion"

**Key technique: Ping-pong buffers**
GPU erosion requires iterative simulation where each frame reads from one buffer and writes to another, then swaps. This avoids read-after-write conflicts.

```
Ping buffer → Compute shader → Pong buffer → Swap → Repeat
```

**Core algorithm (simplified):**
```
for iteration in 0..erosionIterations:
    // 1. Calculate drainage area at each point
    drainage = calculateDrainageArea(heights)

    // 2. Apply erosion based on water flow
    // More drainage = more erosion
    erosionRate = pow(drainage, 0.5) * erosionStrength
    heights -= erosionRate * dt

    // 3. Optional: Add tectonic uplift
    heights += upliftRate * dt
```

### Current Implementation

Read these files to understand the terrain generation pipeline:
- `src/lib/features/realm/generation/gpu/terrain-compute-generator.ts` - GPU terrain generator with TSL compute shaders
- `src/lib/features/realm/generation/gpu/terrain-compute-types.ts` - Configuration types
- `src/lib/features/realm/workers/chunk-generator.worker.ts` - CPU worker terrain generation
- `src/lib/features/realm/generation/seed-generator.ts` - Noise functions

### Implementation Plan

1. **Add erosion configuration:**
   ```typescript
   interface ErosionConfig {
     enabled: boolean;
     iterations: number; // 10-100, more = more realistic but slower
     erosionStrength: number; // How much water erodes
     upliftRate: number; // Tectonic uplift per iteration
     neighborhoodSize: number; // 5x5 or 25x25 for flow direction
   }
   ```

2. **Create ping-pong buffer infrastructure:**
   - Add two height buffers (ping/pong) to TerrainComputeGenerator
   - Add swap mechanism between iterations
   - Ensure proper GPU synchronization

3. **Implement erosion compute shader in TSL:**
   - Calculate steepest descent direction (sample 5x5 neighborhood)
   - Calculate drainage area (accumulate flow from uphill neighbors)
   - Apply erosion: `newHeight = height - erosionRate * pow(drainageArea, 0.5)`
   - Optional: Add uplift

4. **Add CPU fallback erosion:**
   - Implement same algorithm in `generateChunkCPU()` for WebGL fallback
   - Can be simpler (fewer iterations) since it's fallback

5. **Make it optional and configurable:**
   - Off by default (for performance)
   - Expose via terrain config
   - Consider pre-generating erosion for the spawn area only

### Success Criteria

- [ ] Terrain with erosion looks more natural (river valleys, ridge lines)
- [ ] Ping-pong buffer pattern working correctly
- [ ] Optional - can be disabled for performance
- [ ] CPU fallback works when WebGPU unavailable
- [ ] No visual artifacts or stability issues
- [ ] Build and typecheck pass

### Files to Create/Modify

1. `src/lib/features/realm/generation/gpu/terrain-compute-types.ts` - Add ErosionConfig
2. `src/lib/features/realm/generation/gpu/terrain-compute-generator.ts` - Add erosion pass
3. `src/lib/features/realm/workers/chunk-generator.worker.ts` - Add CPU erosion fallback
4. Consider: New file `src/lib/features/realm/generation/gpu/erosion-compute.ts` for erosion-specific code

---

## 3. WATER Agent: Implement Drainage-Based Water System

### Task
Replace the simple flat water plane with a drainage-based water system where water placement is computed from terrain topology.

### Research Context

**Current system:**
The current water is a simple flat plane at a fixed `waterLevel` that follows the camera. This looks unrealistic - water appears where it shouldn't (floating in valleys), and there are no rivers or realistic lake shapes.

**Drainage-based water:**
Instead of arbitrary water placement, compute where water would naturally accumulate based on terrain drainage:
1. Calculate drainage area at each point (how much terrain drains through here)
2. High drainage + low elevation = water (lakes, rivers)
3. Water flows downhill following the drainage network

**Reference:**
- Veloren computes river networks from drainage patterns
- WebGPU-Erosion-Simulation calculates drainage area in compute shader

### Current Implementation

Read these files:
- `src/lib/features/realm/rendering/water.ts` - Current simple WaterManager
- `src/lib/features/realm/workers/chunk-generator.worker.ts` - Where drainage could be computed
- `src/lib/features/realm/generation/gpu/terrain-compute-generator.ts` - GPU generation

### Implementation Plan

1. **Compute drainage area per vertex:**
   - During terrain generation (worker or GPU)
   - For each vertex, count how many uphill vertices drain through it
   - Store as a new vertex attribute or separate buffer

2. **Add drainage-based water masking:**
   - `isWater(drainage, height) = drainage > threshold && height < oceanLevel + tolerance`
   - High drainage areas at low elevation become water
   - This creates realistic lake shapes in valleys

3. **Render water per-chunk:**
   - Instead of one global water plane, each chunk gets water geometry
   - Water mesh only where `isWater` is true
   - Can use the same triplanar material system

4. **Optional: River rendering:**
   - Trace drainage paths downhill from high-drainage points
   - Render as spline-based water strips
   - More complex but creates visible rivers

5. **Keep fallback for performance:**
   - Simple flat plane mode for low-end devices
   - Configurable via settings

### Success Criteria

- [ ] Water appears only in realistic locations (valleys, low areas)
- [ ] Lake shapes follow terrain contours
- [ ] Water respects drainage patterns
- [ ] Fallback to simple water plane available
- [ ] No floating water in illogical places
- [ ] Build and typecheck pass

### Files to Modify

1. `src/lib/features/realm/rendering/water.ts` - Enhance or replace
2. `src/lib/features/realm/workers/chunk-generator.worker.ts` - Add drainage computation
3. `src/lib/features/realm/core/chunk-manager.ts` - Pass drainage data to rendering
4. Consider: New file for per-chunk water mesh generation

---

## 4. BIOMES Agent: Create Multi-Biome System with Blending

### Task
Implement a proper biome system where different regions of the world have distinct terrain types (forest, desert, tundra, etc.) with smooth blending at boundaries.

### Research Context

**Current system:**
Biome is determined purely by height in `getBiomeFromHeight()`:
- Below ocean level → "ocean"
- Above mountain level → "mountains"
- Otherwise → "plains"

This is too simplistic - a world should have varied biomes based on multiple factors.

**Better approach:**
Use Whittaker biome classification based on temperature and precipitation:
- Temperature: Varies with latitude (distance from equator) and altitude
- Precipitation: Varies with noise patterns (rain shadows, etc.)
- The intersection determines biome type

**Reference:**
- THREE.Terrain has GLSL expressions for elevation/slope-based material blending
- Veloren uses altitude + humidity + temperature for biome selection

### Current Implementation

Read these files:
- `src/lib/features/realm/generation/seed-generator.ts` - Contains `getBiome()` function
- `src/lib/features/realm/workers/chunk-generator.worker.ts` - Uses biome for coloring
- `src/lib/features/realm/generation/gpu/terrain-compute-generator.ts` - GPU color computation
- `src/lib/features/realm/rendering/terrain-splat-material.ts` - Material blending

### Implementation Plan

1. **Define biome types:**
   ```typescript
   enum BiomeType {
     Ocean,
     Beach,
     Desert,
     Savanna,
     TropicalForest,
     Grassland,
     TemperateForest,
     Taiga,
     Tundra,
     Mountain,
     SnowyMountain
   }
   ```

2. **Add temperature and precipitation noise:**
   - Temperature: Large-scale noise + latitude factor + altitude reduction
   - Precipitation: Separate noise layer at different frequency
   - Both should be continuous for smooth biome boundaries

3. **Implement Whittaker-style biome lookup:**
   ```typescript
   function getBiome(temperature: number, precipitation: number, height: number): BiomeType {
     if (height < oceanLevel) return BiomeType.Ocean;
     if (height < oceanLevel + 5) return BiomeType.Beach;
     if (height > snowLine) return BiomeType.SnowyMountain;

     // Whittaker diagram lookup
     if (temperature > 0.7) {
       return precipitation > 0.6 ? BiomeType.TropicalForest : BiomeType.Desert;
     }
     // ... etc
   }
   ```

4. **Update blend weights per biome:**
   - Each biome has characteristic blend weights (sand for desert, grass for forest, etc.)
   - Blend smoothly at biome boundaries using the temperature/precipitation gradients

5. **Update vegetation density per biome:**
   - Forests: High tree density
   - Desert: Sparse vegetation, cacti
   - Tundra: Low shrubs only
   - Ocean: No vegetation

### Success Criteria

- [ ] Multiple distinct biomes visible when exploring
- [ ] Smooth transitions between biomes (no hard edges)
- [ ] Temperature/precipitation-based selection
- [ ] Biome-appropriate vegetation density
- [ ] Build and typecheck pass

### Files to Modify

1. `src/lib/features/realm/generation/seed-generator.ts` - Enhance getBiome()
2. `src/lib/features/realm/workers/chunk-generator.worker.ts` - Update biome coloring
3. `src/lib/features/realm/generation/gpu/terrain-compute-generator.ts` - GPU biome computation
4. Consider: New file `src/lib/features/realm/generation/biome-system.ts`

---

## 5. VEGETATION Agent: Implement ScatterMeshes-Style Vegetation Placement

### Task
Improve vegetation placement with deterministic, terrain-aware scattering that respects biomes, slopes, and density rules.

### Research Context

**Current system:**
Vegetation is placed with pseudo-random placement in `generateVegetation()`:
- Random density threshold
- Basic height filtering (no underwater, no high altitude)
- Type selection by random value ranges

**ScatterMeshes pattern (from THREE.Terrain):**
A more sophisticated approach where vegetation placement is:
1. **Deterministic** - Same seed always produces same result
2. **Terrain-aware** - Respects slope (no trees on cliffs), moisture, etc.
3. **Biome-specific** - Desert has cacti, forest has trees
4. **Density-controlled** - Configurable density per vegetation type
5. **Collision-avoiding** - Vegetation doesn't overlap

**Reference:**
- https://github.com/IceCreamYou/THREE.Terrain - `ScatterMeshes()` function

### Current Implementation

Read these files:
- `src/lib/features/realm/generation/gpu/terrain-compute-generator.ts` - `generateVegetation()` method (lines ~710-788)
- `src/lib/features/realm/workers/chunk-generator.worker.ts` - Worker vegetation generation
- `src/lib/features/realm/core/realm-config.ts` - Vegetation types

### Implementation Plan

1. **Define vegetation rules per biome:**
   ```typescript
   interface VegetationRule {
     type: VegetationType;
     biomes: BiomeType[]; // Which biomes this appears in
     density: number; // 0-1, how common
     minSlope: number; // 0-1, minimum slope (0 = flat only)
     maxSlope: number; // 0-1, maximum slope
     minHeight: number; // Minimum terrain height
     maxHeight: number; // Maximum terrain height
     minSpacing: number; // Minimum distance between instances
     scaleRange: [number, number]; // [min, max] scale
   }
   ```

2. **Implement Poisson disk sampling:**
   - Instead of uniform random, use Poisson disk for even spacing
   - Respects `minSpacing` per vegetation type
   - More natural-looking than random distribution

3. **Add slope-based filtering:**
   - Calculate slope from normal: `slope = 1 - normal.y`
   - Filter out vegetation on steep slopes
   - Different types have different slope tolerances

4. **Biome-specific vegetation lists:**
   ```typescript
   const BIOME_VEGETATION: Record<BiomeType, VegetationType[]> = {
     [BiomeType.TemperateForest]: ['tree1', 'tree2', 'bush1', 'grass'],
     [BiomeType.Desert]: ['cactus', 'rock1', 'rock2'],
     [BiomeType.Tundra]: ['bush2', 'grass', 'rock1'],
     // ...
   };
   ```

5. **Optimize placement:**
   - Pre-calculate valid placement zones per chunk
   - Use spatial hashing for collision detection
   - Consider GPU-based placement for large worlds

### Success Criteria

- [ ] Vegetation respects biome types
- [ ] No trees on steep cliffs
- [ ] Even, natural-looking distribution (not random clumps)
- [ ] Configurable density per type
- [ ] Deterministic (same seed = same result)
- [ ] Build and typecheck pass

### Files to Modify

1. `src/lib/features/realm/generation/gpu/terrain-compute-generator.ts` - Enhance `generateVegetation()`
2. `src/lib/features/realm/workers/chunk-generator.worker.ts` - Worker vegetation
3. `src/lib/features/realm/core/realm-config.ts` - Add vegetation rules
4. Consider: New file `src/lib/features/realm/generation/vegetation-scatter.ts`

---

## Usage Notes

Each prompt is self-contained with:
- Task description
- Research context and repo links
- Current implementation files to read
- Implementation plan
- Success criteria
- Files to modify

The agents should:
1. Read the current implementation files first
2. Understand the existing patterns
3. Follow the implementation plan
4. Run `npm run build` and `npm run check` to verify
5. Report success criteria status

Recommended execution order:
1. **Skirts** first (simplifies the codebase)
2. **Erosion** (foundation for better terrain)
3. **Biomes** (depends on terrain)
4. **Water** (depends on terrain and drainage)
5. **Vegetation** (depends on biomes)

However, agents 2-5 are largely independent and can run in parallel if needed.
