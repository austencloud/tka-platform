# Space Scene Upgrade — Design Spec

**Date:** 2026-05-12
**Status:** Draft
**Scope:** Upgrade CosmicScene from "simple" tier (sky gradient + asteroid + stars) to "complex" tier (on par with ForestScene/WinterScene), with full Scene Lab integration.

## Current State

`CosmicScene.svelte` renders:
- `SkyGradient` with variant-specific palettes (night: purple/indigo, aurora: cyan/magenta/green)
- `GroundPlane` — flat 1.25m asteroid disc
- `FallingParticles` — 200 drifting stars

No config interface. No Scene Lab support. No GLB assets. No lighting beyond default ambient.

## Target State

A rich lunar/space-station environment with configurable terrain, celestial objects, multi-layer particles, and a three-light lighting stack — all tunable via Scene Lab.

## Architecture

### 1. Config Interface — `CosmicSceneConfig`

Added to `scene-configs.ts` alongside `ForestSceneConfig` and `WinterSceneConfig`.

```typescript
interface CosmicSceneConfig {
  sky: SkyGradientConfig;
  fog: FogConfig;

  ground: {
    color: string;
    size: number;        // lunar terrain radius (meters)
    textured: boolean;
    diffuseMap?: string;
    normalMap?: string;
    roughnessMap?: string;
    normalScale?: number;
    textureRepeat?: number;
  };

  platform: {
    enabled: boolean;
    shape: "circle" | "hexagon";
    radius: number;           // meters
    height: number;           // thickness
    metallic: number;         // 0-1
    roughness: number;        // 0-1
    baseColor: string;
    emissiveColor: string;    // edge glow + accent veins
    emissiveIntensity: number;
    edgeGlowWidth: number;    // rim light width
    pulseSpeed: number;       // 0 = static, >0 = breathing pulse
  };

  earth: {
    enabled: boolean;
    position: [number, number, number]; // world coords
    radius: number;                     // visual size
    rimColor: string;                   // atmosphere glow
    rimIntensity: number;
    rotationSpeed: number;              // slow spin
  };

  nebula: {
    enabled: boolean;
    color1: string;
    color2: string;
    opacity: number;
    scale: number;
    animationSpeed: number;
  };

  // Particle layers — each independently toggleable
  particles: {
    starDrift: FallingParticlesConfig | null;
    cosmicDust: FallingParticlesConfig | null;
    energyParticles: {
      enabled: boolean;
      count: number;
      riseSpeed: number;
      colors: string[];
      sizeRange: [number, number];
      spawnRadius: number;      // matches platform radius
      maxHeight: number;
    } | null;
    meteorStreaks: {
      enabled: boolean;
      frequency: number;        // avg seconds between streaks
      speed: number;
      colors: string[];
      trailLength: number;
    } | null;
  };

  // Three-layer lighting stack
  lighting: {
    ambient: HemisphereLightConfig;
    coldDirectional: {
      enabled: boolean;
      color: string;
      intensity: number;
      position: [number, number, number]; // direction from Earth
    };
    warmStation: {
      enabled: boolean;
      color: string;
      intensity: number;
      distance: number;
      decay: number;
      heightOffset: number;     // how far above platform
    };
    accentEmissive: {
      enabled: boolean;
      color: string;
      intensity: number;
      pulseSpeed: number;       // syncs with platform pulse
    };
  };
}
```

Two default factory functions:
- `createDefaultCosmicNightConfig()` — deep purple/indigo, cold blue Earth light, minimal warm glow
- `createDefaultCosmicAuroraConfig()` — cyan/magenta/green, warmer accent glow, aurora-tinted nebula

### 2. Scene Components

**CosmicScene.svelte** — expanded from 77 lines to full scene orchestrator:
- Accepts optional `config?: CosmicSceneConfig` prop (Scene Lab override)
- Falls back to variant-appropriate default config
- Composes all sub-elements from config

**New sub-components** (all under `environments/primitives/` or `environments/scenes/cosmic/`):
- **StationPlatform.svelte** — procedural mesh (CircleGeometry or custom hex) with `MeshStandardMaterial`. Emissive edge glow via custom shader chunk or emissiveMap. Pulse animation via `useTask` frame loop.
- **EarthSphere.svelte** — textured sphere with Fresnel rim glow shader. Slow rotation. Earth texture from `/textures/cosmic/earth-diffuse.jpg` (2K, loaded async).
- **NebulaLayer.svelte** — inverted partial sphere or screen-space quad with procedural noise shader. Two-color gradient with animated UV offset for slow drift.
- **EnergyParticles.svelte** — GPU particle system (BufferGeometry + ShaderMaterial). Particles spawn at platform radius, rise upward, fade at maxHeight. Distinct from FallingParticles (which falls/drifts) — these rise from a ring.
- **MeteorStreaks.svelte** — spawns line-geometry streaks at random intervals. Each streak: random start position in upper hemisphere, random direction, fast travel, trail fade. Uses `Line2` or custom trail mesh.

