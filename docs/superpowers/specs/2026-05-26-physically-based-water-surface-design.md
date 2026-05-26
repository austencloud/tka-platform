# Physically-Based Water Surface

**Date:** 2026-05-26  
**Status:** Approved  
**Scope:** Ocean scene water surface rendering — both underwater and above-water perspectives

## Problem

The current WaterSurface.svelte uses a PlaneGeometry with only 64 segments (ultra) spanning a 360-unit plane. This produces visible tessellation artifacts — hard geometric lines where Gerstner wave displacement creates creases between vertices. The Snell's window interior is a flat `uSkyColor` uniform, not a view of the actual above-water scene. From above, the water has no Fresnel reflection/refraction split. The overall effect reads as "game-like" rather than physically correct.

## Architecture

### Files Modified

- **`WaterSurface.svelte`** — Complete shader rewrite. Accepts render target textures as props. Vertex shader unchanged (Gerstner waves), fragment shader replaced with physically-based optics.
- **`ocean-quality.ts`** — New quality fields: `waterRefractionEnabled`, `waterRefractionResolution`, `waterChromaticFringing`, `waterBeerLambert`. Segment counts bumped to 256/128/64.
- **`scene-configs.ts`** — Extended `OceanWaterSurfaceConfig` with absorption, chromatic fringing, fresnel, and foam parameters.
- **`OceanScene.svelte`** — Mounts `WaterRefractionPass`, passes RT textures to `WaterSurface`.

### New File

- **`ocean/WaterRefractionPass.svelte`** — Manages two WebGLRenderTargets (above-water and below-water captures). Renders the scene from a reflected camera position each frame. Exposes textures as bindable state.

## Render Pipeline

### Planar Reflection with Clipping Planes

Each frame, `WaterRefractionPass` determines which side of the water the camera is on and renders one extra pass:

**When camera is below water (underwater view):**
1. Create mirror camera at `mirrorY = 2 * waterHeight - camera.y`
2. Set clipping plane: `y > waterHeight` (renders only above-water geometry)
3. Render to `aboveWaterRT` (sky, boat, sun, sky gradient)
4. `WaterSurface` samples `aboveWaterRT` inside Snell's window with refraction distortion

**When camera is above water (surface view):**
1. Create mirror camera at reflected position
2. Set clipping plane: `y < waterHeight` (renders only underwater geometry)
3. Render to `belowWaterRT` (seabed, fish, coral, kelp)
4. `WaterSurface` samples `belowWaterRT` for look-down refraction and `aboveWaterRT` for reflection

Only one RT pass renders per frame — the one for the opposite side of the water from the camera. The same side's scene is already in the main framebuffer and can be sampled via screen-space UV for effects like TIR reflection (underwater) or Fresnel reflection (above water uses the sky gradient directly — no second RT needed since the primary reflection is sky).

### Render Target Resolution by Tier

| Tier | Resolution | Extra GPU cost |
|------|-----------|---------------|
| Ultra | 1024x1024 | ~25-40% |
| Medium | 512x512 | ~15-20% |
| Low | Disabled | 0% (procedural fallback) |

### Exclusions from Reflection Pass

The water surface mesh itself, the sky dome, and fog are excluded from the reflection render to avoid self-intersection and reduce draw calls.

## Underwater Fragment Shader (Snell's Window)

### Physics

- Snell's law: `n_water * sin(theta_water) = n_air * sin(theta_air)`
- Water IOR = 1.333, critical angle ≈ 48.6° from vertical
- Inside critical cone: refracted view of above-water world
- Outside critical cone: Total Internal Reflection (dark mirror of underwater scene)

### Shader Pipeline

1. **View angle computation** — dot product of view direction with Gerstner-derived surface normal
2. **Snell's window mask** — smoothstep around critical angle, perturbed by animated noise (existing uNoiseScale/uNoiseSpeed/uNoiseAmplitude)
3. **Window interior** — sample `uAboveWaterRT` with refraction UV offset based on surface normal and view angle. UV offset = `surfaceNormal.xz * refractionStrength * (1.0 - cosTheta)`
4. **Chromatic dispersion** — at window edge (within `edgeWidth` of critical angle), offset R and B channels by `±chromaticStrength` to simulate wavelength-dependent refraction
5. **TIR region** — dark tinted color. When render targets are available, samples below-water RT for realistic mirror effect. Otherwise uses `uColor * tirDarkness`
6. **Beer-Lambert absorption** — applied to TIR reflection: `color *= exp(-absorption * viewDistance)` with per-channel rates (red absorbed fastest, blue penetrates deepest)
7. **Edge brightening** — Fresnel-like brightening near the Snell's window boundary

