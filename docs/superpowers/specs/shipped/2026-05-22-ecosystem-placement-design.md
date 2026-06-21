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

### 3. All species treated identically across depth zones

Real reef ecology shows strong depth zonation driven by light attenuation and wave energy. Branching corals (Acropora-type) dominate shallow, high-light zones. Massive and encrusting corals dominate deeper, low-light zones. Soft corals thrive in current-exposed areas. The current system picks species with a flat 70/30 dominant/random split regardless of where in the depth gradient a formation sits.

**Literature:** Bongaerts et al., Royal Society 2015 (Symbiodinium endosymbiont zonation drives coral depth distribution). Li 2021, "Procedural Modeling of the Great Barrier Reef" (Springer) -- species selection weighted by normalized depth produces the single biggest visual difference between "real reef" and "random scatter."

### 4. Coral placement within formations is pure random-in-circle

Lines 351-367: coral positions within a formation use `rng() * formation.radius` for distance, which clusters toward the center (polar bias). The species mixing is ~70% dominant / 30% random, which is good, but there is no spatial coherence -- corals of the same species should form sub-clusters within a formation, not be individually randomized.

### 5. Kelp patches lack relationship to rock structure and current direction

Lines 387-405: kelp patches are offset from formation centers by a random angle and distance, which sometimes places them in open water. Real kelp attaches to hard substrate (rocks). Additionally, `rotY` is fully random. ABZU's GDC 2017 talk ("Creating the Art of ABZU") describes kelp forests integrated with a dominant current direction -- kelp leans and sways aligned to prevailing flow, creating the iconic "wall of kelp" silhouette that reads immediately as underwater.

### 6. Decorations follow ecology rules but lack edge accumulation

Lines 408-449: decorations (starfish near coral, urchins near rock formations, shells in open sand) follow the right ecological logic. But shells accumulate in depressions and against objects in real reefs -- there is no drift-accumulation simulation.

### 7. No slope awareness for placement filtering

`terrainHeightForPlacement` returns the max of 5 samples (center + 4 neighbors), which prevents sinking. But it does not compute slope. Coral grows on hard substrate (rocky slopes), not loose sand (flat areas). Kelp prefers flat areas with stable holdfast positions. There is no slope-based filtering or preference.

### 8. No depth-of-field density modulation

All zones have the same visual density treatment. Near the camera (clearing zone), fewer but larger objects create foreground framing. At mid-distance (reef zone), maximum density creates the "wall of life" effect. At background distance (forest/background zones), objects should thin out and enlarge to create silhouette-scale landmarks. The current system does scale objects by distance somewhat, but the density curve is flat.

### 9. Reef macro-shape is a Poisson ring (polka dots, not organic boundary)

The angular bias proposed below only partially addresses the "even polka dots" problem. A reef's macro-shape is fractal and branching -- fingers of coral extending into sand, with sand channels cutting back into the reef. Uniform Poisson sampling, even with angular weighting, still produces a smooth, regular boundary.

## Proposed Changes

### A. DLA Reef Macro-Shape (Organic Boundary)

**Replaces simple angular bias as the primary macro-structure tool.**

Diffusion-Limited Aggregation grows organic, branching reef shapes with fractal boundaries -- dramatically more natural than Poisson-spaced circles with angular weighting.

**Algorithm:** A 2D grid-based DLA pre-pass (~40 lines):

1. Initialize a grid (e.g., 64x64 covering the reef annulus, each cell ~0.75m).
2. Seed 3-5 "reef nucleation points" behind the stage (negative Z hemisphere, biased toward `reefAxisAngle`). Mark those cells as `reef`.
3. Release random walkers from the grid boundary. Each walker steps randomly (4-connected) until it lands adjacent to a `reef` cell -- then it sticks and becomes `reef` itself.
4. Run ~800-1200 walkers (tunable via `dlaWalkerCount`). The result is a branching, fractal reef boundary.
5. Smooth the mask once (3x3 majority filter) to remove single-cell peninsulas that would look like isolated dots at render scale.

