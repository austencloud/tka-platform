---
status: archived
---
# 3D Effects System Design

**Date:** 2026-04-04
**Status:** Draft
**Scope:** Recreate all four 2D visual effects (Trails, LED, Charcoal, Fire) as native 3D renderers with environment interaction and graceful quality degradation.

---

## Problem

The 2D effects (fire, LED, charcoal, trails) are screen-space WebGL overlays composited on top of the Canvas2D animation layer. When the user switches to the 3D viewer, these 2D overlays render on top of the Three.js scene — they don't track with the 3D camera, props clip through them, and the illusion breaks completely.

The 3D effects layer (`src/lib/shared/3d/effects/`) has some initial implementations (RibbonTrail3D, FireEmitter, SparkleEmitter) but they're placeholder-quality compared to the 2D counterparts.

## Goal

Each effect in 3D should deliver the same visual satisfaction as its 2D counterpart while feeling fully immersive — interacting with the environment through dynamic lighting, ground reflections, and physical behavior. Desktop gets the full experience; mobile degrades gracefully without looking broken.

## Implementation Order

1. **Trails** — closest to done, foundational geometry patterns
2. **LED** — instanced sprites + bloom, moderate complexity
3. **Charcoal** — GPU particle system with physics
4. **Fire** — dense volumetric particles with 3D noise turbulence

Each effect gets its own implementation cycle (spec → plan → build → iterate).

---

## Architecture: Per-Effect Specialized Renderers

Mirrors the 2D architecture. Each effect gets its own renderer class using the optimal 3D technique for that visual. Shared infrastructure handles quality detection, light management, and tip position bridging.

### Why Not a Unified Particle Engine

Fire needs turbulence noise fields. Trails aren't particles at all (they're ribbon geometry). LED needs instanced billboards with bloom. Forcing all four into one particle system would compromise each one. The 2D effects succeeded because each got the technique it deserved.

---

## Shared Infrastructure

### Quality Tier System

Three tiers, auto-detected at startup with manual override available in settings.

| Tier | Detection Criteria | Particle Budget | Dynamic Lights | Shadows | Post-Processing |
|------|-------------------|----------------|----------------|---------|-----------------|
| **High** | Desktop GPU, WebGPU or strong WebGL2, `hardwareConcurrency >= 8` | 50,000+ | 4 point lights | Soft shadows | Full bloom chain |
| **Medium** | Mid-range laptop, decent mobile, `hardwareConcurrency >= 4` | 10,000 | 2 point lights | None | Single-pass bloom |
| **Low** | Weak mobile, old hardware, `hardwareConcurrency < 4` | 2,000 | 0 (emissive only) | None | None |

**Detection method:**
1. Query `renderer.capabilities` — max texture units, float texture support, max vertex uniforms
2. Check `navigator.hardwareConcurrency` for CPU core count
3. Sample frame time during first 60 frames — if average exceeds 20ms, downgrade one tier
4. User can force a tier via settings (persisted to localStorage)

**File:** `src/lib/shared/3d/effects/quality/QualityTierDetector.ts`

### Dynamic Light Manager

Effects request point lights for environment interaction. The manager prevents shader explosion from too many lights.

**Responsibilities:**
- Pool and reuse `THREE.PointLight` instances
- Cap total active lights per quality tier
- Merge nearby same-color lights when over budget (weighted average position, summed intensity)
- On Low tier: skip light creation entirely — effects use emissive materials + additive blending to fake illumination

**Interface:**
```typescript
interface IDynamicLightManager {
  requestLight(position: Vector3, color: Color, intensity: number, range: number): LightHandle | null;
  releaseLight(handle: LightHandle): void;
  updateLight(handle: LightHandle, position: Vector3, intensity: number): void;
}
```

**File:** `src/lib/shared/3d/effects/lighting/DynamicLightManager.ts`

### 3D Effect Orchestrator

Replaces the current `EffectsLayer.svelte` with a proper orchestrator.

