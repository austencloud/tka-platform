# Fish Personality System — Design Spec

**Date:** 2026-05-21
**Status:** Draft — Pending Approval
**Scope:** Self-contained within the ocean fish rendering pipeline. Zero changes to ocean floor, ruins platform, corals, kelp, god rays, caustics, or post-processing.

---

## Problem

The 3D ocean fish are GPU-computed boids that school correctly but lack individual character. All fish swim at similar speeds, react identically to neighbors, and never do anything surprising. The 2D fish system (`@austencloud/backgrounds`) has a rich personality layer — 4 traits, 7 moods, 12 behaviors, species-specific modifiers, predator/prey dynamics — that makes each fish feel alive. The 3D fish need equivalent depth.

## Research Basis

- **ABZU (GDC 2017):** CPU behavior state machine + GPU instanced vertex animation. 10k-20k fish on PS4. Spatial sorting for O(n*k) neighbor lookup.
- **Jolles et al. (2017):** Real fish personality reduces to two axes — exploration tendency (speed + wander range) and social proximity (cohesion weight + separation distance).
- **"Boids That See" (Hemelrijk & Hildenbrandt):** Perception-cone boids with 270° FOV and blind spot behind. One dot-product check per neighbor. Produces more realistic turning behavior than omnidirectional radius.
- **Curl Noise (Bridson 2007):** Divergence-free 3D vector fields from simplex noise create smooth, swirling, current-like motion. Fish riding invisible currents look like they're in water instead of a vacuum.
- **Undulatory Propulsion:** Cosine-wave vertex displacement with amplitude increasing head→tail. Production standard (ABZU, Godot fish tutorials). Velocity-modulated intensity.
- **Three.js TSL + WebGPU:** Production-ready in r171+, Threlte 8 supports WebGPURenderer via `createRenderer`. Full renderer migration is a separate project — this spec uses GPUComputationRenderer but designs for easy TSL compute migration later.

## Architecture

Four layers, each with a single responsibility:

```
Layer 4: Species Character (init-time, static)
    ↓ writes traits texture once
Layer 1: GPU Simulation (every frame, ~0.3ms)
    ↓ positions + velocities
Layer 2: CPU Event System (occasional, 1-3 events/sec)
    ↓ impulse writes into velocity texture
Layer 3: Vertex Animation (render shader, per-vertex)
    ↓ final screen pixels
```

### Layer 1: GPU Boids Simulation

**Compute backend:** GPUComputationRenderer (existing). Three RGBA float textures on a `ceil(sqrt(count))` square grid.

**Textures:**

| Texture | R | G | B | A |
|---|---|---|---|---|
| Position (dynamic) | x | y | z | hueOffset |
| Velocity (dynamic) | vx | vy | vz | instanceScale |
| Traits (static) | speedMult | socialMult | boldness | dartSeed |

**Perception-cone boids** replace omnidirectional radius checks:

```glsl
vec3 toNeighbor = op - pos;
float d = length(toNeighbor);
if (d < 0.001 || d > uAliDist * 1.5) continue;

// 270° forward cone — reject neighbors directly behind
vec3 forward = normalize(vel);
float cosAngle = dot(forward, normalize(toNeighbor));
if (cosAngle < -0.7) continue;  // ~135° half-angle = 270° total FOV
```

This is 2 extra lines in the existing neighbor loop. Fish stop reacting to what's behind them, creating more natural turning arcs.

**Curl noise flow field** adds environmental current forces:

```glsl
// 3D curl noise sampled at fish position, evolving slowly over time
vec3 curlForce = curlNoise(pos * 0.15 + uTime * 0.02) * uCurrentStrength;
steer += curlForce;
```

The `curlNoise` function computes the curl of 3D simplex noise — a standard GLSL snippet (~30 lines). `uCurrentStrength` is a uniform (default ~0.3) controllable from Scene Lab.

**Per-fish trait modulation** in the velocity shader:

```glsl
vec4 traits = texture2D(tTraits, uv);
float speedMult = traits.r;    // 0.6-1.6
float socialMult = traits.g;   // 0.5-1.5
float boldness = traits.b;     // 0.5-1.3

// Social fish align/cohere more strongly
if (aliN > 0.0) steer += normalize(ali/aliN - vel) * 0.4 * socialMult;
if (cohN > 0.0) steer += normalize(coh/cohN - pos) * 0.3 * socialMult;

// Bold fish tolerate closer stage proximity
float avoidDist = (uStageRadius + 2.5) * (1.5 - boldness * 0.4);

// Per-fish speed range
float adjMax = uMaxSpeed * speedMult;
float adjMin = uMinSpeed * speedMult;
```

