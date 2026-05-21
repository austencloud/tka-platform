# Ocean Scene Full Redesign — Approach C (Full ABZU)

**Date:** 2026-05-20
**Status:** Approved
**Art Direction:** "Dream of the ocean, not simulation." (ABZU GDC talk)
**Palette:** Subnautica gradient — `#1d395e` → `#3b5b81` → `#4c8dc2` → `#6dd4e3` → `#9ce4f2`

## Research Artifacts

- **Research doc:** `docs/reference/ocean-scene-research.md`
- **Reference repos:** `.reference-repos/ocean/` (4 repos: mini-aquarium, threejs-caustics, caustics, three-good-godrays)
- **Memory:** `project_ocean_scene_redesign.md`

## Current State (What's Wrong)

| Problem | Current Value | Target |
|---|---|---|
| Fog | FogExp2 single-color, density 0.018 | Per-channel RGB absorption, density 0.045 |
| God rays | DirectionalLight only | Screen-space volumetric raymarching (three-good-godrays) |
| Dome | MeshPhysicalMaterial 8% opacity | MeshTransmissionMaterial with iridescence |
| Caustics | Disabled (`null`) | Projected refraction caustics on seabed |
| Water surface | Flat plane, sine displacement | Snell's window (97° cone, total internal reflection) |
| Fish | 12 fish, sine-orbit wander | 30-50 fish, GPGPU boids |
| Density | 12 corals, 8 rocks, sparse Poisson | 60+ corals, 70+ kelp, 24+ rocks, concentric rings |
| Post-processing | clearDepth masking inverted | Fixed masking + bloom + CA + vignette |
| Palette | Muddy dark purple (#050520) | Navy → teal → cyan (Subnautica) |
| Particles | ~290 CPU-driven | 5000+ GPU-instanced |

## Phase Plan

Each phase ships independently. User verifies before next phase starts. No phase depends on a later phase.

---

### Phase 1: Foundation (Parameters Only, Zero New Code)

**Goal:** Triple density, fix palette, increase fog. Scene goes from "sparse scattered props" to "populated underwater environment."

**Changes:**

Density — replace sparse Poisson disc with concentric ring placement:
- Foreground (3-6m): 20 corals, 12 rocks, 20 floor decorations
- Midground (6-12m): 30 kelp, 16 corals, 8 rocks
- Background (12-25m): 40+ kelp, sparse large corals
- Total: ~60 corals (was 12), ~70 kelp (was 24), ~24 rocks (was 8), ~30 decorations (was 12)

Fog density: 0.018 → 0.045

Palette swap (all 4 variants, abyss primary):
- Fog color: `#050520` → `#0d2a44`
- Ground color: `#121020` → `#1a3a4a`
- Sky gradient: `#020210/#0a0a2e/#000008` → `#020a14/#0d3050/#000810`
- Hemisphere: sky `#0a1a30` → `#2a6080`, ground `#050510` → `#0a1820`
- Coral glow: `#00ffcc` → `#00ccaa`
- God ray color: `#1a3050` → `#b0d8e8`

Fish count: 12 → 30
Jellyfish count: 6 → 10

**Verification:** Load ocean scene. Is it denser? Better colors? Fog has depth?

---

### Phase 2: Post-Processing Fix + Bloom/CA/Vignette

**Goal:** Fix inverted clearDepth masking. Add cinematic post-processing. Jellyfish and plankton glow.

**Changes:**

Fix `ScenePostProcessing.svelte` — effects should apply OUTSIDE dome, not inside. Invert clearDepth comparison in WaterAbsorptionEffect and UnderwaterDistortionEffect shaders.

Add to EffectComposer pipeline (all from pmndrs/postprocessing, already in deps):
- `BloomEffect`: intensity 1.5, luminanceThreshold 0.6, luminanceSmoothing 0.4, mipmapBlur true
- `ChromaticAberrationEffect`: offset `[0.0008, 0.0008]`
- `VignetteEffect`: darkness 0.4, offset 0.3

Tag jellyfish + plankton meshes with `layers.enable(BLOOM_LAYER)` for selective bloom (or use luminance threshold if selective bloom is too complex for initial pass).

**Verification:** Do jellyfish glow? Does the scene have depth/atmosphere from vignette? Subtle chromatic fringe at edges?

---

### Phase 3: Volumetric God Rays

**Goal:** Replace bare DirectionalLight with proper volumetric shafts that get occluded by kelp/coral silhouettes.

**Dependencies:** `npm install three-good-godrays`

**Implementation:**

Add DirectionalLight with `castShadow: true`, shadow map 1024x1024, positioned at [5, 25, 5] aimed at origin.

Add `GodraysPass` to EffectComposer after RenderPass, before EffectPass:
```typescript
import { GodraysPass } from 'three-good-godrays';

const godraysPass = new GodraysPass(godRayLight, camera, {
  density: 1/128,
  maxDensity: 0.5,
  distanceAttenuation: 2,
  color: new Color('#b0d8e8'),
  raymarchSteps: 60,
  blur: true,
  resolutionScale: 0.5,
});
composer.addPass(godraysPass);
```

GodraysPass is a `Pass` (not `Effect`), so it goes as its own pass in the composer, not inside an EffectPass.

**Verification:** Shafts of light filtering through kelp canopy. Shadows from coral blocking rays. Rays animate subtly.

---

### Phase 4: Dome Glass — MeshTransmissionMaterial

**Goal:** Dome looks like real glass with refraction, color separation, and oil-film iridescence.

**Research needed:** Verify MeshTransmissionMaterial works via Threlte's `<T.MeshPhysicalMaterial>` with `transmission` prop. If not, use imperative Three.js.

**Parameters (from mini-aquarium repo):**
```
transmission: 0.92
thickness: 3
chromaticAberration: 0.025
distortion: 0.1
distortionScale: 0.1
temporalDistortion: 0.2
iridescence: 1
iridescenceThicknessRange: [0, 1400]
anisotropy: 0.1
backside: true
samples: 4
roughness: 0.05
```

**OOM Mitigation:**
- `samples: 4` (not 16)
- Monitor `renderer.info.render` for frame drops
- If WebGL context lost fires, swap to fallback material:
  ```
  clearcoat: 1.0
  clearcoatRoughness: 0.05
  color: #a0d8f0
  opacity: 0.15
  envMapIntensity: 0.5
  ```

**Verification:** Dome refracts scene behind it. Subtle color separation at edges. Iridescent sheen when viewed at angles. No OOM crash.

---

### Phase 5: Snell's Window Water Surface

**Goal:** Looking up from underwater, sky compresses into ~97° cone. Total internal reflection outside the cone. Wave wobble on the boundary.

**Implementation:** Custom ShaderMaterial replacing current WaterSurface.

Fragment shader logic:
1. Compute view angle: `dot(normalize(vWorldPosition - cameraPosition), surfaceNormal)`
2. Critical angle: `asin(1.0 / 1.333)` = 48.5° half-angle (97° full cone)
3. Inside cone: sky color through Fresnel-weighted refraction, brightness falloff toward edge
4. Outside cone: total internal reflection — sample scene below, darkened
5. Boundary: animate with time-varying noise displacement for wave wobble
6. Fresnel blend at boundary: `fresnelBias: 0.1, fresnelPower: 2.0, fresnelScale: 1.0`

**Verification:** Look up in the scene. Circular bright window overhead. Dark reflective water outside the window. Boundary wobbles gently.

---

### Phase 6: Projected Caustics on Seabed

**Goal:** Dancing light patterns on the ocean floor from water surface refraction.

**Technique (from threejs-caustics repo):**

Two-pass pipeline:
1. Render environment depth from light's orthographic camera into float render target (1024x1024)
2. Caustic computation: GLSL `refract()` with `eta: 0.7504` (air/water IOR), iterative ray-march (MAX_ITERATIONS: 50), compute intensity via Jacobian area distortion (`causticsFactor: 0.15`)

Integration:
- Generate caustic texture each frame (driven by animated wave normals)
- Project onto ProceduralSeabed via `onBeforeCompile` shader injection (same pattern as N8python/caustics repo)
- Additive blending for RGB, depth comparison for masking

**Parameters:**
| Parameter | Value |
|---|---|
| eta | 0.7504 |
| causticsFactor | 0.15 |
| Render target | 1024x1024 float |
| MAX_ITERATIONS | 50 |
| Animation | Feed WaterSurface wave displacement into refraction normals |

**Verification:** Look at the seabed. Animated caustic light patterns dancing on sand. Patterns respond to water surface animation.

---

### Phase 7: GPGPU Fish Boids

**Goal:** Fish school together, avoid the dome, flee the camera, and orbit lazily — all computed on GPU.

**Technique (from Three.js webgl_gpgpu_birds):**

GPUComputationRenderer with two float textures (ping-pong):
- Position texture: RGBA = x, y, z, species
- Velocity texture: RGBA = vx, vy, vz, phase

Boid rules (in GLSL compute shader):
- Separation: repel within 0.5m
- Alignment: match heading within 2m radius
- Cohesion: steer toward flock center within 4m radius
- Dome avoidance: strong repulsion from `DOME_RADIUS` boundary
- Camera avoidance: flee when camera is within 3m
- Waypoint drift: lazy circular orbit to prevent static schooling
- Height banding: soft clamp to `swimHeight` range

Rendering: InstancedMesh per species (5 species × 1 draw call each). Read position/velocity textures in vertex shader to place instances.

Fish count: 50 (10 per species, single draw call each)

**Verification:** Fish school together. Schools turn as a unit. Fish avoid dome walls and camera. Natural-looking movement.

---

### Phase 8: GPU Particle System

**Goal:** Water feels alive. 5000+ ambient particles with zero CPU overhead.

**Research needed:** Test `@newkrok/three-particles` and `three.quarks` with Threlte. Pick whichever integrates cleanly.

**Particle layers:**
| Layer | Count | Behavior | Size | Color |
|---|---|---|---|---|
| Marine snow | 2000 | Extremely slow drift down | 0.005-0.015 | White, 30% opacity |
| Dust motes | 1500 | Lateral drift, slight tumble | 0.01-0.03 | Teal-grey |
| Bubbles | 500 | Rise with sinusoidal wobble | 0.02-0.06 | Cyan, 50% opacity |
| Bioluminescent plankton | 500 | Random walk, independent pulse | 0.08-0.2 | Magenta/violet/cyan |
| Detritus | 500 | Slow sink, horizontal drift | 0.01-0.025 | Brown-green |

All GPU-instanced. Position/velocity computed in shader or compute texture. No per-frame JS loops.

**Fallback:** If GPU particle libraries don't integrate with Threlte, use InstancedMesh with custom shader material (same technique as boids but simpler — no flocking rules, just drift forces).

**Verification:** Water is filled with subtle floating particles at all depths. Bioluminescent plankton pulse independently. No frame drop from particle count.

---

## Art Direction Notes

- **ABZU philosophy:** Every depth layer filled independently. Foreground, midground, background each have their own density pass.
- **Color depth:** Red channel dies first with distance. Distant objects shift blue-green. This happens automatically via WaterAbsorptionEffect.
- **Bioluminescence contrast:** Warm magenta/violet jellyfish + plankton against cool teal/navy environment. Maximum pop.
- **God rays as primary atmosphere:** Rays are the single biggest atmosphere contributor. They should be visible, animated, and occluded by geometry.
- **Density ≠ clutter:** Dense placement with fog means distant objects dissolve. Close objects are clear. This creates depth without visual noise.

## Risk Register

| Risk | Mitigation |
|---|---|
| MeshTransmissionMaterial OOM on weak GPUs | Fallback to clearcoat material, `samples: 4` cap |
| Caustic shader porting complexity | N8python's technique (simpler) as backup if martinRenou's is too heavy |
| GPGPU boids + Threlte integration | Study Three.js example thoroughly before implementing. Fallback: improved sine-orbit with flocking-like behavior |
| GPU particle library incompatibility | Fallback to raw InstancedMesh + custom ShaderMaterial |
| Performance budget exceeded | Each phase tested independently. If frame time exceeds 16ms, reduce counts/resolution |

## Performance Budget

Target: 60fps on mid-range GPU (GTX 1660 / M1 equivalent)

| System | Budget |
|---|---|
| God rays | 2ms (0.5x resolution, 60 samples) |
| Caustics | 1.5ms (1024x1024 render target) |
| Bloom + CA + vignette | 1ms |
| GPGPU boids | 0.5ms (50 fish) |
| GPU particles | 0.5ms (5000 particles) |
| Scene render | 8ms |
| **Total** | ~14ms (headroom for spikes) |