**Responsibilities:**
- Read `TipEffectMap` (same assignment system as 2D — per-tip, per-hand, or cell-wide)
- Route tips to the correct 3D renderer based on assigned effect
- Manage per-frame updates via Threlte's `useTask` hook
- Suppress 2D effect overlays when 3D mode is active

**File:** `src/lib/shared/3d/effects/EffectOrchestrator3D.svelte`

### Tip Position Bridge

Converts 2D tip tracking data into 3D world-space coordinates.

**Input:** `PropState3D` (already computed by the animation system — contains `worldPosition`, `worldRotation`)
**Output:** Per-tip `{ position: Vector3, velocity: Vector3, jerk: Vector3 }` in world space

**Computation:**
- Position: transform tip offset by prop's world rotation + world position
- Velocity: finite differencing between current and previous frame positions
- Jerk: finite differencing of velocity (needed by charcoal emission)

**File:** `src/lib/shared/3d/effects/TipPositionBridge3D.ts`

### 2D Overlay Suppression

When `viewer3DState.renderMode === "3d"`:
- `AnimationRenderLoop` skips fire overlay render, charcoal overlay render, LED overlay render, and trail overlay render
- The Canvas2D base layer continues rendering props (or is hidden entirely if 3D handles prop rendering)

This is the "step zero" fix that stops the broken overlay behavior visible in the screenshot.

**Modified file:** `src/lib/shared/animation-engine/services/implementations/AnimationRenderLoop.ts`

---

## Effect 1: Trails

### Current State
`RibbonTrail3D.svelte` exists with basic physics-based ribbons. Needs upgrade to match 2D Catmull-Rom trail quality.

### Geometry: GPU Ribbon Mesh
- Ring buffer of 3D positions sampled from prop tip world positions each frame
- Catmull-Rom interpolation between samples for smooth curves (matching 2D `Canvas2DTrailRenderer` behavior)
- Triangle strip mesh: two vertices per sample point, offset perpendicular to both the trail tangent and the camera view direction (camera-facing ribbon that always looks volumetric)
- Tapered width: thickest at the emitting tip, narrowing to zero at the tail
- Opacity gradient: full alpha at tip, fading to transparent at tail

### Material
Custom `THREE.ShaderMaterial`:
- Per-vertex alpha driven by position in the ring buffer (age-based fade)
- Prop color (blue/red) with emissive component so trails are self-lit in any lighting condition
- Additive blending for bright, luminous appearance
- **High tier:** soft edge via fragment depth comparison — trails fade smoothly where they intersect scene geometry (ground, avatar)
- **Low tier:** basic alpha blending, no depth tricks

### Environment Interaction
- **High/Medium:** Trail emits a subtle moving point light at the active tip position, colored to match the prop. Illuminates nearby ground and avatar body.
- **Low:** Emissive material only, no dynamic point light.

### Trail Modes (matching 2D)
| Mode | Behavior |
|------|----------|
| **Fade** | Ring buffer with time-based alpha decay. Oldest points fade out. |
| **Loop Clear** | Clear entire trail buffer when sequence loops back to beat 1. |
| **Persistent** | Never clear. Accumulates full history up to max buffer size. |

### Performance
- Single draw call per trail (one triangle strip geometry)
- Ring buffer is fixed-size, pre-allocated — oldest points overwritten, zero GC pressure
- **Low tier:** reduce sample rate to every 2nd frame and halve max trail length

### Key Files
| File | Purpose |
|------|---------|
| `src/lib/shared/3d/effects/trails/TrailRenderer3D.ts` | Core renderer — ring buffer, Catmull-Rom, mesh generation |
| `src/lib/shared/3d/effects/trails/TrailMaterial3D.ts` | Custom shader material |
| `src/lib/shared/3d/effects/trails/Trail3D.svelte` | Threlte component wrapper |

---

## Effect 2: LED

### Visual Target
Actual glowing LED pixels floating in 3D space with light-painting trail accumulation and bloom. Should feel like watching LED staves in a dark room.

### Geometry: Instanced Billboard Sprites
- Each LED point rendered as a camera-facing quad (billboard)
- All LEDs across both props in one instanced draw call
- Size scales slightly with velocity — faster movement elongates the sprite in the motion direction (subtle, max 1.5x stretch)

