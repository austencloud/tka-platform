# Deep Ocean Scene Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade OceanScene from simple tier (bubbles + gradient) to complex tier with 9 toggleable layers, two variants, and full Scene Lab integration — matching ForestScene and WinterScene.

**Architecture:** Follows the Forest/Winter pattern exactly: typed `OceanSceneConfig` interface with `createDefaultOcean*Config()` factories, a rewritten `OceanScene.svelte` that accepts an optional `config` prop for Scene Lab, and an `OceanControls.svelte` panel for live tuning. GLB models load from R2 CDN with progressive loading and a 15-second timeout safety valve.

**Tech Stack:** Svelte 5, Threlte (Three.js), GLSL shaders (caustics), R2 CDN (assets), `@austencloud/backgrounds` (BackgroundType enum)

**Spec:** `docs/superpowers/specs/2026-05-12-deep-ocean-scene-upgrade-design.md`

---

## File Map

### New files
| File | Purpose |
|------|---------|
| `src/lib/features/lab/tabs/scene-lab/components/OceanControls.svelte` | Scene Lab slider panel for ocean config |

### Modified files
| File | Change |
|------|--------|
| `src/lib/shared/3d/environments/domain/enums/environment-enums.ts` | Add `OceanVariant` |
| `src/lib/shared/3d/environments/domain/models/scene-configs.ts` | Add `OceanSceneConfig`, two `createDefault*` factories |
| `src/lib/shared/3d/environments/scenes/OceanScene.svelte` | Full rewrite from simple to complex |
| `src/lib/features/lab/tabs/scene-lab/domain/scene-lab-types.ts` | Add `"ocean-deep"`, `"ocean-reef"` to `SceneId` |
| `src/lib/features/lab/tabs/scene-lab/state/scene-lab-state.svelte.ts` | Add ocean config state + reset/copy logic |
| `src/lib/features/lab/tabs/scene-lab/SceneLab.svelte` | Import OceanControls, route when ocean selected |
| `src/lib/features/lab/tabs/scene-lab/components/ScenePreview.svelte` | Render OceanScene with lab config |
| `src/lib/shared/3d/environments/components/Environment3D.svelte` | Pass variant prop for ocean |

### Assets (upload to R2 CDN)
| Path | Source |
|------|--------|
| `/models/ocean/coral_brain.glb` | CC0 underwater pack |
| `/models/ocean/coral_fan.glb` | CC0 underwater pack |
| `/models/ocean/coral_tube.glb` | CC0 underwater pack |
| `/models/ocean/kelp_tall.glb` | CC0 or procedural |
| `/models/ocean/kelp_short.glb` | CC0 or procedural |
| `/models/ocean/jellyfish_a.glb` | CC0 underwater pack |
| `/textures/ocean-floor/diffuse.jpg` | Poly Haven CC0 sand |
| `/textures/ocean-floor/normal.jpg` | Poly Haven CC0 sand |
| `/textures/ocean-floor/roughness.jpg` | Poly Haven CC0 sand |

---

## Task 1: Add OceanVariant Enum

**Files:**
- Modify: `src/lib/shared/3d/environments/domain/enums/environment-enums.ts`

- [ ] **Step 1: Add OceanVariant type**

```typescript
/**
 * Ocean scene color variants
 */
export type OceanVariant = "deep" | "reef";
```

Add this below the existing `CosmicVariant` type.

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no consumers yet)

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/environments/domain/enums/environment-enums.ts
git commit -m "feat(ocean): add OceanVariant enum type"
```

---

## Task 2: Add OceanSceneConfig Interface and Default Factories

**Files:**
- Modify: `src/lib/shared/3d/environments/domain/models/scene-configs.ts`

- [ ] **Step 1: Add OceanSceneConfig interface**

Add after the `WinterSceneConfig` interface (after line ~151), before the default config section:

```typescript
// ============================================================================
// Ocean scene
// ============================================================================

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

- [ ] **Step 2: Add shared constants**

Add after the Winter defaults section (after `createDefaultWinterConfig`):

```typescript
// ----- Ocean -----

const OCEAN_KELP_RINGS: TreeRingConfig[] = [
  { radius: 12, count: 14, scaleBase: 1.2, scaleVariation: 0.4, radiusJitter: 1.0 },
  { radius: 16, count: 20, scaleBase: 1.0, scaleVariation: 0.3, radiusJitter: 1.5 },
  { radius: 20, count: 26, scaleBase: 0.8, scaleVariation: 0.25, radiusJitter: 2.0 },
];

const OCEAN_FLOOR_TEXTURES = {
  diffuseMap: "/textures/ocean-floor/diffuse.jpg",
  normalMap: "/textures/ocean-floor/normal.jpg",
  roughnessMap: "/textures/ocean-floor/roughness.jpg",
};
```

- [ ] **Step 3: Add createDefaultOceanDeepConfig factory**

```typescript
export function createDefaultOceanDeepConfig(): OceanSceneConfig {
  return {
    sky: {
      topColor: "#001a2e",
      midColor: "#003366",
      bottomColor: "#000a14",
    },
    fog: { color: "#002244", density: 0.035 },
    ground: {
      color: "#1a3a4a",
      size: 50,
      textured: true,
      ...OCEAN_FLOOR_TEXTURES,
      normalScale: 1.2,
      textureRepeat: 30,
    },
    coral: {
      enabled: true,
      count: 12,
      clearingRadius: 10,
      glowColor: "#40a0c0",
      glowBlend: 0.25,
    },
    kelp: {
      enabled: true,
      rings: OCEAN_KELP_RINGS,
      clearingRadius: 10,
      swaySpeed: 0.8,
      swayAmplitude: 0.15,
    },
    rockCount: 8,
    rockTintColor: "#1a3a4a",
    rockTintBlend: 0.30,
    bubbles: {
      type: "bubbles",
      count: 80,
      area: { width: 6, height: 4, depth: 6 },
      speed: 0.075,
      colors: ["#60c0e0", "#80d0f0", "#40a0c0", "#a0e0ff"],
      sizeRange: [0.03, 0.09],
      spin: false,
    },
    dust: {
      type: "dust",
      count: 120,
      area: { width: 15, height: 6, depth: 15 },
      speed: 0.015,
      colors: ["#406080", "#506878", "#385868"],
      sizeRange: [0.02, 0.06],
      spin: false,
    },
    plankton: {
      type: "fireflies",
      count: 60,
      area: { width: 10, height: 4, depth: 10 },
      speed: 0.005,
      colors: ["#60e0ff", "#40c0ff", "#80ffff"],
      sizeRange: [0.1, 0.25],
      spin: false,
    },
    jellyfish: {
      enabled: true,
      count: 4,
      glowColor: "#a064ff",
      driftSpeed: 0.3,
      pulseRate: 0.5,
      lightIntensity: 8,
      lightDistance: 8,
      spawnRadius: 8,
      heightRange: [2, 6],
    },
    godRays: {
      enabled: true,
      color: "#4090b0",
      intensity: 0.6,
      position: [5, 25, 5],
    },
    caustics: {
      enabled: true,
      intensity: 0.12,
      speed: 0.02,
      scale: 4.0,
      color: "#60c0e0",
    },
    hemisphereLight: {
      skyColor: "#1a3a5a",
      groundColor: "#0a1a2a",
      intensity: 0.4,
    },
  };
}
```

