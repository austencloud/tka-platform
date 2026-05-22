# Fish Swimming Fix — Design Spec

**Date:** 2026-05-22
**Status:** Draft
**Scope:** Diagnostic + fix for fish freezing in the ocean 3D scene. Confined to `FishSchool.svelte` and `fish-shaders.ts`.

---

## Problem

Fish in the ocean scene render at their initial positions but appear frozen — no visible translational movement or body animation. The GPGPU boids simulation, vertex animation, and event system are all wired up, but the visual result is static fish.

## Root Cause Analysis

After reading every file in the fish rendering pipeline (`FishSchool.svelte`, `fish-shaders.ts`, `fish-behavior-shader.ts`, `fish-locomotion-params.ts`, `fish-species-config.ts`, `FishEventSystem.ts`, `SpeciesRotationManager.ts`, and the OceanScene integration), the system is architecturally correct. No single line is obviously wrong. The freeze is caused by a combination of parameter imbalances and a missing diagnostic layer that make it impossible to tell which stage is failing at runtime.

### Probable causes, ranked by likelihood

**1. Silent `gpu.init()` failure (HIGH probability)**

At `FishSchool.svelte:398-399`:
```typescript
const err = gpu.init();
if (err !== null) return;
```

If any of the three GPGPU shaders (velocity, position, state) fail to compile, `init()` returns a non-null error string. The code silently returns without logging the error, without setting `gpuCompute`, and without creating any meshes. The `useTask` frame loop bails at line 603 because `gpuCompute` is null.

The velocity shader (`fish-shaders.ts:63-332`) is 270 lines of GLSL with a full N^2 boids loop, simplex noise, curl noise, SDF sampling with tetrahedron gradients, state machine behavior modifiers, and spawn/despawn logic. The state shader (`fish-behavior-shader.ts`) adds another N^2 loop with trophic matrix lookups. Either shader exceeding a GPU's instruction limit or loop iteration limit would cause a silent compilation failure.

If `gpu.init()` fails, fish don't render at all — they're invisible, not frozen. BUT: the initial `gpu.compute()` at line 461 runs AFTER `init()` succeeds, and textures are bound to materials. If `init()` succeeds but a RUNTIME error occurs during subsequent `compute()` calls (e.g., shader timeout on mobile GPUs), fish would appear at their initial positions and then freeze.

**2. Velocity effectively zero despite min-speed clamp (MEDIUM probability)**

The velocity shader uses aggressive drag:
```glsl
vel = vel * 0.94 + steer * uDelta;
```

With `uMaxSteer = 0.1` and `dt ≈ 0.016`, the max steering contribution per frame is `0.1 * 0.016 = 0.0016`. The drag removes `vel * 0.06` per frame. At equilibrium, velocity ≈ `steer * dt / (1 - drag) = 0.027`.

The min-speed clamp (`uMinSpeed = 0.5 * speedMult`) should prevent this, but if `speedMult` from the traits texture reads as 0 (e.g., traits texture not properly initialized or sampled at wrong UV), the clamp is ineffective.

**3. `targetSize` config mismatch makes movement imperceptible (MEDIUM probability)**

The scene config sets `fish.targetSize: 0.7` (from `scene-configs.ts:949`). The FishSchool was designed around `targetSize: 0.08`. At 8.75x the intended size, the largest resident fish (Emperor Angelfish, sizeScale 0.76) is `0.7 * 0.76 = 0.53` world units. Moving at the minimum speed of 0.5 units/sec, it traverses less than 1 body length per second. Combined with the 0.94 drag factor and soft steering, fish would appear to barely move — alive but sluggish to the point of looking frozen.

This is the core issue that BL/s speed normalization (see Fix Plan section 2) solves permanently.

**4. NaN propagation (LOW-MEDIUM probability)**

The velocity shader has multiple `normalize()` calls that could produce NaN if the input vector is zero:
- `normalize(vel + vec3(0.001))` — the 0.001 guard helps but doesn't cover all cases
- `normalize(pos - uScatterOrigin + vec3(0.001))` — same
- `normalize(pos.xz + 0.001)` — 2D normalize on `vec2`, guard is scalar on `pos.xz` which is wrong (should be `vec2(0.001)`)