### Material: Two-Layer Glow (Single Shader)
- **Inner core:** Bright, near-white center — small, sharp circle. This is the "bulb."
- **Outer halo:** Soft colored bloom surrounding the core — larger radius, transparent, additive blend
- Both layers computed in one fragment shader: distance from quad center drives core→halo gradient
- Color per-instance from `LedTipTracker` pattern engine (same RGB values as 2D)

### Trail Accumulation
- LED positions accumulate into a secondary ring buffer per LED
- Rendered as a fading ribbon of glow sprites trailing behind each active LED
- Temporal fade: older positions dim over configurable decay time
- Creates the "light painting" effect — arcs of colored light suspended in 3D space

### Bloom Post-Processing
- Leverages existing `threlte-postprocessing` bloom already configured in `Scene3D.svelte`
- **High:** Full bloom with luminance threshold tuned so only LED cores exceed it — natural light bleed into surrounding scene
- **Medium:** Bloom with reduced radius and fewer mip levels
- **Low:** No post-process bloom. The sprite halo layer alone provides the glow (still reads well, less atmospheric)

### Environment Interaction
- **High:** One pooled point light per prop, colored to the dominant LED color of that prop's active LEDs. Intensity modulated by LED count and brightness. Casts colored light on avatar skin and ground plane.
- **Medium:** Same point light, no shadow casting
- **Low:** Emissive sprites only, no dynamic lights

### LED Patterns
Same pattern engine as 2D. `LedTipTracker` already computes per-LED colors per frame. All patterns (rainbow, solid, chase, strobe, pulse) work unchanged — they feed RGB values into the instanced sprite color attribute.

### Key Files
| File | Purpose |
|------|---------|
| `src/lib/shared/3d/effects/led/LedRenderer3D.ts` | Instanced sprite renderer + trail accumulation |
| `src/lib/shared/3d/effects/led/LedMaterial3D.ts` | Core+halo shader material |
| `src/lib/shared/3d/effects/led/Led3D.svelte` | Threlte component wrapper |

---

## Effect 3: Charcoal

### Visual Target
Discrete sparks that burst from prop tips during sharp movements, arc through the air with gravity, and scatter across the ground. Think blacksmith sparks or grinding metal.

### Particle System: GPU Point Sprites
- Pre-allocated particle pool:
  - **High:** 5,000 particles
  - **Medium:** 2,000 particles
  - **Low:** 500 particles
- Particles emitted from prop tips when jerk (rate of change of acceleration) exceeds threshold — same trigger logic as 2D `CharcoalSparkRenderer`
- Ambient emission: low-rate continuous sparks even during slow/stationary movement (configurable)

### Physics (Per-Particle)
| Force | Behavior |
|-------|----------|
| **Gravity** | Constant downward acceleration in world space (9.81 m/s^2 scaled for visual feel) |
| **Drag** | Air resistance proportional to velocity squared, decelerates particles |
| **Initial velocity** | Inherited from prop tip velocity + random spread within a cone |
| **Lifetime** | 0.5–2.0 seconds (randomized per particle) |

- **High tier:** Physics computed via transform feedback on GPU — zero CPU cost per particle
- **Medium/Low tier:** CPU-side update loop (smaller pool makes this performant)

### Rendering
- Point sprites rendered via `THREE.Points` with custom `ShaderMaterial`
- Temperature-based color over lifetime: bright yellow-white at birth → orange → deep red → dark ash gray
- Size decreases over lifetime (large bright spark → small dim ember)
- **High tier:** optional glow halo per particle (second additive pass)

### Environment Interaction
- **High:**
  - Flickering warm point light at each emission point (intensity proportional to burst rate)
  - Ground collision: raycast particle position against Y=0 plane. On hit, reflect velocity with 0.3 restitution coefficient. Spawn a short-lived ground ember (tiny emissive sprite decal on the ground plane, fades over 0.5s).
  - Creates satisfying scatter of sparks bouncing off the floor
- **Medium:** Point light at emission, no ground collision/bounce
- **Low:** No lights, no collision — just the flying sprites

