# Space Scene Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade CosmicScene from simple tier (sky gradient + flat asteroid + drifting stars) to complex tier with lunar terrain, space station platform, Earth rise, nebula layer, four particle systems, three-light stack, and full Scene Lab integration.

**Architecture:** Extend existing scene-configs.ts with `CosmicSceneConfig` interface and two factory functions (Night/Aurora). Build five new sub-components under `environments/scenes/cosmic/`. Wire Scene Lab with `CosmicControls.svelte` and two new SceneIds. No GLB models — all geometry is procedural, textures are existing rock PBR set repurposed as regolith.

**Tech Stack:** Svelte 5, Threlte v8, Three.js (ShaderMaterial, BufferGeometry, MeshStandardMaterial), existing FallingParticles primitive, existing scene-configs pattern.

---

## File Map

**Create:**
- `src/lib/shared/3d/environments/scenes/cosmic/StationPlatform.svelte` — procedural hex/circle platform with emissive edge shader
- `src/lib/shared/3d/environments/scenes/cosmic/EarthSphere.svelte` — textured sphere with Fresnel rim glow
- `src/lib/shared/3d/environments/scenes/cosmic/NebulaLayer.svelte` — shader-based nebula wash on inverted partial sphere
- `src/lib/shared/3d/environments/scenes/cosmic/EnergyParticles.svelte` — rising GPU particles from platform ring
- `src/lib/shared/3d/environments/scenes/cosmic/MeteorStreaks.svelte` — pooled line-geometry meteor trails
- `src/lib/features/lab/tabs/scene-lab/components/CosmicControls.svelte` — Scene Lab controls panel
- `static/textures/cosmic/earth-diffuse.jpg` — 2K NASA Blue Marble (public domain, downloaded)

**Modify:**
- `src/lib/shared/3d/environments/domain/models/scene-configs.ts` — add `CosmicSceneConfig` interface + two factory functions
- `src/lib/shared/3d/environments/scenes/CosmicScene.svelte` — expand from 77-line simple scene to full orchestrator
- `src/lib/features/lab/tabs/scene-lab/domain/scene-lab-types.ts` — add `cosmic-night` and `cosmic-aurora` SceneIds
- `src/lib/features/lab/tabs/scene-lab/state/scene-lab-state.svelte.ts` — add cosmic config state + wiring
- `src/lib/features/lab/tabs/scene-lab/SceneLab.svelte` — add CosmicControls conditional
- `src/lib/features/lab/tabs/scene-lab/components/ScenePreview.svelte` — wire cosmic scenes into preview

---

### Task 1: CosmicSceneConfig interface and default factories

**Files:**
- Modify: `src/lib/shared/3d/environments/domain/models/scene-configs.ts`

- [ ] **Step 1: Add CosmicSceneConfig interface after WinterSceneConfig**

Add to `scene-configs.ts` after the `WinterSceneConfig` interface block:

```typescript
// ============================================================================
// Cosmic scene
// ============================================================================

export interface PlatformConfig {
  enabled: boolean;
  shape: "circle" | "hexagon";
  radius: number;
  height: number;
  metallic: number;
  roughness: number;
  baseColor: string;
  emissiveColor: string;
  emissiveIntensity: number;
  edgeGlowWidth: number;
  pulseSpeed: number;
}

export interface EarthConfig {
  enabled: boolean;
  position: [number, number, number];
  radius: number;
  rimColor: string;
  rimIntensity: number;
  rotationSpeed: number;
}

export interface NebulaConfig {
  enabled: boolean;
  color1: string;
  color2: string;
  opacity: number;
  scale: number;
  animationSpeed: number;
}

export interface EnergyParticlesConfig {
  enabled: boolean;
  count: number;
  riseSpeed: number;
  colors: string[];
  sizeRange: [number, number];
  spawnRadius: number;
  maxHeight: number;
}

export interface MeteorStreaksConfig {
  enabled: boolean;
  frequency: number;
  speed: number;
  colors: string[];
  trailLength: number;
}

export interface CosmicSceneConfig {
  sky: SkyGradientConfig;
  fog: FogConfig;
  ground: GroundConfig;
  platform: PlatformConfig;
  earth: EarthConfig;
  nebula: NebulaConfig;
  particles: {
    starDrift: FallingParticlesConfig | null;
    cosmicDust: FallingParticlesConfig | null;
    energyParticles: EnergyParticlesConfig | null;
    meteorStreaks: MeteorStreaksConfig | null;
  };
  lighting: {
    ambient: HemisphereLightConfig;
    coldDirectional: {
      enabled: boolean;
      color: string;
      intensity: number;
      position: [number, number, number];
    };
    warmStation: PointLightConfig & { enabled: boolean };
    accentEmissive: {
      enabled: boolean;
      color: string;
      intensity: number;
      pulseSpeed: number;
    };
  };
}
```

- [ ] **Step 2: Add createDefaultCosmicNightConfig factory**

Add after the `createDefaultWinterConfig` function:

