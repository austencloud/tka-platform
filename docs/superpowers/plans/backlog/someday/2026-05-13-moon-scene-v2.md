# Moon Scene v2 — Hybrid Grandeur + Mystical

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the cosmic/moon 3D scene from a basic lunar surface into a jaw-dropping "alien amphitheater" — crystal formations serve as audience barriers, the platform channels lunar energy through glowing ground veins, Earth casts volumetric god rays, and a proper starfield replaces the particle-based stars.

**Architecture:** Six new/upgraded components in `src/lib/shared/3d/environments/scenes/cosmic/`. Each is a self-contained Svelte component with its own shader, driven by config values in `CosmicSceneConfig`. The ground plane gets a custom shader replacing `TexturedGroundPlane` to support emissive energy veins. Config changes enable nebula and tune particle counts.

**Tech Stack:** Threlte/Svelte 5, Three.js custom ShaderMaterial, GLSL shaders, existing `useTask` animation loop, `userProportionsState.groundY` for vertical alignment.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/shared/3d/environments/scenes/cosmic/LunarCrystals.svelte` | Create | Procedural translucent crystal prism clusters around stage |
| `src/lib/shared/3d/environments/scenes/cosmic/EarthGodRays.svelte` | Create | Volumetric light beams emanating from Earth's direction |
| `src/lib/shared/3d/environments/scenes/cosmic/LunarGroundPlane.svelte` | Create | Custom ground with emissive energy vein network |
| `src/lib/shared/3d/environments/scenes/cosmic/Starfield.svelte` | Create | High-quality point-sprite starfield on sky dome |
| `src/lib/shared/3d/environments/scenes/CosmicScene.svelte` | Modify | Wire new components, remove rock GLBs, swap ground plane |
| `src/lib/shared/3d/environments/domain/models/scene-configs.ts` | Modify | Add config interfaces + defaults for new components |

---

### Task 1: Add Config Interfaces and Defaults

**Files:**
- Modify: `src/lib/shared/3d/environments/domain/models/scene-configs.ts`

- [ ] **Step 1: Add new config interfaces after `MeteorStreaksConfig`**

In `scene-configs.ts`, add these interfaces after `MeteorStreaksConfig` (around line 296):

```typescript
export interface LunarCrystalsConfig {
  enabled: boolean;
  /** Number of crystal cluster groups around the platform. */
  clusterCount: number;
  /** Distance from center for cluster ring (meters). */
  ringRadius: number;
  /** Crystal body color. */
  color: string;
  /** Inner glow emissive color. */
  glowColor: string;
  /** Emissive intensity of crystal glow. */
  glowIntensity: number;
  /** Base height range [min, max] in meters. */
  heightRange: [number, number];
  /** Opacity of crystal bodies (0-1). */
  opacity: number;
}

export interface EarthGodRaysConfig {
  enabled: boolean;
  /** Beam color. */
  color: string;
  /** Overall intensity multiplier. */
  intensity: number;
  /** Number of visible beams. */
  count: number;
  /** Drift animation speed. */
  speed: number;
}

export interface LunarGroundConfig {
  enabled: boolean;
  /** Vein emissive color. */
  veinColor: string;
  /** Vein glow intensity. */
  veinIntensity: number;
  /** Vein animation pulse speed. */
  veinPulseSpeed: number;
  /** Vein network density (scale factor for noise). */
  veinDensity: number;
}