### Key Files
| File | Purpose |
|------|---------|
| `src/lib/shared/3d/effects/charcoal/CharcoalRenderer3D.ts` | Particle pool, physics, emission logic |
| `src/lib/shared/3d/effects/charcoal/CharcoalMaterial3D.ts` | Temperature-color shader |
| `src/lib/shared/3d/effects/charcoal/CharcoalGroundEmber.ts` | Ground decal embers (High tier) |
| `src/lib/shared/3d/effects/charcoal/Charcoal3D.svelte` | Threlte component wrapper |

---

## Effect 4: Fire

### Visual Target
Convincing turbulent flames emanating from prop tips with organic, swirling motion. Should match the visual richness of the 2D Navier-Stokes fluid sim without the computational cost of a 3D fluid simulation.

### Why Not 3D Navier-Stokes
The 2D fire runs a Navier-Stokes fluid sim on a 2D texture grid (~30 passes/frame). Extending this to 3D would require a volumetric 3D texture grid with the same pass count — the memory and compute cost scales cubically. At 128^3 resolution that's 2 million voxels per pass, 30 passes per frame, per fire source. Not viable for real-time on any consumer hardware, let alone mobile.

### Approach: Dense Volumetric Particle Fire with 3D Curl Noise

A dense particle system where 3D curl noise creates the turbulent, organic motion that makes fire look alive.

### Particle System
- Dense emitter at each fire-assigned tip:
  - **High:** 3,000 particles per fire source
  - **Medium:** 1,000 particles per fire source
  - **Low:** 300 particles per fire source
- Particles rise with buoyancy: upward force proportional to particle temperature
- 3D curl noise displacement applied per-particle per-frame — creates swirling, turbulent paths
- Prop velocity inheritance: fire "trails" behind fast swings, flames stretch in the direction of movement

### 3D Curl Noise Turbulence
The core of the fire's visual quality. Curl noise produces divergence-free vector fields — particles swirl without clumping or diverging, mimicking fluid behavior at a fraction of the cost.

- Sample 3D simplex noise, compute curl (cross product of gradient) to get a displacement vector
- Noise field scrolls upward and rotates slowly over time for constant organic evolution
- Two octaves of noise layered: large-scale swirl + fine-scale turbulence
- **Turbulence intensity** maps to the 2D "turbulence" slider — scales the curl noise amplitude
- **High tier:** 3 octaves for richer detail
- **Low tier:** 1 octave, sampled every 2nd frame

### Rendering: Soft Billboard Quads
- Camera-facing billboard quads per particle
- Fragment shader samples scrolling 3D noise (simplex or Worley) for internal flame texture detail — each particle isn't a flat circle but has visible internal structure
- Color ramp driven by particle temperature:
  - Hot (young): bright white/yellow core
  - Warm: orange
  - Cooling: deep red
  - Cold (dying): dark smoke/ash (alpha blended, not additive)
- Additive blending for bright flame regions, alpha blending for smoke regions
- **High tier:** depth-sorted alpha rendering — overlapping particles create convincing volume as camera moves around the fire
- **Low tier:** fewer, larger particles with simpler noise (1 octave, no internal texture)

### Color Curves (Matching 2D Presets)
Same four presets as 2D, same visual identity:

| Preset | Color Ramp |
|--------|-----------|
| **Classic** | White → Yellow → Orange → Red → Dark smoke |
| **Blue** | White → Light blue → Deep blue → Indigo → Gray smoke |
| **Spirit** | White → Bright green → Teal → Dark green → Gray smoke |
| **Custom** | User-defined color stops (same UI as 2D) |

Color curve applied as a 1D texture lookup: particle temperature (0→1) maps to the color ramp.

### Smoke Transition (High Tier)
- Particles in the final 30% of their lifetime transition from fire to smoke
- Smoke particles: larger size, slower rise, darker color, pure alpha blending (no additive)
- Subtle dark wisps that dissipate and fade
- Creates the natural fire→smoke boundary at the top of the flame volume