The scattered `+0.001` epsilon pattern is fragile. A zero vector with magnitude 0.001 still normalizes to a vector pointing along the epsilon direction, not a meaningful fallback. And the epsilon is large enough to bias results when the actual vector is small but valid. The `safeNormalize()` helper (see Fix Plan section 1) replaces this pattern everywhere.

If NaN enters a fish's velocity, it stays NaN forever because `NaN * 0.94 = NaN` and `NaN + anything = NaN`. The position shader then produces `posData.xyz += NaN = NaN`, and the vertex shader places the fish at an undefined location (typically off-screen or at origin). NaN guards must exist in BOTH velocity and position shaders — position propagates NaN from velocity via `posData.xyz += vel * dt`, so a position-only guard catches cases where velocity NaN recovery hasn't triggered yet.

**5. `rayPosition` never passed from OceanScene (CONFIRMED, low impact)**

OceanScene does not pass the `rayPosition` prop to FishSchool (lines 1130-1140). The default `new Vector3(0, 0, 0)` means the scatter origin is always at world origin. This doesn't cause freezing but means scatter behavior is non-functional. Fish near the origin get a constant scatter force from `uScatterOrigin`.

## Diagnostic Plan

Before implementing any fix, add temporary console logging to identify which stage is failing. This takes 5 minutes and prevents guessing.

### Step 1: Log `gpu.init()` result

**File:** `FishSchool.svelte:398-399`
**Change:**
```typescript
const err = gpu.init();
if (err !== null) {
  console.error('[FishSchool] GPUComputationRenderer init failed:', err);
  return;
}
console.log('[FishSchool] GPU init OK, loaded', loaded.length, 'species,', spawnOffset, 'fish');
```

### Step 2: Log frame loop entry

**File:** `FishSchool.svelte:602-603`
**Change:**
```typescript
useTask((delta) => {
  if (!gpuCompute || !posVar || !velVar || !stateVar || materials.length === 0) return;
  // Add once-per-second diagnostic (remove after fix)
  const dt = Math.min(delta, 0.05);
  elapsed += dt;
  if (Math.floor(elapsed) !== Math.floor(elapsed - dt)) {
    console.log('[FishSchool] frame loop running, elapsed:', elapsed.toFixed(1), 'dt:', dt.toFixed(4));
  }
```

### Step 3: Read back GPU texture to verify positions change

Add a one-shot readback after 2 seconds of simulation:
```typescript
if (elapsed > 2 && elapsed - dt <= 2) {
  const rt = gpuCompute.getCurrentRenderTarget(posVar);
  const buf = new Float32Array(4);
  renderer.readRenderTargetPixels(rt, 0, 0, 1, 1, buf);
  console.log('[FishSchool] fish 0 position at t=2:', buf[0], buf[1], buf[2]);
}
```

If the position at t=2 equals the initial position, the GPGPU simulation is not advancing. If it has changed, the simulation works but rendering or scaling makes the movement invisible.

## Fix Plan

### 1. `safeNormalize()` helper — eliminate all epsilon hacks

**Problem:** The codebase uses scattered `normalize(v + vec3(0.001))` guards that (a) bias direction toward the epsilon when the real vector is small, (b) don't cover zero-length edge cases properly, and (c) are inconsistently applied across shaders.

**Solution:** Define a reusable `safeNormalize()` helper and replace every raw `normalize()` call in the velocity and behavior shaders:

```glsl
vec3 safeNormalize(vec3 v) {
  float l = length(v);
  return l > 1e-6 ? v / l : vec3(0.0, 0.0, 1.0);
}
```

The fallback `vec3(0.0, 0.0, 1.0)` (forward direction) is a safe default — a fish with zero velocity should face forward, not along an arbitrary epsilon vector.