export interface StarfieldConfig {
  enabled: boolean;
  /** Total star count. */
  count: number;
  /** Dome radius (meters). */
  radius: number;
  /** Size range [min, max] for star sprites. */
  sizeRange: [number, number];
  /** Twinkle animation speed. */
  twinkleSpeed: number;
}
```

- [ ] **Step 2: Add new fields to CosmicSceneConfig**

Add these fields to `CosmicSceneConfig` after the `lighting` field:

```typescript
export interface CosmicSceneConfig {
  // ... existing fields ...
  lighting: { /* ... existing ... */ };
  /** Crystal formations around the platform. */
  crystals: LunarCrystalsConfig;
  /** Volumetric god rays from Earth direction. */
  godRays: EarthGodRaysConfig;
  /** Custom lunar ground with energy veins. */
  lunarGround: LunarGroundConfig;
  /** High-quality starfield dome. */
  starfield: StarfieldConfig;
}
```

- [ ] **Step 3: Add defaults to `createDefaultCosmicNightConfig`**

Add after the `lighting` block:

```typescript
    crystals: {
      enabled: true,
      clusterCount: 8,
      ringRadius: 6.5,
      color: "#334466",
      glowColor: "#4488ff",
      glowIntensity: 0.8,
      heightRange: [0.8, 2.5],
      opacity: 0.6,
    },
    godRays: {
      enabled: true,
      color: "#4488ff",
      intensity: 0.15,
      count: 5,
      speed: 0.3,
    },
    lunarGround: {
      enabled: true,
      veinColor: "#4488ff",
      veinIntensity: 0.4,
      veinPulseSpeed: 0.5,
      veinDensity: 3.0,
    },
    starfield: {
      enabled: true,
      count: 1500,
      radius: 75,
      sizeRange: [0.5, 3.0],
      twinkleSpeed: 0.8,
    },
```

- [ ] **Step 4: Add defaults to `createDefaultCosmicAuroraConfig`**

Same structure but with aurora color palette:

```typescript
    crystals: {
      enabled: true,
      clusterCount: 10,
      ringRadius: 6.5,
      color: "#2a4455",
      glowColor: "#00ccaa",
      glowIntensity: 1.0,
      heightRange: [1.0, 3.0],
      opacity: 0.55,
    },
    godRays: {
      enabled: true,
      color: "#44ddcc",
      intensity: 0.12,
      count: 4,
      speed: 0.25,
    },
    lunarGround: {
      enabled: true,
      veinColor: "#00ccaa",
      veinIntensity: 0.5,
      veinPulseSpeed: 0.4,
      veinDensity: 2.5,
    },
    starfield: {
      enabled: true,
      count: 1500,
      radius: 75,
      sizeRange: [0.5, 3.0],
      twinkleSpeed: 0.6,
    },
```

- [ ] **Step 5: Re-enable nebula in night config**

Change the nebula block in `createDefaultCosmicNightConfig` from disabled to:

```typescript
    nebula: {
      enabled: true,
      color1: "#1a1040",
      color2: "#2a1555",
      opacity: 0.15,
      scale: 2.5,
      animationSpeed: 0.08,
    },
```

- [ ] **Step 6: Run typecheck**

Run: `npx svelte-check --threshold error --tsconfig tsconfig.json 2>&1 | grep -E "scene-configs|Cosmic"`

Expected: Errors about missing properties in CosmicScene (expected — components not wired yet).

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/3d/environments/domain/models/scene-configs.ts
git commit -m "feat(cosmic): add config interfaces for moon v2 components

Add LunarCrystalsConfig, EarthGodRaysConfig, LunarGroundConfig,
StarfieldConfig interfaces. Add defaults for night + aurora variants.
Re-enable nebula with subtle settings."
```

---

### Task 2: Lunar Crystal Formations

**Files:**
- Create: `src/lib/shared/3d/environments/scenes/cosmic/LunarCrystals.svelte`

- [ ] **Step 1: Create the crystal component**