- [ ] **Step 4: Add createDefaultOceanReefConfig factory**

```typescript
export function createDefaultOceanReefConfig(): OceanSceneConfig {
  return {
    sky: {
      topColor: "#003355",
      midColor: "#006688",
      bottomColor: "#001a33",
    },
    fog: { color: "#004466", density: 0.018 },
    ground: {
      color: "#2a4a5a",
      size: 50,
      textured: true,
      ...OCEAN_FLOOR_TEXTURES,
      normalScale: 1.0,
      textureRepeat: 30,
    },
    coral: {
      enabled: true,
      count: 16,
      clearingRadius: 10,
      glowColor: "#ff8080",
      glowBlend: 0.15,
    },
    kelp: {
      enabled: true,
      rings: [
        { radius: 14, count: 12, scaleBase: 1.0, scaleVariation: 0.35, radiusJitter: 1.0 },
        { radius: 18, count: 18, scaleBase: 0.8, scaleVariation: 0.25, radiusJitter: 1.5 },
      ],
      clearingRadius: 12,
      swaySpeed: 1.0,
      swayAmplitude: 0.12,
    },
    rockCount: 10,
    rockTintColor: "#2a4a5a",
    rockTintBlend: 0.20,
    bubbles: {
      type: "bubbles",
      count: 120,
      area: { width: 8, height: 4, depth: 8 },
      speed: 0.09,
      colors: ["#60c0e0", "#80d0f0", "#40a0c0", "#a0e0ff"],
      sizeRange: [0.02, 0.07],
      spin: false,
    },
    dust: {
      type: "dust",
      count: 80,
      area: { width: 12, height: 5, depth: 12 },
      speed: 0.02,
      colors: ["#608090", "#708898", "#587888"],
      sizeRange: [0.015, 0.04],
      spin: false,
    },
    plankton: {
      type: "fireflies",
      count: 30,
      area: { width: 8, height: 3, depth: 8 },
      speed: 0.008,
      colors: ["#40e0c0", "#60ffd0"],
      sizeRange: [0.08, 0.18],
      spin: false,
    },
    jellyfish: {
      enabled: true,
      count: 3,
      glowColor: "#64c0ff",
      driftSpeed: 0.4,
      pulseRate: 0.6,
      lightIntensity: 6,
      lightDistance: 6,
      spawnRadius: 10,
      heightRange: [1.5, 5],
    },
    godRays: {
      enabled: true,
      color: "#80c0e0",
      intensity: 1.2,
      position: [5, 20, 5],
    },
    caustics: {
      enabled: true,
      intensity: 0.25,
      speed: 0.03,
      scale: 3.0,
      color: "#80d0f0",
    },
    hemisphereLight: {
      skyColor: "#4080b0",
      groundColor: "#1a3040",
      intensity: 0.7,
    },
  };
}
```

