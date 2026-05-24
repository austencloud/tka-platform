---
status: backlog
value: 4
effort: M
remaining: "Full build — download 5 model varieties, decimate hero kelps, integrate 3-tier animation system (bone heroes + vertex sway mid + instanced background), update placement zones"
depends_on: ""
plan_path: ""
tags: ["3d", "scenes", "ocean", "models", "animation"]
last_triaged: 2026-05-24
---
# Lush Kelp Forest Overhaul — Design Spec

**Date:** 2026-05-24
**Status:** Ready for implementation planning

## Problem

The ocean scene's kelp forest uses two low-poly models (`seaweed.glb` at 68KB, `kelp_plant.glb` at 1.1MB) with no animation. The kelp looks static and artificial — it undercuts the premium underwater atmosphere built by the post-processing pipeline (Beer-Lambert absorption, volumetric god rays, refraction caustics). A vertex shader sway system exists (`createSwayingInstancedMesh` in `ocean-instancing.ts`) but hasn't been visually validated as working.

Real kelp forests have multiple species at different heights, organic frond movement driven by current, and dense layered canopies. The current implementation has none of this.

## Goal

Replace the static 2-model kelp system with a 5-variety lush forest using 3 animation tiers. The result should feel like a living underwater ecosystem — tall kelp swaying overhead, mid-height seaweed bending in current, ground cover rippling gently.

## Non-Goals

- Kelp physics simulation (current-driven Verlet or similar). Shader-based approximation is sufficient.
- Procedural kelp generation. All varieties come from authored 3D models.
- Kelp interaction with performer/avatar. Kelp is background scenery.

## Architecture

### 3-Tier Animation System

| Tier | Animation Method | Mesh Type | Instance Budget | Visual Role |
|------|-----------------|-----------|-----------------|-------------|
| **Hero** | Skeletal/morph animation via `AnimationMixer` | `SkinnedMesh` (individual) | 3-6 total | Foreground showpieces with organic frond motion |
| **Mid** | Vertex shader sway (`createSwayingInstancedMesh`) | `InstancedMesh` | 25-50 | Forest fill, visible but not hero-level detail |
| **Background** | Vertex shader sway (larger amplitude, slower speed) | `InstancedMesh` | 50-100 | Distant silhouette fill, fading into fog |

### 5 Kelp Varieties

#### 1. Giant Kelp — Hero (Tier 1)
- **Source:** Sketchfab "Kelp" by Mazelya (CC-BY)
- **Original:** 365k tris. **Decimated target:** ~50k tris via Meshopt/gltf-transform.
- **Role:** 1-3 tall foreground kelp plants with full bone animation. Fronds, stipe, gas bladders visible at close range.
- **Animation:** Skeletal animation from model or hand-keyed in Blender. 2-3 second loop, slow undulating sway.

#### 2. Breathing Kelp — Hero (Tier 1)
- **Source:** Sketchfab "Kelp with animation" by cswindley (CC-BY)
- **Original:** 49k tris. Use as-is (already within budget).
- **Role:** 2-4 mid-foreground kelps with opacity-mapped fronds. Substance Painter PBR textures.
- **Animation:** Baked bone animation ("breathing" sway). Opacity maps create translucent frond edges.

#### 3. Leafy Kelp — Mid (Tier 2)
- **Source:** Sketchfab "Animated Kelp" by JosephWPugsley (CC-BY)
- **Original:** 7.1k tris. Instancing-friendly.
- **Role:** 10-20 instances in the forest zone. Visible individually but not hero-level.
- **Animation:** Vertex shader sway. The model has 400 leaves — the height-proportional shader displaces tips more than base.

#### 4. Seaweed Clusters — Mid (Tier 2)
- **Source:** RenderCrate Seaweed (Extended Use License, no attribution required)
- **Format:** GLB ready. ~1.3MB.
- **Role:** 15-30 instances as ground/mid-height seaweed clusters between kelp stalks.
- **Animation:** Vertex shader sway with lower amplitude (ground cover sways less than tall kelp).

#### 5. Silhouette Kelp — Background (Tier 3)
- **Source:** Poly by Google "Kelp" via Poly Pizza (CC-BY)
- **Original:** 784 tris. Near-zero GPU cost.
- **Role:** 50-100 instances at forest outer edge. Dark silhouettes against fog. Creates depth and density.
- **Animation:** Vertex shader sway with large amplitude + slow speed for distant parallax effect.

### Zone-Based Placement

Extends the existing Poisson-disc placement system with tier-aware zone assignment:

| Zone | Radius | Kelp Tier | Varieties |
|------|--------|-----------|-----------|
| Reef (near camera) | `reefInner` – `reefOuter` | Hero (Tier 1) | Giant Kelp, Breathing Kelp |
| Forest | `forestInner` – `forestOuter` | Mid (Tier 2) | Leafy Kelp, Seaweed Clusters |
| Background | `forestOuter` – `backgroundRadius` | Background (Tier 3) | Silhouette Kelp |

