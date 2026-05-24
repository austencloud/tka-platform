# Ocean Ecosystem Placement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace uniform reef scatter with ecologically-motivated placement: DLA-grown organic reef boundary, depth-zonated species, current-driven kelp orientation, slope-aware filtering, and distance-based density curves.

**Architecture:** Infrastructure-first approach. Pure utility functions (DLA, slope, species selection, von Mises) are built and tested in isolation, then wired into OceanScene's `reefFormations` and `scenePlacements` deriveds. Config types extended first so all new fields exist before code references them.

**Tech Stack:** TypeScript, Svelte 5, three.js (placement math only — no rendering changes)

**Spec:** `docs/superpowers/specs/2026-05-22-ecosystem-placement-design.md`

---

### Task 1: Config Type Extensions

**Files:**
- Modify: `src/lib/shared/3d/environments/domain/models/scene-configs.ts`

Adds DLA config, coral species config, placement feature flags, current direction, and reef axis angle to the ocean scene config types and defaults.

- [ ] **Step 1: Add new interfaces and extend OceanZonesConfig**

Add after the `OceanZonesConfig` interface closing brace (~line 314):

```typescript
export interface DLAConfig {
  gridSize: number;
  walkerCount: number;
  seeds: Array<{ angle: number; distanceNorm: number }>;
  outsideLeakFactor: number;
}

export interface CoralSpeciesConfig {
  speciesIndex: number;
  depthPreference: [number, number];
  currentAffinity?: number;
}

export interface PlacementConfig {
  slopeAware: boolean;
  dlaMacroShape: boolean;
  depthZonation: boolean;
  currentDrivenKelp: boolean;
  speciesClustering: boolean;
  rockAnchoredKelp: boolean;
  driftAccumulation: boolean;
  densityCurve: 'flat' | 'bell';
}
```

Add `reefAxisAngle: number;` to `OceanZonesConfig` (after `backgroundRadius`).

- [ ] **Step 2: Extend OceanSceneConfig**

Add these fields to the `OceanSceneConfig` interface (after `platform`):

```typescript
  currentDirection: { x: number; z: number };
  dla: DLAConfig;
  coralSpecies: CoralSpeciesConfig[];
  placement: PlacementConfig;
```

- [ ] **Step 3: Add defaults to createDefaultOceanReefConfig**

In the reef config factory, add defaults for all new fields:

```typescript
    zones: {
      // ... existing fields ...
      reefAxisAngle: Math.PI, // behind stage
    },
    // ... after platform ...
    currentDirection: { x: 0, z: -1 },
    dla: {
      gridSize: 64,
      walkerCount: 1000,
      seeds: [
        { angle: Math.PI, distanceNorm: 0.3 },
        { angle: Math.PI * 0.8, distanceNorm: 0.5 },
        { angle: Math.PI * 1.2, distanceNorm: 0.4 },
        { angle: Math.PI * 0.6, distanceNorm: 0.6 },
      ],
      outsideLeakFactor: 0.1,
    },
    coralSpecies: [
      { speciesIndex: 0, depthPreference: [0.0, 0.4] },
      { speciesIndex: 1, depthPreference: [0.2, 0.6] },
      { speciesIndex: 2, depthPreference: [0.4, 0.8] },
      { speciesIndex: 3, depthPreference: [0.6, 1.0] },
      { speciesIndex: 4, depthPreference: [0.3, 0.9], currentAffinity: 2.0 },
      { speciesIndex: 5, depthPreference: [0.0, 0.5] },
      { speciesIndex: 6, depthPreference: [0.3, 0.7] },
      { speciesIndex: 7, depthPreference: [0.5, 1.0] },
    ],
    placement: {
      slopeAware: true,
      dlaMacroShape: true,
      depthZonation: true,
      currentDrivenKelp: true,
      speciesClustering: true,
      rockAnchoredKelp: true,
      driftAccumulation: true,
      densityCurve: 'bell',
    },
```

- [ ] **Step 4: Add the same defaults to the other 3 variant factories**

`createDefaultOceanAbyssConfig`, `createDefaultOceanMysticalConfig`, `createDefaultOceanCinematicConfig` all need the same new fields. Copy the defaults from reef config.

- [ ] **Step 5: Build verification**

Run: `npx svelte-check --tsconfig tsconfig.json`
Expected: 0 errors. Any missing field references in existing code will surface here.

- [ ] **Step 6: Commit**

```
feat(ocean): add DLA, species zonation, and placement config types
```

---

### Task 2: DLA Reef Macro-Shape Module