- [ ] **Step 5: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/3d/environments/domain/models/scene-configs.ts
git commit -m "feat(ocean): add OceanSceneConfig interface and default factories"
```

---

## Task 3: Source and Upload 3D Assets

**Files:**
- Assets to upload to R2 CDN

This task runs in parallel with coding tasks. The OceanScene component uses fallback rendering (colored ground, no GLBs) until assets are available — same resilience pattern as Forest/Winter where `{#if $model}` gates all model rendering.

- [ ] **Step 1: Source CC0 coral models**

Search KayKit Underwater Pack, Quaternius ocean set, or Kenney assets for:
- Brain coral (rounded, bulbous)
- Fan coral (flat, branching)
- Tube coral (vertical cylinders)
- Optional: staghorn coral (branching antler shape)

Convert to `.glb` using `npx gltf-pipeline` if needed. Keep each under 500KB.

- [ ] **Step 2: Source CC0 kelp models**

Two strand variants — tall (4-6m) and short (2-3m). If no suitable CC0 GLBs exist, create procedural geometry later (elongated tapered cylinders with noise displacement). Use placeholder cylinders for now.

- [ ] **Step 3: Source CC0 jellyfish model**

Translucent bell + trailing tentacles. Model should have separate mesh groups for bell and tentacles so material can be set to transparent + emissive independently.

- [ ] **Step 4: Source CC0 sand textures**

From Poly Haven or ambientCG:
- `diffuse.jpg` — sandy color, ~1024x1024
- `normal.jpg` — ripple pattern
- `roughness.jpg` — mostly rough with smooth patches

- [ ] **Step 5: Upload all assets to R2 CDN**

Upload to `https://pub-f5505ed75927471cb198c54336317370.r2.dev/`:
- `/models/ocean/coral_brain.glb`
- `/models/ocean/coral_fan.glb`
- `/models/ocean/coral_tube.glb`
- `/models/ocean/kelp_tall.glb`
- `/models/ocean/kelp_short.glb`
- `/models/ocean/jellyfish_a.glb`
- `/textures/ocean-floor/diffuse.jpg`
- `/textures/ocean-floor/normal.jpg`
- `/textures/ocean-floor/roughness.jpg`

Alternatively, place textures in `static/textures/ocean-floor/` for local serving (like forest floor textures at `static/textures/forest-floor/`). GLBs go on R2 CDN (like forest trees).

- [ ] **Step 6: Verify asset accessibility**

```bash
curl -sI "https://pub-f5505ed75927471cb198c54336317370.r2.dev/models/ocean/coral_brain.glb" | head -3
```

Expected: `HTTP/2 200` with correct content-type.

---

## Task 4: Rewrite OceanScene.svelte — Core Structure

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/OceanScene.svelte`

- [ ] **Step 1: Rewrite with config-driven pattern**

Replace the entire file. This is the core structure with ground, sky, fog, lighting, and particles. GLB models (coral, kelp, jellyfish) come in the next task.

```svelte
<script lang="ts">
  import { T, useThrelte } from "@threlte/core";
  import { useGltf } from "@threlte/extras";
  import TexturedGroundPlane from "../primitives/TexturedGroundPlane.svelte";
  import GroundPlane from "../primitives/GroundPlane.svelte";
  import SkyGradient from "../primitives/SkyGradient.svelte";
  import FallingParticles from "../primitives/FallingParticles.svelte";
  import type { OceanVariant } from "../domain/enums/environment-enums";
  import {
    type OceanSceneConfig,
    createDefaultOceanDeepConfig,
    createDefaultOceanReefConfig,
  } from "../domain/models/scene-configs";
  import { onMount } from "svelte";
  import { userProportionsState } from "../../state/user-proportions-state.svelte";
  import { FogExp2, Color, Vector3 } from "three";
  import { getSceneFeatureContext } from "../../scene-features/context/scene-feature-context";

  interface Props {
    variant?: OceanVariant;
    config?: OceanSceneConfig;
  }

  let { variant = "deep", config }: Props = $props();

  const activeConfig = $derived(
    config ??
      (variant === "reef"
        ? createDefaultOceanReefConfig()
        : createDefaultOceanDeepConfig())
  );

  const R2_CDN = "https://pub-f5505ed75927471cb198c54336317370.r2.dev";

  // GLB models — gate rendering on load
  const coralBrain = useGltf(`${R2_CDN}/models/ocean/coral_brain.glb`);
  const coralFan = useGltf(`${R2_CDN}/models/ocean/coral_fan.glb`);
  const coralTube = useGltf(`${R2_CDN}/models/ocean/coral_tube.glb`);
  const kelpTall = useGltf(`${R2_CDN}/models/ocean/kelp_tall.glb`);
  const kelpShort = useGltf(`${R2_CDN}/models/ocean/kelp_short.glb`);
  const jellyfishModel = useGltf(`${R2_CDN}/models/ocean/jellyfish_a.glb`);

  const rockA = useGltf(`${R2_CDN}/models/forest/Rock_1_A_Color1.gltf`);
  const rockB = useGltf(`${R2_CDN}/models/forest/Rock_1_B_Color1.gltf`);

  const { scene } = useThrelte();

  let sceneFeatures = $state<ReturnType<typeof getSceneFeatureContext> | null>(null);
  try {
    sceneFeatures = getSceneFeatureContext();
  } catch {
    // May render outside scene feature system
  }

  const groundY = $derived(userProportionsState.groundY);

  // ---- Placements (reactive from config) ----

  const coralPlacements = $derived.by(() => {
    const { count, clearingRadius } = activeConfig.coral;
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + 0.3;
      const radius = clearingRadius - 1.5 + Math.sin(i * 3.7) * 1.5;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const scale = 0.6 + Math.abs(Math.sin(i * 2.3) * 0.4);
      const rotation = Math.sin(i * 1.7) * Math.PI;
      return [x, z, scale, rotation] as [number, number, number, number];
    });
  });

  const kelpPlacements = $derived.by(() => {
    return activeConfig.kelp.rings.flatMap((ring, ringIndex) =>
      Array.from({ length: ring.count }, (_, i) => {
        const angleOffset = ringIndex * 0.4;
        const angle = (i / ring.count) * Math.PI * 2 + angleOffset;
        const seed = ringIndex * 100 + i;
        const radiusVariation =
          ring.radius + Math.sin(seed * 3.7) * ring.radiusJitter;
        const x = Math.cos(angle) * radiusVariation;
        const z = Math.sin(angle) * radiusVariation;
        const scale =
          ring.scaleBase + Math.abs(Math.sin(seed * 2.3) * ring.scaleVariation);
        const rotation = angle + Math.PI + Math.sin(seed * 1.7) * 0.3;
        return [x, z, scale, rotation, seed] as [number, number, number, number, number];
      })
    );
  });

  const rockPlacements = $derived.by(() => {
    const count = activeConfig.rockCount;
    const clearingRadius = activeConfig.kelp.clearingRadius;
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + 0.2;
      const radius = clearingRadius - 2.0 + Math.sin(i * 4.1) * 1.0;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const scale = 0.3 + Math.abs(Math.sin(i * 3.2) * 0.25);
      const rotation = Math.sin(i * 2.8) * Math.PI;
      return [x, z, scale, rotation] as [number, number, number, number];
    });
  });

  const jellyfishPlacements = $derived.by(() => {
    const jf = activeConfig.jellyfish;
    if (!jf?.enabled) return [];
    return Array.from({ length: jf.count }, (_, i) => {
      const angle = (i / jf.count) * Math.PI * 2 + 0.5;
      const radius = jf.spawnRadius * (0.5 + Math.sin(i * 2.7) * 0.3);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = jf.heightRange[0] + (jf.heightRange[1] - jf.heightRange[0]) * ((i + 0.5) / jf.count);
      return { x, y, z, seed: i * 37 };
    });
  });

  // ---- Underwater tint (like Winter's tintSnowy) ----
  function tintUnderwater(root: { traverse: (cb: (obj: unknown) => void) => void }, color: string, blend: number) {
    const tintColor = new Color(color);
    root.traverse((obj) => {
      const m = obj as { isMesh?: boolean; material?: unknown };
      if (!m.isMesh || !m.material) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      const cloned = mats.map((mat) => {
        const clone = (mat as import("three").MeshStandardMaterial).clone();
        if (clone.color) clone.color.lerp(tintColor, blend);
        if (clone.emissive) clone.emissive.lerp(tintColor, blend * 0.5);
        return clone;
      });
      (m as { material: unknown }).material = Array.isArray(m.material)
        ? cloned
        : cloned[0];
    });
  }

  function underwaterClone(
    sourceScene: { clone: () => { traverse: (cb: (obj: unknown) => void) => void } },
    color: string,
    blend: number,
  ) {
    const cloned = sourceScene.clone();
    tintUnderwater(cloned, color, blend);
    return cloned;
  }

  // ---- Fog ----
  $effect(() => {
    if (!scene.current) return;
    const fog = activeConfig.fog;
    scene.current.fog = new FogExp2(new Color(fog.color), fog.density);
    return () => {
      if (scene.current) scene.current.fog = null;
    };
  });

  // ---- Loading progress ----
  $effect(() => {
    if (!sceneFeatures) return;
    const glbs = [$coralBrain, $coralFan, $coralTube, $kelpTall, $kelpShort, $jellyfishModel, $rockA, $rockB];
    const loaded = glbs.filter(Boolean).length;
    sceneFeatures.reportProgress("environment", loaded / glbs.length);
    if (loaded === glbs.length) {
      sceneFeatures.reportReady("environment");
    }
  });

  onMount(() => {
    const timer = setTimeout(() => {
      if (sceneFeatures && !sceneFeatures.isReady("environment")) {
        console.warn("[OceanScene] GLB loading timed out - lifting curtain");
        sceneFeatures.reportReady("environment");
      }
    }, 15_000);
    return () => clearTimeout(timer);
  });