### Layer 2: CPU Event System

A lightweight TypeScript class (`FishEventSystem`) that runs in the `useTask` loop. It does NOT manage per-fish state machines — it fires occasional impulse events by writing directly into the velocity data texture.

**File:** `src/lib/shared/3d/environments/scenes/ocean/FishEventSystem.ts`

**Events:**

| Event | Trigger | Effect | Frequency |
|---|---|---|---|
| **Ray scatter** | Manta ray position within 4m of any fish cluster centroid | Write burst velocity (outward from ray position, 3× normal speed) to all fish within scatter radius. Decays naturally via drag. | When ray passes through school (~every 15-30s based on orbit) |
| **Random dart** | Per-fish cooldown timer (base 8s, multiplied by `1.5 - boldness`; timid fish have shorter cooldowns and dart more often) | Write velocity spike in current heading direction (2× speed, 0.3s duration). Shader drag returns to normal. | ~2-4 fish darting at any moment across the school |
| **Vertical excursion** | Random timer weighted by curiosity (encoded in `dartSeed`) | Write upward or downward velocity bias (+0.5 Y component) | ~1 fish ascending/descending at any time |

**Implementation pattern:**

```typescript
class FishEventSystem {
  private dartTimers: Float32Array;
  private readonly texSize: number;

  tick(dt: number, gpuCompute: GPUComputationRenderer, velVar: any, rayPosition: Vector3) {
    // Decrement dart timers, fire new darts
    // Check ray proximity for scatter
    // Write impulses via gpuCompute.getCurrentRenderTarget(velVar)
  }
}
```

CPU writes to the velocity texture happen BEFORE `gpuCompute.compute()` each frame. The GPU simulation immediately incorporates the impulses, and the built-in drag (0.97× per frame) naturally decays them back to normal schooling behavior. No explicit "end event" logic needed.

**Ray scatter detail:** The existing manta ray in OceanScene orbits on a fixed path. FishEventSystem receives the ray's world position each frame (passed as a prop or read from a ref). When `distance(rayPos, clusterCentroid) < scatterRadius`, it identifies all fish within the blast zone by reading the position texture back to CPU (via `renderer.readRenderTargetPixels` — one 9×9 texture read, ~0.01ms) and writes burst velocities for affected fish.

### Layer 3: Vertex Animation

**File:** Same vertex shader in FishSchool.svelte's `renderVertexShader`.

**Cosine-wave undulatory body motion** replaces the current basic tail wiggle:

```glsl
// Undulatory propulsion — wave travels head to tail
float bodyPhase = uTime * uSwimFreq + localPos.z * uWaveNumber;
float amplitude = uBaseAmplitude * (0.2 + 0.8 * max(0.0, -localPos.z / bodyLength));
float swimSpeed = length(fishVel);

// Faster swimming = more aggressive body wave
amplitude *= 0.5 + swimSpeed * 0.8;

localPos.x += sin(bodyPhase) * amplitude;
```

**Parameters:**
- `uSwimFreq`: base oscillation frequency (default 5.0 Hz, per-instance jitter via `aReference.x * 2.0`)
- `uWaveNumber`: spatial frequency of the body wave (default 3.0, controls how many "S-curves" the body makes)
- `uBaseAmplitude`: base lateral displacement (default 0.08, scaled by `fishScale`)
- `bodyLength`: approximate fish length in local coords (from normalized geometry, ~1.0)

**C-start escape override** for startled fish:

When a dart impulse is active (fish velocity > 2× normal), the vertex shader detects the speed spike and applies a brief body curve:

```glsl
float speedRatio = swimSpeed / (uMaxSpeed * 0.5);
float cStartIntensity = smoothstep(1.5, 2.5, speedRatio);

// C-bend: sharp curve in the first half of the body
float cBend = cStartIntensity * sin(localPos.z * 1.5) * 0.3;
localPos.x += cBend;
```

No additional CPU data needed — the vertex shader reads the velocity magnitude that's already there and adapts the animation.