Hero kelps are placed individually (not instanced) at hand-tuned or Poisson-sampled positions within the reef zone. Mid and background kelps use the existing `createSwayingInstancedMesh` pipeline.

### Hero Kelp Integration

New component: `HeroKelp.svelte` — manages `SkinnedMesh` loading + `AnimationMixer` playback.

```
OceanScene.svelte
├── HeroKelp.svelte (×3-6, individual SkinnedMesh)
├── InstancedMesh (mid kelp, vertex sway)
├── InstancedMesh (seaweed clusters, vertex sway)
└── InstancedMesh (background kelp, vertex sway)
```

`HeroKelp` uses `useGltf` to load the model, extracts the `AnimationClip`, creates an `AnimationMixer`, and plays the clip on loop with `THREE.LoopRepeat`. Time offset is randomized per instance so they don't synchronize.

### Model Pipeline

1. Download GLB/GLTF from each source
2. Run through `gltf-transform` for optimization:
   - Decimation (hero giant kelp: 365k → ~50k)
   - Meshopt compression
   - Texture resize (max 1024×1024 for kelp — they're mostly green)
   - Draco compression for instanced meshes
3. Place in `static/models/ocean/kelp/` subdirectory
4. Attribution file: `static/models/ocean/kelp/CREDITS.md`

### Sway Shader Improvements

The existing `createSwayingInstancedMesh` vertex shader needs tuning:

- **Per-instance phase offset:** Add an instanced attribute `aPhaseOffset` (random float 0–2π) so instances don't sway in unison.
- **Two-octave noise:** Layer a second sine at 0.3× frequency for slower drift underneath the primary sway.
- **Current direction:** Add a `uCurrentDir` vec2 uniform so sway biases in one direction (simulating ocean current), not pure oscillation.

### Config Changes

Extend `OceanSceneConfig.kelp`:

```typescript
kelp: {
  enabled: boolean;
  // Tier 2+3 counts (instanced)
  midCount: number;        // was "count"
  backgroundCount: number; // new
  // Tier 1 (hero, individual)
  heroCount: number;       // new, 0-6
  // Sway parameters
  swaySpeed: number;
  swayAmplitude: number;
  currentDirection: [number, number]; // new — XZ bias
};
```

### Performance Budget

| Component | Tris | Draw Calls |
|-----------|------|------------|
| Hero kelps (3-6 × ~50k) | 150-300k | 3-6 |
| Mid instanced (25-50 × 7k) | 175-350k | 2 |
| Seaweed instanced (15-30 × ~5k) | 75-150k | 1 |
| Background instanced (50-100 × 784) | 39-78k | 1 |
| **Total** | **~440-878k** | **7-10** |

At worst case (~878k tris), this is comparable to the existing fish school system. Quality tier scaling applies: low tier cuts hero count to 0, mid count by 60%, background count by 50%.

### Quality Tier Scaling

| Config | Ultra | Medium | Low |
|--------|-------|--------|-----|
| `heroCount` | 4 | 2 | 0 |
| `midCount` | 40 | 15 | 8 |
| `backgroundCount` | 80 | 30 | 0 |

Low tier disables hero and background kelp entirely — just mid-tier instanced sway.

## Model Sources & Licensing

| Variety | Source | License | Attribution Required |
|---------|--------|---------|---------------------|
| Giant Kelp | Sketchfab (Mazelya) | CC-BY 4.0 | Yes |
| Breathing Kelp | Sketchfab (cswindley) | CC-BY 4.0 | Yes |
| Leafy Kelp | Sketchfab (JosephWPugsley) | CC-BY 4.0 | Yes |
| Seaweed Clusters | RenderCrate | Extended Use | No |
| Silhouette Kelp | Poly Pizza / Google | CC-BY 3.0 | Yes |

Attribution goes in `static/models/ocean/kelp/CREDITS.md` and in the app's credits/about page.

## Success Criteria

- 5 visually distinct kelp varieties visible in the ocean scene
- Hero kelps sway with organic bone-driven animation (fronds move independently)
- Mid/background kelps sway via vertex shader with per-instance phase offsets
- No visible synchronization between kelp instances (phase randomization works)
- Performance stays within 60fps on medium-tier hardware (integrated GPU)
- Low quality tier gracefully degrades (no hero kelps, fewer instances)
- All model attributions documented in CREDITS.md

## Rollout

1. Download and optimize all 5 models
2. Integrate Tier 2+3 (instanced sway) — extends existing pipeline, lowest risk
3. Build `HeroKelp.svelte` for Tier 1 bone-animated kelps
4. Update placement zones for tier-aware distribution
5. Tune sway parameters per variety
6. Quality tier scaling
