# Fish Swimming Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix frozen fish in the ocean scene by adding GPU init diagnostics, eliminating NaN propagation, normalizing speed to body-lengths-per-second, strengthening animation coupling, and providing a CPU fallback.

**Architecture:** GPGPU boids simulation via Three.js `GPUComputationRenderer` with DataTexture ping-pong. Three compute shaders (velocity, position, state) feed `InstancedMesh` render materials. Fixes are shader-level (`safeNormalize`, BL/s speed, drag) plus TypeScript-level (logging, fallback, `rayPosition` prop wiring).

**Tech Stack:** Three.js GPUComputationRenderer, GLSL ES 3.0, Svelte 5, Threlte v8, TypeScript

---

## File Map

| File | Role | Changes |
|------|------|---------|
| `src/lib/shared/3d/environments/scenes/ocean/fish-shaders.ts` | Velocity, position, render vertex/fragment shaders | Add `safeNormalize()`, NaN guard in position shader, BL/s speed uniforms, drag fix, amplitude coupling |
| `src/lib/shared/3d/environments/scenes/ocean/fish-behavior-shader.ts` | Trophic state machine shader | Add `safeNormalize()` to 5 unguarded normalize calls |
| `src/lib/shared/3d/environments/scenes/ocean/FishSchool.svelte` | GPGPU orchestrator + InstancedMesh setup | GPU init logging, CPU fallback, new uniforms for BL/s, drag |
| `src/lib/shared/3d/environments/scenes/ocean/fish-species-config.ts` | Species data | No structural change — speed values reinterpreted as BL/s |
| `src/lib/shared/3d/environments/domain/models/scene-configs.ts` | Ocean config defaults | Add `halfSpeedTime` field to fish config |
| `src/lib/shared/3d/environments/scenes/OceanScene.svelte` | Scene composition | Pass `rayPosition` prop to FishSchool |

---