### Fallback (Low Tier / No RT)

Uses upgraded procedural shader:
- Gradient sky model inside window (top → horizon transition) instead of flat color
- Animated sun disc
- Beer-Lambert absorption on fog color
- Same Gerstner normals for smooth wave shading
- No chromatic fringing

## Above-Water Fragment Shader

### Physics

- Fresnel effect: steep viewing angles see mostly reflection, shallow angles see through to underwater
- Schlick approximation: `R = R0 + (1 - R0) * (1 - cosTheta)^5`
- R0 for water ≈ 0.02

### Shader Pipeline

1. **Fresnel split** — compute reflection coefficient from view angle and surface normal
2. **Reflection** — sky gradient sampled analytically (same vertical gradient model as the SkyGradient primitive, computed in-shader from view direction). No RT needed for sky reflection.
3. **Refraction** — sample underwater scene from `uBelowWaterRT` at offset UV, apply Beer-Lambert absorption based on depth
4. **Blend** — `mix(refraction, reflection, fresnel)`
5. **Foam** — on wave crests where `displacement > foam.threshold`, add white highlight at `foam.intensity`
6. **Specular** — sun reflection using Blinn-Phong or GGX on wave normals

### Fallback (Low Tier / No RT)

- Procedural sky reflection (gradient + sun disc)
- Fog-colored refraction tint
- Foam and specular still active

## Quality Tier Integration

Extended fields in `OceanQualityConfig`:

| Field | Ultra | Medium | Low |
|-------|-------|--------|-----|
| `waterSurfaceSegments` | 256 | 128 | 64 |
| `waterRefractionEnabled` | true | true | false |
| `waterRefractionResolution` | 1024 | 512 | 0 |
| `waterChromaticFringing` | true | true | false |
| `waterBeerLambert` | true | true | true |

The segment bump alone (256 vs. 64) eliminates the tessellation artifacts. Even low-tier users benefit from smoother wave rendering.

## Config Extensions

New fields on `OceanWaterSurfaceConfig`:

```typescript
absorption: {
  red: number;    // 0.45
  green: number;  // 0.15
  blue: number;   // 0.04
};

chromaticFringing: {
  enabled: boolean;
  strength: number;  // 0.003
  edgeWidth: number; // 0.1
};

fresnel: {
  r0: number;     // 0.02
  power: number;  // 5.0
};

foam: {
  threshold: number; // 0.08
  intensity: number; // 0.3
};
```

All parameters are Scene Lab-drivable for real-time tuning.

## Existing Seabed Caustics

The voronoi caustics on the seabed (`ProceduralSeabed.svelte`, line 334-346) remain as-is. They already produce convincing light patterns. The ocean config's `caustics: null` should be populated to enable them, with intensity modulated by Beer-Lambert distance from the water surface.

## Mesh Resolution Justification

Current: 64 segments across 360 units = 5.6 units per quad edge.
Target: 256 segments across 360 units = 1.4 units per quad edge.

At 1.4 units per edge, Gerstner wave features (typical wavelength 5-10 units) are sampled at 4-7 vertices per wave — well above the Nyquist minimum of 2 for smooth reconstruction. The analytical normals from the Gerstner tangent/binormal computation (already implemented in the vertex shader) provide per-pixel smooth shading between vertices.

## Performance Budget

| Component | Ultra cost | Medium cost | Low cost |
|-----------|-----------|-------------|----------|
| Water mesh (256/128/64 segs) | 131k tris | 33k tris | 8k tris |
| Reflection RT render | 1 extra scene pass at 1024² | 1 pass at 512² | Skipped |
| Beer-Lambert (per-pixel) | Negligible | Negligible | Negligible |
| Chromatic fringing | 2 extra texture samples | 2 extra samples | Skipped |

Total frame budget impact on ultra: ~25-40% increase from reflection pass. This is within budget for a premium visual feature — the ocean scene is already GPU-heavy from fish boids, kelp sway, and particle systems.

## Out of Scope

- Physically-projected caustics from water surface normals (the voronoi approximation is sufficient and much cheaper)
- Screen-space reflections (the planar reflection approach is more accurate for a flat water plane)
- Subsurface scattering in the water volume
- Dynamic foam generation from wave collision