### Layer 4: Species Character

**Init-time setup** in the `$effect` body. Each species gets distinct trait distributions:

| Species | Model | Count | speedMult | socialMult | boldness | Character |
|---|---|---|---|---|---|---|
| Common | fish_common.glb | 28 | 0.8-1.2 | 0.7-1.3 | 0.6-1.0 | Average schooler |
| Butterfly | fish_butterfly.glb | 26 | 0.6-0.9 | 1.0-1.5 | 0.5-0.8 | Slow, social, timid — tight clusters |
| Trout | fish_trout.glb | 26 | 1.1-1.6 | 0.5-0.9 | 0.9-1.3 | Fast, independent, bold — break away |

Species counts are fixed at init: `common = ceil(count * 0.35)`, `butterfly = floor(count * 0.325)`, `trout = count - common - butterfly`. For 80 fish: 28/26/26.

**Trait generation** uses species-specific min/max ranges with uniform random distribution within each range. The `dartSeed` channel (traits.a) is purely random across all species — it drives the timing of rare events so they don't synchronize.

**Clustered spawn** (already implemented by subagent): 4 sub-schools at init, each positioned at a different angle around the scene. Fish within a cluster start with aligned velocities. Natural boids dynamics maintain or reorganize schools over time.

## Config Interface

New fields added to the existing `OceanSceneConfig.fish` block:

```typescript
fish: {
  enabled: boolean;
  count: number;
  targetSize: number;
  swimHeight: [number, number];  // [minY, maxY] altitude range in meters
  speed: [number, number];       // [minSpeed, maxSpeed] in units/frame
  // New personality fields
  currentStrength: number;      // Curl noise flow field strength (0-1, default 0.3)
  swimFrequency: number;        // Body wave oscillation Hz (default 5.0)
  waveAmplitude: number;        // Body wave base amplitude (default 0.08)
  scatterRadius: number;        // Ray scatter blast radius in meters (default 4.0)
  perceptionAngle: number;      // Half-angle of forward vision cone in degrees (default 135)
};
```

All new fields have sane defaults and are Scene Lab-controllable.

## Performance Budget

| Component | Cost per frame | Notes |
|---|---|---|
| GPU boids compute (9×9 texture) | ~0.3ms | Same as before, +perception check +curl noise +trait read |
| CPU event system | ~0.01ms | Timer decrements + occasional texture write |
| Vertex animation | ~0.1ms | Cosine eval per vertex, 3 draw calls |
| Position texture readback (for ray scatter) | ~0.01ms | Only when ray is near a school |
| **Total** | ~0.42ms | Well within 14ms budget |

## Files Changed

| File | Change |
|---|---|
| `ocean/FishSchool.svelte` | Rewrite velocity shader (perception cones, curl noise, trait modulation), rewrite vertex shader (undulatory animation, C-start), integrate FishEventSystem |
| `ocean/FishEventSystem.ts` | New file — CPU event layer (ray scatter, random darts, vertical excursions) |
| `scene-configs.ts` | Add new fish config fields (currentStrength, swimFrequency, waveAmplitude, scatterRadius, perceptionAngle) |
| `OceanScene.svelte` | Pass manta ray position to FishSchool as a prop |

## Files NOT Changed

Everything else in the ocean scene: ProceduralSeabed, RuinsPlatform, coral/kelp/rocks, god ray shafts, Snell's window, caustics, ScenePostProcessing, jellyfish, bubbles, dust, plankton, lighting. Zero touch.

## Future: TSL Compute Migration Path

When the full WebGPU renderer migration happens (separate project):
1. Replace GPUComputationRenderer with TSL `StorageBufferNode` compute
2. Replace GLSL shader strings with TSL `Fn()` definitions
3. Replace texture reads with `storage.element(instanceIndex)`
4. The simulation logic, trait distributions, event system, and vertex animation are all unchanged

The personality system design is renderer-agnostic. Only the compute plumbing changes.

## Testing

- Visual: reload ocean scene, observe species clustering, speed variety, curl noise drift, ray scatter events
- Console: `[FishSchool]` logs for GPU init success, event firing
- Performance: Chrome DevTools GPU timeline, verify total fish cost < 0.5ms
- Regression: all other ocean layers render identically (no shader changes outside fish)