### Task 1: Add `safeNormalize()` to velocity + position shaders

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/ocean/fish-shaders.ts`

This task adds the `safeNormalize` helper and replaces every fragile `normalize()` call in the velocity shader, adds a NaN guard to the position shader, and adds `safeNormalize` to the render vertex shader.

- [ ] **Step 1: Add `safeNormalize` GLSL helpers to top of file**

Add after the `NOISE_GLSL` constant (after line 61), as a new shared GLSL block:

```typescript
const SAFE_NORMALIZE_GLSL = /* glsl */ `
vec3 safeNormalize(vec3 v) {
  float l = length(v);
  return l > 1e-6 ? v / l : vec3(0.0, 0.0, 1.0);
}

vec2 safeNormalize2(vec2 v) {
  float l = length(v);
  return l > 1e-6 ? v / l : vec2(0.0, 1.0);
}
`;
```

- [ ] **Step 2: Inject `safeNormalize` into velocity shader**

In the `velocityShader` template string, add `${SAFE_NORMALIZE_GLSL}` right after `${NOISE_GLSL}` (currently at line 113).

Change line 113 area from:
```glsl
${NOISE_GLSL}
```
to:
```glsl
${NOISE_GLSL}
${SAFE_NORMALIZE_GLSL}
```

- [ ] **Step 3: Replace all normalize calls in velocity shader**

Replace each call site:

**Line 185** — forward direction:
```glsl
// Before:
vec3 forward = length(vel) > 0.001 ? normalize(vel) : vec3(0.0, 0.0, 1.0);
// After:
vec3 forward = safeNormalize(vel);
```

**Line 198** — perception cone check (inside boids loop):
```glsl
// Before:
float cosAngle = dot(forward, normalize(toNeighbor));
// After:
float cosAngle = dot(forward, safeNormalize(toNeighbor));
```

**Line 205** — separation force:
```glsl
// Before:
sep += normalize(pos - op) * (1.0 - d / uSepDist);
// After:
sep += safeNormalize(pos - op) * (1.0 - d / uSepDist);
```

**Line 221** — separation steering:
```glsl
// Before:
if (sepN > 0.0) steer += normalize(sep / sepN) * 0.3;
// After:
if (sepN > 0.0) steer += safeNormalize(sep / sepN) * 0.3;
```

**Line 223** — cohesion steering:
```glsl
// Before:
if (cohN > 0.0) steer += normalize(coh / cohN - pos) * 0.8 * socialMult;
// After:
if (cohN > 0.0) steer += safeNormalize(coh / cohN - pos) * 0.8 * socialMult;
```

**Line 230** — school center pull:
```glsl
// Before:
steer += normalize(toSchool) * pull * 0.5;
// After:
steer += safeNormalize(toSchool) * pull * 0.5;
```

**Line 242** — boundary containment (uses vec2):
```glsl
// Before:
steer.xz += normalize(toCenter) * t * 1.5;
// After:
steer.xz += safeNormalize2(toCenter) * t * 1.5;
```

**Line 253** — stage avoidance (vec2 with bad epsilon):
```glsl
// Before:
steer.xz += normalize(pos.xz + 0.001) * pen * 3.0;
// After:
steer.xz += safeNormalize2(pos.xz) * pen * 3.0;
```

**Line 258** — scatter avoidance (bad epsilon):
```glsl
// Before:
vec3 away = normalize(pos - uScatterOrigin + vec3(0.001));
// After:
vec3 away = safeNormalize(pos - uScatterOrigin);
```

**Lines 285, 289, 301** — state machine threat directions (3 sites):
```glsl
// Before:
steer = normalize(threatDir + vec3(0.001)) * 2.0 + sep * 0.3;
// After:
steer = safeNormalize(threatDir) * 2.0 + sep * 0.3;
```
```glsl
// Before:
steer = normalize(threatDir + vec3(0.001)) * 1.5;
// After:
steer = safeNormalize(threatDir) * 1.5;
```
```glsl
// Before:
steer = normalize(threatDir + vec3(0.001)) * 1.5;
// After:
steer = safeNormalize(threatDir) * 1.5;
```

**Line 303** — home return (no guard currently):
```glsl
// Before:
steer = normalize(home - pos) * 1.0;
// After:
steer = safeNormalize(home - pos) * 1.0;
```

**Line 319** — dart velocity (bad epsilon):
```glsl
// Before:
vel += normalize(vel + vec3(0.001)) * uDartStrength;
// After:
vel += safeNormalize(vel) * uDartStrength;
```

- [ ] **Step 4: Add NaN guard to position shader**

In the `positionShader`, after reading velocity and before writing `gl_FragColor`, add a NaN firewall. Change:

```glsl
vec2 uv = gl_FragCoord.xy / resolution.xy;
vec4 posData = texture2D(texturePosition, uv);
vec3 vel = texture2D(textureVelocity, uv).xyz;
posData.xyz += vel * uDelta;
gl_FragColor = posData;
```

to:

```glsl
vec2 uv = gl_FragCoord.xy / resolution.xy;
vec4 posData = texture2D(texturePosition, uv);
vec3 vel = texture2D(textureVelocity, uv).xyz;

// NaN firewall: if velocity is NaN, zero it; if position is NaN, respawn
if (any(isnan(vel)) || any(isinf(vel))) vel = vec3(0.0);
posData.xyz += vel * uDelta;

if (any(isnan(posData.xyz)) || any(isinf(posData.xyz))) {
  float hash1 = fract(sin(uv.x * 12.9898 + uv.y * 78.233) * 43758.5453);
  float hash2 = fract(sin(uv.x * 39.346 + uv.y * 11.135) * 43758.5453);
  float hash3 = fract(sin(uv.x * 73.156 + uv.y * 29.984) * 43758.5453);
  posData.xyz = vec3(
    (hash1 - 0.5) * 20.0,
    2.0 + hash2 * 5.0,
    (hash3 - 0.5) * 20.0
  );
}

