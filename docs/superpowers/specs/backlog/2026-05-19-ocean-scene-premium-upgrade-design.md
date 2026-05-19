---
status: backlog
value: 4
effort: M
remaining: "Phase 1 foundation done (4 variants, voronoi caustics, god rays, water surface). Phase 2 post-processing upgrades next."
depends_on: ""
plan_path: ""
tags: ["3d", "scenes", "ocean", "shaders"]
last_triaged: 2026-05-19
---
# Ocean Scene Premium Upgrade — Design Spec

## Goal

Take the Ocean 3D background from last place (4.5 avg in the scene audit) to a genuine 10/10 premium underwater experience. Phase 1 laid the foundation with 4 distinct ocean variants and new shader sub-components. Phase 2 moves the heavy-lifting into screen-space post-processing for physically-grounded underwater optics.

## Phase 1 — Complete

Four ocean variants with distinct visual identities:

- **Abyss** — Dark bioluminescent, Voronoi caustics, 100 plankton, 6 jellyfish with bell pulse
- **Reef** — Bright turquoise, 24 fish, golden caustics, 5 god ray shafts, coral reef
- **Mystical** — Aurora-green Voronoi caustics, 120 multi-color plankton, ethereal jellyfish
- **Cinematic** — Muted realistic tones, 6 god ray shafts, realistic-scale caustics, water surface

New sub-components: `VoronoiCaustics.svelte`, `GodRayShafts.svelte`, `WaterSurface.svelte`.

## Phase 2 — Post-Processing Upgrades (Highest Impact)

### 2a. Per-Channel Wavelength Absorption (replaces FogExp2)

Beer-Lambert per-channel absorption. Red attenuates fastest, green next, blue last. Reads depth buffer, computes per-pixel water depth, applies per-channel exponential decay. This is the single biggest gap between the current scene and Subnautica-tier rendering.

```glsl
vec3 absorptionCoeff = vec3(0.45, 0.07, 0.02);
vec3 transmittance = exp(-absorptionCoeff * waterDepth);
```

Effort: Low (one post-processing Effect). Visual delta: Transformative.

### 2b. Raymarched Volumetric God Rays (replaces billboard planes)

Screen-space raymarched god rays via `three-good-godrays` library (Ameobea). Marches along the ray, samples shadow map, accumulates density with Beer's law, applies Henyey-Greenstein phase function. Blue noise dithering eliminates banding. Half-resolution rendering for performance.

Effort: Low (library import). Visual delta: High.

### 2c. Screen-Space Underwater Distortion

Post-processing pass that jitters screen-space UVs using animated noise. Depth-aware (stronger distortion for distant objects). Clamped to prevent sampling above-water pixels.

Effort: Low (one post-processing Effect). Visual delta: High for cost.

### 2d. Refraction-Based Caustics with Chromatic Aberration

Render water surface normals to FBO, compute refracted ray directions, measure area ratio for brightness. Chromatic aberration by computing R/G/B with slightly different refraction indices. Replaces decorative Voronoi with physically-grounded light bending.

Effort: Medium (two FBO passes). Visual delta: High.

## Phase 3 — Geometry & Material Upgrades

### 3a. Gerstner Wave Water Surface

Replace sine displacement with Gerstner waves for sharp-crest/flat-trough ocean wave shape. Compute proper normals for Fresnel reflection and caustic generation.

### 3b. Depth-Graded Lighting + Fresnel Rim Glow

Attenuate directional light color per-object based on Y position (warm near surface, blue at floor). Add Fresnel rim glow to creatures for cheap subsurface scattering (especially jellyfish bells).

### 3c. In-Scattering Term

Add Henyey-Greenstein phase-function-based in-scattering to the absorption pass. The water column itself glows faintly, with brighter patches near the surface.

## Phase 4 — Polish

- Kelp sway vertex animation (config has swaySpeed/swayAmplitude, shader not wired)
- Improved fish schooling (Boids-like flocking instead of circular orbits)
- Bloom integration for bioluminescent elements
- Per-variant ambient audio cues (stretch)

## Audit Gap Analysis (Ember 7.1 vs Ocean 4.5)

| Aspect | Ember | Ocean | Gap |
|--------|-------|-------|-----|
| Shader sophistication | 6-octave rotated FBM, domain warping | Simple Voronoi, basic sine waves | +2 |
| Multi-layer atmosphere | 3D Simplex sky + lightning | Basic god rays | +1 |
| Micro-effects | Heat distortion, particle bursts, fire wisp trails | Static particles | +1 |
| Geometry complexity | Multi-component pillars, animated veins | Static coral clusters | +0.5 |
| Physics feel | Lava crusting, particle cooling | Simple floating objects | +0.5 |

## References

- Subnautica: per-channel attenuation as #1 visual upgrade (Max McGuire)
- Martin Renou: real-time caustics via refraction
- Maxime Heckel: caustics + volumetric lighting in WebGL
- `three-good-godrays` (Ameobea): production-ready raymarched god rays
- Anderson Mancini: R3F water simulation demo
- Catlike Coding: looking-through-water distortion clamping