**Integration with Poisson:** After the DLA pass, the `densityBias` function checks the DLA mask:
- Formation center inside DLA boundary: acceptance probability = `densityBias(distanceNorm)` (full)
- Formation center outside DLA boundary: acceptance probability = `densityBias(distanceNorm) * 0.1` (10% leak-through for scattered outlier formations, which real reefs have)

This replaces the `angularConcentration` parameter -- the DLA seeds already cluster behind the stage, and the organic boundary encodes far more structure than a cosine angular weight could.

**Source:** Li 2021, "Procedural Modeling of the Great Barrier Reef" (Springer) -- DLA used for reef macro-shape with parameterized seed placement and walker counts.

```typescript
interface DLAConfig {
  /** Grid resolution. Higher = finer fractal detail, more compute. */
  gridSize: number;          // default: 64
  /** Number of random walkers to release. More = denser reef. */
  walkerCount: number;       // default: 1000
  /** Seed points for reef nucleation (normalized annulus coordinates). */
  seeds: Array<{ angle: number; distanceNorm: number }>;
  /** Acceptance multiplier for formations outside the DLA boundary. */
  outsideLeakFactor: number; // default: 0.1
}
```

### B. Weighted Poisson Disc Sampling (Density Gradient)

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

**Reef bias function:** Combines the DLA mask lookup (Section A) with the distance density curve (Section F). The DLA mask provides macro-shape; the density curve provides the depth falloff.

### C. Depth-Based Species Zonation

**The single biggest "real reef vs random" differentiator.** Add `depthPreference` per species index in coral config.

Real reef ecology shows strong depth zonation:
- **Shallow / high-light zone** (distanceNorm 0.0-0.4): branching corals dominate (Acropora-type). High light, high wave energy favors fast-growing branching morphology.
- **Mid-depth zone** (distanceNorm 0.3-0.7): mixed assemblage. Branching and massive corals coexist.
- **Deep / low-light zone** (distanceNorm 0.6-1.0): massive and encrusting corals dominate. Plate corals that maximize light capture surface area.
- **Current-exposed areas**: soft corals (sea fans, whips) that flex with water movement.

**Config addition (~10 lines):**
```typescript
export interface CoralSpeciesConfig {
  /** Index into the instanced mesh array. */
  speciesIndex: number;
  /** Normalized depth preference range [min, max].
   *  0.0 = shallowest reef zone, 1.0 = deepest/farthest.
   *  Species weight is 1.0 inside the range, falls off with gaussian tails outside. */
  depthPreference: [number, number];
  /** Optional: preference multiplier in high-current areas. Default 1.0. */
  currentAffinity?: number;
}

// Example config:
const coralSpecies: CoralSpeciesConfig[] = [
  { speciesIndex: 0, depthPreference: [0.0, 0.4] },  // branching (shallow)
  { speciesIndex: 1, depthPreference: [0.2, 0.6] },  // mixed branching
  { speciesIndex: 2, depthPreference: [0.4, 0.8] },  // massive/boulder
  { speciesIndex: 3, depthPreference: [0.6, 1.0] },  // encrusting/plate
  { speciesIndex: 4, depthPreference: [0.3, 0.9], currentAffinity: 2.0 },  // soft coral (fans)
];
```

**Placement integration:** When selecting species for a formation at `distanceNorm` d:

```typescript
function speciesWeight(species: CoralSpeciesConfig, d: number): number {
  const [lo, hi] = species.depthPreference;
  if (d >= lo && d <= hi) return 1.0;
  // Gaussian falloff outside preferred range (sigma = 0.15)
  const dist = d < lo ? lo - d : d - hi;
  return Math.exp(-(dist * dist) / (2 * 0.15 * 0.15));
}

// Weighted random selection from species array
function selectSpecies(species: CoralSpeciesConfig[], distanceNorm: number, rng: () => number): number {
  const weights = species.map(s => speciesWeight(s, distanceNorm));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return species[i].speciesIndex;
  }
  return species[species.length - 1].speciesIndex;
}
```

