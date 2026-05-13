# Deep Ocean Scene Upgrade — Design Spec

**Date:** 2026-05-12
**Status:** Approved
**Scope:** Upgrade OceanScene from simple tier (bubbles + gradient + ground plane) to complex tier, on par with ForestScene and WinterScene.

## Overview

The current OceanScene is ~50 lines: a sky gradient, a flat colored ground plane, and 80 rising bubbles. This upgrade transforms it into a full underwater environment with 3D models, layered particles, shader-driven caustics, bioluminescent lighting, and complete Scene Lab integration.

## Architecture

Follows the proven Forest/Winter pattern exactly:

| Artifact | Path | Purpose |
|----------|------|---------|
| `OceanSceneConfig` | `src/lib/shared/3d/environments/domain/models/scene-configs.ts` | Typed config interface |
| `createDefaultOceanDeepConfig()` | same file | Deep Ocean variant defaults |
| `createDefaultOceanReefConfig()` | same file | Coral Reef variant defaults |
| `OceanScene.svelte` | `src/lib/shared/3d/environments/scenes/OceanScene.svelte` | Replaces current simple scene |
| `OceanControls.svelte` | `src/lib/features/lab/tabs/scene-lab/components/OceanControls.svelte` | Scene Lab control panel |
| SceneId union | `src/lib/features/lab/tabs/scene-lab/domain/scene-lab-types.ts` | Add `"ocean-deep"` and `"ocean-reef"` |
| SceneLab.svelte | `src/lib/features/lab/tabs/scene-lab/SceneLab.svelte` | Route to OceanControls |
| scene-lab-state | `src/lib/features/lab/tabs/scene-lab/state/scene-lab-state.svelte.ts` | Add oceanConfig state |
| Environment3D.svelte | `src/lib/shared/3d/environments/components/Environment3D.svelte` | Pass config prop when Scene Lab active |
| BackgroundType enum | `@austencloud/backgrounds` | Add `CORAL_REEF` variant |

### Props Interface

```typescript
interface Props {
  variant?: OceanVariant; // "deep" | "reef"
  config?: OceanSceneConfig; // Full config override (Scene Lab)
}
```

Production callers pass `variant` and get baked defaults. Scene Lab passes `config` to drive every knob reactively.

## Variants

### Deep Ocean (existing `BackgroundType.DEEP_OCEAN`)
- Dark, atmospheric, heavy fog (density 0.035)
- Muted coral colors
- Bioluminescent accents are the only bright spots
- Moody, isolated feel

### Coral Reef (new `BackgroundType.CORAL_REEF`)
- Brighter, shallower water simulation
- Lighter fog (density 0.018)
- Vivid coral colors, more fish particles
- Warmer god ray lighting — tropical reef vibes

## Layers

All 9 layers are independently toggleable in Scene Lab. Each has a typed config section within `OceanSceneConfig`.

### 1. Ocean Floor

Reuses existing `TexturedGroundPlane` primitive.

| Parameter | Default (Deep) | Default (Reef) | Scene Lab |
|-----------|----------------|-----------------|-----------|
| color | `#1a3a4a` | `#2a4a5a` | color picker |
| size | 50m | 50m | slider 10-100m |
| textured | true | true | — |
| diffuseMap | `/textures/ocean-floor/diffuse.jpg` | same | — |
| normalMap | `/textures/ocean-floor/normal.jpg` | same | — |
| roughnessMap | `/textures/ocean-floor/roughness.jpg` | same | — |
| normalScale | 1.2 | 1.0 | slider 0-3 |
| textureRepeat | 30 | 30 | slider 4-60 |

Textures: sand PBR set from Poly Haven (CC0). Hosted on R2 CDN at `/textures/ocean-floor/`.

### 2. Coral Formations

