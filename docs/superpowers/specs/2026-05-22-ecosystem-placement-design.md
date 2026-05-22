# Ocean Ecosystem Placement Redesign

**Date:** 2026-05-22
**Status:** Draft
**Scope:** Placement logic only. No new model types, no new species. Focuses on spatial distribution algorithms that make the existing objects look like a natural reef ecosystem.

## Current State

The ocean scene placement system in `OceanScene.svelte` is already well-architected. It uses:

1. **Poisson disc sampling** (`src/lib/shared/3d/environments/utils/poisson-disc.ts`) for initial formation center placement and scatter fill across zones.
2. **Reef formations** as the organizing unit: each formation has a center, radius, density, dominant species, anchor rock flag, and color hue.
3. **PlacementGrid** for spatial conflict resolution: large items (hero rocks, boulders) register in the grid; small items (coral, kelp, decorations) check against large items but cluster freely among themselves.
4. **Priority-ordered placement**: hero rocks, procedural rocks, boulders, coral, kelp, decorations -- each category respects prior placements.
5. **Sediment mounding** via `terrain-height.ts`: geometry rises around placed objects using cosine-falloff weight functions, simulating sediment accumulation.
6. **Zone-based separation** via `OceanZonesConfig`: stage (clear), clearing (small decorations), reef (rocks/coral/kelp), forest (dense kelp/boulders), background (silhouettes into fog).
7. **Terrain-aware Y placement** via `terrainHeightForPlacement()`: samples center + 4 neighbors and takes the max, preventing objects from sinking into valleys.

This is considerably more sophisticated than a naive random scatter. The foundations are solid.

## What's Wrong

### 1. Formations are uniformly distributed (no density gradient)

`poissonDiscSample` places formation centers with even spacing (`minDistance: 2.5`) across the entire annulus from `clearingRadius + 0.5` to `backgroundRadius - 2`. Real reefs have dense life near structure and sparse sand flats between. The current layout reads as "even polka dots" rather than "patchy reef."

**Evidence:** Lines 173-178 in OceanScene.svelte -- the Poisson call has uniform density. There is a `distFactor` computed (line 185) but it only influences whether a formation is "large" -- it does not modulate formation spacing or count.

### 2. No angular preference (reef is rotationally symmetric)

Real reefs form along current directions. The current system is radially symmetric -- formations are equally likely in any direction. From the camera's default viewing angle, this produces a flat, undifferentiated backdrop with no visual hierarchy.

### 3. Coral placement within formations is pure random-in-circle

Lines 351-367: coral positions within a formation use `rng() * formation.radius` for distance, which clusters toward the center (polar bias). The species mixing is ~70% dominant / 30% random, which is good, but there is no spatial coherence -- corals of the same species should form sub-clusters within a formation, not be individually randomized.

### 4. Kelp patches lack relationship to rock structure

Lines 387-405: kelp patches are offset from formation centers by a random angle and distance, which sometimes places them in open water. Real kelp attaches to hard substrate (rocks). Kelp should preferentially anchor near rock placements.

### 5. Decorations follow ecology rules but lack edge accumulation

Lines 408-449: decorations (starfish near coral, urchins near rock formations, shells in open sand) follow the right ecological logic. But shells accumulate in depressions and against objects in real reefs -- there is no drift-accumulation simulation.

### 6. No slope awareness for placement filtering

`terrainHeightForPlacement` returns the max of 5 samples (center + 4 neighbors), which prevents sinking. But it does not compute slope. Coral grows on hard substrate (rocky slopes), not loose sand (flat areas). Kelp prefers flat areas with stable holdfast positions. There is no slope-based filtering or preference.

### 7. No depth-of-field density modulation

All zones have the same visual density treatment. Near the camera (clearing zone), fewer but larger objects create foreground framing. At mid-distance (reef zone), maximum density creates the "wall of life" effect. At background distance (forest/background zones), objects should thin out and enlarge to create silhouette-scale landmarks. The current system does scale objects by distance somewhat, but the density curve is flat.

## Proposed Changes