</script>

<!-- Sky gradient -->
<SkyGradient
  topColor={activeConfig.sky.topColor}
  midColor={activeConfig.sky.midColor}
  bottomColor={activeConfig.sky.bottomColor}
/>

<!-- Ocean floor -->
{#if activeConfig.ground.textured && activeConfig.ground.diffuseMap}
  <TexturedGroundPlane
    color={activeConfig.ground.color}
    size={activeConfig.ground.size}
    diffuseMap={activeConfig.ground.diffuseMap}
    normalMap={activeConfig.ground.normalMap}
    roughnessMap={activeConfig.ground.roughnessMap}
    normalScale={activeConfig.ground.normalScale ?? 1.0}
    textureRepeat={activeConfig.ground.textureRepeat ?? 8}
  />
{:else}
  <GroundPlane
    color={activeConfig.ground.color}
    size={activeConfig.ground.size}
    opacity={activeConfig.ground.opacity ?? 1}
  />
{/if}

<!-- Bubbles -->
{#key `bubbles|${activeConfig.bubbles.count}|${activeConfig.bubbles.sizeRange[0]}|${activeConfig.bubbles.area.width}|${activeConfig.bubbles.speed}`}
  <FallingParticles
    type={activeConfig.bubbles.type}
    count={activeConfig.bubbles.count}
    area={activeConfig.bubbles.area}
    speed={activeConfig.bubbles.speed}
    colors={activeConfig.bubbles.colors}
    sizeRange={activeConfig.bubbles.sizeRange}
    spin={activeConfig.bubbles.spin}
  />
{/key}

<!-- Dust motes -->
{#if activeConfig.dust}
  {#key `dust|${activeConfig.dust.count}|${activeConfig.dust.sizeRange[0]}|${activeConfig.dust.area.width}|${activeConfig.dust.speed}`}
    <FallingParticles
      type={activeConfig.dust.type}
      count={activeConfig.dust.count}
      area={activeConfig.dust.area}
      speed={activeConfig.dust.speed}
      colors={activeConfig.dust.colors}
      sizeRange={activeConfig.dust.sizeRange}
      spin={activeConfig.dust.spin}
    />
  {/key}
{/if}

<!-- Bioluminescent plankton -->
{#if activeConfig.plankton}
  {#key `plankton|${activeConfig.plankton.count}|${activeConfig.plankton.sizeRange[0]}|${activeConfig.plankton.area.width}`}
    <FallingParticles
      type={activeConfig.plankton.type}
      count={activeConfig.plankton.count}
      area={activeConfig.plankton.area}
      speed={activeConfig.plankton.speed}
      colors={activeConfig.plankton.colors}
      sizeRange={activeConfig.plankton.sizeRange}
      spin={activeConfig.plankton.spin}
    />
  {/key}
{/if}

<!-- Coral formations -->
{#if activeConfig.coral.enabled && $coralBrain && $coralFan && $coralTube}
  {#each coralPlacements as [x, z, scale, rotY], i}
    {@const coralModels = [$coralBrain, $coralFan, $coralTube]}
    {@const source = coralModels[i % coralModels.length]!}
    <T
      is={underwaterClone(source.scene, activeConfig.coral.glowColor, activeConfig.coral.glowBlend)}
      position.x={x}
      position.y={groundY}
      position.z={z}
      {scale}
      rotation.y={rotY}
    />
  {/each}
{/if}

<!-- Kelp forest -->
{#if activeConfig.kelp.enabled && $kelpTall && $kelpShort}
  {#each kelpPlacements as [x, z, scale, rotY, seed], i}
    {@const source = i % 2 === 0 ? $kelpTall : $kelpShort}
    <T
      is={underwaterClone(source.scene, "#0d3a1a", 0.2)}
      position.x={x}
      position.y={groundY}
      position.z={z}
      {scale}
      rotation.y={rotY}
    />
  {/each}
{/if}

<!-- Seabed rocks -->
{#if $rockA && $rockB}
  {#each rockPlacements as [x, z, scale, rotY], i}
    {@const source = i % 2 === 0 ? $rockA : $rockB}
    <T
      is={underwaterClone(source.scene, activeConfig.rockTintColor, activeConfig.rockTintBlend)}
      position.x={x}
      position.y={groundY}
      position.z={z}
      {scale}
      rotation.y={rotY}
    />
  {/each}
{/if}

<!-- Jellyfish with point lights -->
{#if activeConfig.jellyfish?.enabled && $jellyfishModel}
  {#each jellyfishPlacements as jf}
    <T.Group position.x={jf.x} position.y={groundY + jf.y} position.z={jf.z}>
      <T
        is={underwaterClone($jellyfishModel.scene, activeConfig.jellyfish.glowColor, 0.4)}
        scale={0.5}
      />
      <T.PointLight
        color={activeConfig.jellyfish.glowColor}
        intensity={activeConfig.jellyfish.lightIntensity}
        distance={activeConfig.jellyfish.lightDistance}
        decay={2}
      />
    </T.Group>
  {/each}
{/if}

<!-- God rays (directional light from above) -->
{#if activeConfig.godRays?.enabled}
  <T.DirectionalLight
    color={activeConfig.godRays.color}
    intensity={activeConfig.godRays.intensity}
    position.x={activeConfig.godRays.position[0]}
    position.y={activeConfig.godRays.position[1]}
    position.z={activeConfig.godRays.position[2]}
  />
{/if}

<!-- Hemisphere ambient -->
<T.HemisphereLight
  color={activeConfig.hemisphereLight.skyColor}
  groundColor={activeConfig.hemisphereLight.groundColor}
  intensity={activeConfig.hemisphereLight.intensity}
/>
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/OceanScene.svelte
git commit -m "feat(ocean): rewrite OceanScene from simple to complex tier"
```

---

## Task 5: Update Environment3D to Pass Variant

**Files:**
- Modify: `src/lib/shared/3d/environments/components/Environment3D.svelte`

- [ ] **Step 1: Add variant prop to ocean scene rendering**

In the `getSceneConfig` function, change the `DEEP_OCEAN` case to include a variant. Also add the `OceanVariant` import. In the `SceneConfig` type, update ocean to support variants:

Change the type union member from:
```typescript
| { scene: "ocean" }
```
to:
```typescript
| { scene: "ocean"; variant: "deep" | "reef" }
```

Change the switch case from:
```typescript
case BackgroundType.DEEP_OCEAN:
  return { scene: "ocean" };
```
to:
```typescript
case BackgroundType.DEEP_OCEAN:
  return { scene: "ocean", variant: "deep" };
```

Change the template from:
```svelte
{:else if config.scene === "ocean"}
  <OceanScene />
```
to:
```svelte
{:else if config.scene === "ocean"}
  <OceanScene variant={config.variant} />
```

Note: `CORAL_REEF` BackgroundType doesn't exist in the package yet. When it's added later, add a second case:
```typescript
case BackgroundType.CORAL_REEF:
  return { scene: "ocean", variant: "reef" };
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/environments/components/Environment3D.svelte
git commit -m "feat(ocean): pass variant prop to OceanScene from Environment3D"
```

---

## Task 6: Scene Lab Integration — Types and State

**Files:**
- Modify: `src/lib/features/lab/tabs/scene-lab/domain/scene-lab-types.ts`
- Modify: `src/lib/features/lab/tabs/scene-lab/state/scene-lab-state.svelte.ts`

- [ ] **Step 1: Add ocean SceneIds**

In `scene-lab-types.ts`, update the type and options:

```typescript
export type SceneId = "winter" | "forest-firefly" | "forest-autumn" | "cosmic-night" | "cosmic-aurora" | "ocean-deep" | "ocean-reef";
```

Add to `SCENE_OPTIONS` array:

```typescript
{
  id: "ocean-deep",
  label: "Ocean (Deep)",
  description: "Dark underwater with bioluminescent life and kelp forest",
},
{
  id: "ocean-reef",
  label: "Ocean (Coral Reef)",
  description: "Bright tropical reef with vivid coral and warm god rays",
},
```

- [ ] **Step 2: Add ocean state to scene-lab-state**

In `scene-lab-state.svelte.ts`, add imports:

```typescript
import {
  type OceanSceneConfig,
  createDefaultOceanDeepConfig,
  createDefaultOceanReefConfig,
} from "$lib/shared/3d/environments/domain/models/scene-configs";
```

Add state variables (after the cosmic ones):

```typescript
let oceanDeepConfig = $state<OceanSceneConfig>(createDefaultOceanDeepConfig());
let oceanReefConfig = $state<OceanSceneConfig>(createDefaultOceanReefConfig());
```

Add to `resetCurrent`:

```typescript
else if (sceneId === "ocean-deep")
  oceanDeepConfig = createDefaultOceanDeepConfig();
else if (sceneId === "ocean-reef")
  oceanReefConfig = createDefaultOceanReefConfig();
```

Add to `currentConfigSnapshot`:

```typescript
if (sceneId === "ocean-deep") return $state.snapshot(oceanDeepConfig);
if (sceneId === "ocean-reef") return $state.snapshot(oceanReefConfig);
```

Add to `currentDefaultFnName`:

```typescript
case "ocean-deep":
  return "createDefaultOceanDeepConfig";
case "ocean-reef":
  return "createDefaultOceanReefConfig";
```

Add to `currentConfigTypeName`:

```typescript
if (sceneId.startsWith("ocean")) return "OceanSceneConfig";
```

Add getters to the return object:

```typescript
get oceanDeepConfig() {
  return oceanDeepConfig;
},
get oceanReefConfig() {
  return oceanReefConfig;
},
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/lab/tabs/scene-lab/domain/scene-lab-types.ts src/lib/features/lab/tabs/scene-lab/state/scene-lab-state.svelte.ts
git commit -m "feat(ocean): add ocean scene IDs and state to Scene Lab"
```

---

## Task 7: Create OceanControls.svelte

**Files:**
- Create: `src/lib/features/lab/tabs/scene-lab/components/OceanControls.svelte`

- [ ] **Step 1: Write the controls panel**

Follow WinterControls pattern exactly — `ParamPanel` sections with `ParamSlider` and `ParamColor`.

```svelte
<script lang="ts">
  import ParamPanel from "./ParamPanel.svelte";
  import ParamSlider from "./ParamSlider.svelte";
  import ParamColor from "./ParamColor.svelte";
  import { getSceneLabContext } from "../context/scene-lab-context";

  const { state } = getSceneLabContext();

  const isDeep = $derived(state.sceneId === "ocean-deep");
  const cfg = $derived(isDeep ? state.oceanDeepConfig : state.oceanReefConfig);

  function mutate() {
    return isDeep ? state.oceanDeepConfig : state.oceanReefConfig;
  }
</script>

<ParamPanel title="Sky">
  <ParamColor label="Top" value={cfg.sky.topColor} onChange={(v) => (mutate().sky.topColor = v)} />
  <ParamColor label="Mid" value={cfg.sky.midColor ?? "#000000"} onChange={(v) => (mutate().sky.midColor = v)} />
  <ParamColor label="Bottom" value={cfg.sky.bottomColor} onChange={(v) => (mutate().sky.bottomColor = v)} />
</ParamPanel>

<ParamPanel title="Fog">
  <ParamColor label="Color" value={cfg.fog.color} onChange={(v) => (mutate().fog.color = v)} />
  <ParamSlider label="Density" value={cfg.fog.density} min={0} max={0.1} step={0.001} onChange={(v) => (mutate().fog.density = v)} />
</ParamPanel>

<ParamPanel title="Ground">
  <ParamColor label="Color" value={cfg.ground.color} onChange={(v) => (mutate().ground.color = v)} />
  <ParamSlider label="Size" value={cfg.ground.size} min={10} max={100} step={5} unit="m" onChange={(v) => (mutate().ground.size = v)} />
  <ParamSlider label="Normal scale" value={cfg.ground.normalScale ?? 1} min={0} max={3} step={0.1} onChange={(v) => (mutate().ground.normalScale = v)} />
  <ParamSlider label="Texture repeat" value={cfg.ground.textureRepeat ?? 8} min={4} max={60} step={1} onChange={(v) => (mutate().ground.textureRepeat = v)} />
</ParamPanel>

<ParamPanel title="Coral">
  <ParamSlider label="Enabled" value={cfg.coral.enabled ? 1 : 0} min={0} max={1} step={1} onChange={(v) => (mutate().coral.enabled = v > 0.5)} />
  <ParamSlider label="Count" value={cfg.coral.count} min={0} max={30} step={1} onChange={(v) => (mutate().coral.count = v)} />
  <ParamSlider label="Clearing radius" value={cfg.coral.clearingRadius} min={5} max={25} step={0.5} unit="m" onChange={(v) => (mutate().coral.clearingRadius = v)} />
  <ParamColor label="Glow color" value={cfg.coral.glowColor} onChange={(v) => (mutate().coral.glowColor = v)} />
  <ParamSlider label="Glow blend" value={cfg.coral.glowBlend} min={0} max={1} step={0.01} onChange={(v) => (mutate().coral.glowBlend = v)} />
</ParamPanel>

<ParamPanel title="Kelp forest" defaultOpen={false}>
  <ParamSlider label="Enabled" value={cfg.kelp.enabled ? 1 : 0} min={0} max={1} step={1} onChange={(v) => (mutate().kelp.enabled = v > 0.5)} />
  <ParamSlider label="Sway speed" value={cfg.kelp.swaySpeed} min={0} max={3} step={0.1} onChange={(v) => (mutate().kelp.swaySpeed = v)} />
  <ParamSlider label="Sway amplitude" value={cfg.kelp.swayAmplitude} min={0} max={0.5} step={0.01} unit="rad" onChange={(v) => (mutate().kelp.swayAmplitude = v)} />
  <ParamSlider label="Clearing radius" value={cfg.kelp.clearingRadius} min={5} max={25} step={0.5} unit="m" onChange={(v) => (mutate().kelp.clearingRadius = v)} />
  {#each cfg.kelp.rings as _, i}
    <div class="ring-group">
      <div class="ring-label">Ring {i + 1}</div>
      <ParamSlider label="Radius" value={cfg.kelp.rings[i]!.radius} min={8} max={40} step={0.5} unit="m" onChange={(v) => (mutate().kelp.rings[i]!.radius = v)} />
      <ParamSlider label="Count" value={cfg.kelp.rings[i]!.count} min={0} max={50} step={1} onChange={(v) => (mutate().kelp.rings[i]!.count = v)} />
      <ParamSlider label="Scale base" value={cfg.kelp.rings[i]!.scaleBase} min={0.3} max={2.5} step={0.05} onChange={(v) => (mutate().kelp.rings[i]!.scaleBase = v)} />
    </div>
  {/each}
</ParamPanel>

<ParamPanel title="Rocks" defaultOpen={false}>
  <ParamSlider label="Count" value={cfg.rockCount} min={0} max={20} step={1} onChange={(v) => (mutate().rockCount = v)} />
  <ParamColor label="Tint color" value={cfg.rockTintColor} onChange={(v) => (mutate().rockTintColor = v)} />
  <ParamSlider label="Tint blend" value={cfg.rockTintBlend} min={0} max={1} step={0.01} onChange={(v) => (mutate().rockTintBlend = v)} />
</ParamPanel>

<ParamPanel title="Bubbles">
  <ParamSlider label="Count" value={cfg.bubbles.count} min={0} max={500} step={10} onChange={(v) => (mutate().bubbles.count = v)} />
  <ParamSlider label="Speed" value={cfg.bubbles.speed} min={0} max={0.5} step={0.005} unit="m/s" onChange={(v) => (mutate().bubbles.speed = v)} />
  <ParamSlider label="Min size" value={cfg.bubbles.sizeRange[0]} min={0.01} max={0.2} step={0.005} unit="m" onChange={(v) => (mutate().bubbles.sizeRange[0] = v)} />
  <ParamSlider label="Max size" value={cfg.bubbles.sizeRange[1]} min={0.02} max={0.3} step={0.005} unit="m" onChange={(v) => (mutate().bubbles.sizeRange[1] = v)} />
  <ParamSlider label="Area width" value={cfg.bubbles.area.width} min={2} max={30} step={1} unit="m" onChange={(v) => (mutate().bubbles.area.width = v)} />
  {#each cfg.bubbles.colors as _, i}
    <ParamColor label={`Color ${i + 1}`} value={cfg.bubbles.colors[i]!} onChange={(v) => (mutate().bubbles.colors[i] = v)} />
  {/each}
</ParamPanel>

{#if cfg.dust}
  <ParamPanel title="Dust motes" defaultOpen={false}>
    <ParamSlider label="Count" value={cfg.dust.count} min={0} max={500} step={10} onChange={(v) => { if (mutate().dust) mutate().dust!.count = v; }} />
    <ParamSlider label="Speed" value={cfg.dust.speed} min={0} max={0.1} step={0.001} onChange={(v) => { if (mutate().dust) mutate().dust!.speed = v; }} />
    <ParamSlider label="Area width" value={cfg.dust.area.width} min={2} max={30} step={1} unit="m" onChange={(v) => { if (mutate().dust) mutate().dust!.area.width = v; }} />
  </ParamPanel>
{/if}

{#if cfg.plankton}
  <ParamPanel title="Bioluminescent plankton" defaultOpen={false}>
    <ParamSlider label="Count" value={cfg.plankton.count} min={0} max={200} step={5} onChange={(v) => { if (mutate().plankton) mutate().plankton!.count = v; }} />
    <ParamSlider label="Speed" value={cfg.plankton.speed} min={0} max={0.05} step={0.001} onChange={(v) => { if (mutate().plankton) mutate().plankton!.speed = v; }} />
    {#each cfg.plankton.colors as _, i}
      <ParamColor label={`Color ${i + 1}`} value={cfg.plankton.colors[i]!} onChange={(v) => { if (mutate().plankton) mutate().plankton!.colors[i] = v; }} />
    {/each}
  </ParamPanel>
{/if}

{#if cfg.jellyfish}
  <ParamPanel title="Jellyfish" defaultOpen={false}>
    <ParamSlider label="Enabled" value={cfg.jellyfish.enabled ? 1 : 0} min={0} max={1} step={1} onChange={(v) => { if (mutate().jellyfish) mutate().jellyfish!.enabled = v > 0.5; }} />
    <ParamSlider label="Count" value={cfg.jellyfish.count} min={0} max={8} step={1} onChange={(v) => { if (mutate().jellyfish) mutate().jellyfish!.count = v; }} />
    <ParamColor label="Glow color" value={cfg.jellyfish.glowColor} onChange={(v) => { if (mutate().jellyfish) mutate().jellyfish!.glowColor = v; }} />
    <ParamSlider label="Drift speed" value={cfg.jellyfish.driftSpeed} min={0} max={2} step={0.05} onChange={(v) => { if (mutate().jellyfish) mutate().jellyfish!.driftSpeed = v; }} />
    <ParamSlider label="Pulse rate" value={cfg.jellyfish.pulseRate} min={0} max={2} step={0.05} unit="Hz" onChange={(v) => { if (mutate().jellyfish) mutate().jellyfish!.pulseRate = v; }} />
    <ParamSlider label="Light intensity" value={cfg.jellyfish.lightIntensity} min={0} max={30} step={1} onChange={(v) => { if (mutate().jellyfish) mutate().jellyfish!.lightIntensity = v; }} />
    <ParamSlider label="Light distance" value={cfg.jellyfish.lightDistance} min={1} max={20} step={0.5} unit="m" onChange={(v) => { if (mutate().jellyfish) mutate().jellyfish!.lightDistance = v; }} />
    <ParamSlider label="Spawn radius" value={cfg.jellyfish.spawnRadius} min={3} max={20} step={0.5} unit="m" onChange={(v) => { if (mutate().jellyfish) mutate().jellyfish!.spawnRadius = v; }} />
  </ParamPanel>
{/if}

{#if cfg.caustics}
  <ParamPanel title="Caustic ripples" defaultOpen={false}>
    <ParamSlider label="Enabled" value={cfg.caustics.enabled ? 1 : 0} min={0} max={1} step={1} onChange={(v) => { if (mutate().caustics) mutate().caustics!.enabled = v > 0.5; }} />
    <ParamSlider label="Intensity" value={cfg.caustics.intensity} min={0} max={1} step={0.01} onChange={(v) => { if (mutate().caustics) mutate().caustics!.intensity = v; }} />
    <ParamSlider label="Speed" value={cfg.caustics.speed} min={0} max={0.1} step={0.002} onChange={(v) => { if (mutate().caustics) mutate().caustics!.speed = v; }} />
    <ParamSlider label="Scale" value={cfg.caustics.scale} min={1} max={10} step={0.5} onChange={(v) => { if (mutate().caustics) mutate().caustics!.scale = v; }} />
    <ParamColor label="Color" value={cfg.caustics.color} onChange={(v) => { if (mutate().caustics) mutate().caustics!.color = v; }} />
  </ParamPanel>
{/if}

{#if cfg.godRays}
  <ParamPanel title="God rays" defaultOpen={false}>
    <ParamSlider label="Enabled" value={cfg.godRays.enabled ? 1 : 0} min={0} max={1} step={1} onChange={(v) => { if (mutate().godRays) mutate().godRays!.enabled = v > 0.5; }} />
    <ParamColor label="Color" value={cfg.godRays.color} onChange={(v) => { if (mutate().godRays) mutate().godRays!.color = v; }} />
    <ParamSlider label="Intensity" value={cfg.godRays.intensity} min={0} max={3} step={0.05} onChange={(v) => { if (mutate().godRays) mutate().godRays!.intensity = v; }} />
  </ParamPanel>
{/if}

<ParamPanel title="Hemisphere light" defaultOpen={false}>
  <ParamColor label="Sky" value={cfg.hemisphereLight.skyColor} onChange={(v) => (mutate().hemisphereLight.skyColor = v)} />
  <ParamColor label="Ground" value={cfg.hemisphereLight.groundColor} onChange={(v) => (mutate().hemisphereLight.groundColor = v)} />
  <ParamSlider label="Intensity" value={cfg.hemisphereLight.intensity} min={0} max={3} step={0.05} onChange={(v) => (mutate().hemisphereLight.intensity = v)} />
</ParamPanel>

<style>
  .ring-group {
    margin: 4px 0 8px;
    padding: 4px 8px;
    background: rgba(255, 255, 255, 0.02);
    border-left: 2px solid var(--theme-accent, #38bdf8);
    border-radius: 4px;
  }

  .ring-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    margin-bottom: 4px;
  }
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/lab/tabs/scene-lab/components/OceanControls.svelte
git commit -m "feat(ocean): add OceanControls for Scene Lab"
```

---

## Task 8: Wire OceanControls into SceneLab and ScenePreview

**Files:**
- Modify: `src/lib/features/lab/tabs/scene-lab/SceneLab.svelte`
- Modify: `src/lib/features/lab/tabs/scene-lab/components/ScenePreview.svelte`

- [ ] **Step 1: Update SceneLab.svelte**

Add import:

```typescript
import OceanControls from "./components/OceanControls.svelte";
```

Update the controls routing in the template (the `{#if}` block in `.controls-scroll`):

```svelte
<div class="controls-scroll">
  {#if sceneState.sceneId === "winter"}
    <WinterControls />
  {:else if sceneState.sceneId.startsWith("ocean")}
    <OceanControls />
  {:else}
    <ForestControls />
  {/if}
</div>
```

Note: Cosmic scenes may also need routing here — check if they already fall through to ForestControls. If so, add cosmic routing too, but that's out of scope for this plan. For now the `{:else}` handles forest and cosmic.

- [ ] **Step 2: Update ScenePreview.svelte**

Add import:

```typescript
import OceanScene from "$lib/shared/3d/environments/scenes/OceanScene.svelte";
```

Add ocean scene rendering in the `T.Group` (after the cosmic aurora block):

```svelte
{:else if labState.sceneId === "ocean-deep"}
  <OceanScene variant="deep" config={labState.oceanDeepConfig} />
{:else if labState.sceneId === "ocean-reef"}
  <OceanScene variant="reef" config={labState.oceanReefConfig} />
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/lab/tabs/scene-lab/SceneLab.svelte src/lib/features/lab/tabs/scene-lab/components/ScenePreview.svelte
git commit -m "feat(ocean): wire OceanScene into Scene Lab preview and controls"
```

---

## Task 9: Caustic Shader (Stretch — Can Ship Without)

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/OceanScene.svelte` (add caustic plane)

The caustic effect is a translucent plane slightly above the ground with a custom `ShaderMaterial` that generates animated refracted light patterns.

- [ ] **Step 1: Add caustic shader material and plane to OceanScene**

Add to the `<script>` section:

```typescript
import { ShaderMaterial, AdditiveBlending, PlaneGeometry, DoubleSide } from "three";

function createCausticMaterial(color: string, intensity: number, speed: number, scale: number): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    blending: AdditiveBlending,
    side: DoubleSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new Color(color) },
      uIntensity: { value: intensity },
      uScale: { value: scale },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uIntensity;
      uniform float uScale;
      varying vec2 vUv;

      float causticLayer(vec2 p, float t) {
        float a = sin(p.x * 3.0 + t * 0.7) * sin(p.y * 2.5 + t * 0.5);
        float b = sin(p.x * 2.0 - t * 0.6) * sin(p.y * 3.5 - t * 0.4);
        float c = sin((p.x + p.y) * 2.8 + t * 0.8);
        return (a + b + c) / 3.0;
      }

      void main() {
        vec2 scaledUv = (vUv - 0.5) * uScale;
        float c1 = causticLayer(scaledUv, uTime);
        float c2 = causticLayer(scaledUv * 1.3 + 0.5, uTime * 1.2);
        float pattern = smoothstep(0.0, 0.8, (c1 + c2) * 0.5 + 0.5);
        float alpha = pattern * uIntensity;
        gl_FragColor = vec4(uColor * alpha, alpha);
      }
    `,
  });
}
```

Add a reactive effect to animate the caustic uniform:

```typescript
import { useTask } from "@threlte/core";

let causticMaterial = $state<ShaderMaterial | null>(null);

$effect(() => {
  const c = activeConfig.caustics;
  if (!c?.enabled) {
    causticMaterial = null;
    return;
  }
  causticMaterial = createCausticMaterial(c.color, c.intensity, c.speed, c.scale);
});

useTask((delta) => {
  if (causticMaterial) {
    causticMaterial.uniforms.uTime!.value += delta * (activeConfig.caustics?.speed ?? 0.02) * 10;
  }
});
```

Add to the template (after the ground plane section):

```svelte
<!-- Caustic light ripples -->
{#if activeConfig.caustics?.enabled && causticMaterial}
  <T.Mesh
    position.y={groundY + 0.02}
    rotation.x={-Math.PI / 2}
    material={causticMaterial}
  >
    <T.PlaneGeometry args={[activeConfig.ground.size * 0.8, activeConfig.ground.size * 0.8]} />
  </T.Mesh>
{/if}
```

- [ ] **Step 2: Update caustic uniforms reactively**

Add an effect that syncs config changes into the material uniforms:

```typescript
$effect(() => {
  if (!causticMaterial || !activeConfig.caustics) return;
  causticMaterial.uniforms.uColor!.value = new Color(activeConfig.caustics.color);
  causticMaterial.uniforms.uIntensity!.value = activeConfig.caustics.intensity;
  causticMaterial.uniforms.uScale!.value = activeConfig.caustics.scale;
});
```

- [ ] **Step 3: Run typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/OceanScene.svelte
git commit -m "feat(ocean): add caustic ripple shader on ocean floor"
```

---

## Task 10: Jellyfish Animation (Drift + Pulse)

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/OceanScene.svelte`

The static jellyfish placements from Task 4 need animation: slow Lissajous drift paths and emissive intensity pulsing.

- [ ] **Step 1: Add jellyfish animation state**

In the `<script>` section, add an animation state array and a `useTask` callback:

```typescript
let jellyfishOffsets = $state<{ dx: number; dy: number; dz: number }[]>([]);

$effect(() => {
  const jf = activeConfig.jellyfish;
  if (!jf?.enabled) {
    jellyfishOffsets = [];
    return;
  }
  jellyfishOffsets = Array.from({ length: jf.count }, () => ({ dx: 0, dy: 0, dz: 0 }));
});

let jellyfishTime = 0;
useTask((delta) => {
  const jf = activeConfig.jellyfish;
  if (!jf?.enabled || jellyfishOffsets.length === 0) return;
  jellyfishTime += delta * jf.driftSpeed;

  for (let i = 0; i < jellyfishOffsets.length; i++) {
    const phase = i * 2.3;
    jellyfishOffsets[i] = {
      dx: Math.sin(jellyfishTime * 0.7 + phase) * 1.5,
      dy: Math.sin(jellyfishTime * 0.4 + phase * 1.3) * 0.5,
      dz: Math.cos(jellyfishTime * 0.5 + phase * 0.8) * 1.5,
    };
  }
});
```

- [ ] **Step 2: Update jellyfish template to use animated offsets**

Replace the static jellyfish rendering with animated positions:

```svelte
{#if activeConfig.jellyfish?.enabled && $jellyfishModel}
  {#each jellyfishPlacements as jf, i}
    {@const offset = jellyfishOffsets[i] ?? { dx: 0, dy: 0, dz: 0 }}
    <T.Group
      position.x={jf.x + offset.dx}
      position.y={groundY + jf.y + offset.dy}
      position.z={jf.z + offset.dz}
    >
      <T
        is={underwaterClone($jellyfishModel.scene, activeConfig.jellyfish.glowColor, 0.4)}
        scale={0.5}
      />
      <T.PointLight
        color={activeConfig.jellyfish.glowColor}
        intensity={activeConfig.jellyfish.lightIntensity * (0.7 + 0.3 * Math.sin(jellyfishTime * activeConfig.jellyfish.pulseRate * Math.PI * 2 + i * 1.7))}
        distance={activeConfig.jellyfish.lightDistance}
        decay={2}
      />
    </T.Group>
  {/each}
{/if}
```

The pulse is applied via the light intensity oscillation: `base * (0.7 + 0.3 * sin(time * rate))`. This makes the glow throb between 70-100% of configured intensity.

- [ ] **Step 3: Run typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/OceanScene.svelte
git commit -m "feat(ocean): add jellyfish drift animation and pulsing glow"
```

---

## Task 11: Final Verification

- [ ] **Step 1: Run full typecheck**

Run: `npx tsc --noEmit`
Expected: PASS with zero errors

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Visual verification**

Open Scene Lab, select "Ocean (Deep)" from the scene picker. Verify:
- Sky gradient renders (deep blue)
- Ground plane appears with sandy texture (or fallback color if textures not uploaded yet)
- Bubbles rise
- Dust motes drift
- Plankton glows
- Fog fades distant objects
- God ray directional light casts from above
- Hemisphere light provides ambient
- If GLBs uploaded: coral, kelp, rocks, and jellyfish render with underwater tint
- All Scene Lab sliders respond (change a fog density, sky color, bubble count)

Switch to "Ocean (Coral Reef)". Verify:
- Lighter, brighter atmosphere
- Different fog density
- Warmer god ray color
- Higher bubble count
- Controls still work

- [ ] **Step 4: Commit any final fixes**

```bash
git add -u
git commit -m "feat(ocean): deep ocean scene upgrade complete"
```