### 3. Textures & Assets

| Asset | Source | Size | Path |
|---|---|---|---|
| Earth diffuse | NASA Blue Marble (public domain) | 2K | `/textures/cosmic/earth-diffuse.jpg` |
| Lunar regolith diffuse | CC0 texture | 1K | `/textures/cosmic/lunar-diffuse.jpg` |
| Lunar regolith normal | CC0 texture | 1K | `/textures/cosmic/lunar-normal.jpg` |
| Lunar regolith roughness | Generated | 1K | `/textures/cosmic/lunar-roughness.jpg` |

No GLB models needed. Station platform is procedural geometry. Earth is a textured sphere primitive. This keeps the scene lightweight compared to Forest/Winter (which load multiple KayKit GLBs from CDN).

### 4. Scene Lab Integration

**scene-lab-types.ts** — add two new SceneIds:
```typescript
type SceneId = "winter" | "forest-firefly" | "forest-autumn" | "cosmic-night" | "cosmic-aurora";
```

**scene-lab-state.svelte.ts** — add:
- `cosmicNightConfig` and `cosmicAuroraConfig` state
- Wire into `resetCurrent()`, `currentConfigSnapshot()`, factory name/type mappings

**CosmicControls.svelte** — new controls panel (follows WinterControls/ForestControls pattern):
- **Sky** section: 3 color pickers + fog density
- **Ground** section: color, size, texture toggle
- **Platform** section: shape toggle, radius, metallic, roughness, base color, emissive color, emissive intensity, edge glow width, pulse speed
- **Earth** section: enabled toggle, position (3 sliders), radius, rim color, rim intensity, rotation speed
- **Nebula** section: enabled toggle, color1, color2, opacity, scale, animation speed
- **Particles** section: subsections for each of 4 layers, each with enabled toggle + individual params
- **Lighting** section: subsections for ambient, cold directional, warm station, accent emissive

**SceneLab.svelte** — add `CosmicControls` to the controls-scroll conditional.

**ScenePreview.svelte** — wire cosmic variants into the preview renderer with config pass-through.

### 5. Environment3D Integration

No changes needed — `Environment3D.svelte` already maps `BackgroundType.NIGHT_SKY` to `CosmicScene` with variant. The CosmicScene component just becomes richer internally.

### 6. Scene Feature Readiness

Earth texture is async-loaded. Register progress:
```typescript
sceneFeatures.reportProgress("environment", loaded / total);
sceneFeatures.reportReady("environment");
```
Safety timeout at 15s (same pattern as ForestScene).

### 7. Variant Differences

| Element | Cosmic Night | Cosmic Aurora |
|---|---|---|
| Sky | Deep purple → indigo → near-black | Deep teal → emerald → dark cyan |
| Nebula | Subtle purple wash | Vivid cyan/magenta bands |
| Earth rim | Blue-white | Cyan-tinted |
| Platform emissive | Cool blue (#4488ff) | Teal-green (#00ccaa) |
| Cold directional | Blue-white, moderate | Cyan, slightly warmer |
| Accent color | Indigo (#6644cc) | Magenta (#cc44aa) |
| Dust motes | White/blue | Cyan/magenta mix |
| Star drift colors | White, pale blue, lavender | Cyan, magenta, teal, pink |

### 8. Performance Budget

- No GLB loading (unlike Forest/Winter) — faster initial load
- Earth texture: single 2K JPG (~200KB), async
- Lunar textures: 3x 1K JPG (~150KB total), async
- Particle systems: 4 layers but each capped (dust: 100, energy: 50, meteors: ~3 active, stars: 200 existing)
- Meteor streaks: simple line geometry, pooled (max 5 concurrent)
- Platform shader: single standard material with emissive — negligible cost
- Target: 60fps on mid-range GPU, same as Forest/Winter

### 9. What This Does NOT Include

- No audio (ambient space sounds — separate feature if wanted)
- No interactive elements (clicking Earth, etc.)
- No additional celestial bodies beyond Earth (Saturn, etc. — add later if wanted)
- No space debris / satellite models (keep it clean, add via Scene Lab iteration)
