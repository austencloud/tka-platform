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

**4. NaN propagation (LOW-MEDIUM probability)**

The velocity shader has multiple `normalize()` calls that could produce NaN if the input vector is zero:
- `normalize(vel + vec3(0.001))` — the 0.001 guard helps but doesn't cover all cases
- `normalize(pos - uScatterOrigin + vec3(0.001))` — same
- `normalize(pos.xz + 0.001)` — 2D normalize on `vec2`, guard is scalar on `pos.xz` which is wrong (should be `vec2(0.001)`)

If NaN enters a fish's velocity, it stays NaN forever because `NaN * 0.94 = NaN` and `NaN + anything = NaN`. The position shader then produces `posData.xyz += NaN = NaN`, and the vertex shader places the fish at an undefined location (typically off-screen or at origin).

**5. `rayPosition` never passed from OceanScene (CONFIRMED, low impact)**

OceanScene does not pass the `rayPosition` prop to FishSchool (lines 1130-1140). The default `new Vector3(0, 0, 0)` means the scatter origin is always at world origin. This doesn't cause freezing but means scatter behavior is non-functional. Fish near the origin get a constant repulsion force from `uScatterOrigin`.

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

Based on diagnostic results, apply the appropriate fix:

### If `gpu.init()` fails

The shaders are too complex for the target GPU. Reduce the N^2 boids loop to a capped neighbor search:

**File:** `fish-shaders.ts` velocity shader, lines 187-217

Replace the full resolution loop with a capped 64-neighbor sample:
```glsl
float step = max(1.0, resolution.x / 8.0);
for (float y = 0.0; y < resolution.y; y += step) {
  for (float x = 0.0; x < resolution.x; x += step) {
```

This reduces the loop from 196 iterations to ~64, well within GPU limits. Also apply the same change to the state shader (`fish-behavior-shader.ts` lines 57-108).

### If positions don't advance (NaN propagation)

Add NaN guards in the velocity shader:

**File:** `fish-shaders.ts`, after the final velocity calculation (before `gl_FragColor`):
```glsl
if (any(isnan(vel)) || any(isinf(vel))) {
  vel = normalize(curlNoise(pos * 0.1 + uTime * 0.01)) * uMinSpeed;
}
```

Also fix the `normalize(pos.xz + 0.001)` guard at line 253:
```glsl
steer.xz += normalize(pos.xz + vec2(0.001)) * pen * 3.0;
```
Currently `0.001` is a float added to a `vec2`, which adds `0.001` to both components — this actually works in GLSL but is ambiguous. Make it explicit.

### If positions advance but movement looks frozen (parameter imbalance)

Three parameter changes in `FishSchool.svelte` and `fish-shaders.ts`:

1. **Reduce drag from 0.94 to 0.97** (`fish-shaders.ts:310`):
```glsl
vel = vel * 0.97 + steer * uDelta;
```
This changes velocity half-life from ~11 frames to ~23 frames, allowing fish to maintain momentum longer.

2. **Increase `uMaxSteer` from 0.1 to 0.3** (`FishSchool.svelte:325`):
```typescript
velU.uMaxSteer = { value: 0.3 };
```
Triples the max steering force, making directional changes visible.

3. **Review `targetSize` config** (`scene-configs.ts:949`):
The config sets `targetSize: 0.7` but the system was designed around `0.08`. Either:
- Reduce `targetSize` to `0.08` (original design) and increase `sizeScale` values in `fish-species-config.ts` to compensate, OR
- Keep `targetSize: 0.7` but proportionally increase speed ranges in the species config to maintain visible body-lengths-per-second

### Always: add the missing `rayPosition` prop

**File:** `OceanScene.svelte:1130-1140`

Add `rayPosition` pass-through to FishSchool so scatter behavior works. The current default of `Vector3(0,0,0)` causes a constant scatter force at the world origin.

## Relationship to Existing Specs

### fish-personality-system plan (`2026-05-21`)
The personality system (traits texture, FishEventSystem, perception cones, curl noise, C-start escape) is **already implemented** in the current codebase. The plan at `docs/superpowers/plans/2026-05-21-fish-personality-system.md` describes work that has been completed. All 6 tasks from that plan are reflected in the current `FishSchool.svelte` and supporting files.

### fish-ecosystem-upgrade spec (`2026-05-21`)
The ecosystem upgrade (50 species, trophic roles, locomotion modes, species rotation, behavior state machine) is **also already implemented**. `fish-species-config.ts` has all 50 species. `fish-behavior-shader.ts` has the trophic state machine. `SpeciesRotationManager.ts` handles visitor groups. `fish-locomotion-params.ts` has all 6 locomotion modes.

### This spec
This is a **debugging/tuning spec**, not a feature spec. The architecture is built. The problem is that the built system produces frozen fish due to parameter issues, possible shader compilation failure, or NaN propagation. The fix is diagnostic-first, then targeted parameter adjustment.

## Files to Change

| File | Change | Lines |
|------|--------|-------|
| `src/.../ocean/FishSchool.svelte` | Add diagnostic logging to `$effect` and `useTask` | 398-399, 602-606 |
| `src/.../ocean/FishSchool.svelte` | Increase `uMaxSteer` from 0.1 to 0.3 | 325 |
| `src/.../ocean/fish-shaders.ts` | Reduce drag from 0.94 to 0.97 | 310 |
| `src/.../ocean/fish-shaders.ts` | Add NaN guard before `gl_FragColor` | ~328 |
| `src/.../ocean/fish-shaders.ts` | Fix `normalize(pos.xz + 0.001)` to `vec2(0.001)` | 253 |
| `src/.../ocean/fish-behavior-shader.ts` | (if needed) Cap boids loop iterations | 57-108 |
| `src/.../scenes/OceanScene.svelte` | Pass `rayPosition` prop to FishSchool | 1130-1140 |
| `src/.../domain/models/scene-configs.ts` | Review `targetSize: 0.7` vs original `0.08` design | 949 |

## Verification

After applying fixes:
1. Open ocean scene in Chrome DevTools, check console for `[FishSchool] GPU init OK`
2. Confirm `[FishSchool] frame loop running` logs appear with advancing elapsed time
3. Visually confirm fish move in schooling patterns (not just drifting linearly)
4. Visually confirm body undulation (tail waggle visible on larger fish)
5. Confirm no NaN-related visual artifacts (fish disappearing or teleporting to origin)
6. Performance: Chrome DevTools Performance tab, fish compute < 1ms per frame

## What "Working" Looks Like

- Fish school in visible groups, circling at varying heights between swim height bounds
- Individual fish show distinct body undulation matching their locomotion mode (tail-heavy for carangiform, pectoral-driven for labriform)
- Schools slowly drift and reform, influenced by curl noise currents
- Occasional dart bursts where individual fish briefly accelerate
- Fish avoid the central stage area (performer clearing)
- Visitor groups swim through the scene every 30-90 seconds