**Apply to all call sites in `fish-shaders.ts`:**
- `normalize(vel + vec3(0.001))` -> `safeNormalize(vel)`
- `normalize(pos - uScatterOrigin + vec3(0.001))` -> `safeNormalize(pos - uScatterOrigin)`
- `normalize(pos.xz + 0.001)` -> use a `vec2` variant: `safeNormalize2(pos.xz)` with the same pattern
- All boids steering normalization (`normalize(sepDir)`, `normalize(cohDir)`, etc.)

**Apply to all call sites in `fish-behavior-shader.ts`:**
- Same pattern for any `normalize()` on vectors that could be zero (e.g., relative position between fish)

**Also add NaN guard in the position shader** (not just velocity). Since `posData.xyz += vel * dt` propagates NaN from either source, the position shader needs its own check:

```glsl
// Position shader: NaN firewall
if (any(isnan(posData.xyz)) || any(isinf(posData.xyz))) {
  posData.xyz = vec3(
    (fract(sin(ref.x * 12.9898) * 43758.5453) - 0.5) * uBoundsRadius,
    mix(uSwimHeightMin, uSwimHeightMax, fract(sin(ref.y * 78.233) * 43758.5453)),
    (fract(sin(ref.x * 39.346) * 43758.5453) - 0.5) * uBoundsRadius
  );
}
```

This respawns NaN-corrupted fish at a random valid position rather than losing them permanently.

### 2. Body-lengths-per-second (BL/s) speed normalization

**Problem:** Speed parameters are defined in absolute world units. When `targetSize` changes (from the original `0.08` design value to the current `0.7`), fish speed doesn't scale. At 8.75x size, fish need 8.75x speed to maintain the same visual body-lengths-per-second. This is why `targetSize: 0.7` makes fish appear frozen — their speed didn't scale with their body.

**Solution:** Define speed in BL/s (body-lengths-per-second) in species config, then compute world-space speed in the shader:

**Species config change** (`fish-species-config.ts`):
```typescript
// Replace absolute speed values with BL/s
speedCruise: 1.5,    // BL/s — standard cruising speed
speedBurst: 8.0,     // BL/s — C-start escape / dart
speedIdle: 0.3,      // BL/s — near-stationary hovering
```

These values come from undulatory swimming kinematics research (PNAS 2021): most reef fish cruise at 1-2 BL/s, burst at 5-12 BL/s, and idle at 0.2-0.5 BL/s.

**Shader change** (`fish-shaders.ts`, velocity computation):
```glsl
// World-space speed = BL/s * targetSize * sizeScale
float bodyLength = uTargetSize * traits.w; // traits.w = sizeScale
float worldMinSpeed = uSpeedIdle * bodyLength;
float worldMaxSpeed = uSpeedBurst * bodyLength;
float worldCruiseSpeed = uSpeedCruise * bodyLength;
```

**Drag coefficient from desired deceleration time:**

Replace the magic `0.94` drag constant with a physically-derived value. For a half-speed time of 0.5 seconds (fish reaches 50% speed 0.5s after steering stops):

```glsl
float drag = pow(0.5, uDelta / 0.5); // ~0.978 at 60fps
vel = vel * drag + steer * uDelta;
```

This makes drag behavior frame-rate independent AND tunable via a single parameter (half-speed time in seconds). The current `0.94` at 60fps gives a half-speed time of ~0.18 seconds — too aggressive, which is why fish bleed velocity before they can visibly move.

**This permanently decouples speed from size.** Any future `targetSize` change maintains correct visual speed because the ratio is baked into the shader.

### 3. Spatial hash grid for boids neighbors

**Problem:** The current stride-stepping approach samples every Nth fish by texture index:

```glsl
float step = max(1.0, resolution.x / 8.0);
for (float y = 0.0; y < resolution.y; y += step) {
  for (float x = 0.0; x < resolution.x; x += step) {
```

This produces biologically wrong neighbor selection — fish at index 0 "sees" fish at indices 8, 16, 24, etc., regardless of spatial distance. Two fish swimming side-by-side might never register as neighbors if their indices aren't stride-aligned. The boids rules (separation, alignment, cohesion) operate on the wrong neighbor set, producing uncorrelated motion instead of schooling.