This replaces the flat 70/30 dominant/random species selection with ecologically-motivated depth zonation. The gaussian falloff ensures soft transitions between zones -- no hard species boundaries.

**Source:** Bongaerts et al., Royal Society 2015; Li 2021 (Springer).

### D. Current-Driven Kelp Orientation

Add a global `currentDirection` to ocean config. Kelp `rotY` is biased toward the current direction using a von Mises distribution instead of uniform random.

**Config addition:**
```typescript
export interface OceanSceneConfig {
  // ... existing fields ...
  /** Dominant current direction as a 2D unit vector on the XZ plane. */
  currentDirection: { x: number; z: number };  // default: { x: 0, z: -1 } (toward camera)
}
```

**Kelp rotation (~5 lines of change):**
```typescript
// Von Mises sampling: concentration kappa ~ 2.0 gives ±45° spread
const currentAngle = Math.atan2(config.currentDirection.z, config.currentDirection.x);
const kappa = 2.0;
// Approximate von Mises: rejection sampling or use the wrapped normal approximation
const rotY = vonMisesSample(currentAngle, kappa, rng);
```

**Sway animation DC offset:** The existing kelp sway shader/animation gets a constant DC offset in the current direction. Instead of oscillating symmetrically around vertical, kelp oscillates around a lean angle (e.g., 5-10 degrees toward current). This is a uniform parameter, not per-instance.

The visual effect: kelp fronds create a coherent "wall" leaning in one direction rather than a random tangle. This is the signature look of real kelp forests and was specifically called out in the ABZU GDC 2017 talk as a key readability improvement.

**Source:** ABZU GDC 2017, "Creating the Art of ABZU."

### E. Species Sub-Clustering Within Formations

Replace the individual coral placement loop (lines 348-367) with a two-level approach:

1. For each formation, generate 2-4 "colony nuclei" using a tight Poisson disc (minDistance 0.5) within the formation radius.
2. Each nucleus inherits the formation's dominant species (or a secondary species at 30% probability). Species selected via depth-weighted selection (Section C) rather than flat random.
3. Individual corals are placed around their parent nucleus with gaussian-distributed offset (sigma = 0.3-0.6 meters), inheriting the nucleus species.

This produces the natural "colony patch" pattern -- each reef has a few distinct coral clusters, not a uniform species mix.

### F. Rock-Anchored Kelp Placement

Replace the current "offset from formation center" kelp logic with:

1. For each rock placement (hero rock or procedural rock with scale > 0.15), generate 0-3 kelp positions within 0.5-1.5m of the rock.
2. Probability of kelp near a rock scales with rock size (larger rocks = more holdfast area).
3. Remaining kelp budget fills gaps using the existing Poisson approach but with a preference for areas near any rock (check grid for registered items within 3m).
4. All kelp rotations use current-biased von Mises distribution (Section D).

### G. Slope Computation and Filtering

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

### H. Distance-Based Density Curve

Replace the flat density across zones with a bell curve that peaks at the reef zone:

```
Clearing (3-7m):    density multiplier 0.3 (sparse, foreground framing)
Reef inner (7-14m): density multiplier 1.0 (maximum density, "wall of life")
Reef outer (14-18m):density multiplier 0.8 (still dense, start thinning)
Forest (18-22m):    density multiplier 0.5 (fewer, larger objects)
Background (22-24m):density multiplier 0.2 (silhouette-scale only)
```

This is implemented as part of the `densityBias` function described in (B), using the `distanceNorm` parameter. Combined with the DLA mask (Section A), the final acceptance probability is:

```
P(accept) = dlaMask(x, z) * densityCurve(distanceNorm) * minDistanceCheck
```

### I. Edge Accumulation for Floor Decorations