```typescript
// ----- Cosmic -----

export function createDefaultCosmicNightConfig(): CosmicSceneConfig {
  return {
    sky: {
      topColor: "#050510",
      midColor: "#0d0d2a",
      bottomColor: "#1a1040",
    },
    fog: { color: "#0a0a18", density: 0.008 },
    ground: {
      color: "#3a3a44",
      size: 25,
      textured: true,
      diffuseMap: "/textures/terrain/rock/diffuse.jpg",
      normalMap: "/textures/terrain/rock/normal.jpg",
      roughnessMap: "/textures/terrain/rock/roughness.jpg",
      normalScale: 2.0,
      textureRepeat: 20,
    },
    platform: {
      enabled: true,
      shape: "circle",
      radius: 2.5,
      height: 0.15,
      metallic: 0.8,
      roughness: 0.3,
      baseColor: "#2a3040",
      emissiveColor: "#4488ff",
      emissiveIntensity: 0.6,
      edgeGlowWidth: 0.08,
      pulseSpeed: 0.5,
    },
    earth: {
      enabled: true,
      position: [-40, 12, -60],
      radius: 8,
      rimColor: "#6ab4ff",
      rimIntensity: 1.2,
      rotationSpeed: 0.02,
    },
    nebula: {
      enabled: true,
      color1: "#2a0845",
      color2: "#1a1060",
      opacity: 0.15,
      scale: 1.0,
      animationSpeed: 0.01,
    },
    particles: {
      starDrift: {
        type: "stars",
        count: 200,
        area: { width: 7.5, height: 6, depth: 7.5 },
        speed: 0.025,
        colors: ["#ffffff", "#e0e7ff", "#c7d2fe", "#818cf8"],
        sizeRange: [0.03, 0.09],
        spin: false,
      },
      cosmicDust: {
        type: "dust",
        count: 100,
        area: { width: 12, height: 8, depth: 12 },
        speed: 0.01,
        colors: ["#aaaacc", "#8888aa", "#ccccee", "#7777aa"],
        sizeRange: [0.01, 0.04],
        spin: false,
      },
      energyParticles: {
        enabled: true,
        count: 50,
        riseSpeed: 0.3,
        colors: ["#4488ff", "#6699ff", "#88bbff", "#aaddff"],
        sizeRange: [0.02, 0.06],
        spawnRadius: 2.5,
        maxHeight: 4.0,
      },
      meteorStreaks: {
        enabled: true,
        frequency: 8,
        speed: 15,
        colors: ["#ffcc66", "#ffaa44", "#ffffff"],
        trailLength: 3.0,
      },
    },
    lighting: {
      ambient: {
        skyColor: "#1a2244",
        groundColor: "#0a0a14",
        intensity: 0.4,
      },
      coldDirectional: {
        enabled: true,
        color: "#6688cc",
        intensity: 0.8,
        position: [-20, 15, -30],
      },
      warmStation: {
        enabled: true,
        color: "#ffcc88",
        intensity: 15,
        distance: 8,
        decay: 1.5,
        heightOffset: 0.5,
      },
      accentEmissive: {
        enabled: true,
        color: "#4488ff",
        intensity: 0.4,
        pulseSpeed: 0.5,
      },
    },
  };
}

export function createDefaultCosmicAuroraConfig(): CosmicSceneConfig {
  return {
    sky: {
      topColor: "#030810",
      midColor: "#0a2a2a",
      bottomColor: "#102030",
    },
    fog: { color: "#081818", density: 0.008 },
    ground: {
      color: "#2a3038",
      size: 25,
      textured: true,
      diffuseMap: "/textures/terrain/rock/diffuse.jpg",
      normalMap: "/textures/terrain/rock/normal.jpg",
      roughnessMap: "/textures/terrain/rock/roughness.jpg",
      normalScale: 2.0,
      textureRepeat: 20,
    },
    platform: {
      enabled: true,
      shape: "circle",
      radius: 2.5,
      height: 0.15,
      metallic: 0.8,
      roughness: 0.3,
      baseColor: "#1a2a2a",
      emissiveColor: "#00ccaa",
      emissiveIntensity: 0.7,
      edgeGlowWidth: 0.08,
      pulseSpeed: 0.4,
    },
    earth: {
      enabled: true,
      position: [-40, 12, -60],
      radius: 8,
      rimColor: "#44ddcc",
      rimIntensity: 1.4,
      rotationSpeed: 0.02,
    },
    nebula: {
      enabled: true,
      color1: "#00aaaa",
      color2: "#aa44aa",
      opacity: 0.2,
      scale: 1.2,
      animationSpeed: 0.015,
    },
    particles: {
      starDrift: {
        type: "stars",
        count: 200,
        area: { width: 7.5, height: 6, depth: 7.5 },
        speed: 0.025,
        colors: ["#22d3ee", "#a855f7", "#0d9488", "#f0abfc"],
        sizeRange: [0.03, 0.09],
        spin: false,
      },
      cosmicDust: {
        type: "dust",
        count: 100,
        area: { width: 12, height: 8, depth: 12 },
        speed: 0.01,
        colors: ["#88cccc", "#aa88cc", "#66aaaa", "#cc88aa"],
        sizeRange: [0.01, 0.04],
        spin: false,
      },
      energyParticles: {
        enabled: true,
        count: 50,
        riseSpeed: 0.3,
        colors: ["#00ccaa", "#44ddbb", "#88eedd", "#aaffee"],
        sizeRange: [0.02, 0.06],
        spawnRadius: 2.5,
        maxHeight: 4.0,
      },
      meteorStreaks: {
        enabled: true,
        frequency: 8,
        speed: 15,
        colors: ["#ffcc66", "#ffaa44", "#ffffff"],
        trailLength: 3.0,
      },
    },
    lighting: {
      ambient: {
        skyColor: "#1a3344",
        groundColor: "#0a1414",
        intensity: 0.5,
      },
      coldDirectional: {
        enabled: true,
        color: "#44aaaa",
        intensity: 0.7,
        position: [-20, 15, -30],
      },
      warmStation: {
        enabled: true,
        color: "#ffddaa",
        intensity: 18,
        distance: 8,
        decay: 1.5,
        heightOffset: 0.5,
      },
      accentEmissive: {
        enabled: true,
        color: "#cc44aa",
        intensity: 0.5,
        pulseSpeed: 0.4,
      },
    },
  };
}
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors in scene-configs.ts

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/environments/domain/models/scene-configs.ts
git commit -m "feat(cosmic): add CosmicSceneConfig interface and Night/Aurora defaults"
```

---

### Task 2: StationPlatform sub-component

**Files:**
- Create: `src/lib/shared/3d/environments/scenes/cosmic/StationPlatform.svelte`

- [ ] **Step 1: Create cosmic scene directory**

```bash
mkdir -p src/lib/shared/3d/environments/scenes/cosmic
```

- [ ] **Step 2: Write StationPlatform.svelte**

```svelte
<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { onMount, onDestroy, untrack } from "svelte";
  import {
    CylinderGeometry,
    ShaderMaterial,
    Color,
    DoubleSide,
  } from "three";
  import type { PlatformConfig } from "../../domain/models/scene-configs";
  import { userProportionsState } from "../../../state/user-proportions-state.svelte";

  interface Props {
    config: PlatformConfig;
  }

  let { config }: Props = $props();
  const groundY = $derived(userProportionsState.groundY);

  const geometry = $derived.by(() => {
    const segments = config.shape === "hexagon" ? 6 : 64;
    return new CylinderGeometry(
      config.radius,
      config.radius,
      config.height,
      segments
    );
  });

  const vertexShader = /* glsl */ `
    varying vec3 vPosition;
    varying vec3 vNormal;
    void main() {
      vPosition = position;
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform vec3 uBaseColor;
    uniform vec3 uEmissiveColor;
    uniform float uEmissiveIntensity;
    uniform float uEdgeGlowWidth;
    uniform float uRadius;
    uniform float uHeight;
    uniform float uMetallic;
    uniform float uRoughness;
    uniform float uPulse;

    varying vec3 vPosition;
    varying vec3 vNormal;

    void main() {
      float distFromCenter = length(vPosition.xz) / uRadius;
      float edgeFactor = smoothstep(1.0 - uEdgeGlowWidth, 1.0, distFromCenter);

      float topFace = step(0.49, vNormal.y);
      float sideFace = 1.0 - abs(vNormal.y);

      float pulse = 1.0 + sin(uPulse) * 0.15;
      float glow = (edgeFactor * topFace + sideFace * 0.6) * uEmissiveIntensity * pulse;

      vec3 base = uBaseColor * (0.3 + uMetallic * 0.7);
      vec3 emissive = uEmissiveColor * glow;

      gl_FragColor = vec4(base + emissive, 1.0);
    }
  `;

  let pulseTime = 0;

  const material = $derived.by(() => {
    return new ShaderMaterial({
      uniforms: {
        uBaseColor: { value: new Color(config.baseColor) },
        uEmissiveColor: { value: new Color(config.emissiveColor) },
        uEmissiveIntensity: { value: config.emissiveIntensity },
        uEdgeGlowWidth: { value: config.edgeGlowWidth },
        uRadius: { value: config.radius },
        uHeight: { value: config.height },
        uMetallic: { value: config.metallic },
        uRoughness: { value: config.roughness },
        uPulse: { value: 0 },
      },
      vertexShader,
      fragmentShader,
      side: DoubleSide,
    });
  });

  useTask((delta) => {
    if (!material || config.pulseSpeed === 0) return;
    pulseTime += delta * config.pulseSpeed * Math.PI * 2;
    material.uniforms.uPulse.value = pulseTime;
  });

  $effect(() => {
    if (!material) return;
    material.uniforms.uBaseColor.value = new Color(config.baseColor);
    material.uniforms.uEmissiveColor.value = new Color(config.emissiveColor);
    material.uniforms.uEmissiveIntensity.value = config.emissiveIntensity;
    material.uniforms.uEdgeGlowWidth.value = config.edgeGlowWidth;
    material.uniforms.uRadius.value = config.radius;
    material.uniforms.uHeight.value = config.height;
    material.uniforms.uMetallic.value = config.metallic;
    material.uniforms.uRoughness.value = config.roughness;
  });
</script>

{#if config.enabled}
  <T.Mesh
    {geometry}
    {material}
    position.y={groundY + config.height / 2}
  />
{/if}
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: Clean

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/cosmic/
git commit -m "feat(cosmic): add StationPlatform with emissive edge glow shader"
```

---

### Task 3: EarthSphere sub-component

**Files:**
- Create: `src/lib/shared/3d/environments/scenes/cosmic/EarthSphere.svelte`

- [ ] **Step 1: Write EarthSphere.svelte**

```svelte
<script lang="ts">
  import { T, useTask, useLoader } from "@threlte/core";
  import {
    SphereGeometry,
    ShaderMaterial,
    TextureLoader,
    BackSide,
    FrontSide,
    Color,
    AdditiveBlending,
  } from "three";
  import type { EarthConfig } from "../../domain/models/scene-configs";

  interface Props {
    config: EarthConfig;
    onReady?: () => void;
  }

  let { config, onReady }: Props = $props();

  const geometry = $derived(new SphereGeometry(config.radius, 48, 48));

  const textureLoader = useLoader(TextureLoader);
  const earthTex = $derived(
    textureLoader.load("/textures/cosmic/earth-diffuse.jpg")
  );

  $effect(() => {
    if ($earthTex && onReady) onReady();
  });

  const vertexShader = /* glsl */ `
    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vViewDir;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vUv = uv;
      vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
      vViewDir = normalize(-mvPos.xyz);
      gl_Position = projectionMatrix * mvPos;
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform sampler2D uEarthMap;
    uniform vec3 uRimColor;
    uniform float uRimIntensity;
    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vViewDir;

    void main() {
      vec4 texColor = texture2D(uEarthMap, vUv);
      float fresnel = 1.0 - dot(vNormal, vViewDir);
      fresnel = pow(fresnel, 3.0);
      vec3 rim = uRimColor * fresnel * uRimIntensity;
      gl_FragColor = vec4(texColor.rgb + rim, 1.0);
    }
  `;

  const material = $derived.by(() => {
    const tex = $earthTex;
    if (!tex) return null;
    return new ShaderMaterial({
      uniforms: {
        uEarthMap: { value: tex },
        uRimColor: { value: new Color(config.rimColor) },
        uRimIntensity: { value: config.rimIntensity },
      },
      vertexShader,
      fragmentShader,
    });
  });

  $effect(() => {
    if (!material) return;
    material.uniforms.uRimColor.value = new Color(config.rimColor);
    material.uniforms.uRimIntensity.value = config.rimIntensity;
  });

  let rotationY = $state(0);
  useTask((delta) => {
    rotationY += delta * config.rotationSpeed;
  });

  // Atmosphere glow ring — slightly larger additive sphere behind Earth
  const glowGeometry = $derived(new SphereGeometry(config.radius * 1.15, 32, 32));
  const glowMaterial = $derived.by(() => {
    return new ShaderMaterial({
      uniforms: {
        uRimColor: { value: new Color(config.rimColor) },
        uRimIntensity: { value: config.rimIntensity * 0.4 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uRimColor;
        uniform float uRimIntensity;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          float fresnel = 1.0 - dot(vNormal, vViewDir);
          fresnel = pow(fresnel, 2.0);
          float alpha = fresnel * uRimIntensity;
          gl_FragColor = vec4(uRimColor, alpha);
        }
      `,
      transparent: true,
      blending: AdditiveBlending,
      side: BackSide,
      depthWrite: false,
    });
  });