**Solution:** Spatial hash grid via an extra GPGPU pass. This is the technique ABZU's enhanced boids system uses (source: ABZU GDC 2016, "Beautiful Rendering and Amazing Animals"):

**Pass 0 (new): Bin particles into grid cells**
- Grid texture size: e.g., 32x32x8 cells covering the swim volume
- Each fish writes its cell ID to a cell-assignment texture
- A second texture accumulates fish indices per cell (use atomic-style append via alpha channel counter)

**Pass 1: Velocity shader reads only adjacent cells**
```glsl
ivec3 myCell = worldToCell(pos);
for (int dz = -1; dz <= 1; dz++) {
  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      ivec3 neighborCell = myCell + ivec3(dx, dy, dz);
      // Read fish list from cell texture
      // Apply boids rules only to fish in this cell
    }
  }
}
```

This reduces neighbor search from O(N^2) to O(N * K) where K is the max fish per cell (~8-12), and guarantees spatial locality. The 27-cell neighborhood (3x3x3) at typical cell sizes covers the visual perception radius of ~2-3 body lengths.

**Implementation note:** On WebGL2, true atomic writes aren't available. The pragmatic approach is a sorting-based grid: sort fish by cell ID each frame using a bitonic sort pass, then store cell start/end indices in a lookup texture. This is well-documented in GPU gems and used by most WebGL particle systems.

**Future path:** WebGPU compute shaders (already in project backlog as "WebGPU renderer migration") would enable true atomics and make this a straightforward compute dispatch. The spatial hash grid designed here translates directly to a WebGPU compute implementation.

### 4. Amplitude-speed coupling in vertex animation

**Problem:** The vertex shader applies body undulation (tail wag) at constant amplitude regardless of swim speed. A stationary fish wiggles its tail at full amplitude — the single most visually jarring artifact in fish simulations. Real fish modulate both frequency and amplitude with speed. This is immediately noticeable and breaks immersion even when all other systems work correctly.

Source: ABZU GDC talk (procedural fish animation), albertomelladoc Fish-Animation shader on GitHub, PNAS 2021 undulatory swimming kinematics.

**Solution:** In `renderVertexShader`, read velocity magnitude from the `tVelocity` texture and modulate swim parameters:

```glsl
// Read velocity from GPGPU texture
vec4 velData = texture2D(tVelocity, fishUV);
float speed = length(velData.xyz);
float speedRatio = clamp(speed / uMaxSpeed, 0.3, 1.0);

// Modulate swim animation
float effectiveFreq = uSwimFreq * mix(0.5, 1.0, speedRatio);
float effectiveAmplitude = uBaseAmplitude * speedRatio;
```

The `0.3` floor on `speedRatio` prevents fully dead animation at zero speed — a slowly hovering fish should have minimal fin movement. The `mix(0.5, 1.0, speedRatio)` on frequency means idle fish undulate at half-frequency (lazy drift), while bursting fish undulate at full speed.

This requires passing `tVelocity` as an additional uniform to the render material, alongside the existing `tPosition` texture.

### 5. GPU init failure fallback

**Problem:** If `gpu.init()` fails (shader compilation error, GPU resource exhaustion, unsupported WebGL extensions), the scene shows zero fish with no user-visible indication. On lower-end hardware, integrated GPUs, and some mobile devices, this is a realistic failure mode for 270-line GLSL shaders with N^2 loops.

Production games handle this with tiered quality. Subnautica falls back to simplified creature AI. Beyond Blue reduces population density. ABZU has LOD tiers for its fish systems.

**Solution:** After logging the `gpu.init()` error, set a `gpuFailed` flag and render a minimal CPU-driven fallback:

```typescript
const err = gpu.init();
if (err !== null) {
  console.error('[FishSchool] GPUComputationRenderer init failed:', err);
  gpuFailed = true;
  initCPUFallback();
  return;
}
```

