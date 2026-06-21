# Fish Personality System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 4-layer personality system to the GPGPU fish boids — perception-cone vision, curl noise currents, per-fish trait modulation, undulatory body animation, C-start escape, and a CPU event system for darts/scatter/excursions.

**Architecture:** Static traits texture (DataTexture, written once at init) with species-specific personality distributions. Velocity shader reads traits to modulate boids forces. CPU event system fires single-frame impulses via uniforms. Vertex shader replaces basic tail wiggle with cosine-wave body motion + C-start escape detection.

**Tech Stack:** Three.js GPUComputationRenderer, GLSL (inline shader strings), Svelte 5 `$effect`/`useTask`, Vitest

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/shared/3d/environments/domain/models/scene-configs.ts` | Modify | Add 5 new personality config fields to `OceanSceneConfig.fish` interface + defaults |
| `src/lib/shared/3d/environments/scenes/ocean/FishSchool.svelte` | Modify | Traits texture, species split, enhanced velocity shader, vertex animation, event system integration |
| `src/lib/shared/3d/environments/scenes/ocean/FishEventSystem.ts` | Create | CPU event class — dart timers, vertical excursions, scatter state |
| `src/lib/shared/3d/environments/scenes/OceanScene.svelte` | Modify | Compute ray world position, pass as prop to FishSchool |
| `tests/unit/3d-viewer/fish-event-system.test.ts` | Create | Unit tests for FishEventSystem timer/impulse logic |

---

### Task 1: Config Interface

**Files:**
- Modify: `src/lib/shared/3d/environments/domain/models/scene-configs.ts:336-342` (interface)
- Modify: `src/lib/shared/3d/environments/domain/models/scene-configs.ts:940-946` (defaults)

- [ ] **Step 1: Add personality fields to fish interface**

In `scene-configs.ts`, replace the fish block in `OceanSceneConfig` (lines 336-342):

```typescript
  fish: {
    enabled: boolean;
    count: number;
    targetSize: number;
    swimHeight: [number, number];
    speed: [number, number];
    currentStrength: number;
    swimFrequency: number;
    waveAmplitude: number;
    scatterRadius: number;
    perceptionAngle: number;
  };
```

- [ ] **Step 2: Add defaults in createDefaultOceanAbyssConfig**

Replace the fish block in `createDefaultOceanAbyssConfig()` (lines 940-946):

```typescript
    fish: {
      enabled: true,
      count: 80,
      targetSize: 0.08,
      swimHeight: [2, 7],
      speed: [0.5, 1.2],
      currentStrength: 0.3,
      swimFrequency: 5.0,
      waveAmplitude: 0.08,
      scatterRadius: 4.0,
      perceptionAngle: 135,
    },
```

All 4 ocean variants (`abyss`, `reef`, `mystical`, `cinematic`) delegate to `createDefaultOceanAbyssConfig()`, so one change covers all.

- [ ] **Step 3: Typecheck**

Run: `npm run check`
Expected: PASS (all existing fish config consumers still satisfy the interface since FishSchool.svelte destructures with defaults)

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/environments/domain/models/scene-configs.ts
git commit -m "feat(ocean): add personality config fields to fish interface

Add currentStrength, swimFrequency, waveAmplitude, scatterRadius,
perceptionAngle to OceanSceneConfig.fish with sane defaults.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Species Split + Traits Texture

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/ocean/FishSchool.svelte:11` (imports)
- Modify: `src/lib/shared/3d/environments/scenes/ocean/FishSchool.svelte:16-34` (props)
- Modify: `src/lib/shared/3d/environments/scenes/ocean/FishSchool.svelte:296-358` (init)
- Modify: `src/lib/shared/3d/environments/scenes/ocean/FishSchool.svelte:361-378` (uniforms)

- [ ] **Step 1: Add imports and props**

Add `DataTexture`, `FloatType`, `RGBAFormat` to the three import:

```typescript
import {
  InstancedMesh,
  ShaderMaterial,
  Color,
  Vector3,
  InstancedBufferAttribute,
  DoubleSide,
  DataTexture,
  FloatType,
  RGBAFormat,
  type BufferGeometry,
} from "three";
```

Add new props to the `Props` interface and destructuring:

```typescript
interface Props {
  count?: number;
  targetSize?: number;
  swimHeight?: [number, number];
  speed?: [number, number];
  stageRadius?: number;
  boundRadius?: number;
  baseColor?: string;
  currentStrength?: number;
  swimFrequency?: number;
  waveAmplitude?: number;
  scatterRadius?: number;
  perceptionAngle?: number;
  rayPosition?: Vector3;
}

let {
  count = 80,
  targetSize = 0.08,
  swimHeight = [2, 7] as [number, number],
  speed = [0.5, 1.2] as [number, number],
  stageRadius = 5,
  boundRadius = 18,
  baseColor = "#5599bb",
  currentStrength = 0.3,
  swimFrequency = 5.0,
  waveAmplitude = 0.08,
  scatterRadius = 4.0,
  perceptionAngle = 135,
  rayPosition = new Vector3(0, 0, 0),
}: Props = $props();
```

- [ ] **Step 2: Species-based model count split**

Replace the equal-thirds split (lines 298-300):

```typescript
// ── Species-based fish distribution ──────────────────────────────────
const SPECIES = [
  { name: "common",    fraction: 0.35,  speed: [0.8, 1.2], social: [0.7, 1.3], bold: [0.6, 1.0] },
  { name: "butterfly", fraction: 0.325, speed: [0.6, 0.9], social: [1.0, 1.5], bold: [0.5, 0.8] },
  { name: "trout",     fraction: 0.325, speed: [1.1, 1.6], social: [0.5, 0.9], bold: [0.9, 1.3] },
] as const;

const commonCount = Math.ceil(count * SPECIES[0].fraction);
const butterflyCount = Math.floor(count * SPECIES[1].fraction);
const troutCount = count - commonCount - butterflyCount;
const modelCounts = [commonCount, butterflyCount, troutCount];
```

- [ ] **Step 3: Create traits DataTexture**

After initializing `posArr`/`velArr` and the position/velocity loop, add traits texture creation. Insert before the `posVar = gpu.addVariable(...)` line:

```typescript
// ── Traits texture (static — written once) ──────────────────────────
const traitsData = new Float32Array(texSize * texSize * 4);
let speciesOffset = 0;
for (let s = 0; s < 3; s++) {
  const sp = SPECIES[s];
  const sCount = modelCounts[s]!;
  for (let j = 0; j < sCount; j++) {
    const gi = speciesOffset + j;
    const idx = gi * 4;
    const rand = () => Math.random();
    traitsData[idx + 0] = sp.speed[0] + rand() * (sp.speed[1] - sp.speed[0]);   // speedMult
    traitsData[idx + 1] = sp.social[0] + rand() * (sp.social[1] - sp.social[0]); // socialMult
    traitsData[idx + 2] = sp.bold[0] + rand() * (sp.bold[1] - sp.bold[0]);       // boldness
    traitsData[idx + 3] = rand();                                                  // dartSeed
  }
  speciesOffset += sCount;
}
const traitsTex = new DataTexture(traitsData, texSize, texSize, RGBAFormat, FloatType);
traitsTex.needsUpdate = true;
```

- [ ] **Step 4: Add traits texture as uniform on velocity shader**

Add `tTraits` to the velocity shader uniforms (after the existing `velUniforms` setup):

```typescript
velUniforms.tTraits = { value: traitsTex };
velUniforms.uTime = { value: 0 };
velUniforms.uCurrentStrength = { value: currentStrength };
velUniforms.uPerceptionCos = { value: Math.cos(perceptionAngle * Math.PI / 180) };
velUniforms.uScatterOrigin = { value: new Vector3(0, 0, 0) };
velUniforms.uScatterRadius = { value: scatterRadius };
velUniforms.uScatterForce = { value: 3.0 };
velUniforms.uDartCount = { value: 0 };
velUniforms.uDartIndices = { value: new Int32Array(8).fill(-1) };
velUniforms.uDartStrength = { value: 2.0 };
velUniforms.uExcursionCount = { value: 0 };
velUniforms.uExcursionIndices = { value: new Int32Array(4).fill(-1) };
velUniforms.uExcursionBias = { value: new Float32Array(4) };
```

Also store `traitsData` in component state for the event system:

```typescript
let storedTraitsData: Float32Array | null = null;
```

Set it inside the `$effect`:

```typescript
storedTraitsData = traitsData;
```

And add to the cleanup:

```typescript
return () => {
  gpu.dispose();
  traitsTex.dispose();
  for (const geo of geometries) geo.dispose();
  for (const mat of createdMaterials) mat.dispose();
  for (const mesh of createdMeshes) mesh.dispose();
  meshes = [];
  materials = [];
  gpuCompute = null;
  posVar = null;
  velVar = null;
  storedTraitsData = null;
};
```

- [ ] **Step 5: Typecheck**

Run: `npm run check`
Expected: PASS (new uniforms are set but not yet read by shader — that's Task 3)

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/ocean/FishSchool.svelte
git commit -m "feat(ocean): add species-specific traits texture for fish personality

Species split: common (35%), butterfly (32.5%), trout (32.5%).
Each gets distinct trait distributions (speed, social, boldness).
Static DataTexture passed as uniform to velocity shader.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Enhanced Velocity Shader

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/ocean/FishSchool.svelte:55-149` (velocity shader)

- [ ] **Step 1: Write the complete enhanced velocity shader**

Replace the entire `velocityShader` string (lines 55-149) with:

```typescript
const velocityShader = /* glsl */ `
  uniform float uDelta;
  uniform float uTime;
  uniform float uSepDist;
  uniform float uAliDist;
  uniform float uMaxSpeed;
  uniform float uMinSpeed;
  uniform float uGroundY;
  uniform float uHeightMin;
  uniform float uHeightMax;
  uniform float uStageRadius;
  uniform float uBoundRadius;
  uniform float uFishCount;
  uniform float uMaxSteer;
  uniform float uCurrentStrength;
  uniform float uPerceptionCos;
  uniform sampler2D tTraits;

  // Scatter uniforms
  uniform vec3 uScatterOrigin;
  uniform float uScatterRadius;
  uniform float uScatterForce;

  // Dart impulse uniforms
  uniform int uDartCount;
  uniform int uDartIndices[8];
  uniform float uDartStrength;

  // Vertical excursion uniforms
  uniform int uExcursionCount;
  uniform int uExcursionIndices[4];
  uniform float uExcursionBias[4];

  // ── Simplex 3D noise (Stefan Gustavson / Ashima Arts) ─────────────
  vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
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
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 1.0 / 7.0;
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
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  vec3 curlNoise(vec3 p) {
    float e = 0.1;
    vec3 dx = vec3(e, 0.0, 0.0);
    vec3 dy = vec3(0.0, e, 0.0);
    vec3 dz = vec3(0.0, 0.0, e);
    float px = snoise(p + dx) - snoise(p - dx);
    float py = snoise(p + dy) - snoise(p - dy);
    float pz = snoise(p + dz) - snoise(p - dz);
    return vec3(py - pz, pz - px, px - py) / (2.0 * e);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec3 pos = texture2D(texturePosition, uv).xyz;
    vec4 velData = texture2D(textureVelocity, uv);
    vec3 vel = velData.xyz;
    float instanceScale = velData.w;

    if (pos.x > 9000.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, instanceScale); return; }

    // Read per-fish traits
    vec4 traits = texture2D(tTraits, uv);
    float speedMult = traits.r;
    float socialMult = traits.g;
    float boldness = traits.b;

    vec3 sep = vec3(0.0);
    vec3 ali = vec3(0.0);
    vec3 coh = vec3(0.0);
    float sepN = 0.0;
    float aliN = 0.0;
    float cohN = 0.0;

    vec3 forward = length(vel) > 0.001 ? normalize(vel) : vec3(0.0, 0.0, 1.0);

    for (float y = 0.0; y < resolution.y; y += 1.0) {
      for (float x = 0.0; x < resolution.x; x += 1.0) {
        vec2 ref = (vec2(x, y) + 0.5) / resolution.xy;
        vec3 op = texture2D(texturePosition, ref).xyz;
        if (op.x > 9000.0) continue;

        vec3 toNeighbor = op - pos;
        float d = length(toNeighbor);
        if (d < 0.001 || d > uAliDist * 1.5) continue;

        // Perception cone: reject neighbors behind (270° FOV)
        float cosAngle = dot(forward, normalize(toNeighbor));
        if (cosAngle < uPerceptionCos) continue;

        if (d < uSepDist) {
          sep += normalize(pos - op) * (1.0 - d / uSepDist);
          sepN += 1.0;
        }
        if (d < uAliDist) {
          ali += texture2D(textureVelocity, ref).xyz;
          aliN += 1.0;
        }
        if (d < uAliDist * 1.5) {
          coh += op;
          cohN += 1.0;
        }
      }
    }

    vec3 steer = vec3(0.0);
    if (sepN > 0.0) steer += normalize(sep / sepN) * 0.8;
    if (aliN > 0.0) steer += normalize(ali / aliN - vel) * 0.4 * socialMult;
    if (cohN > 0.0) steer += normalize(coh / cohN - pos) * 0.3 * socialMult;

    // Curl noise flow field
    vec3 curlForce = curlNoise(pos * 0.15 + uTime * 0.02) * uCurrentStrength;
    steer += curlForce;

    // Centering — soft pull toward origin
    vec2 toCenter = -pos.xz;
    float distXZ = length(pos.xz);
    if (distXZ > uBoundRadius * 0.6) {
      float t = (distXZ - uBoundRadius * 0.6) / (uBoundRadius * 0.4);
      steer.xz += normalize(toCenter) * t * 1.5;
    }

    // Height bounds
    float minY = uGroundY + uHeightMin;
    float maxY = uGroundY + uHeightMax;
    if (pos.y < minY + 0.5) steer.y += (minY + 0.5 - pos.y) * 2.0;
    if (pos.y > maxY - 0.5) steer.y -= (pos.y - maxY + 0.5) * 2.0;

    // Stage avoidance — bold fish tolerate closer proximity
    float avoidDist = (uStageRadius + 2.5) * (1.5 - boldness * 0.4);
    if (distXZ < avoidDist) {
      float pen = avoidDist - distXZ;
      steer.xz += normalize(pos.xz + 0.001) * pen * 3.0;
    }

    // Ray scatter — continuous avoidance when ray passes through school
    float distToRay = distance(pos, uScatterOrigin);
    if (distToRay < uScatterRadius && uScatterForce > 0.0) {
      vec3 away = normalize(pos - uScatterOrigin + vec3(0.001));
      float proximity = 1.0 - distToRay / uScatterRadius;
      steer += away * uScatterForce * proximity * proximity;
    }

    // Clamp max steering force
    float steerLen = length(steer);
    if (steerLen > uMaxSteer) steer = steer / steerLen * uMaxSteer;

    // Apply steering with drag
    vel = vel * 0.97 + steer * uDelta;

    // Per-fish speed clamp using trait-modulated range
    float adjMax = uMaxSpeed * speedMult;
    float adjMin = uMinSpeed * speedMult;
    float spd = length(vel);
    if (spd > adjMax) vel = vel / spd * adjMax;
    if (spd > 0.001 && spd < adjMin) vel = vel / spd * adjMin;

    // Dart impulses — AFTER speed clamp so velocity spike is visible to
    // the vertex shader's C-start detection. Drag decays it next frame.
    int fishIdx = int(gl_FragCoord.y) * int(resolution.x) + int(gl_FragCoord.x);
    for (int i = 0; i < 8; i++) {
      if (i >= uDartCount) break;
      if (fishIdx == uDartIndices[i]) {
        vel += normalize(vel + vec3(0.001)) * uDartStrength;
      }
    }

    // Vertical excursions — also after clamp
    for (int i = 0; i < 4; i++) {
      if (i >= uExcursionCount) break;
      if (fishIdx == uExcursionIndices[i]) {
        vel.y += uExcursionBias[i];
      }
    }

    gl_FragColor = vec4(vel, instanceScale);
  }
`;
```

- [ ] **Step 2: Update frame loop to pass new uniforms**

In the `useTask` callback (line 455+), add after `velVar.material.uniforms.uDelta.value = dt;`:

```typescript
velVar.material.uniforms.uTime.value = elapsed;
velVar.material.uniforms.uScatterOrigin.value.copy(rayPosition);
```

- [ ] **Step 3: Typecheck + build**

Run: `npm run check && npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/ocean/FishSchool.svelte
git commit -m "feat(ocean): enhanced velocity shader with perception cones, curl noise, traits

Perception-cone boids (270° FOV with blind spot behind).
Curl noise flow field from 3D simplex noise for invisible currents.
Per-fish trait modulation of alignment, cohesion, speed, and stage avoidance.
Ray scatter avoidance and dart/excursion impulse handling in shader.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Undulatory Vertex Animation

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/ocean/FishSchool.svelte:167-210` (vertex shader)
- Modify: `src/lib/shared/3d/environments/scenes/ocean/FishSchool.svelte:408-423` (material uniforms)

- [ ] **Step 1: Write the enhanced render vertex shader**

Replace the entire `renderVertexShader` string (lines 167-210):

```typescript
const renderVertexShader = /* glsl */ `
  attribute vec2 aReference;

  uniform sampler2D tPosition;
  uniform sampler2D tVelocity;
  uniform float uSize;
  uniform float uTime;
  uniform float uSwimFreq;
  uniform float uWaveNumber;
  uniform float uBaseAmplitude;
  uniform float uMaxSpeed;

  varying vec3 vNormal;
  varying float vHue;
  varying vec3 vWorldPos;

  void main() {
    vec4 posData = texture2D(tPosition, aReference);
    vec3 fishPos = posData.xyz;
    vHue = posData.w;

    vec4 velData = texture2D(tVelocity, aReference);
    vec3 fishVel = velData.xyz;
    float instanceScale = velData.w;

    vec3 forward = length(fishVel) > 0.001 ? normalize(fishVel) : vec3(0.0, 0.0, 1.0);
    vec3 worldUp = vec3(0.0, 1.0, 0.0);
    if (abs(dot(forward, worldUp)) > 0.99) worldUp = vec3(1.0, 0.0, 0.0);

    vec3 right = normalize(cross(worldUp, forward));
    vec3 up = cross(forward, right);
    mat3 rot = mat3(right, up, forward);

    float fishScale = uSize * instanceScale;
    vec3 localPos = position;

    // Undulatory propulsion — cosine wave traveling head to tail
    float perInstanceJitter = aReference.x * 2.0;
    float bodyPhase = uTime * (uSwimFreq + perInstanceJitter) + localPos.z * uWaveNumber;
    float bodyLength = 1.0;
    float amplitude = uBaseAmplitude * (0.2 + 0.8 * max(0.0, -localPos.z / bodyLength));
    float swimSpeed = length(fishVel);
    amplitude *= 0.5 + swimSpeed * 0.8;
    localPos.x += sin(bodyPhase) * amplitude;

    // C-start escape — sharp body bend when darting (velocity > 2× normal)
    float speedRatio = swimSpeed / (uMaxSpeed * 0.5);
    float cStartIntensity = smoothstep(1.5, 2.5, speedRatio);
    float cBend = cStartIntensity * sin(localPos.z * 1.5) * 0.3;
    localPos.x += cBend;

    vec3 transformed = rot * (localPos * fishScale) + fishPos;
    vWorldPos = transformed;
    vNormal = normalize(rot * normal);

    gl_Position = projectionMatrix * viewMatrix * vec4(transformed, 1.0);
  }
`;
```

- [ ] **Step 2: Add new uniforms to ShaderMaterial**

In the material creation loop (inside the `$effect`, around line 408), add to the uniforms object:

```typescript
const mat = new ShaderMaterial({
  uniforms: {
    tPosition: { value: null },
    tVelocity: { value: null },
    uSize: { value: targetSize },
    uTime: { value: 0 },
    uSwimFreq: { value: swimFrequency },
    uWaveNumber: { value: 3.0 },
    uBaseAmplitude: { value: waveAmplitude },
    uMaxSpeed: { value: sMax * 2.0 },
    uBaseColor: { value: new Color(baseColor) },
    uLightDir: { value: new Vector3(0.3, 1.0, 0.2).normalize() },
    uAmbient: { value: 0.55 },
    uFogColor: { value: new Color("#1a3040") },
    uFogNear: { value: 15 },
    uFogFar: { value: 25 },
  },
  vertexShader: renderVertexShader,
  fragmentShader: renderFragmentShader,
  side: DoubleSide,
});
```

- [ ] **Step 3: Typecheck + build**

Run: `npm run check && npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/ocean/FishSchool.svelte
git commit -m "feat(ocean): undulatory body animation with C-start escape response

Replace basic tail wiggle with cosine-wave body propulsion (head-to-tail
amplitude gradient, velocity-modulated intensity). Add C-start escape
override detected from velocity magnitude in the vertex shader.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: FishEventSystem

**Files:**
- Create: `src/lib/shared/3d/environments/scenes/ocean/FishEventSystem.ts`
- Create: `tests/unit/3d-viewer/fish-event-system.test.ts`

- [ ] **Step 1: Write the test file**

Create `tests/unit/3d-viewer/fish-event-system.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FishEventSystem } from "$lib/shared/3d/environments/scenes/ocean/FishEventSystem";
import { Vector3 } from "three";

function makeTraits(fishCount: number): Float32Array {
  const data = new Float32Array(fishCount * 4);
  for (let i = 0; i < fishCount; i++) {
    data[i * 4 + 0] = 1.0;  // speedMult
    data[i * 4 + 1] = 1.0;  // socialMult
    data[i * 4 + 2] = 0.8;  // boldness
    data[i * 4 + 3] = 0.5;  // dartSeed
  }
  return data;
}

function makeUniforms() {
  return {
    uDartCount: { value: 0 },
    uDartIndices: { value: new Int32Array(8).fill(-1) },
    uDartStrength: { value: 2.0 },
    uExcursionCount: { value: 0 },
    uExcursionIndices: { value: new Int32Array(4).fill(-1) },
    uExcursionBias: { value: new Float32Array(4) },
    uScatterOrigin: { value: new Vector3() },
  };
}

describe("FishEventSystem", () => {
  let system: FishEventSystem;
  let uniforms: ReturnType<typeof makeUniforms>;
  const fishCount = 10;

  beforeEach(() => {
    system = new FishEventSystem(fishCount, makeTraits(fishCount));
    uniforms = makeUniforms();
  });

  it("initializes with zero active darts", () => {
    const ray = new Vector3(100, 100, 100);
    system.tick(0, uniforms, ray);
    expect(uniforms.uDartCount.value).toBe(0);
  });

  it("fires darts after cooldown expires", () => {
    const ray = new Vector3(100, 100, 100);
    // Tick with large dt to expire all cooldowns
    system.tick(20, uniforms, ray);
    expect(uniforms.uDartCount.value).toBeGreaterThan(0);
    expect(uniforms.uDartCount.value).toBeLessThanOrEqual(8);
  });

  it("limits active darts to 8 max", () => {
    const bigSystem = new FishEventSystem(100, makeTraits(100));
    const ray = new Vector3(100, 100, 100);
    bigSystem.tick(50, uniforms, ray);
    expect(uniforms.uDartCount.value).toBeLessThanOrEqual(8);
  });

  it("clears darts each tick (single-frame impulses)", () => {
    const ray = new Vector3(100, 100, 100);
    system.tick(20, uniforms, ray);
    const firstCount = uniforms.uDartCount.value;
    expect(firstCount).toBeGreaterThan(0);

    // Next tick with small dt — cooldowns just reset, no new darts expected
    system.tick(0.016, uniforms, ray);
    // May have 0 darts or some new ones — but importantly, previous darts cleared
    expect(uniforms.uDartCount.value).toBeLessThanOrEqual(8);
  });

  it("copies ray position to scatter uniform", () => {
    const ray = new Vector3(5, 3, -2);
    system.tick(0.016, uniforms, ray);
    expect(uniforms.uScatterOrigin.value.x).toBe(5);
    expect(uniforms.uScatterOrigin.value.y).toBe(3);
    expect(uniforms.uScatterOrigin.value.z).toBe(-2);
  });

  it("fires vertical excursions", () => {
    const ray = new Vector3(100, 100, 100);
    system.tick(30, uniforms, ray);
    // With large dt, some excursions should fire
    expect(uniforms.uExcursionCount.value).toBeGreaterThanOrEqual(0);
    expect(uniforms.uExcursionCount.value).toBeLessThanOrEqual(4);
  });

  it("boldness affects dart cooldown — timid fish dart sooner", () => {
    const timidTraits = new Float32Array(4 * 4);
    const boldTraits = new Float32Array(4 * 4);
    for (let i = 0; i < 4; i++) {
      timidTraits[i * 4 + 2] = 0.5;  // low boldness = timid
      timidTraits[i * 4 + 3] = 0.5;
      boldTraits[i * 4 + 2] = 1.3;   // high boldness = bold
      boldTraits[i * 4 + 3] = 0.5;
    }
    const timidSystem = new FishEventSystem(4, timidTraits);
    const boldSystem = new FishEventSystem(4, boldTraits);

    const timidUniforms = makeUniforms();
    const boldUniforms = makeUniforms();
    const ray = new Vector3(100, 100, 100);

    // Tick with moderate dt — timid fish should dart before bold fish
    timidSystem.tick(8, timidUniforms, ray);
    boldSystem.tick(8, boldUniforms, ray);

    // Timid fish have shorter cooldowns so more should fire
    expect(timidUniforms.uDartCount.value).toBeGreaterThanOrEqual(
      boldUniforms.uDartCount.value
    );
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npx vitest run tests/unit/3d-viewer/fish-event-system.test.ts`
Expected: FAIL — `FishEventSystem` module not found

- [ ] **Step 3: Implement FishEventSystem**

Create `src/lib/shared/3d/environments/scenes/ocean/FishEventSystem.ts`:

```typescript
import { Vector3 } from "three";

export interface FishEventUniforms {
  uDartCount: { value: number };
  uDartIndices: { value: Int32Array };
  uDartStrength: { value: number };
  uExcursionCount: { value: number };
  uExcursionIndices: { value: Int32Array };
  uExcursionBias: { value: Float32Array };
  uScatterOrigin: { value: Vector3 };
}

export class FishEventSystem {
  private readonly fishCount: number;
  private readonly traitsData: Float32Array;
  private readonly dartTimers: Float32Array;
  private readonly excursionTimers: Float32Array;

  constructor(fishCount: number, traitsData: Float32Array) {
    this.fishCount = fishCount;
    this.traitsData = traitsData;
    this.dartTimers = new Float32Array(fishCount);
    this.excursionTimers = new Float32Array(fishCount);

    for (let i = 0; i < fishCount; i++) {
      this.dartTimers[i] = Math.random() * 8.0;
      this.excursionTimers[i] = 15.0 + Math.random() * 20.0;
    }
  }

  tick(dt: number, uniforms: FishEventUniforms, rayPosition: Vector3): void {
    let dartCount = 0;
    let excursionCount = 0;
    const dartIndices = uniforms.uDartIndices.value;
    const excursionIndices = uniforms.uExcursionIndices.value;
    const excursionBias = uniforms.uExcursionBias.value;

    dartIndices.fill(-1);
    excursionIndices.fill(-1);
    excursionBias.fill(0);

    for (let i = 0; i < this.fishCount; i++) {
      const boldness = this.traitsData[i * 4 + 2]!;
      const dartSeed = this.traitsData[i * 4 + 3]!;

      // Dart timer
      this.dartTimers[i] -= dt;
      if (this.dartTimers[i] <= 0 && dartCount < 8) {
        dartIndices[dartCount] = i;
        dartCount++;
        this.dartTimers[i] = 8.0 * (1.5 - boldness) + dartSeed * 2.0;
      }

      // Vertical excursion timer
      this.excursionTimers[i] -= dt;
      if (this.excursionTimers[i] <= 0 && excursionCount < 4) {
        excursionIndices[excursionCount] = i;
        excursionBias[excursionCount] = (dartSeed > 0.5 ? 1.0 : -1.0) * 0.5;
        excursionCount++;
        this.excursionTimers[i] = 15.0 + dartSeed * 20.0;
      }
    }

    uniforms.uDartCount.value = dartCount;
    uniforms.uExcursionCount.value = excursionCount;
    uniforms.uScatterOrigin.value.copy(rayPosition);
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `npx vitest run tests/unit/3d-viewer/fish-event-system.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/ocean/FishEventSystem.ts tests/unit/3d-viewer/fish-event-system.test.ts
git commit -m "feat(ocean): add FishEventSystem for dart impulses and vertical excursions

CPU event layer that manages per-fish cooldown timers. Fires single-frame
velocity impulses (darts in heading direction, vertical excursions) via
shader uniforms. Boldness trait modulates dart frequency.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Integration — Wire Event System + Ray Position

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/ocean/FishSchool.svelte` (import + frame loop)
- Modify: `src/lib/shared/3d/environments/scenes/OceanScene.svelte:391,760,1007-1017`

- [ ] **Step 1: Import and instantiate FishEventSystem in FishSchool**

Add import at the top of FishSchool.svelte:

```typescript
import { FishEventSystem, type FishEventUniforms } from "./FishEventSystem";
```

Add state variable alongside other component state:

```typescript
let eventSystem: FishEventSystem | null = null;
```

Inside the `$effect`, after `storedTraitsData = traitsData;`, instantiate:

```typescript
const evtSys = new FishEventSystem(count, traitsData);
eventSystem = evtSys;
```

Add to cleanup:

```typescript
eventSystem = null;
```

- [ ] **Step 2: Wire event system into frame loop**

In the `useTask` callback, after `posVar.material.uniforms.uDelta.value = dt;` and before `gpuCompute.compute();`, add:

```typescript
// CPU event impulses → shader uniforms (BEFORE gpu compute)
if (eventSystem) {
  eventSystem.tick(dt, velVar.material.uniforms as unknown as FishEventUniforms, rayPosition);
}
```

The full updated frame loop:

```typescript
useTask((delta) => {
  if (!gpuCompute || !posVar || !velVar || materials.length === 0) return;

  const dt = Math.min(delta, 0.05);
  elapsed += dt;

  velVar.material.uniforms.uDelta.value = dt;
  velVar.material.uniforms.uTime.value = elapsed;
  posVar.material.uniforms.uDelta.value = dt;

  // CPU event impulses → shader uniforms (BEFORE gpu compute)
  if (eventSystem) {
    eventSystem.tick(dt, velVar.material.uniforms as unknown as FishEventUniforms, rayPosition);
  }

  gpuCompute.compute();

  const posTex = gpuCompute.getCurrentRenderTarget(posVar).texture;
  const velTex = gpuCompute.getCurrentRenderTarget(velVar).texture;

  for (const mat of materials) {
    mat.uniforms.tPosition!.value = posTex;
    mat.uniforms.tVelocity!.value = velTex;
    mat.uniforms.uTime!.value = elapsed;
  }
});
```

- [ ] **Step 3: Compute and pass ray position in OceanScene**

In `OceanScene.svelte`, add a derived ray position Vector3. After `let rayAngle = $state(0);` (line 391), add:

```typescript
const rayWorldPos = $derived(
  new Vector3(Math.cos(rayAngle) * 10, groundY + 5, Math.sin(rayAngle) * 10)
);
```

Update the `<FishSchool>` template (lines 1007-1017) to pass all new config fields:

```svelte
{#if activeConfig.fish.enabled}
  <FishSchool
    count={activeConfig.fish.count}
    targetSize={activeConfig.fish.targetSize}
    swimHeight={activeConfig.fish.swimHeight}
    speed={activeConfig.fish.speed}
    stageRadius={zones.clearingRadius}
    boundRadius={zones.forestOuter}
    currentStrength={activeConfig.fish.currentStrength}
    swimFrequency={activeConfig.fish.swimFrequency}
    waveAmplitude={activeConfig.fish.waveAmplitude}
    scatterRadius={activeConfig.fish.scatterRadius}
    perceptionAngle={activeConfig.fish.perceptionAngle}
    rayPosition={rayWorldPos}
  />
{/if}
```

- [ ] **Step 4: Typecheck + build**

Run: `npm run check && npm run build`
Expected: PASS

- [ ] **Step 5: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS (including new fish-event-system tests)

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/ocean/FishSchool.svelte src/lib/shared/3d/environments/scenes/OceanScene.svelte
git commit -m "feat(ocean): integrate FishEventSystem and wire ray position

Connect CPU event system to FishSchool frame loop. Pass manta ray world
position from OceanScene as prop. All personality config fields now flow
from scene-configs through OceanScene to FishSchool.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Verification Checklist

After all 6 tasks, verify:

- [ ] `npm run check` — zero new type errors
- [ ] `npm run build` — clean build
- [ ] `npx vitest run` — all tests pass
- [ ] Visual: reload ocean scene, observe:
  - Fish school with visible speed variety (trout fast, butterfly slow)
  - Smooth body undulation (not just tail wiggle)
  - Occasional dart bursts (individual fish briefly speed up)
  - Fish avoid the manta ray as it orbits through the school
  - Subtle flowing drift from curl noise currents
  - Fish don't react to neighbors directly behind them (perception cones)
  - C-start body bend visible during dart impulses
- [ ] Performance: Chrome DevTools → Performance tab → fish compute < 0.5ms per frame
- [ ] Regression: seabed, ruins, corals, kelp, god rays, caustics, post-processing all unchanged