</script>

{#if config.enabled && material}
  <T.Group
    position.x={config.position[0]}
    position.y={config.position[1]}
    position.z={config.position[2]}
  >
    <T.Mesh {geometry} {material} rotation.y={rotationY} />
    <T.Mesh geometry={glowGeometry} material={glowMaterial} />
  </T.Group>
{/if}
```

- [ ] **Step 2: Download Earth texture**

Run:
```bash
mkdir -p static/textures/cosmic
curl -L -o static/textures/cosmic/earth-diffuse.jpg "https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57735/land_ocean_ice_2048.jpg"
```

This is NASA Blue Marble (public domain). If the URL changes, any 2K Earth texture works — place at `static/textures/cosmic/earth-diffuse.jpg`.

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: Clean

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/cosmic/EarthSphere.svelte static/textures/cosmic/
git commit -m "feat(cosmic): add EarthSphere with Fresnel rim glow and atmosphere halo"
```

---

### Task 4: NebulaLayer sub-component

**Files:**
- Create: `src/lib/shared/3d/environments/scenes/cosmic/NebulaLayer.svelte`

- [ ] **Step 1: Write NebulaLayer.svelte**

```svelte
<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import {
    SphereGeometry,
    ShaderMaterial,
    BackSide,
    AdditiveBlending,
    Color,
  } from "three";
  import type { NebulaConfig } from "../../domain/models/scene-configs";

  interface Props {
    config: NebulaConfig;
  }

  let { config }: Props = $props();

  const geometry = new SphereGeometry(70, 32, 32);

  const vertexShader = /* glsl */ `
    varying vec3 vWorldPosition;
    void main() {
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform float uOpacity;
    uniform float uScale;
    uniform float uTime;
    varying vec3 vWorldPosition;

    // Simplex-like noise for nebula shape
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

    float snoise(vec3 v) {
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      i = mod289(i);
      vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      float n_ = 0.142857142857;
      vec3 ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      vec4 x = x_ * ns.x + ns.yyyy;
      vec4 y = y_ * ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      vec4 s0 = floor(b0) * 2.0 + 1.0;
      vec4 s1 = floor(b1) * 2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
      p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }

    void main() {
      vec3 dir = normalize(vWorldPosition);
      vec3 samplePos = dir * uScale + vec3(uTime * 0.1, 0.0, uTime * 0.05);

      float n1 = snoise(samplePos * 1.5) * 0.5 + 0.5;
      float n2 = snoise(samplePos * 3.0 + 100.0) * 0.5 + 0.5;
      float combined = n1 * 0.7 + n2 * 0.3;
      combined = pow(combined, 1.5);

      vec3 color = mix(uColor1, uColor2, n2);
      float alpha = combined * uOpacity;

      // Fade near horizon to avoid hard edge
      float horizonFade = smoothstep(-0.1, 0.3, dir.y);
      alpha *= horizonFade;

      gl_FragColor = vec4(color, alpha);
    }
  `;

  let time = 0;
  const material = $derived.by(() => {
    return new ShaderMaterial({
      uniforms: {
        uColor1: { value: new Color(config.color1) },
        uColor2: { value: new Color(config.color2) },
        uOpacity: { value: config.opacity },
        uScale: { value: config.scale },
        uTime: { value: 0 },
      },
      vertexShader,
      fragmentShader,
      side: BackSide,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    });
  });

  useTask((delta) => {
    if (!material) return;
    time += delta * config.animationSpeed;
    material.uniforms.uTime.value = time;
  });

  $effect(() => {
    if (!material) return;
    material.uniforms.uColor1.value = new Color(config.color1);
    material.uniforms.uColor2.value = new Color(config.color2);
    material.uniforms.uOpacity.value = config.opacity;
    material.uniforms.uScale.value = config.scale;
  });
</script>

{#if config.enabled}
  <T.Mesh {geometry} {material} renderOrder={-0.5} frustumCulled={false} />
{/if}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: Clean

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/cosmic/NebulaLayer.svelte
git commit -m "feat(cosmic): add NebulaLayer with procedural noise shader"
```

---

### Task 5: EnergyParticles sub-component

**Files:**
- Create: `src/lib/shared/3d/environments/scenes/cosmic/EnergyParticles.svelte`

- [ ] **Step 1: Write EnergyParticles.svelte**

Rising particles from a ring at platform radius — distinct from FallingParticles (which drifts downward). These spawn on a circle, rise upward, and fade out at maxHeight.

```svelte
<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { onMount, onDestroy } from "svelte";
  import {
    BufferGeometry,
    Float32BufferAttribute,
    ShaderMaterial,
    AdditiveBlending,
    Color,
  } from "three";
  import type { EnergyParticlesConfig } from "../../domain/models/scene-configs";
  import { userProportionsState } from "../../../state/user-proportions-state.svelte";

  interface Props {
    config: EnergyParticlesConfig;
  }

  let { config }: Props = $props();
  const groundY = $derived(userProportionsState.groundY);

  interface EnergyParticle {
    angle: number;
    radius: number;
    y: number;
    speed: number;
    size: number;
    colorIndex: number;
    phase: number;
  }

  let particles: EnergyParticle[] = [];
  let geometry = $state<BufferGeometry | null>(null);
  let material = $state<ShaderMaterial | null>(null);

  function spawnParticle(): EnergyParticle {
    const angle = Math.random() * Math.PI * 2;
    const radiusJitter = (Math.random() - 0.5) * 0.5;
    return {
      angle,
      radius: config.spawnRadius + radiusJitter,
      y: 0,
      speed: config.riseSpeed * (0.7 + Math.random() * 0.6),
      size: config.sizeRange[0] + Math.random() * (config.sizeRange[1] - config.sizeRange[0]),
      colorIndex: Math.floor(Math.random() * config.colors.length),
      phase: Math.random() * Math.PI * 2,
    };
  }

  const vertexShader = /* glsl */ `
    attribute float aSize;
    attribute float aAlpha;
    attribute float aColorIndex;
    varying float vAlpha;
    varying float vColorIndex;
    void main() {
      vAlpha = aAlpha;
      vColorIndex = aColorIndex;
      vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = aSize * (1000.0 / -mvPos.z);
      gl_Position = projectionMatrix * mvPos;
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform vec3 uColors[4];
    varying float vAlpha;
    varying float vColorIndex;
    void main() {
      float dist = length(gl_PointCoord - 0.5);
      float glow = 1.0 - smoothstep(0.0, 0.5, dist);
      if (glow < 0.01) discard;
      int idx = int(floor(vColorIndex));
      vec3 color = uColors[min(idx, 3)];
      gl_FragColor = vec4(color, glow * vAlpha);
    }
  `;

  onMount(() => {
    const count = config.count;
    geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute("aSize", new Float32BufferAttribute(new Float32Array(count), 1));
    geometry.setAttribute("aAlpha", new Float32BufferAttribute(new Float32Array(count), 1));
    geometry.setAttribute("aColorIndex", new Float32BufferAttribute(new Float32Array(count), 1));

    const colorArray = config.colors.slice(0, 4).map(c => new Color(c));
    while (colorArray.length < 4) colorArray.push(colorArray[0] || new Color("#ffffff"));

    material = new ShaderMaterial({
      uniforms: { uColors: { value: colorArray } },
      vertexShader,
      fragmentShader,
      blending: AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });

    for (let i = 0; i < count; i++) {
      const p = spawnParticle();
      p.y = Math.random() * config.maxHeight;
      particles.push(p);
    }
  });

  onDestroy(() => {
    geometry?.dispose();
    material?.dispose();
    particles = [];
  });

  useTask((delta) => {
    if (!geometry || !material || !config.enabled) return;

    const posArr = geometry.attributes.position.array as Float32Array;
    const sizeArr = geometry.attributes.aSize.array as Float32Array;
    const alphaArr = geometry.attributes.aAlpha.array as Float32Array;
    const colorArr = geometry.attributes.aColorIndex.array as Float32Array;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]!;
      p.y += p.speed * delta;

      if (p.y > config.maxHeight) {
        const fresh = spawnParticle();
        p.angle = fresh.angle;
        p.radius = fresh.radius;
        p.y = 0;
        p.speed = fresh.speed;
        p.size = fresh.size;
        p.colorIndex = fresh.colorIndex;
        p.phase = fresh.phase;
      }

      const fadeIn = Math.min(p.y / 0.5, 1.0);
      const fadeOut = 1.0 - Math.max((p.y - config.maxHeight * 0.7) / (config.maxHeight * 0.3), 0);
      const sway = Math.sin(p.y * 3 + p.phase) * 0.15;

      posArr[i * 3] = Math.cos(p.angle + sway) * p.radius;
      posArr[i * 3 + 1] = p.y;
      posArr[i * 3 + 2] = Math.sin(p.angle + sway) * p.radius;
      sizeArr[i] = p.size;
      alphaArr[i] = fadeIn * fadeOut;
      colorArr[i] = p.colorIndex;
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.aSize.needsUpdate = true;
    geometry.attributes.aAlpha.needsUpdate = true;
    geometry.attributes.aColorIndex.needsUpdate = true;
    geometry.computeBoundingSphere();
  });
</script>

{#if config.enabled && geometry && material}
  <T.Points {geometry} {material} position.y={groundY} frustumCulled={false} />
{/if}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: Clean

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/cosmic/EnergyParticles.svelte
git commit -m "feat(cosmic): add EnergyParticles — rising glow from platform ring"
```

---

### Task 6: MeteorStreaks sub-component

**Files:**
- Create: `src/lib/shared/3d/environments/scenes/cosmic/MeteorStreaks.svelte`

- [ ] **Step 1: Write MeteorStreaks.svelte**

Pooled line-geometry streaks at random intervals. Max 5 active at once. Each streak: random upper-hemisphere start, random diagonal direction, fast travel, fading trail.

```svelte
<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { onDestroy } from "svelte";
  import {
    BufferGeometry,
    Float32BufferAttribute,
    ShaderMaterial,
    AdditiveBlending,
    Color,
  } from "three";
  import type { MeteorStreaksConfig } from "../../domain/models/scene-configs";

  interface Props {
    config: MeteorStreaksConfig;
  }

  let { config }: Props = $props();

  const POOL_SIZE = 5;
  const TRAIL_SEGMENTS = 12;

  interface Meteor {
    active: boolean;
    x: number; y: number; z: number;
    dx: number; dy: number; dz: number;
    life: number;
    maxLife: number;
    colorIndex: number;
  }

  const pool: Meteor[] = Array.from({ length: POOL_SIZE }, () => ({
    active: false, x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0,
    life: 0, maxLife: 0, colorIndex: 0,
  }));

  let timeSinceSpawn = 0;

  function spawnMeteor(m: Meteor) {
    const angle = Math.random() * Math.PI * 2;
    const elevation = 0.3 + Math.random() * 0.5;
    const dist = 20 + Math.random() * 30;
    m.x = Math.cos(angle) * dist;
    m.y = 10 + Math.random() * 20;
    m.z = Math.sin(angle) * dist;

    const dirAngle = angle + Math.PI + (Math.random() - 0.5) * 0.8;
    m.dx = Math.cos(dirAngle) * config.speed;
    m.dy = -config.speed * (0.3 + Math.random() * 0.4);
    m.dz = Math.sin(dirAngle) * config.speed;

    m.maxLife = config.trailLength / config.speed;
    m.life = 0;
    m.active = true;
    m.colorIndex = Math.floor(Math.random() * config.colors.length);
  }

  const vertexShader = /* glsl */ `
    attribute float aAlpha;
    varying float vAlpha;
    void main() {
      vAlpha = aAlpha;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform vec3 uColor;
    varying float vAlpha;
    void main() {
      gl_FragColor = vec4(uColor, vAlpha);
    }
  `;

  const geometries: BufferGeometry[] = [];
  const materials: ShaderMaterial[] = [];

  for (let i = 0; i < POOL_SIZE; i++) {
    const geo = new BufferGeometry();
    geo.setAttribute("position", new Float32BufferAttribute(new Float32Array(TRAIL_SEGMENTS * 3), 3));
    geo.setAttribute("aAlpha", new Float32BufferAttribute(new Float32Array(TRAIL_SEGMENTS), 1));
    geometries.push(geo);

    const colorArr = config.colors.slice(0, 4).map(c => new Color(c));
    materials.push(new ShaderMaterial({
      uniforms: { uColor: { value: colorArr[0] || new Color("#ffffff") } },
      vertexShader,
      fragmentShader,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    }));
  }

  onDestroy(() => {
    geometries.forEach(g => g.dispose());
    materials.forEach(m => m.dispose());
  });

  useTask((delta) => {
    if (!config.enabled) return;

    timeSinceSpawn += delta;
    const spawnInterval = config.frequency * (0.5 + Math.random());
    if (timeSinceSpawn >= spawnInterval) {
      timeSinceSpawn = 0;
      const idle = pool.find(m => !m.active);
      if (idle) spawnMeteor(idle);
    }

    const colorArr = config.colors.map(c => new Color(c));

    for (let i = 0; i < POOL_SIZE; i++) {
      const m = pool[i]!;
      const geo = geometries[i]!;
      const mat = materials[i]!;
      const posArr = geo.attributes.position.array as Float32Array;
      const alphaArr = geo.attributes.aAlpha.array as Float32Array;

      if (!m.active) {
        for (let j = 0; j < TRAIL_SEGMENTS; j++) alphaArr[j] = 0;
        geo.attributes.aAlpha.needsUpdate = true;
        continue;
      }

      m.life += delta;
      if (m.life >= m.maxLife) {
        m.active = false;
        for (let j = 0; j < TRAIL_SEGMENTS; j++) alphaArr[j] = 0;
        geo.attributes.aAlpha.needsUpdate = true;
        continue;
      }

      const headX = m.x + m.dx * m.life;
      const headY = m.y + m.dy * m.life;
      const headZ = m.z + m.dz * m.life;
      const trailDt = config.trailLength / config.speed / TRAIL_SEGMENTS;

      for (let j = 0; j < TRAIL_SEGMENTS; j++) {
        const t = m.life - j * trailDt;
        if (t < 0) {
          alphaArr[j] = 0;
        } else {
          posArr[j * 3] = m.x + m.dx * t;
          posArr[j * 3 + 1] = m.y + m.dy * t;
          posArr[j * 3 + 2] = m.z + m.dz * t;
          alphaArr[j] = (1.0 - j / TRAIL_SEGMENTS) * (1.0 - m.life / m.maxLife);
        }
      }

      mat.uniforms.uColor.value = colorArr[m.colorIndex % colorArr.length] || colorArr[0];
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aAlpha.needsUpdate = true;
    }
  });
</script>

{#each pool as _, i}
  <T.Line geometry={geometries[i]} material={materials[i]} frustumCulled={false} />
{/each}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: Clean

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/cosmic/MeteorStreaks.svelte
git commit -m "feat(cosmic): add MeteorStreaks — pooled line-geometry meteor trails"
```

---

### Task 7: Rewrite CosmicScene as full orchestrator

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/CosmicScene.svelte`

- [ ] **Step 1: Replace CosmicScene.svelte contents**

Replace entire file with:

```svelte
<script lang="ts">
  import { T, useThrelte } from "@threlte/core";
  import { onMount } from "svelte";
  import { FogExp2, Color, Vector3 } from "three";
  import SkyGradient from "../primitives/SkyGradient.svelte";
  import FallingParticles from "../primitives/FallingParticles.svelte";
  import GroundPlane from "../primitives/GroundPlane.svelte";
  import TexturedGroundPlane from "../primitives/TexturedGroundPlane.svelte";
  import StationPlatform from "./cosmic/StationPlatform.svelte";
  import EarthSphere from "./cosmic/EarthSphere.svelte";
  import NebulaLayer from "./cosmic/NebulaLayer.svelte";
  import EnergyParticles from "./cosmic/EnergyParticles.svelte";
  import MeteorStreaks from "./cosmic/MeteorStreaks.svelte";
  import type { CosmicVariant } from "../domain/enums/environment-enums";
  import {
    type CosmicSceneConfig,
    createDefaultCosmicNightConfig,
    createDefaultCosmicAuroraConfig,
  } from "../domain/models/scene-configs";
  import { userProportionsState } from "../../state/user-proportions-state.svelte";
  import { getSceneFeatureContext } from "../../scene-features/context/scene-feature-context";

  interface Props {
    variant?: CosmicVariant;
    config?: CosmicSceneConfig;
  }

  let { variant = "night", config }: Props = $props();

  const defaultConfigs = {
    night: createDefaultCosmicNightConfig,
    aurora: createDefaultCosmicAuroraConfig,
  };

  const activeConfig = $derived(config ?? defaultConfigs[variant]());

  const { scene } = useThrelte();
  const groundY = $derived(userProportionsState.groundY);

  $effect(() => {
    if (!scene.current) return;
    const fog = activeConfig.fog;
    scene.current.fog = new FogExp2(new Color(fog.color), fog.density);
    return () => {
      if (scene.current) scene.current.fog = null;
    };
  });

  const sceneFeatures = getSceneFeatureContext();
  let earthReady = $state(false);

  $effect(() => {
    if (!sceneFeatures) return;
    if (earthReady || !activeConfig.earth.enabled) {
      sceneFeatures.reportReady("environment");
    } else {
      sceneFeatures.reportProgress("environment", 0.5);
    }
  });

  onMount(() => {
    const timer = setTimeout(() => {
      if (sceneFeatures && !sceneFeatures.isReady("environment")) {
        console.warn("[CosmicScene] texture loading timed out — lifting curtain");
        sceneFeatures.reportReady("environment");
      }
    }, 15_000);
    return () => clearTimeout(timer);
  });
</script>

<SkyGradient
  topColor={activeConfig.sky.topColor}
  midColor={activeConfig.sky.midColor}
  bottomColor={activeConfig.sky.bottomColor}
/>

<NebulaLayer config={activeConfig.nebula} />

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

<StationPlatform config={activeConfig.platform} />

<EarthSphere
  config={activeConfig.earth}
  onReady={() => (earthReady = true)}
/>

<!-- Warm station glow -->
{#if activeConfig.lighting.warmStation.enabled}
  <T.PointLight
    position.x={0}
    position.y={groundY + activeConfig.lighting.warmStation.heightOffset}
    position.z={0}
    color={activeConfig.lighting.warmStation.color}
    intensity={activeConfig.lighting.warmStation.intensity}
    distance={activeConfig.lighting.warmStation.distance}
    decay={activeConfig.lighting.warmStation.decay}
  />
{/if}

<!-- Cold directional (from Earth direction) -->
{#if activeConfig.lighting.coldDirectional.enabled}
  <T.DirectionalLight
    color={activeConfig.lighting.coldDirectional.color}
    intensity={activeConfig.lighting.coldDirectional.intensity}
    position.x={activeConfig.lighting.coldDirectional.position[0]}
    position.y={activeConfig.lighting.coldDirectional.position[1]}
    position.z={activeConfig.lighting.coldDirectional.position[2]}
  />
{/if}

<T.HemisphereLight
  color={activeConfig.lighting.ambient.skyColor}
  groundColor={activeConfig.lighting.ambient.groundColor}
  intensity={activeConfig.lighting.ambient.intensity}
/>

<!-- Star drift -->
{#if activeConfig.particles.starDrift}
  {#key `stars-${activeConfig.particles.starDrift.count}`}
    <FallingParticles
      type={activeConfig.particles.starDrift.type}
      count={activeConfig.particles.starDrift.count}
      area={activeConfig.particles.starDrift.area}
      speed={activeConfig.particles.starDrift.speed}
      colors={activeConfig.particles.starDrift.colors}
      sizeRange={activeConfig.particles.starDrift.sizeRange}
      spin={activeConfig.particles.starDrift.spin ?? false}
    />
  {/key}
{/if}

<!-- Cosmic dust motes -->
{#if activeConfig.particles.cosmicDust}
  {#key `dust-${activeConfig.particles.cosmicDust.count}`}
    <FallingParticles
      type={activeConfig.particles.cosmicDust.type}
      count={activeConfig.particles.cosmicDust.count}
      area={activeConfig.particles.cosmicDust.area}
      speed={activeConfig.particles.cosmicDust.speed}
      colors={activeConfig.particles.cosmicDust.colors}
      sizeRange={activeConfig.particles.cosmicDust.sizeRange}
      spin={activeConfig.particles.cosmicDust.spin ?? false}
    />
  {/key}
{/if}

<!-- Energy particles rising from platform -->
{#if activeConfig.particles.energyParticles}
  {#key `energy-${activeConfig.particles.energyParticles.count}`}
    <EnergyParticles config={activeConfig.particles.energyParticles} />
  {/key}
{/if}

<!-- Meteor streaks -->
{#if activeConfig.particles.meteorStreaks}
  <MeteorStreaks config={activeConfig.particles.meteorStreaks} />
{/if}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: Clean

- [ ] **Step 3: Run build**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/CosmicScene.svelte
git commit -m "feat(cosmic): rewrite CosmicScene as full orchestrator with all sub-components"
```

---

### Task 8: Scene Lab integration — types and state

**Files:**
- Modify: `src/lib/features/lab/tabs/scene-lab/domain/scene-lab-types.ts`
- Modify: `src/lib/features/lab/tabs/scene-lab/state/scene-lab-state.svelte.ts`

- [ ] **Step 1: Update SceneId union and SCENE_OPTIONS**

In `scene-lab-types.ts`, replace contents:

```typescript
export type SceneId =
  | "winter"
  | "forest-firefly"
  | "forest-autumn"
  | "cosmic-night"
  | "cosmic-aurora";

export interface SceneOption {
  id: SceneId;
  label: string;
  description: string;
}

export const SCENE_OPTIONS: SceneOption[] = [
  {
    id: "winter",
    label: "Winter",
    description: "Snowy forest clearing with frozen pond and campfire",
  },
  {
    id: "forest-firefly",
    label: "Forest (Firefly)",
    description: "Moonlit forest with fireflies and warm campfire",
  },
  {
    id: "forest-autumn",
    label: "Forest (Autumn)",
    description: "Golden-hour forest clearing with falling leaves",
  },
  {
    id: "cosmic-night",
    label: "Cosmic (Night)",
    description: "Deep space with lunar surface, station platform, and Earth rise",
  },
  {
    id: "cosmic-aurora",
    label: "Cosmic (Aurora)",
    description: "Aurora-lit space with nebula wash and teal-green accents",
  },
];
```

- [ ] **Step 2: Update scene-lab-state.svelte.ts**

Replace contents:

```typescript
import {
  type ForestSceneConfig,
  type WinterSceneConfig,
  type CosmicSceneConfig,
  createDefaultForestAutumnConfig,
  createDefaultForestFireflyConfig,
  createDefaultWinterConfig,
  createDefaultCosmicNightConfig,
  createDefaultCosmicAuroraConfig,
} from "$lib/shared/3d/environments/domain/models/scene-configs";
import type { SceneId } from "../domain/scene-lab-types";

export function createSceneLabState() {
  let sceneId = $state<SceneId>("winter");
  let winterConfig = $state<WinterSceneConfig>(createDefaultWinterConfig());
  let forestFireflyConfig = $state<ForestSceneConfig>(
    createDefaultForestFireflyConfig()
  );
  let forestAutumnConfig = $state<ForestSceneConfig>(
    createDefaultForestAutumnConfig()
  );
  let cosmicNightConfig = $state<CosmicSceneConfig>(
    createDefaultCosmicNightConfig()
  );
  let cosmicAuroraConfig = $state<CosmicSceneConfig>(
    createDefaultCosmicAuroraConfig()
  );

  function resetCurrent() {
    if (sceneId === "winter") winterConfig = createDefaultWinterConfig();
    else if (sceneId === "forest-firefly")
      forestFireflyConfig = createDefaultForestFireflyConfig();
    else if (sceneId === "forest-autumn")
      forestAutumnConfig = createDefaultForestAutumnConfig();
    else if (sceneId === "cosmic-night")
      cosmicNightConfig = createDefaultCosmicNightConfig();
    else if (sceneId === "cosmic-aurora")
      cosmicAuroraConfig = createDefaultCosmicAuroraConfig();
  }

  function currentConfigSnapshot(): unknown {
    if (sceneId === "winter") return $state.snapshot(winterConfig);
    if (sceneId === "forest-firefly") return $state.snapshot(forestFireflyConfig);
    if (sceneId === "forest-autumn") return $state.snapshot(forestAutumnConfig);
    if (sceneId === "cosmic-night") return $state.snapshot(cosmicNightConfig);
    return $state.snapshot(cosmicAuroraConfig);
  }

  function currentDefaultFnName(): string {
    switch (sceneId) {
      case "winter":
        return "createDefaultWinterConfig";
      case "forest-firefly":
        return "createDefaultForestFireflyConfig";
      case "forest-autumn":
        return "createDefaultForestAutumnConfig";
      case "cosmic-night":
        return "createDefaultCosmicNightConfig";
      case "cosmic-aurora":
        return "createDefaultCosmicAuroraConfig";
    }
  }

  function currentConfigTypeName(): string {
    if (sceneId === "winter") return "WinterSceneConfig";
    if (sceneId.startsWith("forest")) return "ForestSceneConfig";
    return "CosmicSceneConfig";
  }

  async function copyCurrentToClipboard(): Promise<void> {
    const snapshot = currentConfigSnapshot();
    const tsCode = `export function ${currentDefaultFnName()}(): ${currentConfigTypeName()} {\n  return ${JSON.stringify(snapshot, null, 2)};\n}\n`;
    await navigator.clipboard.writeText(tsCode);
  }

  return {
    get sceneId() {
      return sceneId;
    },
    setSceneId(id: SceneId) {
      sceneId = id;
    },
    get winterConfig() {
      return winterConfig;
    },
    get forestFireflyConfig() {
      return forestFireflyConfig;
    },
    get forestAutumnConfig() {
      return forestAutumnConfig;
    },
    get cosmicNightConfig() {
      return cosmicNightConfig;
    },
    get cosmicAuroraConfig() {
      return cosmicAuroraConfig;
    },
    resetCurrent,
    copyCurrentToClipboard,
  };
}

export type SceneLabState = ReturnType<typeof createSceneLabState>;
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: Clean

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/lab/tabs/scene-lab/domain/scene-lab-types.ts src/lib/features/lab/tabs/scene-lab/state/scene-lab-state.svelte.ts
git commit -m "feat(scene-lab): add cosmic-night and cosmic-aurora SceneIds and state"
```

---

### Task 9: CosmicControls panel

**Files:**
- Create: `src/lib/features/lab/tabs/scene-lab/components/CosmicControls.svelte`

- [ ] **Step 1: Write CosmicControls.svelte**

Follows WinterControls pattern exactly — ParamPanel sections with ParamSlider/ParamColor bindings.

```svelte
<script lang="ts">
  import ParamPanel from "./ParamPanel.svelte";
  import ParamSlider from "./ParamSlider.svelte";
  import ParamColor from "./ParamColor.svelte";
  import { getSceneLabContext } from "../context/scene-lab-context";

  interface Props {
    variant: "night" | "aurora";
  }

  let { variant }: Props = $props();
  const { state } = getSceneLabContext();
  const cfg = $derived(
    variant === "night" ? state.cosmicNightConfig : state.cosmicAuroraConfig
  );
  const target = $derived(
    variant === "night" ? "cosmicNightConfig" : "cosmicAuroraConfig"
  );

  function set(path: string, value: unknown) {
    const parts = path.split(".");
    let obj: Record<string, unknown> = state[target] as Record<string, unknown>;
    for (let i = 0; i < parts.length - 1; i++) {
      obj = obj[parts[i]!] as Record<string, unknown>;
    }
    obj[parts[parts.length - 1]!] = value;
  }
</script>

<ParamPanel title="Sky">
  <ParamColor label="Top" value={cfg.sky.topColor} onChange={(v) => set("sky.topColor", v)} />
  <ParamColor label="Mid" value={cfg.sky.midColor ?? "#000000"} onChange={(v) => set("sky.midColor", v)} />
  <ParamColor label="Bottom" value={cfg.sky.bottomColor} onChange={(v) => set("sky.bottomColor", v)} />
</ParamPanel>

<ParamPanel title="Fog">
  <ParamColor label="Color" value={cfg.fog.color} onChange={(v) => set("fog.color", v)} />
  <ParamSlider label="Density" value={cfg.fog.density} min={0} max={0.05} step={0.001} onChange={(v) => set("fog.density", v)} />
</ParamPanel>

<ParamPanel title="Ground">
  <ParamColor label="Color" value={cfg.ground.color} onChange={(v) => set("ground.color", v)} />
  <ParamSlider label="Size" value={cfg.ground.size} min={5} max={60} step={1} unit="m" onChange={(v) => set("ground.size", v)} />
</ParamPanel>

<ParamPanel title="Station Platform">
  <ParamSlider label="Enabled" value={cfg.platform.enabled ? 1 : 0} min={0} max={1} step={1} onChange={(v) => set("platform.enabled", v > 0.5)} />
  <ParamSlider label="Radius" value={cfg.platform.radius} min={0.5} max={8} step={0.25} unit="m" onChange={(v) => set("platform.radius", v)} />
  <ParamSlider label="Height" value={cfg.platform.height} min={0.02} max={0.5} step={0.01} unit="m" onChange={(v) => set("platform.height", v)} />
  <ParamSlider label="Metallic" value={cfg.platform.metallic} min={0} max={1} step={0.05} onChange={(v) => set("platform.metallic", v)} />
  <ParamSlider label="Roughness" value={cfg.platform.roughness} min={0} max={1} step={0.05} onChange={(v) => set("platform.roughness", v)} />
  <ParamColor label="Base color" value={cfg.platform.baseColor} onChange={(v) => set("platform.baseColor", v)} />
  <ParamColor label="Emissive color" value={cfg.platform.emissiveColor} onChange={(v) => set("platform.emissiveColor", v)} />
  <ParamSlider label="Emissive intensity" value={cfg.platform.emissiveIntensity} min={0} max={3} step={0.05} onChange={(v) => set("platform.emissiveIntensity", v)} />
  <ParamSlider label="Edge glow width" value={cfg.platform.edgeGlowWidth} min={0} max={0.5} step={0.01} onChange={(v) => set("platform.edgeGlowWidth", v)} />
  <ParamSlider label="Pulse speed" value={cfg.platform.pulseSpeed} min={0} max={3} step={0.1} onChange={(v) => set("platform.pulseSpeed", v)} />
</ParamPanel>

<ParamPanel title="Earth" defaultOpen={false}>
  <ParamSlider label="Enabled" value={cfg.earth.enabled ? 1 : 0} min={0} max={1} step={1} onChange={(v) => set("earth.enabled", v > 0.5)} />
  <ParamSlider label="Pos X" value={cfg.earth.position[0]} min={-80} max={80} step={1} unit="m" onChange={(v) => set("earth.position.0", v)} />
  <ParamSlider label="Pos Y" value={cfg.earth.position[1]} min={-20} max={40} step={1} unit="m" onChange={(v) => set("earth.position.1", v)} />
  <ParamSlider label="Pos Z" value={cfg.earth.position[2]} min={-80} max={80} step={1} unit="m" onChange={(v) => set("earth.position.2", v)} />
  <ParamSlider label="Radius" value={cfg.earth.radius} min={1} max={20} step={0.5} unit="m" onChange={(v) => set("earth.radius", v)} />
  <ParamColor label="Rim color" value={cfg.earth.rimColor} onChange={(v) => set("earth.rimColor", v)} />
  <ParamSlider label="Rim intensity" value={cfg.earth.rimIntensity} min={0} max={3} step={0.1} onChange={(v) => set("earth.rimIntensity", v)} />
  <ParamSlider label="Rotation speed" value={cfg.earth.rotationSpeed} min={0} max={0.2} step={0.005} onChange={(v) => set("earth.rotationSpeed", v)} />
</ParamPanel>

<ParamPanel title="Nebula" defaultOpen={false}>
  <ParamSlider label="Enabled" value={cfg.nebula.enabled ? 1 : 0} min={0} max={1} step={1} onChange={(v) => set("nebula.enabled", v > 0.5)} />
  <ParamColor label="Color 1" value={cfg.nebula.color1} onChange={(v) => set("nebula.color1", v)} />
  <ParamColor label="Color 2" value={cfg.nebula.color2} onChange={(v) => set("nebula.color2", v)} />
  <ParamSlider label="Opacity" value={cfg.nebula.opacity} min={0} max={0.5} step={0.01} onChange={(v) => set("nebula.opacity", v)} />
  <ParamSlider label="Scale" value={cfg.nebula.scale} min={0.2} max={3} step={0.1} onChange={(v) => set("nebula.scale", v)} />
  <ParamSlider label="Animation speed" value={cfg.nebula.animationSpeed} min={0} max={0.1} step={0.005} onChange={(v) => set("nebula.animationSpeed", v)} />
</ParamPanel>

<ParamPanel title="Star Drift">
  {#if cfg.particles.starDrift}
    <ParamSlider label="Count" value={cfg.particles.starDrift.count} min={0} max={500} step={10} onChange={(v) => { if (cfg.particles.starDrift) set("particles.starDrift.count", v); }} />
    <ParamSlider label="Speed" value={cfg.particles.starDrift.speed} min={0} max={0.2} step={0.005} onChange={(v) => { if (cfg.particles.starDrift) set("particles.starDrift.speed", v); }} />
    {#each cfg.particles.starDrift.colors as _, i}
      <ParamColor label={`Star ${i + 1}`} value={cfg.particles.starDrift.colors[i]!} onChange={(v) => { if (cfg.particles.starDrift) set(`particles.starDrift.colors.${i}`, v); }} />
    {/each}
  {/if}
</ParamPanel>

<ParamPanel title="Cosmic Dust" defaultOpen={false}>
  {#if cfg.particles.cosmicDust}
    <ParamSlider label="Count" value={cfg.particles.cosmicDust.count} min={0} max={300} step={10} onChange={(v) => { if (cfg.particles.cosmicDust) set("particles.cosmicDust.count", v); }} />
    <ParamSlider label="Speed" value={cfg.particles.cosmicDust.speed} min={0} max={0.1} step={0.005} onChange={(v) => { if (cfg.particles.cosmicDust) set("particles.cosmicDust.speed", v); }} />
  {/if}
</ParamPanel>

<ParamPanel title="Energy Particles" defaultOpen={false}>
  {#if cfg.particles.energyParticles}
    <ParamSlider label="Enabled" value={cfg.particles.energyParticles.enabled ? 1 : 0} min={0} max={1} step={1} onChange={(v) => { if (cfg.particles.energyParticles) set("particles.energyParticles.enabled", v > 0.5); }} />
    <ParamSlider label="Count" value={cfg.particles.energyParticles.count} min={0} max={200} step={5} onChange={(v) => { if (cfg.particles.energyParticles) set("particles.energyParticles.count", v); }} />
    <ParamSlider label="Rise speed" value={cfg.particles.energyParticles.riseSpeed} min={0} max={2} step={0.05} unit="m/s" onChange={(v) => { if (cfg.particles.energyParticles) set("particles.energyParticles.riseSpeed", v); }} />
    <ParamSlider label="Max height" value={cfg.particles.energyParticles.maxHeight} min={1} max={10} step={0.5} unit="m" onChange={(v) => { if (cfg.particles.energyParticles) set("particles.energyParticles.maxHeight", v); }} />
    {#each cfg.particles.energyParticles.colors as _, i}
      <ParamColor label={`Glow ${i + 1}`} value={cfg.particles.energyParticles.colors[i]!} onChange={(v) => { if (cfg.particles.energyParticles) set(`particles.energyParticles.colors.${i}`, v); }} />
    {/each}
  {/if}
</ParamPanel>

<ParamPanel title="Meteor Streaks" defaultOpen={false}>
  {#if cfg.particles.meteorStreaks}
    <ParamSlider label="Enabled" value={cfg.particles.meteorStreaks.enabled ? 1 : 0} min={0} max={1} step={1} onChange={(v) => { if (cfg.particles.meteorStreaks) set("particles.meteorStreaks.enabled", v > 0.5); }} />
    <ParamSlider label="Frequency" value={cfg.particles.meteorStreaks.frequency} min={1} max={30} step={1} unit="s" onChange={(v) => { if (cfg.particles.meteorStreaks) set("particles.meteorStreaks.frequency", v); }} />
    <ParamSlider label="Speed" value={cfg.particles.meteorStreaks.speed} min={5} max={40} step={1} unit="m/s" onChange={(v) => { if (cfg.particles.meteorStreaks) set("particles.meteorStreaks.speed", v); }} />
    <ParamSlider label="Trail length" value={cfg.particles.meteorStreaks.trailLength} min={0.5} max={10} step={0.5} unit="m" onChange={(v) => { if (cfg.particles.meteorStreaks) set("particles.meteorStreaks.trailLength", v); }} />
  {/if}
</ParamPanel>

<ParamPanel title="Hemisphere Light" defaultOpen={false}>
  <ParamColor label="Sky" value={cfg.lighting.ambient.skyColor} onChange={(v) => set("lighting.ambient.skyColor", v)} />
  <ParamColor label="Ground" value={cfg.lighting.ambient.groundColor} onChange={(v) => set("lighting.ambient.groundColor", v)} />
  <ParamSlider label="Intensity" value={cfg.lighting.ambient.intensity} min={0} max={3} step={0.05} onChange={(v) => set("lighting.ambient.intensity", v)} />
</ParamPanel>

<ParamPanel title="Cold Directional Light" defaultOpen={false}>
  <ParamSlider label="Enabled" value={cfg.lighting.coldDirectional.enabled ? 1 : 0} min={0} max={1} step={1} onChange={(v) => set("lighting.coldDirectional.enabled", v > 0.5)} />
  <ParamColor label="Color" value={cfg.lighting.coldDirectional.color} onChange={(v) => set("lighting.coldDirectional.color", v)} />
  <ParamSlider label="Intensity" value={cfg.lighting.coldDirectional.intensity} min={0} max={3} step={0.05} onChange={(v) => set("lighting.coldDirectional.intensity", v)} />
</ParamPanel>

<ParamPanel title="Warm Station Glow" defaultOpen={false}>
  <ParamSlider label="Enabled" value={cfg.lighting.warmStation.enabled ? 1 : 0} min={0} max={1} step={1} onChange={(v) => set("lighting.warmStation.enabled", v > 0.5)} />
  <ParamColor label="Color" value={cfg.lighting.warmStation.color} onChange={(v) => set("lighting.warmStation.color", v)} />
  <ParamSlider label="Intensity" value={cfg.lighting.warmStation.intensity} min={0} max={50} step={1} onChange={(v) => set("lighting.warmStation.intensity", v)} />
  <ParamSlider label="Distance" value={cfg.lighting.warmStation.distance} min={1} max={30} step={1} unit="m" onChange={(v) => set("lighting.warmStation.distance", v)} />
  <ParamSlider label="Height" value={cfg.lighting.warmStation.heightOffset} min={0} max={3} step={0.1} unit="m" onChange={(v) => set("lighting.warmStation.heightOffset", v)} />
</ParamPanel>

<ParamPanel title="Accent Emissive" defaultOpen={false}>
  <ParamSlider label="Enabled" value={cfg.lighting.accentEmissive.enabled ? 1 : 0} min={0} max={1} step={1} onChange={(v) => set("lighting.accentEmissive.enabled", v > 0.5)} />
  <ParamColor label="Color" value={cfg.lighting.accentEmissive.color} onChange={(v) => set("lighting.accentEmissive.color", v)} />
  <ParamSlider label="Intensity" value={cfg.lighting.accentEmissive.intensity} min={0} max={3} step={0.05} onChange={(v) => set("lighting.accentEmissive.intensity", v)} />
  <ParamSlider label="Pulse speed" value={cfg.lighting.accentEmissive.pulseSpeed} min={0} max={3} step={0.1} onChange={(v) => set("lighting.accentEmissive.pulseSpeed", v)} />
</ParamPanel>
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: Clean

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/lab/tabs/scene-lab/components/CosmicControls.svelte
git commit -m "feat(scene-lab): add CosmicControls panel with all tunable parameters"
```

---

### Task 10: Wire Scene Lab UI — SceneLab.svelte and ScenePreview.svelte

**Files:**
- Modify: `src/lib/features/lab/tabs/scene-lab/SceneLab.svelte`
- Modify: `src/lib/features/lab/tabs/scene-lab/components/ScenePreview.svelte`

- [ ] **Step 1: Update SceneLab.svelte — add CosmicControls import and conditional**

Add import at top of script:
```typescript
import CosmicControls from "./components/CosmicControls.svelte";
```

Replace the controls-scroll conditional block:
```svelte
<div class="controls-scroll">
  {#if sceneState.sceneId === "winter"}
    <WinterControls />
  {:else if sceneState.sceneId === "cosmic-night"}
    <CosmicControls variant="night" />
  {:else if sceneState.sceneId === "cosmic-aurora"}
    <CosmicControls variant="aurora" />
  {:else}
    <ForestControls />
  {/if}
</div>
```

- [ ] **Step 2: Update ScenePreview.svelte — add cosmic scene rendering**

Add import at top of script:
```typescript
import CosmicScene from "$lib/shared/3d/environments/scenes/CosmicScene.svelte";
```

In the `<T.Group>` inside Canvas, add cosmic scene branches after the forest-autumn branch:

```svelte
{:else if labState.sceneId === "cosmic-night"}
  <CosmicScene variant="night" config={labState.cosmicNightConfig} />
{:else if labState.sceneId === "cosmic-aurora"}
  <CosmicScene variant="aurora" config={labState.cosmicAuroraConfig} />
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: Clean

- [ ] **Step 4: Run full build**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds with no errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/lab/tabs/scene-lab/SceneLab.svelte src/lib/features/lab/tabs/scene-lab/components/ScenePreview.svelte
git commit -m "feat(scene-lab): wire cosmic scenes into SceneLab and ScenePreview"
```

---

### Task 11: Verify in browser

- [ ] **Step 1: Start dev server on port 5174**

Run: `npx vite --port 5174 &`

- [ ] **Step 2: Navigate to Scene Lab, select Cosmic (Night)**

Open Scene Lab in the app. Select "Cosmic (Night)" from the scene dropdown.

Verify:
- Lunar textured ground visible
- Station platform with blue edge glow sitting on surface
- Earth sphere visible in sky with atmospheric rim
- Nebula color wash in background
- Star drift particles moving
- Cosmic dust motes floating
- Energy particles rising from platform area
- Occasional meteor streaks
- Three lighting layers visible (cold blue directional, warm point light from platform, blue accent glow)

- [ ] **Step 3: Switch to Cosmic (Aurora)**

Select "Cosmic (Aurora)" from dropdown.

Verify:
- Sky shifts to teal/emerald palette
- Platform glow changes to teal-green
- Nebula shows cyan/magenta colors
- Star colors shift to cyan/magenta/teal/pink mix

- [ ] **Step 4: Test Scene Lab sliders**

Adjust several parameters:
- Platform radius slider → platform resizes
- Earth position sliders → Earth moves
- Nebula opacity → nebula fades in/out
- Energy particles count → particle density changes
- Cold directional enabled toggle → light on/off

- [ ] **Step 5: Copy config and verify output**

Click "Copy config" button. Paste into a text editor. Verify it produces valid TypeScript with the current slider values.

- [ ] **Step 6: Commit verification screenshot or state "verified visually"**

Cannot take automated screenshot per CLAUDE.md — ask user to confirm visual state.