```svelte
<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import {
    ConeGeometry,
    ShaderMaterial,
    AdditiveBlending,
    Color,
    MeshPhysicalMaterial,
  } from "three";
  import type { LunarCrystalsConfig } from "../../domain/models/scene-configs";
  import { userProportionsState } from "@austencloud/scene-3d";

  interface Props {
    config: LunarCrystalsConfig;
  }

  let { config }: Props = $props();
  const groundY = $derived(userProportionsState.groundY);

  const crystalGeometry = new ConeGeometry(0.15, 1, 6);

  interface CrystalPlacement {
    x: number;
    z: number;
    shards: Array<{
      height: number;
      radius: number;
      tilt: number;
      tiltAxis: number;
      rotY: number;
    }>;
  }

  function seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  const placements = $derived.by<CrystalPlacement[]>(() => {
    const result: CrystalPlacement[] = [];
    const rand = seededRandom(42);

    for (let i = 0; i < config.clusterCount; i++) {
      const angle = (i / config.clusterCount) * Math.PI * 2 + rand() * 0.3;
      const radiusJitter = (rand() - 0.5) * 1.5;
      const x = Math.cos(angle) * (config.ringRadius + radiusJitter);
      const z = Math.sin(angle) * (config.ringRadius + radiusJitter);

      const shardCount = 2 + Math.floor(rand() * 3);
      const shards: CrystalPlacement["shards"] = [];

      for (let j = 0; j < shardCount; j++) {
        const [minH, maxH] = config.heightRange;
        const h = minH + rand() * (maxH - minH);
        shards.push({
          height: h,
          radius: 0.08 + rand() * 0.12,
          tilt: (rand() - 0.5) * 0.4,
          tiltAxis: rand() * Math.PI * 2,
          rotY: rand() * Math.PI * 2,
        });
      }

      result.push({ x, z, shards });
    }
    return result;
  });

  const bodyMaterial = $derived.by(() => {
    return new MeshPhysicalMaterial({
      color: new Color(config.color),
      emissive: new Color(config.glowColor),
      emissiveIntensity: config.glowIntensity,
      transparent: true,
      opacity: config.opacity,
      roughness: 0.1,
      metalness: 0.2,
      transmission: 0.3,
      thickness: 0.5,
    });
  });

  let pulseTime = 0;

  useTask((delta) => {
    if (!bodyMaterial) return;
    pulseTime += delta * 0.5;
    const pulse = 1.0 + Math.sin(pulseTime) * 0.3;
    bodyMaterial.emissiveIntensity = config.glowIntensity * pulse;
  });
</script>

{#if config.enabled}
  {#each placements as cluster}
    <T.Group position.x={cluster.x} position.y={groundY} position.z={cluster.z}>
      {#each cluster.shards as shard}
        <T.Mesh
          geometry={crystalGeometry}
          material={bodyMaterial}
          scale.x={shard.radius / 0.15}
          scale.y={shard.height}
          scale.z={shard.radius / 0.15}
          position.y={shard.height / 2}
          rotation.x={Math.cos(shard.tiltAxis) * shard.tilt}
          rotation.y={shard.rotY}
          rotation.z={Math.sin(shard.tiltAxis) * shard.tilt}
        />
      {/each}
      <T.PointLight
        color={config.glowColor}
        intensity={config.glowIntensity * 3}
        distance={3}
        decay={2}
        position.y={1.0}
      />
    </T.Group>
  {/each}
{/if}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/cosmic/LunarCrystals.svelte
git commit -m "feat(cosmic): add LunarCrystals component

Procedural translucent crystal prism clusters arranged in a ring
around the platform. Each cluster has 2-4 shards with seeded random
variation in height, tilt, and scale. MeshPhysicalMaterial with
transmission for glass-like appearance. Pulsing emissive glow
synced with point lights at each cluster."
```

---

### Task 3: Earth God Rays

**Files:**
- Create: `src/lib/shared/3d/environments/scenes/cosmic/EarthGodRays.svelte`

- [ ] **Step 1: Create the god rays component**

Adapted from `celestial/GodRays.svelte` pattern, oriented toward Earth's position:

```svelte
<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import {
    PlaneGeometry,
    ShaderMaterial,
    AdditiveBlending,
    DoubleSide,
    Color,
  } from "three";
  import type { EarthGodRaysConfig, EarthConfig } from "../../domain/models/scene-configs";

  interface Props {
    config: EarthGodRaysConfig;
    earthConfig: EarthConfig;
  }

  let { config, earthConfig }: Props = $props();

  const geometry = new PlaneGeometry(30, 20, 1, 1);

  const vertexShader = /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uIntensity;
    uniform float uCount;
    varying vec2 vUv;

    float hash(float n) { return fract(sin(n) * 43758.5453); }

    void main() {
      float beams = 0.0;
      for (float i = 0.0; i < 8.0; i++) {
        if (i >= uCount) break;
        float offset = hash(i * 127.1) * 0.6 + 0.2;
        float width = 0.015 + hash(i * 311.7) * 0.025;
        float drift = sin(uTime + i * 2.7) * 0.02;
        float beam = smoothstep(width, 0.0, abs(vUv.x - offset - drift));
        beam *= (0.5 + hash(i * 197.3) * 0.5);
        beams += beam;
      }

      // Fade from top (Earth) to bottom (ground)
      float vFade = smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.3, vUv.y);

      // Subtle noise for atmosphere
      float noise = fract(sin(dot(vUv * 30.0 + uTime * 0.05, vec2(12.9898, 78.233))) * 43758.5453);
      beams *= (0.9 + noise * 0.1);

      float alpha = beams * vFade * uIntensity;
      gl_FragColor = vec4(uColor * 1.2, alpha);
    }
  `;

  let time = 0;

  const material = $derived.by(() => {
    return new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new Color(config.color) },
        uIntensity: { value: config.intensity },
        uCount: { value: config.count },
      },
      vertexShader,
      fragmentShader,
      side: DoubleSide,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    });
  });

  useTask((delta) => {
    if (!material) return;
    time += delta * config.speed;
    material.uniforms.uTime!.value = time;
  });

  $effect(() => {
    if (!material) return;
    material.uniforms.uColor!.value = new Color(config.color);
    material.uniforms.uIntensity!.value = config.intensity;
    material.uniforms.uCount!.value = config.count;
  });

  const rayRotationY = $derived(
    Math.atan2(-earthConfig.position[0], -earthConfig.position[2])
  );
  const rayTilt = $derived(
    -Math.atan2(earthConfig.position[1], Math.hypot(earthConfig.position[0], earthConfig.position[2])) * 0.5
  );
</script>