**Files:**
- Create: `src/lib/shared/3d/environments/utils/dla.ts`
- Create: `src/lib/shared/3d/environments/utils/__tests__/dla.test.ts`

Pure function — grid-based Diffusion-Limited Aggregation that grows organic branching reef shapes.

- [ ] **Step 1: Write test for DLA**

```typescript
// src/lib/shared/3d/environments/utils/__tests__/dla.test.ts
import { describe, it, expect } from 'vitest';
import { generateDLAMask } from '../dla';

describe('generateDLAMask', () => {
  it('produces a grid with reef cells around seeds', () => {
    const mask = generateDLAMask({
      gridSize: 32,
      walkerCount: 200,
      seeds: [{ angle: Math.PI, distanceNorm: 0.4 }],
      outsideLeakFactor: 0.1,
      innerRadius: 7,
      outerRadius: 24,
      seed: 42,
    });

    expect(mask.gridSize).toBe(32);
    expect(mask.grid.length).toBe(32 * 32);

    // At least some cells should be reef
    const reefCount = mask.grid.filter(Boolean).length;
    expect(reefCount).toBeGreaterThan(10);
    expect(reefCount).toBeLessThan(32 * 32 * 0.8);
  });

  it('lookup returns true inside reef boundary', () => {
    const mask = generateDLAMask({
      gridSize: 32,
      walkerCount: 300,
      seeds: [{ angle: Math.PI, distanceNorm: 0.4 }],
      outsideLeakFactor: 0.1,
      innerRadius: 7,
      outerRadius: 24,
      seed: 42,
    });

    // Seed position should be reef
    const seedX = Math.cos(Math.PI) * (7 + 0.4 * 17);
    const seedZ = Math.sin(Math.PI) * (7 + 0.4 * 17);
    expect(mask.lookup(seedX, seedZ)).toBe(true);
  });

  it('is deterministic given same seed', () => {
    const args = {
      gridSize: 32, walkerCount: 200,
      seeds: [{ angle: Math.PI, distanceNorm: 0.4 }],
      outsideLeakFactor: 0.1, innerRadius: 7, outerRadius: 24, seed: 42,
    };
    const a = generateDLAMask(args);
    const b = generateDLAMask(args);
    expect(a.grid).toEqual(b.grid);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/shared/3d/environments/utils/__tests__/dla.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement DLA module**

```typescript
// src/lib/shared/3d/environments/utils/dla.ts
import { seededRandom } from './poisson-disc';

export interface DLAMaskConfig {
  gridSize: number;
  walkerCount: number;
  seeds: Array<{ angle: number; distanceNorm: number }>;
  outsideLeakFactor: number;
  innerRadius: number;
  outerRadius: number;
  seed: number;
}

export interface DLAMask {
  gridSize: number;
  grid: boolean[];
  lookup: (worldX: number, worldZ: number) => boolean;
}