Add a "drift score" when placing shells: preference for positions adjacent to (within 0.5m of) a registered large object in the PlacementGrid. This simulates current-driven sediment and shell accumulation at the base of rocks and corals.

**Implementation:** After generating a candidate shell position, compute proximity to the nearest registered grid item. If within 0.3-0.8m, boost acceptance probability by 2x. If no nearby object, reduce to 0.5x.

## Explicitly Rejected Approaches

### Wave Function Collapse (WFC)

WFC excels at tile-based layouts (rooms, terrains with discrete tiles, 2D maps) where adjacency constraints between tiles produce globally consistent patterns. However, it is a poor fit for organic scatter in continuous space:

1. **Discretization overhead:** Reef placement operates in continuous 2D space. WFC requires discretizing into a tile grid, defining adjacency rules for each tile type, and then mapping back to continuous positions. The DLA + weighted Poisson approach works natively in continuous space.
2. **Over-constraint:** WFC enforces hard adjacency rules (tile A can only neighbor tile B). Reef ecology has soft, probabilistic co-occurrence -- a branching coral is *more likely* near a massive coral, not *required* to be. The weighted Poisson approach handles soft preferences naturally.
3. **Backtracking cost:** WFC with many tile types in large grids can require expensive backtracking. The DLA + Poisson pipeline runs in a single forward pass with no backtracking.
4. **Shape mismatch:** WFC produces rectilinear patterns aligned to the tile grid. Reef formations are curved, branching, and fractal. DLA produces exactly these shapes natively.

The weighted Poisson + DLA macro-shape + formation hierarchy is the correct architecture for this problem. This decision is documented here so nobody proposes WFC for reef placement later.

## Config Additions