### Environment Interaction
- **High:**
  - 1-2 dynamic point lights per fire source, color sampled from the dominant flame color at that moment
  - Light intensity flickers driven by the same noise field (not random — visually coherent with the flame motion)
  - Soft shadow casting from fire lights
  - Ground glow: warm emissive decal on the ground plane beneath the fire source
- **Medium:** Point light with flicker, no shadows, no ground decal
- **Low:** Emissive particles only, no dynamic lights

### Key Files
| File | Purpose |
|------|---------|
| `src/lib/shared/3d/effects/fire/FireRenderer3D.ts` | Dense particle system, curl noise, emission |
| `src/lib/shared/3d/effects/fire/FireMaterial3D.ts` | Billboard shader with noise texture + color ramp |
| `src/lib/shared/3d/effects/fire/CurlNoiseField.ts` | 3D curl noise computation (simplex + curl) |
| `src/lib/shared/3d/effects/fire/FireColorCurve3D.ts` | Color ramp presets + 1D texture generation |
| `src/lib/shared/3d/effects/fire/Fire3D.svelte` | Threlte component wrapper |

---

## File Structure Overview

```
src/lib/shared/3d/effects/
├── EffectOrchestrator3D.svelte          # Routes tips → renderers
├── TipPositionBridge3D.ts               # 2D tip data → 3D world coords
├── types.ts                             # Shared effect types (updated)
│
├── quality/
│   └── QualityTierDetector.ts           # Auto-detect High/Medium/Low
│
├── lighting/
│   └── DynamicLightManager.ts           # Pooled point lights
│
├── trails/
│   ├── Trail3D.svelte                   # Threlte component
│   ├── TrailRenderer3D.ts               # Ring buffer + Catmull-Rom + mesh
│   └── TrailMaterial3D.ts               # Emissive ribbon shader
│
├── led/
│   ├── Led3D.svelte                     # Threlte component
│   ├── LedRenderer3D.ts                 # Instanced sprites + trail buffer
│   └── LedMaterial3D.ts                 # Core+halo glow shader
│
├── charcoal/
│   ├── Charcoal3D.svelte               # Threlte component
│   ├── CharcoalRenderer3D.ts           # Particle pool + physics
│   ├── CharcoalMaterial3D.ts           # Temperature-color shader
│   └── CharcoalGroundEmber.ts          # Ground decal embers
│
├── fire/
│   ├── Fire3D.svelte                    # Threlte component
│   ├── FireRenderer3D.ts               # Dense particle system
│   ├── FireMaterial3D.ts               # Billboard noise + color ramp
│   ├── CurlNoiseField.ts              # 3D curl noise
│   └── FireColorCurve3D.ts            # Color presets + 1D texture
│
└── post-processing/
    └── BloomEffect.svelte               # Existing (configure for LED)
```

---

## Integration Points

### TipEffectMap (Unchanged)
The existing per-tip effect assignment system works identically in 3D. The `EffectOrchestrator3D` reads the same `TipEffectMap` that the 2D `AnimationRenderLoop` uses. No changes to assignment UI or persistence.

### Effects UI (Minor Updates)
The existing effect customization UI in `EffectsSection.svelte` and `EffectMatrixDrawer.svelte` (inside the cell editor) controls fire intensity, trail fade, LED pattern, charcoal burst threshold. These parameters map to the same concepts in 3D. Any 3D-specific parameters (e.g., ground bounce toggle, smoke toggle) get added to the existing customize panels.

### Sequence Viewer Toggle
When switching between 2D and 3D:
- 2D → 3D: suppress 2D overlays, initialize 3D renderers with current effect assignments
- 3D → 2D: dispose 3D renderers, resume 2D overlays

Effect assignments and customization persist across mode switches.

---

## Performance Budget

Target: 60fps on High tier desktop, 30fps on Low tier mobile.