export function generateDLAMask(config: DLAMaskConfig): DLAMask {
  const { gridSize, walkerCount, seeds, innerRadius, outerRadius, seed } = config;
  const rng = seededRandom(seed);
  const grid = new Array<boolean>(gridSize * gridSize).fill(false);
  const extent = outerRadius * 2.2;
  const cellSize = extent / gridSize;

  function worldToGrid(wx: number, wz: number): [number, number] {
    const gx = Math.floor((wx + extent / 2) / cellSize);
    const gz = Math.floor((wz + extent / 2) / cellSize);
    return [
      Math.max(0, Math.min(gridSize - 1, gx)),
      Math.max(0, Math.min(gridSize - 1, gz)),
    ];
  }

  function idx(gx: number, gz: number): number {
    return gz * gridSize + gx;
  }

  // Seed reef nucleation points
  for (const s of seeds) {
    const r = innerRadius + s.distanceNorm * (outerRadius - innerRadius);
    const wx = Math.cos(s.angle) * r;
    const wz = Math.sin(s.angle) * r;
    const [gx, gz] = worldToGrid(wx, wz);
    grid[idx(gx, gz)] = true;
    // Seed a small 3x3 patch for stability
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const nx = gx + dx, nz = gz + dz;
        if (nx >= 0 && nx < gridSize && nz >= 0 && nz < gridSize) {
          grid[idx(nx, nz)] = true;
        }
      }
    }
  }

  // Random walkers — each walks until adjacent to reef, then sticks
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  for (let w = 0; w < walkerCount; w++) {
    // Start from random boundary position within the annulus
    const angle = rng() * Math.PI * 2;
    const edge = rng() > 0.5 ? outerRadius : innerRadius;
    const [startGx, startGz] = worldToGrid(
      Math.cos(angle) * edge,
      Math.sin(angle) * edge,
    );
    let gx = startGx, gz = startGz;
    let steps = 0;
    const maxSteps = gridSize * gridSize;

    while (steps < maxSteps) {
      steps++;
      // Check if adjacent to reef
      let adjacent = false;
      for (const [dx, dz] of dirs) {
        const nx = gx + dx, nz = gz + dz;
        if (nx >= 0 && nx < gridSize && nz >= 0 && nz < gridSize && grid[idx(nx, nz)]) {
          adjacent = true;
          break;
        }
      }
      if (adjacent) {
        grid[idx(gx, gz)] = true;
        break;
      }
      // Random step
      const dir = dirs[Math.floor(rng() * 4)]!;
      const nx = gx + dir[0], nz = gz + dir[1];
      if (nx >= 0 && nx < gridSize && nz >= 0 && nz < gridSize) {
        gx = nx;
        gz = nz;
      }
    }
  }

  // Majority-filter smoothing — remove single-cell peninsulas
  const smoothed = [...grid];
  for (let gz = 1; gz < gridSize - 1; gz++) {
    for (let gx = 1; gx < gridSize - 1; gx++) {
      let neighbors = 0;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (dx === 0 && dz === 0) continue;
          if (grid[idx(gx + dx, gz + dz)]) neighbors++;
        }
      }
      smoothed[idx(gx, gz)] = neighbors >= 4;
    }
  }

  function lookup(worldX: number, worldZ: number): boolean {
    const [gx, gz] = worldToGrid(worldX, worldZ);
    return smoothed[idx(gx, gz)] ?? false;
  }

  return { gridSize, grid: smoothed, lookup };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/shared/3d/environments/utils/__tests__/dla.test.ts`
Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```
feat(ocean): add DLA reef macro-shape generator
```

---

### Task 3: Weighted Poisson Disc Sampling

**Files:**
- Modify: `src/lib/shared/3d/environments/utils/poisson-disc.ts`

Add optional `densityBias` callback to `poissonDiscSample` that modulates acceptance probability.

- [ ] **Step 1: Add densityBias to PoissonDiscConfig**

```typescript
export interface PoissonDiscConfig {
  innerRadius: number;
  outerRadius: number;
  minDistance: number;
  count: number;
  seed: number;
  densityBias?: (x: number, z: number, distanceNorm: number) => number;
}
```

- [ ] **Step 2: Apply densityBias in the sampling loop**

After the min-distance check passes (line 47: `if (!tooClose)`), add the bias check:

```typescript
    if (!tooClose) {
      const distanceNorm = (r - innerRadius) / Math.max(outerRadius - innerRadius, 0.001);
      if (densityBias && rng() > densityBias(x, z, distanceNorm)) {
        continue;
      }
      samples.push({ x, z, distanceNorm });
    }
```

Remove the old inline `distanceNorm` computation from inside the push.

- [ ] **Step 3: Build verification**

Run: `npx svelte-check --tsconfig tsconfig.json`
Expected: 0 errors. Existing callers pass no `densityBias` so behavior is unchanged.

- [ ] **Step 4: Commit**

```
feat(ocean): add densityBias to Poisson disc sampling
```

---

### Task 4: Terrain Slope Computation

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/ocean/terrain-height.ts`

- [ ] **Step 1: Add terrainSlope function**

Add after `terrainHeightForPlacement`:

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
  return Math.sqrt(dx * dx + dz * dz);
}
```

- [ ] **Step 2: Build verification**

Run: `npx svelte-check --tsconfig tsconfig.json`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```
feat(ocean): add terrain slope computation for placement filtering
```

---

### Task 5: Species Selection & Von Mises Helpers

**Files:**
- Create: `src/lib/shared/3d/environments/utils/reef-ecology.ts`
- Create: `src/lib/shared/3d/environments/utils/__tests__/reef-ecology.test.ts`

Pure functions for depth-weighted species selection and current-driven angle sampling.

- [ ] **Step 1: Write tests**

```typescript
// src/lib/shared/3d/environments/utils/__tests__/reef-ecology.test.ts
import { describe, it, expect } from 'vitest';
import { speciesWeight, selectSpecies, vonMisesSample, densityCurve } from '../reef-ecology';
import type { CoralSpeciesConfig } from '../../domain/models/scene-configs';

describe('speciesWeight', () => {
  it('returns 1.0 inside preferred range', () => {
    const sp: CoralSpeciesConfig = { speciesIndex: 0, depthPreference: [0.2, 0.6] };
    expect(speciesWeight(sp, 0.4)).toBe(1.0);
  });

  it('falls off outside preferred range', () => {
    const sp: CoralSpeciesConfig = { speciesIndex: 0, depthPreference: [0.2, 0.6] };
    const w = speciesWeight(sp, 0.9);
    expect(w).toBeGreaterThan(0);
    expect(w).toBeLessThan(0.5);
  });
});