gl_FragColor = posData;
```

- [ ] **Step 5: Add `safeNormalize` to render vertex shader**

In `renderVertexShader`, add `${SAFE_NORMALIZE_GLSL}` at the top (after the uniform declarations, before `void main()`).

Replace line 395:
```glsl
// Before:
vec3 forward = length(fishVel) > 0.001 ? normalize(fishVel) : vec3(0.0, 0.0, 1.0);
// After:
vec3 forward = safeNormalize(fishVel);
```

Replace line 399:
```glsl
// Before:
vec3 right = normalize(cross(worldUp, forward));
// After:
vec3 right = safeNormalize(cross(worldUp, forward));
```

Replace line 435:
```glsl
// Before:
vNormal = normalize(rot * normal);
// After:
vNormal = safeNormalize(rot * normal);
```

- [ ] **Step 6: Run typecheck**

Run: `npm run check`
Expected: PASS — no type errors (changes are GLSL strings, not TypeScript types)

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/ocean/fish-shaders.ts
git commit -m "fix(ocean): add safeNormalize to velocity/position/render shaders, NaN firewall in position shader"
```

---

### Task 2: Add `safeNormalize()` to behavior shader

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/ocean/fish-behavior-shader.ts`

The behavior shader (`stateShader`) has 5 completely unguarded `normalize()` calls — more dangerous than the velocity shader because they have zero epsilon protection.

- [ ] **Step 1: Add `safeNormalize` helper to stateShader**

Insert `safeNormalize` function definition at the top of the `stateShader` GLSL string, right after the opening backtick and uniform declarations (before `void main()`):

```glsl
vec3 safeNormalize(vec3 v) {
  float l = length(v);
  return l > 1e-6 ? v / l : vec3(0.0, 0.0, 1.0);
}
```

Add it right before the `void main() {` line.

- [ ] **Step 2: Replace all 5 unguarded normalize calls**

**Line 30** — forward direction (already has manual guard, replace for consistency):
```glsl
// Before:
vec3 forward = length(vel) > 0.001 ? normalize(vel) : vec3(0.0, 0.0, 1.0);
// After:
vec3 forward = safeNormalize(vel);
```

**Line 52** — scatter flee direction:
```glsl
// Before:
vec3 awayFromRay = normalize(pos - uScatterOrigin);
// After:
vec3 awayFromRay = safeNormalize(pos - uScatterOrigin);
```

**Line 68** — perception cone check:
```glsl
// Before:
float facing = dot(forward, normalize(toNeighbor));
// After:
float facing = dot(forward, safeNormalize(toNeighbor));
```

**Line 77** — flee direction:
```glsl
// Before:
vec3 away = normalize(pos - op);
// After:
vec3 away = safeNormalize(pos - op);
```

**Line 85** — hunt direction:
```glsl
// Before:
vec3 toward = normalize(op - pos);
// After:
vec3 toward = safeNormalize(op - pos);
```

**Line 103** — territorial aggression direction:
```glsl
// Before:
vec3 toward = normalize(op - pos);
// After:
vec3 toward = safeNormalize(op - pos);
```

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/ocean/fish-behavior-shader.ts
git commit -m "fix(ocean): add safeNormalize to behavior shader — 5 previously unguarded normalize calls"
```

---

### Task 3: GPU init logging + CPU fallback

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/ocean/FishSchool.svelte`

- [ ] **Step 1: Add gpu init logging**

At `FishSchool.svelte:398-399`, change:

```typescript
const err = gpu.init();
if (err !== null) return;
```

to:

```typescript
const err = gpu.init();
if (err !== null) {
  console.error('[FishSchool] GPUComputationRenderer init failed:', err);
  return;
}
console.log('[FishSchool] GPU init OK —', loaded.length, 'species,', spawnOffset, 'fish, texSize', localTexSize);
```

- [ ] **Step 2: Add `gpuFailed` state and CPU fallback state variables**

Near the top state declarations (around line 146), add:

```typescript
let gpuFailed = $state(false);
let fallbackMeshes = $state<InstancedMesh[]>([]);
```

- [ ] **Step 3: Create CPU fallback function**

After the `getLocoUniforms` function (after line 128), add the CPU fallback. This creates 20 fish on smooth circular paths using a single InstancedMesh with CPU-driven transforms:

```typescript
function initCPUFallback(
  loadedResults: { species: FishSpeciesConfig; model: ExtractedModel }[],
  gy: number,
) {
  const FALLBACK_COUNT = 20;
  const firstModel = loadedResults.find((r) => r.model)?.model;
  if (!firstModel) return;

  const geo = firstModel.geometry.clone();
  const mat = new ShaderMaterial({
    uniforms: {
      tPosition: { value: null },
      tVelocity: { value: null },
      uSize: { value: targetSize * 0.5 },
      uTime: { value: 0 },
      uMaxSpeed: { value: 1.0 },
      ...getLocoUniforms(LocomotionMode.Carangiform),
      tAlbedo: { value: firstModel.diffuseMap },
      uFallbackColor: { value: new Color('#5599bb') },
      uHasTexture: { value: firstModel.diffuseMap ? 1.0 : 0.0 },
      uLightDir: { value: new Vector3(0.3, 1.0, 0.2).normalize() },
      uAmbient: { value: 0.55 },
      uRoughness: { value: 0.5 },
      uFogColor: { value: new Color('#1a3040') },
      uFogNear: { value: 15 },
      uFogFar: { value: 25 },
    },
    vertexShader: renderVertexShader,
    fragmentShader: renderFragmentShader,
    side: DoubleSide,
  });

  const mesh = new InstancedMesh(geo, mat, FALLBACK_COUNT);
  mesh.frustumCulled = false;

  const dummy = new Object3D();
  const paths = Array.from({ length: FALLBACK_COUNT }, (_, i) => ({
    radius: 8 + Math.random() * 10,
    height: gy + 2 + Math.random() * 4,
    speed: 0.15 + Math.random() * 0.25,
    phase: (i / FALLBACK_COUNT) * Math.PI * 2,
    yOsc: 0.3 + Math.random() * 0.5,
    yFreq: 0.2 + Math.random() * 0.3,
  }));

  for (let i = 0; i < FALLBACK_COUNT; i++) {
    const p = paths[i]!;
    const angle = p.phase;
    dummy.position.set(
      Math.cos(angle) * p.radius,
      p.height,
      Math.sin(angle) * p.radius,
    );
    dummy.lookAt(
      Math.cos(angle + 0.1) * p.radius,
      p.height,
      Math.sin(angle + 0.1) * p.radius,
    );
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;

  fallbackMeshes = [mesh];

  let fbElapsed = 0;
  useTask((delta) => {
    fbElapsed += delta;
    mat.uniforms.uTime!.value = fbElapsed;
    for (let i = 0; i < FALLBACK_COUNT; i++) {
      const p = paths[i]!;
      const angle = fbElapsed * p.speed + p.phase;
      const x = Math.cos(angle) * p.radius;
      const z = Math.sin(angle) * p.radius;
      const y = p.height + Math.sin(fbElapsed * p.yFreq) * p.yOsc;
      dummy.position.set(x, y, z);
      const nextAngle = angle + 0.1;
      dummy.lookAt(
        Math.cos(nextAngle) * p.radius,
        y,
        Math.sin(nextAngle) * p.radius,
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
}
```

- [ ] **Step 4: Wire up CPU fallback on GPU init failure**

In the `$effect` block, after the `gpu.init()` error log (Step 1), add the fallback call:

```typescript
const err = gpu.init();
if (err !== null) {
  console.error('[FishSchool] GPUComputationRenderer init failed:', err);
  gpuFailed = true;
  const validResults = loaded
    .filter((r): r is { species: FishSpeciesConfig; model: ExtractedModel } => r.model !== null);
  initCPUFallback(validResults, gy);
  return;
}
```

- [ ] **Step 5: Render fallback meshes in template**

Update the template at the bottom of the file. Change:

```svelte
{#each meshes as mesh (mesh.id)}
  <T is={mesh} />
{/each}
```

to:

```svelte
{#each meshes as mesh (mesh.id)}
  <T is={mesh} />
{/each}
{#each fallbackMeshes as mesh (mesh.id)}
  <T is={mesh} />
{/each}
```

- [ ] **Step 6: Clean up fallback meshes in $effect teardown**

In the `$effect` return cleanup (around line 478), add:

```typescript
for (const m of fallbackMeshes) {
  (m.material as ShaderMaterial).dispose();
  m.geometry.dispose();
  m.dispose();
}
fallbackMeshes = [];
gpuFailed = false;
```

- [ ] **Step 7: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/ocean/FishSchool.svelte
git commit -m "fix(ocean): add GPU init logging + 20-fish CPU fallback for shader compilation failure"
```

---

### Task 4: BL/s speed normalization + physically-derived drag

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/ocean/fish-shaders.ts` (velocity shader)
- Modify: `src/lib/shared/3d/environments/scenes/ocean/FishSchool.svelte` (uniform setup)
- Modify: `src/lib/shared/3d/environments/domain/models/scene-configs.ts` (config interface + defaults)

The core fix: decouple speed from `targetSize` so fish move at correct body-lengths-per-second regardless of scale.

- [ ] **Step 1: Add `halfSpeedTime` to OceanSceneConfig**

In `scene-configs.ts`, add `halfSpeedTime` to the fish config interface (around line 337):

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
  halfSpeedTime: number;  // seconds for drag to halve velocity
};
```

In `createDefaultOceanAbyssConfig`, add `halfSpeedTime: 0.5` to the fish block (after `perceptionAngle: 135`):

```typescript
fish: {
  enabled: true,
  count: 150,
  targetSize: 0.7,
  swimHeight: [2, 7],
  speed: [0.5, 1.2],
  currentStrength: 0.3,
  swimFrequency: 5.0,
  waveAmplitude: 0.08,
  scatterRadius: 4.0,
  perceptionAngle: 135,
  halfSpeedTime: 0.5,
},
```

- [ ] **Step 2: Add new uniforms to velocity shader**

In `fish-shaders.ts`, add these uniforms to the `velocityShader` declaration block (after `uniform float uMaxSteer;` at line 76):

```glsl
uniform float uTargetSize;
uniform float uHalfSpeedTime;
```

- [ ] **Step 3: Replace magic drag + add BL/s speed computation in velocity shader**

In the `velocityShader` `void main()`, find the speed/drag section (around lines 277-314) and replace it.

Replace:
```glsl
float adjMax = uMaxSpeed * speedMult;
float adjMin = uMinSpeed * speedMult;
```

with:
```glsl
// BL/s: world speed = config speed * targetSize * per-fish sizeScale
float bodyLength = uTargetSize * instanceScale;
float adjMax = uMaxSpeed * speedMult * bodyLength;
float adjMin = uMinSpeed * speedMult * bodyLength;
```

Replace:
```glsl
vel = vel * 0.94 + steer * uDelta;
```

with:
```glsl
float drag = pow(0.5, uDelta / max(uHalfSpeedTime, 0.01));
vel = vel * drag + steer * uDelta;
```

- [ ] **Step 4: Pass new uniforms from FishSchool.svelte**

In `FishSchool.svelte`, in the velocity uniform setup block (around lines 319-346), add:

After `velU.uMaxSteer = { value: 0.1 };` (line 325):
```typescript
velU.uTargetSize = { value: targetSize };
velU.uHalfSpeedTime = { value: 0.5 };
```

Also update the `uMaxSpeed` and `uMinSpeed` to remove the `* 2.0` multiplier that was compensating for the old absolute speed system:

Change:
```typescript
velU.uMaxSpeed = { value: sMax * 2.0 };
velU.uMinSpeed = { value: sMin };
```

to:
```typescript
velU.uMaxSpeed = { value: sMax };
velU.uMinSpeed = { value: sMin };
```

And update the render material `uMaxSpeed` to match. In the material creation loop (around line 435):

Change:
```typescript
uMaxSpeed: { value: sMax * 2.0 },
```

to:
```typescript
uMaxSpeed: { value: sMax },
```

Also do the same in the `createVisitorMesh` function (around line 555):

Change:
```typescript
uMaxSpeed: { value: sMax * 2.0 },
```

to:
```typescript
uMaxSpeed: { value: sMax },
```

- [ ] **Step 5: Update FishSchool to read halfSpeedTime from config**

Add `halfSpeedTime` to FishSchool Props interface:

```typescript
interface Props {
  targetSize?: number;
  swimHeight?: [number, number];
  speed?: [number, number];
  stageRadius?: number;
  boundRadius?: number;
  currentStrength?: number;
  scatterRadius?: number;
  perceptionAngle?: number;
  rayPosition?: Vector3;
  modelBasePath?: string;
  reefSdfData?: ReefSDFData | null;
  halfSpeedTime?: number;
}
```

Add to destructuring:
```typescript
halfSpeedTime = 0.5,
```

Use in uniform setup:
```typescript
velU.uHalfSpeedTime = { value: halfSpeedTime };
```

- [ ] **Step 6: Pass `halfSpeedTime` from OceanScene**

In `OceanScene.svelte`, add to the FishSchool usage (around line 1130-1140):

```svelte
<FishSchool
  targetSize={activeConfig.fish.targetSize}
  swimHeight={activeConfig.fish.swimHeight}
  speed={activeConfig.fish.speed}
  stageRadius={zones.clearingRadius}
  boundRadius={zones.forestOuter}
  currentStrength={activeConfig.fish.currentStrength}
  scatterRadius={activeConfig.fish.scatterRadius}
  perceptionAngle={activeConfig.fish.perceptionAngle}
  halfSpeedTime={activeConfig.fish.halfSpeedTime}
  {reefSdfData}
/>
```

- [ ] **Step 7: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/ocean/fish-shaders.ts src/lib/shared/3d/environments/scenes/ocean/FishSchool.svelte src/lib/shared/3d/environments/domain/models/scene-configs.ts src/lib/shared/3d/environments/scenes/OceanScene.svelte
git commit -m "fix(ocean): BL/s speed normalization + physically-derived drag — decouples fish speed from targetSize"
```

---

### Task 5: Strengthen amplitude-speed coupling in vertex shader

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/ocean/fish-shaders.ts` (render vertex shader)

- [ ] **Step 1: Lower amplitude and frequency floors**

In `renderVertexShader`, find the speed coupling section (around lines 409-416 before other edits; search for `speedMult` in the vertex shader):

Replace:
```glsl
float speedMult = length(fishVel) / max(uMaxSpeed * 0.5, 0.001);
float perInstanceJitter = aReference.x * 2.0;
float freq = uSwimFreq * (0.8 + speedMult * 0.4);
float phase = uTime * freq + localPos.z * uWaveK;

float envelope = pow(max(spineMask, 0.001), uAmpExponent);
float stiffMask = mix(1.0, envelope, uStiffness);
float bodyAmp = uBaseAmplitude * stiffMask * (0.7 + 0.3 * speedMult);
```

with:
```glsl
float speedMult = length(fishVel) / max(uMaxSpeed * 0.5, 0.001);
float speedRatio = clamp(speedMult, 0.0, 2.0);
float perInstanceJitter = aReference.x * 2.0;
float freq = uSwimFreq * mix(0.4, 1.0, min(speedRatio, 1.0));
float phase = uTime * freq + localPos.z * uWaveK;

float envelope = pow(max(spineMask, 0.001), uAmpExponent);
float stiffMask = mix(1.0, envelope, uStiffness);
float bodyAmp = uBaseAmplitude * stiffMask * max(speedRatio, 0.15);
```

Key changes:
- Frequency floor: `0.8 + 0.4*s` → `mix(0.4, 1.0, s)` — 40% floor instead of 80%
- Amplitude floor: `0.7 + 0.3*s` → `max(s, 0.15)` — 15% floor instead of 70%, linear with speed
- `speedRatio` clamped to [0, 2] to allow burst animations to exceed baseline

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/ocean/fish-shaders.ts
git commit -m "fix(ocean): strengthen amplitude-speed coupling — lower floors from 70%/80% to 15%/40%"
```

---

### Task 6: Pass `rayPosition` prop from OceanScene to FishSchool

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/OceanScene.svelte`

- [ ] **Step 1: Check if OceanScene already tracks a ray/mouse position**

Search OceanScene for any existing raycaster or mouse position state. If found, wire it through. If not, we need to add a reactive `Vector3` that tracks mouse-to-world raycasting (which will be fully implemented in the Mouse Scatter spec). For now, just wire the existing prop with a placeholder that the scatter spec will populate.

The `FishSchool` component already declares `rayPosition` as a prop defaulting to `Vector3(0, 0, 0)`. The `FishEventSystem.tick()` at line 624 already copies `rayPosition` into `uScatterOrigin`. All we need is OceanScene to pass it.

- [ ] **Step 2: Add rayPosition state to OceanScene**

Near the top of the `<script>` block in OceanScene (after the config setup), add:

```typescript
let rayPosition = $state(new Vector3(0, -999, 0));
```

Using y=-999 ensures scatter is off-screen by default (fish must be within `scatterRadius` of this point to scatter, and no fish swim at y=-999).

- [ ] **Step 3: Pass rayPosition to FishSchool**

In the FishSchool usage (around line 1130), add the prop:

```svelte
<FishSchool
  targetSize={activeConfig.fish.targetSize}
  swimHeight={activeConfig.fish.swimHeight}
  speed={activeConfig.fish.speed}
  stageRadius={zones.clearingRadius}
  boundRadius={zones.forestOuter}
  currentStrength={activeConfig.fish.currentStrength}
  scatterRadius={activeConfig.fish.scatterRadius}
  perceptionAngle={activeConfig.fish.perceptionAngle}
  halfSpeedTime={activeConfig.fish.halfSpeedTime}
  {rayPosition}
  {reefSdfData}
/>
```

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/OceanScene.svelte
git commit -m "fix(ocean): wire rayPosition prop to FishSchool — scatter origin no longer stuck at world origin"
```

---

### Task 7: Build verification

**Files:** None (read-only verification)

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: PASS with zero errors

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 3: Run existing tests**

Run: `npx vitest run tests/unit/3d-viewer/ --reporter=verbose`
Expected: All existing tests pass (these tests don't test GLSL but they verify the TypeScript integration layer hasn't broken)

- [ ] **Step 4: Visual verification statement**

State: "I cannot verify the visual fish swimming behavior. Please open the ocean scene in your browser and check: (1) fish are visible and moving in schooling patterns, (2) body undulation scales with speed (hovering = gentle, cruising = full), (3) no fish stuck at origin or teleporting, (4) console shows `[FishSchool] GPU init OK`. If GPU init fails, check console for the error message and confirm 20 fallback fish animate on circular paths."

- [ ] **Step 5: Commit verification results**

No commit needed — verification is observational.

---

## Summary of all changes

| Commit | Files | What |
|--------|-------|------|
| 1 | `fish-shaders.ts` | `safeNormalize()` everywhere + NaN firewall in position shader |
| 2 | `fish-behavior-shader.ts` | `safeNormalize()` for 5 unguarded normalize calls |
| 3 | `FishSchool.svelte` | GPU init logging + 20-fish CPU fallback |
| 4 | `fish-shaders.ts`, `FishSchool.svelte`, `scene-configs.ts`, `OceanScene.svelte` | BL/s speed + drag fix |
| 5 | `fish-shaders.ts` | Amplitude-speed coupling floors lowered |
| 6 | `OceanScene.svelte` | Wire `rayPosition` prop |
| 7 | — | Build + typecheck + visual verification |