{#if config.enabled}
  <T.Mesh
    {geometry}
    {material}
    position.y={8}
    rotation.x={rayTilt}
    rotation.y={rayRotationY}
  />
{/if}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/cosmic/EarthGodRays.svelte
git commit -m "feat(cosmic): add EarthGodRays component

Volumetric light beams oriented toward Earth's position.
Shader-based beams with drift animation, vertical fade, and
subtle noise. Auto-rotates to face Earth direction from config."
```

---

### Task 4: Lunar Ground Plane with Energy Veins

**Files:**
- Create: `src/lib/shared/3d/environments/scenes/cosmic/LunarGroundPlane.svelte`

- [ ] **Step 1: Create the custom ground plane**

```svelte
<script lang="ts">
  import { T, useTask, useLoader } from "@threlte/core";
  import {
    ShaderMaterial,
    TextureLoader,
    RepeatWrapping,
    SRGBColorSpace,
    LinearSRGBColorSpace,
    Color,
    DoubleSide,
    type Texture,
  } from "three";
  import type { LunarGroundConfig, GroundConfig } from "../../domain/models/scene-configs";
  import { userProportionsState } from "@austencloud/scene-3d";

  interface Props {
    groundConfig: GroundConfig;
    veins: LunarGroundConfig;
  }

  let { groundConfig, veins }: Props = $props();
  const groundY = $derived(userProportionsState.groundY);

  const textureLoader = useLoader(TextureLoader);
  const diffuseTex = $derived(
    groundConfig.diffuseMap ? textureLoader.load(groundConfig.diffuseMap) : null
  );
  const normalTex = $derived(
    groundConfig.normalMap ? textureLoader.load(groundConfig.normalMap) : null
  );

  function configureTex(tex: Texture, repeat: number, colorSpace: string) {
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    tex.repeat.set(repeat, repeat);
    tex.colorSpace = colorSpace;
    tex.needsUpdate = true;
  }

  const vertexShader = /* glsl */ `
    varying vec2 vUv;
    varying vec3 vWorldPos;
    void main() {
      vUv = uv;
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPos = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform sampler2D uDiffuse;
    uniform sampler2D uNormal;
    uniform bool uHasDiffuse;
    uniform bool uHasNormal;
    uniform vec3 uBaseColor;
    uniform vec3 uVeinColor;
    uniform float uVeinIntensity;
    uniform float uVeinDensity;
    uniform float uTime;
    uniform float uRepeat;
    varying vec2 vUv;
    varying vec3 vWorldPos;

    // Simplex-style 2D noise
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

    float snoise2(vec2 v) {
      const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                         -0.577350269189626, 0.024390243902439);
      vec2 i = floor(v + dot(v, C.yy));
      vec2 x0 = v - i + dot(i, C.xx);
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod289(i);
      vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m * m;
      m = m * m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
      vec3 g;
      g.x = a0.x * x0.x + h.x * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    float veinPattern(vec2 p, float time) {
      float n1 = snoise2(p * 1.0 + time * 0.1);
      float n2 = snoise2(p * 2.3 + vec2(100.0) + time * 0.05);
      float n3 = snoise2(p * 5.0 + vec2(200.0));

      // Create vein-like lines from noise ridges
      float ridge1 = 1.0 - abs(n1);
      float ridge2 = 1.0 - abs(n2);

      ridge1 = pow(ridge1, 4.0);
      ridge2 = pow(ridge2, 6.0);

      float veins = ridge1 * 0.7 + ridge2 * 0.3;

      // Add fine detail
      veins += pow(1.0 - abs(n3), 8.0) * 0.15;

      return veins;
    }

    void main() {
      vec2 tiledUv = vWorldPos.xz * uRepeat / 60.0;

      // Base terrain color
      vec3 base = uBaseColor;
      if (uHasDiffuse) {
        base *= texture2D(uDiffuse, tiledUv).rgb;
      }

      // Energy veins
      vec2 veinUv = vWorldPos.xz * uVeinDensity / 10.0;
      float vein = veinPattern(veinUv, uTime);

      // Fade veins near platform center (let platform glow dominate)
      float distFromCenter = length(vWorldPos.xz);
      float centerFade = smoothstep(3.0, 5.0, distFromCenter);
      // Fade at edges
      float edgeFade = 1.0 - smoothstep(25.0, 30.0, distFromCenter);

      vein *= centerFade * edgeFade;

      // Pulse animation
      float pulse = 1.0 + sin(uTime * 3.14159) * 0.3;
      vec3 veinGlow = uVeinColor * vein * uVeinIntensity * pulse;

      vec3 finalColor = base + veinGlow;
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `;

  let time = 0;

  const material = $derived.by(() => {
    return new ShaderMaterial({
      uniforms: {
        uDiffuse: { value: null },
        uNormal: { value: null },
        uHasDiffuse: { value: false },
        uHasNormal: { value: false },
        uBaseColor: { value: new Color(groundConfig.color) },
        uVeinColor: { value: new Color(veins.veinColor) },
        uVeinIntensity: { value: veins.veinIntensity },
        uVeinDensity: { value: veins.veinDensity },
        uTime: { value: 0 },
        uRepeat: { value: groundConfig.textureRepeat ?? 30 },
      },
      vertexShader,
      fragmentShader,
      side: DoubleSide,
    });
  });

  $effect(() => {
    if (!material) return;
    const tex = diffuseTex ? $diffuseTex : null;
    if (tex) {
      configureTex(tex, groundConfig.textureRepeat ?? 30, SRGBColorSpace);
      material.uniforms.uDiffuse!.value = tex;
      material.uniforms.uHasDiffuse!.value = true;
    }
  });

  $effect(() => {
    if (!material) return;
    material.uniforms.uBaseColor!.value = new Color(groundConfig.color);
    material.uniforms.uVeinColor!.value = new Color(veins.veinColor);
    material.uniforms.uVeinIntensity!.value = veins.veinIntensity;
    material.uniforms.uVeinDensity!.value = veins.veinDensity;
  });

  useTask((delta) => {
    if (!material) return;
    time += delta * veins.veinPulseSpeed;
    material.uniforms.uTime!.value = time;
  });
</script>

{#if veins.enabled}
  <T.Group position={[0, groundY, 0]}>
    <T.Mesh rotation.x={-Math.PI / 2} {material}>
      <T.CircleGeometry args={[groundConfig.size, 64]} />
    </T.Mesh>
  </T.Group>
{/if}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/cosmic/LunarGroundPlane.svelte
git commit -m "feat(cosmic): add LunarGroundPlane with energy vein shader

Custom ground plane replacing TexturedGroundPlane for cosmic scene.
Overlays PBR rock texture with animated emissive vein network using
layered simplex noise ridge detection. Veins pulse with configurable
speed, fade near platform center and at ground edges."
```

---

### Task 5: Starfield Dome

**Files:**
- Create: `src/lib/shared/3d/environments/scenes/cosmic/Starfield.svelte`

- [ ] **Step 1: Create the starfield component**

```svelte
<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { onMount, onDestroy } from "svelte";
  import {
    BufferGeometry,
    Float32BufferAttribute,
    ShaderMaterial,
    AdditiveBlending,
  } from "three";
  import type { StarfieldConfig } from "../../domain/models/scene-configs";

  interface Props {
    config: StarfieldConfig;
  }

  let { config }: Props = $props();

  let geometry = $state<BufferGeometry | null>(null);
  let material = $state<ShaderMaterial | null>(null);

  const vertexShader = /* glsl */ `
    attribute float aSize;
    attribute float aPhase;
    attribute float aBrightness;
    uniform float uTime;
    uniform float uTwinkleSpeed;
    varying float vAlpha;

    void main() {
      float twinkle = 0.6 + 0.4 * sin(uTime * uTwinkleSpeed + aPhase);
      vAlpha = aBrightness * twinkle;

      vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = aSize * (800.0 / -mvPos.z);
      gl_Position = projectionMatrix * mvPos;
    }
  `;

  const fragmentShader = /* glsl */ `
    varying float vAlpha;

    void main() {
      float dist = length(gl_PointCoord - 0.5);
      float core = 1.0 - smoothstep(0.0, 0.15, dist);
      float halo = (1.0 - smoothstep(0.1, 0.5, dist)) * 0.3;
      float alpha = (core + halo) * vAlpha;
      if (alpha < 0.01) discard;

      // Slightly warm core, cool halo
      vec3 color = mix(vec3(0.8, 0.85, 1.0), vec3(1.0, 0.98, 0.95), core);
      gl_FragColor = vec4(color, alpha);
    }
  `;

  onMount(() => {
    const count = config.count;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const brightnesses = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Distribute on sphere surface using spherical coords
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      // Only upper hemisphere + slight below horizon for depth
      const adjustedPhi = phi * 0.6;

      positions[i * 3] = Math.sin(adjustedPhi) * Math.cos(theta) * config.radius;
      positions[i * 3 + 1] = Math.cos(adjustedPhi) * config.radius;
      positions[i * 3 + 2] = Math.sin(adjustedPhi) * Math.sin(theta) * config.radius;

      // Magnitude-based sizing: most stars small, few large
      const magnitude = Math.pow(Math.random(), 3);
      sizes[i] = config.sizeRange[0] + magnitude * (config.sizeRange[1] - config.sizeRange[0]);

      phases[i] = Math.random() * Math.PI * 2;

      // Brightness correlates with size
      brightnesses[i] = 0.3 + magnitude * 0.7;
    }

    const geo = new BufferGeometry();
    geo.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geo.setAttribute("aSize", new Float32BufferAttribute(sizes, 1));
    geo.setAttribute("aPhase", new Float32BufferAttribute(phases, 1));
    geo.setAttribute("aBrightness", new Float32BufferAttribute(brightnesses, 1));
    geometry = geo;

    material = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uTwinkleSpeed: { value: config.twinkleSpeed },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    });
  });

  onDestroy(() => {
    geometry?.dispose();
    material?.dispose();
  });

  let time = 0;
  useTask((delta) => {
    if (!material) return;
    time += delta;
    material.uniforms.uTime!.value = time;
  });