describe('selectSpecies', () => {
  it('biases toward shallow species at low distanceNorm', () => {
    const species: CoralSpeciesConfig[] = [
      { speciesIndex: 0, depthPreference: [0.0, 0.3] },
      { speciesIndex: 1, depthPreference: [0.7, 1.0] },
    ];
    let shallow = 0;
    let i = 0;
    const rng = () => { i++; return (i * 0.1) % 1; };
    for (let j = 0; j < 100; j++) {
      if (selectSpecies(species, 0.1, rng) === 0) shallow++;
    }
    expect(shallow).toBeGreaterThan(70);
  });
});

describe('vonMisesSample', () => {
  it('concentrates around the mean angle', () => {
    let i = 0;
    const rng = () => { i++; return (i * 0.0731) % 1; };
    const samples = Array.from({ length: 200 }, () => vonMisesSample(Math.PI, 2.0, rng));
    const nearMean = samples.filter(a => Math.abs(a - Math.PI) < 0.8 || Math.abs(a - Math.PI + Math.PI * 2) < 0.8);
    expect(nearMean.length).toBeGreaterThan(100);
  });
});

describe('densityCurve', () => {
  it('peaks in mid-range', () => {
    expect(densityCurve(0.5)).toBeGreaterThan(densityCurve(0.0));
    expect(densityCurve(0.5)).toBeGreaterThan(densityCurve(1.0));
  });

  it('returns values between 0 and 1', () => {
    for (let d = 0; d <= 1; d += 0.1) {
      const v = densityCurve(d);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/shared/3d/environments/utils/__tests__/reef-ecology.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement reef-ecology module**

```typescript
// src/lib/shared/3d/environments/utils/reef-ecology.ts
import type { CoralSpeciesConfig } from '../domain/models/scene-configs';

export function speciesWeight(species: CoralSpeciesConfig, distanceNorm: number): number {
  const [lo, hi] = species.depthPreference;
  if (distanceNorm >= lo && distanceNorm <= hi) return 1.0;
  const dist = distanceNorm < lo ? lo - distanceNorm : distanceNorm - hi;
  return Math.exp(-(dist * dist) / (2 * 0.15 * 0.15));
}

export function selectSpecies(
  species: CoralSpeciesConfig[],
  distanceNorm: number,
  rng: () => number,
): number {
  const weights = species.map(s => speciesWeight(s, distanceNorm));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total === 0) return species[0]!.speciesIndex;
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return species[i]!.speciesIndex;
  }
  return species[species.length - 1]!.speciesIndex;
}

export function vonMisesSample(mean: number, kappa: number, rng: () => number): number {
  // Rejection sampling approximation of von Mises distribution
  const tau = 1.0 + Math.sqrt(1.0 + 4.0 * kappa * kappa);
  const rho = (tau - Math.sqrt(2.0 * tau)) / (2.0 * kappa);
  const r_ = (1.0 + rho * rho) / (2.0 * rho);

  for (let attempt = 0; attempt < 100; attempt++) {
    const u1 = rng();
    const z = Math.cos(Math.PI * u1);
    const f = (1.0 + r_ * z) / (r_ + z);
    const c = kappa * (r_ - f);
    const u2 = rng();
    if (c * (2.0 - c) > u2 || Math.log(c / u2) + 1.0 >= c) {
      const u3 = rng();
      const theta = u3 > 0.5 ? Math.acos(f) : -Math.acos(f);
      return ((theta + mean) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    }
  }
  return mean;
}

export function densityCurve(distanceNorm: number): number {
  // Bell curve peaking at reef zone (0.3-0.5 normalized distance)
  // Clearing (0.0-0.2): 0.3
  // Reef inner (0.2-0.5): ramp to 1.0
  // Reef outer (0.5-0.7): 0.8
  // Forest (0.7-0.85): 0.5
  // Background (0.85-1.0): 0.2
  if (distanceNorm < 0.2) return 0.3;
  if (distanceNorm < 0.5) return 0.3 + (distanceNorm - 0.2) / 0.3 * 0.7;
  if (distanceNorm < 0.7) return 1.0 - (distanceNorm - 0.5) / 0.2 * 0.2;
  if (distanceNorm < 0.85) return 0.8 - (distanceNorm - 0.7) / 0.15 * 0.3;
  return 0.5 - (distanceNorm - 0.85) / 0.15 * 0.3;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/shared/3d/environments/utils/__tests__/reef-ecology.test.ts`
Expected: All PASS.

- [ ] **Step 5: Commit**

```
feat(ocean): add species selection, von Mises, and density curve helpers
```

---

### Task 6: DLA + Density Bias Integration into reefFormations

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/OceanScene.svelte` (lines ~209-244)

Replace uniform Poisson formation placement with DLA-masked, density-biased placement.

- [ ] **Step 1: Add imports**

Add to the imports at top of OceanScene.svelte:

```typescript
import { generateDLAMask, type DLAMask } from "../utils/dla";
import { densityCurve } from "../utils/reef-ecology";
```

- [ ] **Step 2: Add DLA mask derived**

Before `reefFormations`, add:

```typescript
  const dlaMask = $derived.by((): DLAMask | null => {
    if (!activeConfig.placement.dlaMacroShape) return null;
    return generateDLAMask({
      ...activeConfig.dla,
      innerRadius: zones.clearingRadius,
      outerRadius: zones.backgroundRadius,
      seed: 99,
    });
  });
```

- [ ] **Step 3: Replace reefFormations derived**

Replace the `reefFormations` derived (lines ~209-244) with:

```typescript
  const reefFormations = $derived.by((): ReefFormation[] => {
    const rng = seededRandom(42);
    const formations: ReefFormation[] = [];
    const cfg = activeConfig;
    const mask = dlaMask;
    const useBell = cfg.placement.densityCurve === 'bell';

    const formationCenters = poissonDiscSample({
      innerRadius: zones.clearingRadius + 0.5,
      outerRadius: zones.backgroundRadius - 2,
      minDistance: 2.5,
      count: 50,
      seed: 42,
      densityBias: (x, z, dNorm) => {
        let bias = useBell ? densityCurve(dNorm) : 1.0;
        if (mask) {
          bias *= mask.lookup(x, z) ? 1.0 : cfg.dla.outsideLeakFactor;
        }
        return bias;
      },
    });

    for (const center of formationCenters) {
      const dist = Math.sqrt(center.x * center.x + center.z * center.z);
      if (dist < zones.stageRadius) continue;

      const distFactor = Math.min(
        (dist - zones.stageRadius) / (zones.backgroundRadius - zones.stageRadius),
        1.0,
      );
      const isLargeFormation = rng() > 0.6;
      const species = Math.floor(rng() * 8);

      formations.push({
        x: center.x,
        z: center.z,
        radius: isLargeFormation ? 2.5 + rng() * 2.0 : 1.0 + rng() * 1.5,
        density: 0.5 + rng() * 0.5,
        dominantSpecies: species,
        hue: CORAL_PALETTE_HUES[species]! + (rng() - 0.5) * 0.04,
        saturation: 0.85 + rng() * 0.3,
        hasAnchorRock: rng() > 0.3,
        anchorRockScale: isLargeFormation
          ? 0.3 + rng() * 0.4 + distFactor * 0.3
          : 0.15 + rng() * 0.25,
      });
    }
    return formations;
  });
```

- [ ] **Step 4: Build verification**

Run: `npx svelte-check --tsconfig tsconfig.json`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```
feat(ocean): integrate DLA mask + density curve into formation placement
```

---

### Task 7: Depth-Based Species Zonation in Coral Placement

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/OceanScene.svelte` (coral section, lines ~387-425)

Replace flat 70/30 dominant/random species selection with depth-weighted selection.

- [ ] **Step 1: Add selectSpecies import**

Add to existing reef-ecology import:

```typescript
import { densityCurve, selectSpecies } from "../utils/reef-ecology";
```

- [ ] **Step 2: Replace coral species selection**

In the coral placement loop (inside `scenePlacements`), replace the `speciesIdx` computation:

```typescript
// OLD:
speciesIdx: (formation.dominantSpecies + (rng() > 0.7 ? Math.floor(rng() * 7) + 1 : 0)) % 8,

// NEW:
speciesIdx: cfg.placement.depthZonation
  ? selectSpecies(cfg.coralSpecies, center_dNorm, rng)
  : (formation.dominantSpecies + (rng() > 0.7 ? Math.floor(rng() * 7) + 1 : 0)) % 8,
```

To get `center_dNorm`, compute it from the coral's world position:

```typescript
const rDist = Math.sqrt(x * x + z * z);
if (rDist < z_.stageRadius || rDist > z_.backgroundRadius) continue;
const center_dNorm = Math.min(1, Math.max(0,
  (rDist - z_.clearingRadius) / (z_.backgroundRadius - z_.clearingRadius),
));
```

- [ ] **Step 3: Build verification**

Run: `npx svelte-check --tsconfig tsconfig.json`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```
feat(ocean): add depth-based species zonation to coral placement
```

---

### Task 8: Species Sub-Clustering Within Formations

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/OceanScene.svelte` (coral section)

Replace individual coral placement with colony-nucleus-based clustering.

- [ ] **Step 1: Replace the coral formation loop**

When `cfg.placement.speciesClustering` is true, generate 2-4 colony nuclei per formation, then cluster corals around each nucleus:

```typescript
    if (cfg.coral.enabled) {
      const rng = seededRandom(100);
      const maxCount = Math.min(cfg.coral.count, qualityConfig.maxCoralCount);

      for (const formation of formations) {
        const totalCount = Math.floor(3 + formation.density * 8 * (formation.radius / 2.0));

        if (cfg.placement.speciesClustering) {
          // Generate 2-4 colony nuclei per formation
          const nucleiCount = 2 + Math.floor(rng() * 3);
          const nuclei: { x: number; z: number; species: number }[] = [];
          for (let n = 0; n < nucleiCount; n++) {
            const nAngle = rng() * Math.PI * 2;
            const nDist = rng() * formation.radius * 0.6;
            const nx = formation.x + Math.cos(nAngle) * nDist;
            const nz = formation.z + Math.sin(nAngle) * nDist;
            const nRDist = Math.sqrt(nx * nx + nz * nz);
            const dNorm = Math.min(1, Math.max(0,
              (nRDist - z_.clearingRadius) / (z_.backgroundRadius - z_.clearingRadius),
            ));
            const sp = cfg.placement.depthZonation
              ? selectSpecies(cfg.coralSpecies, dNorm, rng)
              : (formation.dominantSpecies + (rng() > 0.7 ? Math.floor(rng() * 7) + 1 : 0)) % 8;
            nuclei.push({ x: nx, z: nz, species: sp });
          }

          // Distribute corals around nuclei with gaussian offset
          const perNucleus = Math.ceil(totalCount / nuclei.length);
          for (const nucleus of nuclei) {
            for (let j = 0; j < perNucleus && coral.length < maxCount; j++) {
              // Box-Muller gaussian offset
              const u1 = Math.max(0.0001, rng());
              const u2 = rng();
              const sigma = 0.3 + rng() * 0.3;
              const gx = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * sigma;
              const gz = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2) * sigma;
              const x = nucleus.x + gx;
              const z = nucleus.z + gz;
              const rDist = Math.sqrt(x * x + z * z);
              if (rDist < z_.stageRadius || rDist > z_.backgroundRadius) continue;
              const closeness = 1.0 - Math.sqrt(gx * gx + gz * gz) / (formation.radius + 0.01);
              const sizeRoll = rng();
              const baseScale = sizeRoll > 0.85 ? 0.8 + rng() * 1.2 : sizeRoll > 0.5 ? 0.3 + rng() * 0.5 : 0.1 + rng() * 0.25;
              const finalScale = baseScale * Math.max(0.3, 0.6 + closeness * 0.8);
              if (!grid.isClear(x, z, finalScale * 0.3)) continue;
              coral.push({
                x, z, scale: finalScale, rotY: rng() * Math.PI * 2,
                hueShift: formation.hue + (rng() - 0.5) * 0.03,
                satBoost: formation.saturation + (rng() - 0.5) * 0.1,
                speciesIdx: nucleus.species,
              });
            }
          }
        } else {
          // Original flat placement (fallback)
          for (let j = 0; j < totalCount && coral.length < maxCount; j++) {
            const angle = rng() * Math.PI * 2;
            const dist = rng() * formation.radius;
            const x = formation.x + Math.cos(angle) * dist;
            const z = formation.z + Math.sin(angle) * dist;
            const rDist = Math.sqrt(x * x + z * z);
            if (rDist < z_.stageRadius || rDist > z_.backgroundRadius) continue;
            const closeness = 1.0 - dist / formation.radius;
            const sizeRoll = rng();
            const baseScale = sizeRoll > 0.85 ? 0.8 + rng() * 1.2 : sizeRoll > 0.5 ? 0.3 + rng() * 0.5 : 0.1 + rng() * 0.25;
            const finalScale = baseScale * (0.6 + closeness * 0.8);
            if (!grid.isClear(x, z, finalScale * 0.3)) continue;
            coral.push({
              x, z, scale: finalScale, rotY: rng() * Math.PI * 2,
              hueShift: formation.hue + (rng() - 0.5) * 0.03,
              satBoost: formation.saturation + (rng() - 0.5) * 0.1,
              speciesIdx: (formation.dominantSpecies + (rng() > 0.7 ? Math.floor(rng() * 7) + 1 : 0)) % 8,
            });
          }
        }
      }

      // Clearing coral unchanged
      const clearingCoral = poissonDiscSample({ innerRadius: z_.stageRadius + 0.5, outerRadius: z_.clearingRadius, minDistance: 1.5, count: 25, seed: 150 });
      const rngCl = seededRandom(151);
      for (const s of clearingCoral) {
        if (coral.length >= maxCount) break;
        coral.push({
          x: s.x, z: s.z, scale: 0.15 + rngCl() * 0.3, rotY: rngCl() * Math.PI * 2,
          hueShift: CORAL_PALETTE_HUES[Math.floor(rngCl() * 8)]! + (rngCl() - 0.5) * 0.04,
          satBoost: 0.9 + rngCl() * 0.2, speciesIdx: Math.floor(rngCl() * 8),
        });
      }
    }
```

- [ ] **Step 2: Build verification**

Run: `npx svelte-check --tsconfig tsconfig.json`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```
feat(ocean): add species sub-clustering within coral formations
```

---

### Task 9: Current-Driven Kelp Orientation

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/OceanScene.svelte` (kelp section, lines ~427-469)

Replace random kelp `rotY` with von Mises sampling biased toward current direction.

- [ ] **Step 1: Add vonMisesSample import**

Update reef-ecology import:

```typescript
import { densityCurve, selectSpecies, vonMisesSample } from "../utils/reef-ecology";
```

- [ ] **Step 2: Compute current angle and replace kelp rotY**

At the start of the kelp section, compute the current angle:

```typescript
    if (cfg.kelp.enabled) {
      const rng = seededRandom(200);
      const currentAngle = cfg.placement.currentDrivenKelp
        ? Math.atan2(cfg.currentDirection.z, cfg.currentDirection.x)
        : 0;
      const kappa = 2.0; // ±45° spread
```

Replace every `rotY: rng() * Math.PI * 2` in kelp placement with:

```typescript
      rotY: cfg.placement.currentDrivenKelp
        ? vonMisesSample(currentAngle, kappa, rng)
        : rng() * Math.PI * 2,
```

This applies to both mid kelp (line 452) and background kelp (line 467).

- [ ] **Step 3: Build verification**

Run: `npx svelte-check --tsconfig tsconfig.json`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```
feat(ocean): add current-driven kelp orientation via von Mises
```

---

### Task 10: Rock-Anchored Kelp Placement

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/OceanScene.svelte` (kelp section)

When enabled, place kelp near rocks instead of offset from formation centers.

- [ ] **Step 1: Replace mid kelp placement logic**

Replace the mid kelp section with a dual-path: rock-anchored when enabled, original otherwise:

```typescript
      // Mid kelp: near rocks when enabled, else near formation centers
      if (cfg.placement.rockAnchoredKelp) {
        // Collect all large-enough rocks and hero rocks as potential holdfasts
        const holdfasts = [
          ...heroRocks.filter(r => r.scale > 0.2).map(r => ({ x: r.x, z: r.z, size: r.scale })),
          ...rocks.filter(r => r.scale > 0.15).map(r => ({ x: r.x, z: r.z, size: r.scale })),
          ...boulders.map(b => ({ x: b.x, z: b.z, size: b.scale })),
        ];
        for (const holdfast of holdfasts) {
          const kelpCount = Math.floor(rng() * 3 * holdfast.size);
          for (let j = 0; j < kelpCount && midKelp.length < maxMid; j++) {
            const angle = rng() * Math.PI * 2;
            const dist = 0.5 + rng() * 1.5;
            const x = holdfast.x + Math.cos(angle) * dist;
            const z = holdfast.z + Math.sin(angle) * dist;
            const rDist = Math.sqrt(x * x + z * z);
            if (rDist < z_.clearingRadius || rDist > z_.forestOuter) continue;
            const ss = 0.4 + rng() * 1.0;
            if (!grid.isClear(x, z, ss * 0.2)) { rng(); continue; }
            midKelp.push({
              x, z, scale: ss,
              rotY: cfg.placement.currentDrivenKelp
                ? vonMisesSample(currentAngle, kappa, rng)
                : rng() * Math.PI * 2,
            });
          }
        }
      } else {
        // Original: offset from formation centers
        for (const formation of formations) {
          if (rng() > 0.85) continue;
          const kelpCount = Math.floor(4 + formation.density * 10 * (formation.radius / 2.0));
          const patchAngle = rng() * Math.PI * 2;
          const patchDist = formation.radius * (0.3 + rng() * 0.5);
          const patchX = formation.x + Math.cos(patchAngle) * patchDist;
          const patchZ = formation.z + Math.sin(patchAngle) * patchDist;
          for (let j = 0; j < kelpCount && midKelp.length < maxMid; j++) {
            const angle = rng() * Math.PI * 2;
            const dist = rng() * 1.2;
            const x = patchX + Math.cos(angle) * dist;
            const z = patchZ + Math.sin(angle) * dist;
            const rDist = Math.sqrt(x * x + z * z);
            if (rDist < z_.clearingRadius || rDist > z_.forestOuter) continue;
            const ss = 0.4 + rng() * 1.0;
            if (!grid.isClear(x, z, ss * 0.2)) { rng(); continue; }
            midKelp.push({ x, z, scale: ss, rotY: rng() * Math.PI * 2 });
          }
        }
      }
```

- [ ] **Step 2: Build verification**

Run: `npx svelte-check --tsconfig tsconfig.json`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```
feat(ocean): add rock-anchored kelp placement
```

---

### Task 11: Slope-Aware Placement Filtering

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/OceanScene.svelte`

Add slope checks to coral, kelp, and decoration placement when `slopeAware` is enabled.

- [ ] **Step 1: Add terrainSlope import**

```typescript
import { terrainHeight as terrainHeightRaw, terrainHeightForPlacement, terrainSlope, setMoundSources, type MoundSource } from "./ocean/terrain-height";
```

- [ ] **Step 2: Add slope checks in coral placement**

After the grid-clear check for coral, add:

```typescript
if (cfg.placement.slopeAware) {
  const slope = terrainSlope(x, z, z_.stageRadius, z_.clearingRadius);
  // Coral prefers rocky slopes, reject flat sand 80% of the time
  if (slope < 0.05 && rng() > 0.2) continue;
}
```

- [ ] **Step 3: Add slope checks in kelp placement**

After the grid-clear check for mid kelp, add:

```typescript
if (cfg.placement.slopeAware) {
  const slope = terrainSlope(x, z, z_.stageRadius, z_.clearingRadius);
  // Kelp prefers flat areas, reject steep slopes 90% of the time
  if (slope > 0.3 && rng() > 0.1) continue;
}
```

- [ ] **Step 4: Add slope checks in decoration placement**

For starfish/shells: prefer flat (reject slope > 0.1 at 70%).
For urchins: prefer rocky (reject slope < 0.1 at 50%).

Add the appropriate check after each decoration type's position computation.

- [ ] **Step 5: Build verification**

Run: `npx svelte-check --tsconfig tsconfig.json`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```
feat(ocean): add slope-aware placement filtering
```

---

### Task 12: Edge Accumulation for Decorations

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/OceanScene.svelte` (decoration section)

Shells and starfish drift toward rock/coral bases.

- [ ] **Step 1: Add drift score to shell placement**

In the shell placement section, after generating candidate position, compute proximity to nearest grid-registered item:

```typescript
if (cfg.placement.driftAccumulation) {
  // Boost acceptance near registered large items
  const nearLarge = grid.isClear(s.x, s.z, 0.8) === false;
  if (nearLarge) {
    // Near a large object — high acceptance
  } else if (rng2() > 0.5) {
    // Far from objects — reduced acceptance
    continue;
  }
}
```

- [ ] **Step 2: Apply similar drift to starfish and anemone placements**

For starfish near coral and anemones near rocks, bias the offset distance to be closer (0.2-0.5m instead of 0.3-0.6m) when drift accumulation is on.

- [ ] **Step 3: Build verification**

Run: `npx svelte-check --tsconfig tsconfig.json`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```
feat(ocean): add edge accumulation for floor decorations
```

---

### Task 13: Final Build Verification & Visual Check

**Files:** None (verification only)

- [ ] **Step 1: Full build check**

Run: `npx svelte-check --tsconfig tsconfig.json`
Expected: 0 errors.

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All new tests pass, no regressions.

- [ ] **Step 3: Visual verification**

Load ocean scene in browser. Check:
1. Reef forms organic branching shape (not uniform ring)
2. Near-stage coral is branching species, far coral is massive/encrusting
3. Coral clusters in distinct colony patches within formations
4. Kelp fronds lean in same direction (current bias)
5. Kelp grows near rocks, not in open sand
6. Shells accumulate at base of rocks
7. No objects in stage clearing zone

Cannot verify visually without browser — say: "I cannot verify this visually. Please check the ocean scene and confirm the reef looks organic rather than evenly scattered."

- [ ] **Step 4: Commit all remaining changes**

```
feat(ocean): complete ecosystem placement redesign (9 features)
```