**CPU fallback** (`initCPUFallback`):
- Spawn 20 fish (vs the full GPGPU population)
- Animate along circular/figure-8 paths using `useTask` with simple matrix updates
- No boids, no inter-fish interaction — just smooth looping paths at varying radii and heights
- Reuse the same `InstancedMesh` + species materials, just with CPU-driven transforms
- Apply the same vertex animation (body undulation) since that runs in the render shader, not GPGPU

```typescript
function initCPUFallback() {
  const fallbackCount = 20;
  const paths = Array.from({ length: fallbackCount }, (_, i) => ({
    radius: 3 + Math.random() * 5,
    height: -1 - Math.random() * 3,
    speed: 0.2 + Math.random() * 0.3,
    phase: (i / fallbackCount) * Math.PI * 2,
  }));

  useTask((delta) => {
    elapsed += delta;
    for (let i = 0; i < fallbackCount; i++) {
      const p = paths[i];
      const angle = elapsed * p.speed + p.phase;
      const x = Math.cos(angle) * p.radius;
      const z = Math.sin(angle) * p.radius;
      dummy.position.set(x, p.height, z);
      dummy.lookAt(
        x - Math.sin(angle) * p.radius,
        p.height,
        z + Math.cos(angle) * p.radius
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
}
```

20 fish on smooth circular paths looks dramatically better than zero fish. The fallback is invisible to users who have capable GPUs.

### Always: fix existing issues

**A. Cap the N^2 boids loop (if `gpu.init()` fails on capable hardware)**

**File:** `fish-shaders.ts` velocity shader, lines 187-217

Replace the full resolution loop with a capped 64-neighbor sample (this is the pre-spatial-hash interim fix):
```glsl
float step = max(1.0, resolution.x / 8.0);
for (float y = 0.0; y < resolution.y; y += step) {
  for (float x = 0.0; x < resolution.x; x += step) {
```

This reduces the loop from 196 iterations to ~64, well within GPU limits. Also apply the same change to the state shader (`fish-behavior-shader.ts` lines 57-108).

**B. Pass the missing `rayPosition` prop**

**File:** `OceanScene.svelte:1130-1140`

Add `rayPosition` pass-through to FishSchool so scatter behavior works. The current default of `Vector3(0,0,0)` causes a constant scatter force at the world origin.

## Implementation Priority

| Priority | Fix | Reason |
|----------|-----|--------|
| P0 | `gpu.init()` logging + fallback | Without this, we can't diagnose anything; fallback prevents zero-fish on weak GPUs |
| P0 | `safeNormalize()` everywhere | NaN propagation is silent and permanent; one corrupted fish never recovers |
| P0 | BL/s speed normalization | Root cause of the "frozen fish at targetSize 0.7" problem; fixes the actual bug |
| P1 | Amplitude-speed coupling | Most visually jarring artifact after motion is restored; cheap to implement |
| P1 | Drag coefficient fix (half-speed time) | Frame-rate independent, physically derived, replaces magic number |
| P2 | Spatial hash grid | Correct boids behavior; significant implementation effort but required for biological accuracy |
| P2 | `rayPosition` prop | Low-impact but trivial to fix |

## Relationship to Existing Specs

### fish-personality-system plan (`2026-05-21`)
The personality system (traits texture, FishEventSystem, perception cones, curl noise, C-start escape) is **already implemented** in the current codebase. The plan at `docs/superpowers/plans/2026-05-21-fish-personality-system.md` describes work that has been completed. All 6 tasks from that plan are reflected in the current `FishSchool.svelte` and supporting files.

### fish-ecosystem-upgrade spec (`2026-05-21`)
The ecosystem upgrade (50 species, trophic roles, locomotion modes, species rotation, behavior state machine) is **also already implemented**. `fish-species-config.ts` has all 50 species. `fish-behavior-shader.ts` has the trophic state machine. `SpeciesRotationManager.ts` handles visitor groups. `fish-locomotion-params.ts` has all 6 locomotion modes.

### This spec
This is a **debugging/tuning/hardening spec**, not a feature spec. The architecture is built. The problem is that the built system produces frozen fish due to parameter issues, possible shader compilation failure, NaN propagation, and missing speed-size coupling. The fixes are diagnostic-first, then targeted corrections grounded in real swimming kinematics.