### A. Weighted Poisson Disc Sampling (Density Gradient)

Add a `densityBias` function to `poissonDiscSample` that modulates acceptance probability based on position.

**New function signature:**
```typescript
export interface PoissonDiscConfig {
  innerRadius: number;
  outerRadius: number;
  minDistance: number;
  count: number;
  seed: number;
  densityBias?: (x: number, z: number, distanceNorm: number) => number;
  // Returns 0-1 multiplier on acceptance probability.
  // 0 = never accept, 1 = always accept (subject to min distance).
}
```

**Implementation:** After the min-distance check passes, roll `rng() < densityBias(x, z, distanceNorm)`. If the bias function returns 0.3 at a point, 70% of candidates there are rejected even if spacing is clear.

**Reef bias function:** Higher density in the camera-facing hemisphere (negative Z), higher density at reef-zone distance, lower at the far background. Creates a "reef wall" effect behind the performance area.

### B. Angular Preference ("Current Direction")

Add a `preferredAngle` and `angularConcentration` to `OceanZonesConfig`:

```typescript
export interface OceanZonesConfig {
  // ... existing fields ...
  /** Angle (radians) of the dominant reef formation axis. 0 = positive X. */
  reefAxisAngle: number;
  /** 0 = uniform, 1 = all formations cluster along the axis. */
  reefAxisConcentration: number;
}
```

The density bias function uses this to make formations denser along the reef axis (perpendicular to the prevailing "current"), creating a natural reef ridge rather than a uniform ring.

**Default:** `reefAxisAngle: Math.PI` (behind the stage, where the camera sees them), `reefAxisConcentration: 0.4` (moderate preference, not a hard wall).

### C. Species Sub-Clustering Within Formations

Replace the individual coral placement loop (lines 348-367) with a two-level approach:

1. For each formation, generate 2-4 "colony nuclei" using a tight Poisson disc (minDistance 0.5) within the formation radius.
2. Each nucleus inherits the formation's dominant species (or a secondary species at 30% probability).
3. Individual corals are placed around their parent nucleus with gaussian-distributed offset (sigma = 0.3-0.6 meters), inheriting the nucleus species.

This produces the natural "colony patch" pattern -- each reef has a few distinct coral clusters, not a uniform species mix.

### D. Rock-Anchored Kelp Placement

Replace the current "offset from formation center" kelp logic with:

1. For each rock placement (hero rock or procedural rock with scale > 0.15), generate 0-3 kelp positions within 0.5-1.5m of the rock.
2. Probability of kelp near a rock scales with rock size (larger rocks = more holdfast area).
3. Remaining kelp budget fills gaps using the existing Poisson approach but with a preference for areas near any rock (check grid for registered items within 3m).

### E. Slope Computation and Filtering

Add a `terrainSlope` function to `terrain-height.ts`:

```typescript
export function terrainSlope(
  wx: number,
  wz: number,
  stageRadius: number,
  clearingRadius: number,
): number {
  const eps = 0.3;
  const hC = terrainHeight(wx, wz, stageRadius, clearingRadius);
  const hX = terrainHeight(wx + eps, wz, stageRadius, clearingRadius);
  const hZ = terrainHeight(wx, wz + eps, stageRadius, clearingRadius);
  const dx = (hX - hC) / eps;
  const dz = (hZ - hC) / eps;
  return Math.sqrt(dx * dx + dz * dz);  // gradient magnitude, 0 = flat, >0 = sloped
}
```

**Placement rules:**
- Coral: prefer slope > 0.1 (hard substrate, rocky areas). Reject flat sand (slope < 0.05) at 80% rate.
- Kelp: prefer slope < 0.15 (stable flat substrate). Reject steep slopes (slope > 0.3) at 90% rate.
- Shells/starfish: prefer flat areas (slope < 0.1). They settle in depressions.
- Sea urchins: prefer rocky substrate (slope > 0.1). They graze on hard surfaces.

These are soft preferences (probability modulation), not hard gates. A coral can still end up on flat sand at 20% rate, which matches real reef ecology.