| Component | High (ms/frame) | Medium (ms/frame) | Low (ms/frame) |
|-----------|-----------------|-------------------|----------------|
| Trails (2 props) | 0.5 | 0.3 | 0.2 |
| LED (all points) | 1.0 | 0.5 | 0.3 |
| Charcoal | 1.5 | 0.8 | 0.3 |
| Fire (per source) | 2.0 | 1.0 | 0.5 |
| Dynamic lights | 0.5 | 0.3 | 0 |
| Bloom post-process | 1.0 | 0.5 | 0 |
| **Total effects** | **6.5** | **3.4** | **1.3** |

Remaining frame budget (~10ms on High, ~20ms on Low at 30fps) available for scene rendering, avatar, physics.

---

## Quality Degradation Strategy

If frame time exceeds budget during runtime:
1. First: reduce particle counts by 30%
2. Second: drop one quality tier (High → Medium → Low)
3. Third: disable ground interaction (bounces, decals)
4. Fourth: disable dynamic lights (emissive-only mode)
5. Last resort: disable post-processing bloom

Each step logged to console for debugging. User sees no UI — degradation is seamless.

---

## Testing Strategy

Following earned tests philosophy — test the silent-bug-prone parts:

| What | Why |
|------|-----|
| Curl noise field output | Verify divergence-free property (curl of gradient). Math bug here produces clumping/diverging particles that look wrong but don't crash. |
| Ring buffer wrap-around | Off-by-one in circular buffer produces trail gaps or stale points. |
| Quality tier detection | Ensure correct tier selected for known capability combinations. |
| Light manager pool limits | Verify lights are properly capped and merged when over budget. |
| Tip position bridge | Verify world-space tip positions match expected transforms. Math errors here make effects appear at wrong locations. |
| Color curve interpolation | Wrong temperature→color mapping produces visually wrong fire/charcoal. |

Visual correctness of effects verified by eye during development — not by automated tests.

---

## Migration from Existing 3D Effects

### Existing Files to Replace

The current `src/lib/shared/3d/effects/` directory contains placeholder implementations. These are replaced incrementally as each new effect is built:

| Existing File | Replaced By | Action |
|---------------|-------------|--------|
| `EffectsLayer.svelte` | `EffectOrchestrator3D.svelte` | Delete after orchestrator is working |
| `trails/RibbonTrail3D.svelte` | `trails/Trail3D.svelte` | Delete after new trails work |
| `trails/TrailRenderer.svelte` | `trails/TrailRenderer3D.ts` | Delete |
| `particles/FireEmitter.svelte` | `fire/Fire3D.svelte` | Delete after new fire works |
| `particles/SparkleEmitter.svelte` | No direct replacement (LED covers glow) | Delete |
| `energy/ElectricityArc.svelte` | No replacement (not one of the four core effects) | Keep for now, evaluate later |
| `motion/SpeedLines.svelte` | No replacement | Keep |
| `motion/PropMotionEffects.svelte` | No replacement | Keep |
| `volumetric-fire/VolumetricFireComponent.svelte` | `fire/Fire3D.svelte` | Delete |

### Config Type Migration

The existing `types.ts` defines `AllEffectConfigs` with six categories: trail, particles, glow, fire, sparkle, electricity. The new system uses four categories matching the 2D system: trails, LED, charcoal, fire.

Migration mapping:
- `trail` → `trails` (rename, same concept)
- `fire` → `fire` (same)
- `particles` + `sparkle` → consolidated into `charcoal` (spark-type particles)
- `glow` → absorbed into `LED` (glow is what LEDs do)
- `electricity` → kept as-is (not part of the four core effects, may become a fifth effect later)

The new `types.ts` exports both the legacy `AllEffectConfigs` (deprecated) and the new `Effect3DConfigs` during migration. Once all four effects are built, remove the legacy types.

---

## DI Container Registration

New services register in the existing 3D container at `src/lib/shared/di/containers/`:

```typescript
// In the 3D effects container
.add({ qualityTierDetector: () => new QualityTierDetector() })
.add(({ qualityTierDetector }) => ({
  dynamicLightManager: () => new DynamicLightManager(qualityTierDetector)
}))
.add({ tipPositionBridge: () => new TipPositionBridge3D() })
```

`QualityTierDetector` and `TipPositionBridge3D` are plain DI services (no scene dependency).