```typescript
export interface OceanZonesConfig {
  // ... existing fields unchanged ...

  /** Angle of dominant reef axis (radians). 0 = +X. Default: PI (behind stage). */
  reefAxisAngle: number;
}

export interface DLAConfig {
  /** Grid resolution. Higher = finer fractal detail. Default: 64. */
  gridSize: number;
  /** Number of random walkers. More = denser reef boundary. Default: 1000. */
  walkerCount: number;
  /** Seed points for reef nucleation (angle in radians, distanceNorm 0-1). */
  seeds: Array<{ angle: number; distanceNorm: number }>;
  /** Acceptance multiplier for formations outside the DLA boundary. Default: 0.1. */
  outsideLeakFactor: number;
}

export interface CoralSpeciesConfig {
  speciesIndex: number;
  /** Normalized depth preference [min, max]. 0 = shallowest, 1 = deepest. */
  depthPreference: [number, number];
  /** Multiplier in high-current areas. Default: 1.0. */
  currentAffinity?: number;
}

export interface OceanSceneConfig {
  // ... existing sections unchanged ...

  /** Dominant current direction on XZ plane (unit vector). Default: { x: 0, z: -1 }. */
  currentDirection: { x: number; z: number };

  /** DLA reef macro-shape configuration. */
  dla: DLAConfig;

  /** Per-species depth zonation config. */
  coralSpecies: CoralSpeciesConfig[];

  placement: {
    /** Enable slope-aware placement filtering. */
    slopeAware: boolean;
    /** Enable DLA reef macro-shape (replaces angular bias). */
    dlaMacroShape: boolean;
    /** Enable depth-based species zonation. */
    depthZonation: boolean;
    /** Enable current-driven kelp orientation. */
    currentDrivenKelp: boolean;
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
| `src/lib/shared/3d/environments/domain/models/scene-configs.ts` | Add `DLAConfig`, `CoralSpeciesConfig`, `placement` section to `OceanSceneConfig`, `currentDirection`, zone axis fields |
| `src/lib/shared/3d/environments/scenes/OceanScene.svelte` | Refactor `reefFormations`, `scenePlacements` deriveds to use DLA mask, density bias, slope filtering, depth-zonated species selection, current-driven kelp rotation, species clustering, rock-anchored kelp, and drift accumulation |
| `src/lib/shared/3d/environments/utils/dla.ts` | **New file.** ~40 lines: 2D grid-based DLA with seed placement, random walkers, majority-filter smoothing. Pure function, deterministic given seed. |

## Nice-to-Haves (Future Work)

These are documented for future reference but not required for the initial implementation.

### Bridson's Grid Optimization for Poisson Sampling

The current `poissonDiscSample` uses brute-force O(n^2) neighbor checks. Bridson's algorithm uses a background grid with cell size `minDistance / sqrt(2)` to achieve O(1) neighbor lookups. At current formation counts (~30-60 formations), the brute-force is fast enough. If formation counts grow past ~200 (e.g., for ultra-dense reef configs), switch to Bridson's.

**Reference:** Robert Bridson, "Fast Poisson Disk Sampling in Arbitrary Dimensions" (SIGGRAPH 2007 sketch).

### Inter-Species Co-Occurrence Table

A 5x5 matrix biasing secondary species selection based on nearby already-placed species. For example: if a branching coral colony is already placed, increase the probability of encrusting coral in adjacent nuclei (branching corals create substrate for encrusting species). This models successional ecology.

```typescript
// Example co-occurrence affinities (row = existing neighbor, col = candidate)
const coOccurrence = [
  //  branch  mixed  massive  encrust  soft
  [   0.5,    0.8,   0.6,     1.2,     0.3  ],  // near branching
  [   0.8,    0.5,   0.9,     0.7,     0.5  ],  // near mixed
  [   0.6,    0.9,   0.5,     1.0,     0.8  ],  // near massive
  [   1.2,    0.7,   1.0,     0.5,     0.6  ],  // near encrusting
  [   0.3,    0.5,   0.8,     0.6,     0.5  ],  // near soft coral
];
```

The depth zonation (Section C) already provides the dominant species-selection signal. Co-occurrence would add a secondary refinement. Implement only if depth zonation alone doesn't produce enough visual variety within a single depth band.

### GPU-Side Placement

If the total placed item count exceeds ~5000 instances, the CPU placement pass (~50ms currently) could become noticeable. At that scale, a compute shader could run the Poisson + DLA + slope checks on the GPU in <1ms. Flag for future, but current counts (~800-1500 instances) are well within CPU budget.

## Non-Goals

- **New model types or species** -- separate spec for Meshy models.
- **LOD / culling** -- the scene already uses InstancedMesh for rocks and fog for distance fade; LOD is a separate concern.
- **Animation changes** -- kelp sway DC offset (Section D) is the only animation touch. Jellyfish pulse, fish schooling, etc. are unchanged.

## Verification

1. Load ocean scene with default config. Visually confirm: reef forms an organic, branching shape behind the stage -- not a uniform ring or evenly-spaced dots. Sand channels should visibly cut into the reef boundary.
2. Inspect coral formations at varying distances: near formations should be dominated by branching species; far formations should show massive/encrusting species. The transition should be gradual, not a hard line.
3. Inspect coral formations at close range: each formation should have 2-3 visually distinct species patches (colony nuclei), not a uniform mix.
4. Check kelp positions: most kelp should be within 1-2m of a visible rock. No kelp floating in open sand with no nearby structure.
5. Check kelp orientation: all kelp fronds should lean in approximately the same direction (current direction). Not perfectly aligned -- there should be ~45 degrees of spread -- but clearly biased.
6. Check shell/starfish positions: they should accumulate near the base of rocks and coral structures, not evenly scattered.
7. Toggle `placement.dlaMacroShape` off in Scene Lab: reef should revert to uniform Poisson ring. Confirms the DLA boundary is driving the organic shape.
8. Toggle `placement.depthZonation` off: species should revert to flat random selection regardless of distance. Confirms depth zonation is working.
9. Build passes with no type errors: `npm run check`.