### WebGPU migration (future)
The WebGPU renderer migration (project backlog) would eliminate the N^2 boids limitation entirely via compute shaders with true shared memory and atomics. The spatial hash grid designed in Fix Plan section 3 translates directly to a WebGPU compute dispatch. The BL/s normalization and `safeNormalize()` patterns are shader-level and carry forward unchanged.

## Sources

- **ABZU GDC 2016** — "Beautiful Rendering and Amazing Animals": procedural fish animation, spatial partitioning for boids, amplitude-speed coupling in vertex shaders
- **PNAS 2021** — Undulatory swimming kinematics: BL/s speed ranges by species (cruising 1-2, burst 5-12, idle 0.2-0.5), tail amplitude proportional to speed
- **albertomelladoc/Fish-Animation** (GitHub) — Fish vertex animation shader reference with speed-modulated undulation

## Files to Change

| File | Change | Lines |
|------|--------|-------|
| `src/.../ocean/FishSchool.svelte` | Add diagnostic logging to `$effect` and `useTask` | 398-399, 602-606 |
| `src/.../ocean/FishSchool.svelte` | GPU fallback with 20 CPU-driven fish on circular paths | after 399 |
| `src/.../ocean/FishSchool.svelte` | Pass `tVelocity` to render materials for amplitude coupling | material setup |
| `src/.../ocean/fish-shaders.ts` | Add `safeNormalize()` helper, replace all `normalize()` calls | throughout |
| `src/.../ocean/fish-shaders.ts` | BL/s speed computation from `uTargetSize * sizeScale` | velocity section |
| `src/.../ocean/fish-shaders.ts` | Derived drag: `pow(0.5, dt/0.5)` replacing magic `0.94` | ~310 |
| `src/.../ocean/fish-shaders.ts` | NaN guard in position shader (not just velocity) | position shader |
| `src/.../ocean/fish-shaders.ts` | Amplitude-speed coupling in `renderVertexShader` | vertex shader |
| `src/.../ocean/fish-behavior-shader.ts` | `safeNormalize()` in all normalize calls | throughout |
| `src/.../ocean/fish-behavior-shader.ts` | (if needed) Cap boids loop iterations | 57-108 |
| `src/.../ocean/fish-species-config.ts` | BL/s speed values per species (cruise/burst/idle) | speed fields |
| `src/.../scenes/OceanScene.svelte` | Pass `rayPosition` prop to FishSchool | 1130-1140 |
| `src/.../domain/models/scene-configs.ts` | Review `targetSize: 0.7` vs original `0.08` design | 949 |

## Verification

After applying fixes:
1. Open ocean scene in Chrome DevTools, check console for `[FishSchool] GPU init OK`
2. Confirm `[FishSchool] frame loop running` logs appear with advancing elapsed time
3. Read back position texture at t=2 — values must differ from initial positions
4. Visually confirm fish move in schooling patterns (not just drifting linearly)
5. Visually confirm body undulation scales with speed (hovering fish = gentle wag, cruising = full undulation)
6. Confirm no NaN-related visual artifacts (fish disappearing or teleporting to origin)
7. Test GPU fallback: force `gpu.init()` to fail, confirm 20 fish animate on circular paths
8. Performance: Chrome DevTools Performance tab, fish compute < 1ms per frame
9. Resize `targetSize` to 0.3 and 1.0 in devtools — confirm fish speed scales proportionally (BL/s test)

## What "Working" Looks Like

- Fish school in visible groups, circling at varying heights between swim height bounds
- Individual fish show distinct body undulation matching their locomotion mode (tail-heavy for carangiform, pectoral-driven for labriform)
- Tail wag amplitude and frequency correlate with swim speed — hovering fish have gentle movement, darting fish undulate vigorously
- Schools slowly drift and reform, influenced by curl noise currents
- Occasional dart bursts where individual fish briefly accelerate
- Fish avoid the central stage area (performer clearing)
- Visitor groups swim through the scene every 30-90 seconds
- On weak GPUs: 20 fish on smooth circular paths instead of a blank ocean