GLB coral models arranged in a ring around the clearing edge, same placement pattern as Forest rocks. Material tinted with bioluminescent color-shift (same approach as Winter's `tintSnowy` — lerp toward glow color).

| Parameter | Default (Deep) | Default (Reef) | Scene Lab |
|-----------|----------------|-----------------|-----------|
| enabled | true | true | toggle |
| count | 12 | 16 | slider 0-30 |
| clearingRadius | 10 | 10 | slider 5-25m |
| glowColor | `#40a0c0` | `#ff8080` | color picker |
| glowBlend | 0.25 | 0.15 | slider 0-1 |

Models: 3-4 coral species (brain, fan, tube, staghorn). Source: KayKit Underwater Pack or Quaternius ocean set (CC0). Hosted on R2 CDN at `/models/ocean/`.

Function `tintBioluminescent(root, color, blend)` — same pattern as Winter's `tintSnowy`, lerps material color toward glow color.

### 3. Kelp Forest

GLB kelp strand models in concentric rings. Reuses `TreeRingConfig` type. Vertex animation for gentle swaying via `useTask` (Threlte's frame loop).

| Parameter | Default (Deep) | Default (Reef) | Scene Lab |
|-----------|----------------|-----------------|-----------|
| enabled | true | true | toggle |
| rings | 3 rings | 2 rings | ring editors (like Winter trees) |
| swaySpeed | 0.8 | 1.0 | slider 0-3 |
| swayAmplitude | 0.15 rad | 0.12 rad | slider 0-0.5 |
| clearingRadius | 10 | 12 | slider 5-25m |

Ring defaults (Deep):
- Ring 1: radius 12m, count 14, scaleBase 1.2, scaleVariation 0.4, radiusJitter 1.0
- Ring 2: radius 16m, count 20, scaleBase 1.0, scaleVariation 0.3, radiusJitter 1.5
- Ring 3: radius 20m, count 26, scaleBase 0.8, scaleVariation 0.25, radiusJitter 2.0

Models: 2 kelp strand variants. Could be procedural geometry (elongated cone + noise displacement) if good CC0 GLBs aren't available. R2 CDN at `/models/ocean/`.

Sway implementation: per-instance Y-axis rotation via sine function in `useTask`. Each instance gets a seed-based phase offset for organic variation.

### 4. Seabed Rocks

Reuse existing rock GLBs from Forest (KayKit) or Winter (Kenney) with underwater tint. Same placement pattern as Forest `rockPlacements`.

| Parameter | Default (Deep) | Default (Reef) | Scene Lab |
|-----------|----------------|-----------------|-----------|
| count | 8 | 10 | slider 0-20 |
| tintColor | `#1a3a4a` | `#2a4a5a` | color picker |
| tintBlend | 0.30 | 0.20 | slider 0-1 |

Uses `tintBioluminescent` with a darker, bluer tint to make rocks read as underwater.

### 5. Particles — Bubbles

Existing `FallingParticles` primitive with `type: "bubbles"`.

| Parameter | Default (Deep) | Default (Reef) | Scene Lab |
|-----------|----------------|-----------------|-----------|
| enabled | true | true | toggle |
| count | 80 | 120 | slider 0-500 |
| area | 6m x 4m x 6m | 8m x 4m x 8m | 3 sliders |
| speed | 0.075 | 0.09 | slider 0-0.5 |
| colors | `["#60c0e0","#80d0f0","#40a0c0","#a0e0ff"]` | same | 4 color pickers |
| sizeRange | [0.03, 0.09] | [0.02, 0.07] | 2 sliders |
| spin | false | false | — |

### 6. Particles — Dust Motes

Ambient underwater sediment. Uses `FallingParticles` with `type: "dust"`.

| Parameter | Default (Deep) | Default (Reef) | Scene Lab |
|-----------|----------------|-----------------|-----------|
| enabled | true | true | toggle |
| count | 120 | 80 | slider 0-500 |
| area | 15m x 6m x 15m | 12m x 5m x 12m | 3 sliders |
| speed | 0.015 | 0.02 | slider 0-0.1 |
| colors | `["#406080","#506878","#385868"]` | `["#608090","#708898","#587888"]` | color pickers |
| sizeRange | [0.02, 0.06] | [0.015, 0.04] | 2 sliders |
| spin | false | false | — |

### 7. Particles — Bioluminescent Plankton

Tiny glowing specks. Uses `FallingParticles` with `type: "fireflies"` (same glow shader, ocean colors).

| Parameter | Default (Deep) | Default (Reef) | Scene Lab |
|-----------|----------------|-----------------|-----------|
| enabled | true | false | toggle |
| count | 60 | 30 | slider 0-200 |
| area | 10m x 4m x 10m | 8m x 3m x 8m | 3 sliders |
| speed | 0.005 | 0.008 | slider 0-0.05 |
| colors | `["#60e0ff","#40c0ff","#80ffff"]` | `["#40e0c0","#60ffd0"]` | color pickers |
| sizeRange | [0.1, 0.25] | [0.08, 0.18] | 2 sliders |
| spin | false | false | — |

### 8. Jellyfish

Bioluminescent jellyfish GLBs drifting in mid-water. Translucent material (opacity + emissive). Pulsing glow via emissive intensity oscillation in `useTask`. Each jellyfish gets a `PointLight` for environmental cast.

| Parameter | Default (Deep) | Default (Reef) | Scene Lab |
|-----------|----------------|-----------------|-----------|
| enabled | true | true | toggle |
| count | 4 | 3 | slider 0-8 |
| glowColor | `#a064ff` | `#64c0ff` | color picker |
| driftSpeed | 0.3 | 0.4 | slider 0-2 |
| pulseRate | 0.5 Hz | 0.6 Hz | slider 0-2 |
| lightIntensity | 8 | 6 | slider 0-30 |
| lightDistance | 8m | 6m | slider 1-20m |
| spawnRadius | 8m | 10m | slider 3-20m |
| heightRange | [2m, 6m] | [1.5m, 5m] | 2 sliders |

Drift implementation: each jellyfish follows a slow Lissajous path (sine X + sine Y with different frequencies). Phase offset per instance for organic variation.

Pulse implementation: `emissiveIntensity = base + sin(time * pulseRate * 2PI) * amplitude` applied per frame.

Models: 1-2 jellyfish GLBs from KayKit Underwater Pack or Quaternius (CC0). R2 CDN at `/models/ocean/`.

### 9. Lighting

Three mixable layers, same concept as Forest (hemisphere + campfire point lights).

**Hemisphere Light:**

| Parameter | Default (Deep) | Default (Reef) | Scene Lab |
|-----------|----------------|-----------------|-----------|
| skyColor | `#1a3a5a` | `#4080b0` | color picker |
| groundColor | `#0a1a2a` | `#1a3040` | color picker |
| intensity | 0.4 | 0.7 | slider 0-3 |

**God Rays (DirectionalLight from above):**

| Parameter | Default (Deep) | Default (Reef) | Scene Lab |
|-----------|----------------|-----------------|-----------|
| enabled | true | true | toggle |
| color | `#4090b0` | `#80c0e0` | color picker |
| intensity | 0.6 | 1.2 | slider 0-3 |
| position | [5, 25, 5] | [5, 20, 5] | 3 sliders |

Bioluminescent point lights come from coral (Section 2) and jellyfish (Section 8) — no separate config needed.

### 10. Caustic Ripples

Animated caustic light pattern on the ocean floor. Shader-based: scrolling procedural noise multiplied against the ground.

| Parameter | Default (Deep) | Default (Reef) | Scene Lab |
|-----------|----------------|-----------------|-----------|
| enabled | true | true | toggle |
| intensity | 0.12 | 0.25 | slider 0-1 |
| speed | 0.02 | 0.03 | slider 0-0.1 |
| scale | 4.0 | 3.0 | slider 1-10 |
| color | `#60c0e0` | `#80d0f0` | color picker |

Implementation: a second ground-level plane (slightly above floor) with a custom `ShaderMaterial`. Vertex shader passes UV, fragment shader generates caustic pattern via 2-3 layered sine waves at different frequencies and angles, scrolled by time. Additive blending so it brightens the floor underneath.

Alternative: if perf is a concern, a pre-baked caustic texture atlas (4-8 frames) cycled via UV offset. Simpler but less organic.

### 11. Water Gradient + Fog

Reuses existing `SkyGradient` primitive and Three.js `FogExp2`.

| Parameter | Default (Deep) | Default (Reef) | Scene Lab |
|-----------|----------------|-----------------|-----------|
| sky.topColor | `#001a2e` | `#003355` | color picker |
| sky.midColor | `#003366` | `#006688` | color picker |
| sky.bottomColor | `#000a14` | `#001a33` | color picker |
| fog.color | `#002244` | `#004466` | color picker |
| fog.density | 0.035 | 0.018 | slider 0-0.1 |

## OceanSceneConfig Interface

```typescript
export interface OceanSceneConfig {
  sky: SkyGradientConfig;
  fog: FogConfig;
  ground: GroundConfig;

  coral: {
    enabled: boolean;
    count: number;
    clearingRadius: number;
    glowColor: string;
    glowBlend: number;
  };

  kelp: {
    enabled: boolean;
    rings: TreeRingConfig[];
    clearingRadius: number;
    swaySpeed: number;
    swayAmplitude: number;
  };

  rockCount: number;
  rockTintColor: string;
  rockTintBlend: number;

  bubbles: FallingParticlesConfig;
  dust: FallingParticlesConfig | null;
  plankton: FallingParticlesConfig | null;

  jellyfish: {
    enabled: boolean;
    count: number;
    glowColor: string;
    driftSpeed: number;
    pulseRate: number;
    lightIntensity: number;
    lightDistance: number;
    spawnRadius: number;
    heightRange: [number, number];
  } | null;

  godRays: {
    enabled: boolean;
    color: string;
    intensity: number;
    position: [number, number, number];
  } | null;

  caustics: {
    enabled: boolean;
    intensity: number;
    speed: number;
    scale: number;
    color: string;
  } | null;

  hemisphereLight: HemisphereLightConfig;
}
```

## 3D Model Assets

All CC0 licensed. Hosted on R2 CDN under `/models/ocean/` and `/textures/ocean-floor/`.

| Asset | Source | Files |
|-------|--------|-------|
| Coral (3-4 species) | KayKit Underwater or Quaternius | `coral_brain.glb`, `coral_fan.glb`, `coral_tube.glb`, `coral_staghorn.glb` |
| Kelp (2 variants) | Procedural or CC0 GLB | `kelp_tall.glb`, `kelp_short.glb` |
| Rocks (2 variants) | Reuse KayKit/Kenney existing | Already on CDN |
| Jellyfish (1-2) | KayKit Underwater or Quaternius | `jellyfish_a.glb`, `jellyfish_b.glb` |
| Sand textures | Poly Haven | `diffuse.jpg`, `normal.jpg`, `roughness.jpg` |

## Scene Lab Integration

### OceanControls.svelte

Collapsible `ParamPanel` sections per layer. Follows `WinterControls.svelte` pattern exactly. Sections:

1. Sky (3 color pickers)
2. Fog (color + density slider)
3. Ground (color + size + normal scale + texture repeat)
4. Coral (toggle + count + clearing radius + glow color + glow blend)
5. Kelp (toggle + ring editors + sway speed + sway amplitude)
6. Rocks (count + tint color + tint blend)
7. Bubbles (toggle + count + speed + size range + area)
8. Dust Motes (toggle + count + speed + size range + area)
9. Plankton (toggle + count + glow colors)
10. Jellyfish (toggle + count + glow color + drift speed + pulse rate + light intensity)
11. Caustics (toggle + intensity + speed + scale + color)
12. God Rays (toggle + color + intensity)
13. Hemisphere Light (sky + ground + intensity)

### State additions

`scene-lab-state.svelte.ts` gets `oceanConfig: OceanSceneConfig` alongside existing `winterConfig` and `forestConfig`.

### SceneId additions

```typescript
export type SceneId = "winter" | "forest-firefly" | "forest-autumn" | "ocean-deep" | "ocean-reef";
```

## Loading & Performance

- Progressive GLB loading with `sceneFeatures.reportProgress()` — same as Forest/Winter
- 15-second timeout safety valve lifts loading curtain if CDN stalls
- Caustic shader is the only new GPU cost beyond what Forest already does; all else is standard instanced meshes + particles
- Jellyfish `useTask` callbacks are lightweight (6 sine evaluations per frame)
- Kelp sway is per-instance Y rotation — no geometry rebuild

## Dependencies

- No new npm packages
- Reuses existing primitives: `SkyGradient`, `TexturedGroundPlane`, `GroundPlane`, `FallingParticles`
- Reuses existing types: `TreeRingConfig`, `FogConfig`, `HemisphereLightConfig`, `FallingParticlesConfig`, `SkyGradientConfig`, `GroundConfig`
- New custom `ShaderMaterial` for caustics (self-contained, no library)
- New `BackgroundType.CORAL_REEF` in `@austencloud/backgrounds` package
- New `OceanVariant = "deep" | "reef"` in environment enums

## Stretch Goal

- **Fish silhouettes** — distant small sprites swimming in wide arcs. Current `FallingParticles` only supports vertical drift (fall/rise). Horizontal swimming requires either a new particle movement mode or a separate sprite system. Include if implementation is cheap; defer if it requires a new primitive.

## Out of Scope

- Volumetric god rays (post-processing) — DirectionalLight is sufficient
- Water surface plane with refraction — scene is fully underwater, no surface visible
- Fish schooling AI — beyond simple sprites
- Sound design