</script>

{#if config.enabled && geometry && material}
  <T.Points {geometry} {material} frustumCulled={false} />
{/if}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/cosmic/Starfield.svelte
git commit -m "feat(cosmic): add Starfield dome component

1500-point sprite starfield on upper hemisphere. Magnitude-based
sizing (cubic distribution = most stars small, few bright).
Per-star twinkle animation with phase offset. Warm-core/cool-halo
color gradient per sprite. Replaces FallingParticles star drift."
```

---

### Task 6: Wire Everything Into CosmicScene

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/CosmicScene.svelte`

- [ ] **Step 1: Update imports**

Add new imports and remove `useGltf` (no more rock GLBs):

```svelte
<script lang="ts">
  import { T, useThrelte } from "@threlte/core";
  import { onMount } from "svelte";
  import { FogExp2, Color } from "three";
  import SkyGradient from "../primitives/SkyGradient.svelte";
  import FallingParticles from "../primitives/FallingParticles.svelte";
  import GroundPlane from "../primitives/GroundPlane.svelte";
  import StationPlatform from "./cosmic/StationPlatform.svelte";
  import EarthSphere from "./cosmic/EarthSphere.svelte";
  import NebulaLayer from "./cosmic/NebulaLayer.svelte";
  import EnergyParticles from "./cosmic/EnergyParticles.svelte";
  import MeteorStreaks from "./cosmic/MeteorStreaks.svelte";
  import LunarCrystals from "./cosmic/LunarCrystals.svelte";
  import EarthGodRays from "./cosmic/EarthGodRays.svelte";
  import LunarGroundPlane from "./cosmic/LunarGroundPlane.svelte";
  import Starfield from "./cosmic/Starfield.svelte";
  import type { CosmicVariant } from "../domain/enums/environment-enums";
  import {
    type CosmicSceneConfig,
    createDefaultCosmicNightConfig,
    createDefaultCosmicAuroraConfig,
  } from "../domain/models/scene-configs";
  import { userProportionsState } from "@austencloud/scene-3d";
  import { getSceneFeatureContext } from "../../scene-features/context/scene-feature-context";
```

- [ ] **Step 2: Remove rock loading code**

Delete the `useGltf`, `lunarMat`, `lunarClone`, and `rockPlacements` blocks (lines 72-102 in original).

- [ ] **Step 3: Replace ground plane and rock rendering in template**

Replace the `TexturedGroundPlane`/`GroundPlane` conditional and the `{#if $rockA && $rockB}` block with:

```svelte
<!-- Ground: custom lunar surface with energy veins -->
{#if activeConfig.lunarGround.enabled}
  <LunarGroundPlane
    groundConfig={activeConfig.ground}
    veins={activeConfig.lunarGround}
  />
{:else if activeConfig.ground.textured && activeConfig.ground.diffuseMap}
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

<!-- Crystal formations -->
<LunarCrystals config={activeConfig.crystals} />

<!-- Earth god rays -->
<EarthGodRays config={activeConfig.godRays} earthConfig={activeConfig.earth} />

<!-- Starfield dome (replaces star drift particles) -->
<Starfield config={activeConfig.starfield} />
```

- [ ] **Step 4: Remove the starDrift FallingParticles block**

Delete the `{#if activeConfig.particles.starDrift}` block since Starfield replaces it.

- [ ] **Step 5: Keep remaining particles**

The `cosmicDust`, `energyParticles`, and `meteorStreaks` blocks stay as-is.

- [ ] **Step 6: Also remove the TexturedGroundPlane import if no longer needed**

Check if TexturedGroundPlane is still used in the fallback path. If `lunarGround.enabled` is always true in defaults, the import can stay for safety (fallback path).

- [ ] **Step 7: Run typecheck**

Run: `npx svelte-check --threshold error --tsconfig tsconfig.json 2>&1 | grep -E "Cosmic|cosmic|Lunar|lunar|Starfield|GodRay"`

Expected: No errors in cosmic scene files.

- [ ] **Step 8: Run build**

Run: `npm run build 2>&1 | tail -5`

Expected: Build succeeds.

- [ ] **Step 9: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/CosmicScene.svelte
git commit -m "feat(cosmic): wire moon v2 components into CosmicScene

Replace winter rock GLBs with LunarCrystals. Replace TexturedGroundPlane
with LunarGroundPlane (energy veins). Add EarthGodRays oriented toward
Earth. Add Starfield dome replacing FallingParticles star drift.
Nebula re-enabled via config. Cosmic dust and energy particles retained."
```

---

### Task 7: Visual Tuning Pass

**Files:**
- Modify: `src/lib/shared/3d/environments/domain/models/scene-configs.ts` (if needed)
- Modify: any component files for visual polish

- [ ] **Step 1: Build and test in browser**

Run: `npm run build`

Verify the cosmic scene loads without console errors. If dev server is available on port 5173, use `curl localhost:5173` to confirm it's serving.

- [ ] **Step 2: Check for any TypeScript errors**

Run: `npx svelte-check --threshold error --tsconfig tsconfig.json 2>&1 | grep -c "Error"`

Expected: Same count as before (pre-existing errors only, none in cosmic files).

- [ ] **Step 3: Commit any tuning adjustments**

```bash
git add -u src/lib/shared/3d/environments/
git commit -m "fix(cosmic): visual tuning pass for moon v2

Adjust config values for visual balance after initial integration."
```