### F. Distance-Based Density Curve

Replace the flat density across zones with a bell curve that peaks at the reef zone:

```
Clearing (3-7m):    density multiplier 0.3 (sparse, foreground framing)
Reef inner (7-14m): density multiplier 1.0 (maximum density, "wall of life")
Reef outer (14-18m):density multiplier 0.8 (still dense, start thinning)
Forest (18-22m):    density multiplier 0.5 (fewer, larger objects)
Background (22-24m):density multiplier 0.2 (silhouette-scale only)
```

This is implemented as the `densityBias` function described in (A), using the `distanceNorm` parameter.

### G. Edge Accumulation for Floor Decorations

Add a "drift score" when placing shells: preference for positions adjacent to (within 0.5m of) a registered large object in the PlacementGrid. This simulates current-driven sediment and shell accumulation at the base of rocks and corals.

**Implementation:** After generating a candidate shell position, compute proximity to the nearest registered grid item. If within 0.3-0.8m, boost acceptance probability by 2x. If no nearby object, reduce to 0.5x.

## Config Additions

```typescript
export interface OceanZonesConfig {
  // ... existing fields unchanged ...
  
  /** Angle of dominant reef axis (radians). 0 = +X. Default: PI (behind stage). */
  reefAxisAngle: number;
  /** Angular concentration along reef axis. 0 = uniform, 1 = fully concentrated. */
  reefAxisConcentration: number;
}

export interface OceanSceneConfig {
  // ... existing sections unchanged ...
  
  placement: {
    /** Enable slope-aware placement filtering. */
    slopeAware: boolean;
    /** Enable angular reef concentration. */
    angularBias: boolean;
    /** Enable species sub-clustering within formations. */
    speciesClustering: boolean;
    /** Enable rock-anchored kelp placement. */
    rockAnchoredKelp: boolean;
    /** Enable edge-accumulation for floor decorations. */
    driftAccumulation: boolean;
    /** Distance density curve: 'flat' (current) or 'bell' (proposed). */
    densityCurve: 'flat' | 'bell';
  };
}
```

All placement features default to `true`/`'bell'` for new configs. Existing behavior is recoverable by setting all to `false`/`'flat'`.

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/shared/3d/environments/utils/poisson-disc.ts` | Add `densityBias` parameter to `poissonDiscSample` |
| `src/lib/shared/3d/environments/scenes/ocean/terrain-height.ts` | Add `terrainSlope()` function |
| `src/lib/shared/3d/environments/domain/models/scene-configs.ts` | Add `placement` section to `OceanSceneConfig`, add zone axis fields to `OceanZonesConfig` |
| `src/lib/shared/3d/environments/scenes/OceanScene.svelte` | Refactor `reefFormations`, `scenePlacements` deriveds to use density bias, slope filtering, species clustering, rock-anchored kelp, and drift accumulation |

No new files required. All changes are modifications to existing modules.

## Non-Goals

- **New model types or species** -- separate spec for Meshy models.
- **GPU-side placement** (compute shader instancing) -- the current CPU placement runs once at scene init and produces InstancedMesh; there is no per-frame CPU cost to optimize.
- **LOD / culling** -- the scene already uses InstancedMesh for rocks and fog for distance fade; LOD is a separate concern.
- **Animation changes** -- kelp sway, jellyfish pulse, etc. are unchanged.

## Verification

1. Load ocean scene with default config. Visually confirm: formations cluster along the reef axis behind the stage, not uniformly distributed.
2. Inspect coral formations at close range: each formation should have 2-3 visually distinct species patches, not a uniform mix.
3. Check kelp positions: most kelp should be within 1-2m of a visible rock. No kelp floating in open sand with no nearby structure.
4. Check shell/starfish positions: they should accumulate near the base of rocks and coral structures, not evenly scattered.
5. Toggle `placement.slopeAware` off in Scene Lab: coral should appear on flat sand areas that were previously filtered. Confirms the slope filtering is working.
6. Build passes with no type errors: `npm run check`.