`DynamicLightManager` is a **scene-scoped instance** — it needs access to the Three.js scene to add/remove lights. It's instantiated inside `EffectOrchestrator3D.svelte` using `useThrelte()` to get the scene reference, then passed down to individual effect components via props. It is NOT a global DI singleton because it's tied to a specific Three.js scene lifecycle.

---

## Lifecycle & Disposal

### Initialization
`EffectOrchestrator3D.svelte` initializes renderers on mount. Each renderer allocates its GPU resources (buffers, textures, geometries, materials).

### Per-Frame Update
Threlte's `useTask` drives the render loop. Each effect's update method is called with current tip positions and delta time.

### Disposal
On unmount (user leaves 3D mode or navigates away):
1. Each renderer's `dispose()` method is called
2. GPU buffers (`BufferGeometry`, `BufferAttribute`) are disposed
3. Materials and textures are disposed (`.dispose()`)
4. `DynamicLightManager` releases all pooled lights from the scene
5. Particle pools are nulled for GC
6. Transform feedback objects (if used) are deleted

Svelte's `onDestroy` in each effect's `.svelte` wrapper triggers disposal. The orchestrator calls `dispose()` on all active renderers.

### Mode Switch (3D → 2D)
Same as disposal. When user switches back to 3D, renderers are re-created fresh. Effect assignments persist (they're stored in `TipEffectMap`, not in the renderers).

---

## 2D Overlay Suppression Mechanism

`AnimationRenderLoop` is a DI service — it can't use Svelte context or runes. The suppression uses a simple boolean flag:

```typescript
// In AnimationRenderLoop
private _suppress3DOverlays = false;

set suppress3DOverlays(value: boolean) { this._suppress3DOverlays = value; }

// In the render method, before overlay rendering:
if (this._suppress3DOverlays) {
  // Skip fire, charcoal, LED, and trail overlay rendering
  return;
}
```

The flag is set by the Svelte component that manages the 2D/3D toggle (`SequenceViewerOrchestrator.svelte` or `Viewer3DCanvas.svelte`) — it has access to both `viewer3DState` and the DI container's `animationRenderLoop`.

---

## Beat Loop Signal for Trail Clear

Trail renderers in Loop Clear mode need to know when the sequence loops back to beat 1. The signal path:

1. `AnimationRenderLoop` already detects loop wrap-around (it clears fire simulation state on loop)
2. It fires an existing `onLoopReset` callback
3. `EffectOrchestrator3D` listens to this same signal (passed as a prop or accessed via DI)
4. Orchestrator calls `clearTrailBuffer()` on active Trail3D renderers

No new event system needed — piggyback on the existing loop detection in `AnimationRenderLoop`.

---

## Transform Feedback Fallback

Transform feedback (for GPU-side charcoal particle physics on High tier) requires WebGL2 with `OES_texture_float` and reliable transform feedback support. Some mobile WebGL2 implementations have buggy TF.

**Fallback:** If transform feedback initialization fails (caught during shader link), the charcoal renderer falls back to CPU-side physics (same code path as Medium tier). This is transparent — same visual output, slightly more CPU usage.

Detection happens once during `CharcoalRenderer3D` initialization, not per-frame.

---

## Bloom Configuration for LED

The existing `BloomEffect.svelte` wraps `threlte-postprocessing` bloom with configurable threshold, intensity, and radius. For LED:

- **Luminance threshold** must be set high enough that only LED cores trigger bloom (not the entire scene). Target: `0.85` (LED cores render at full brightness `1.0`, scene geometry is typically `< 0.7`).
- **Intensity** scaled by quality tier: High `1.5`, Medium `1.0`, Low `0` (disabled).
- **Radius** controls bloom spread: High `0.6`, Medium `0.4`.

The existing `BloomEffect.svelte` already accepts these as props. The `EffectOrchestrator3D` passes LED-appropriate values when LED effects are active. When no LED effects are active, bloom parameters revert to scene defaults.

---

## Open Questions

None. All four effects have clear techniques, the shared infrastructure is defined, migration paths are specified, and the quality tier system handles device variation. Ready for implementation planning.
