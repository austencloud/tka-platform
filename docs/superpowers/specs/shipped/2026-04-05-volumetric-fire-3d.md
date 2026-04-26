# Volumetric Raymarched Fire for 3D Viewer

**Date:** 2026-04-05
**Status:** Spec ready, implementation next session
**Prereq:** Current particle fire renderer works but looks like dots. Replace with volumetric raymarching.

---

## Visual Target

A cohesive flame volume at each prop tip that you can orbit around and see depth. Internal turbulent structure from 3D noise. Flame trails behind fast swings. Color curve matches the 2D fire presets (Classic, Blue, Spirit, Custom).

---

## Approach: Object-Space Raymarching

Each fire source is a `THREE.Mesh` with a `BoxGeometry` (bounding volume) and a custom `ShaderMaterial` whose fragment shader raymarches through 3D noise to produce volumetric fire.

### Why This Over Particles

- No point size limits (WebGL clamps `gl_PointSize` on some hardware)
- Fire reads as a solid volume, not individual dots
- Internal turbulent structure visible as camera orbits
- Proven technique: THREE.Fire, VolumetricFire, Unity implementations all use this
- 60fps on modern hardware with careful step count

### Reference Implementations

- **THREE.Fire** (mattatz): `https://github.com/mattatz/THREE.Fire` — GLSL raymarching with webgl-noise
- **VolumetricFire** (yomotsu): `https://github.com/yomotsu/VolumetricFire` — Ported from Alfred Fuller's demo
- **Unity volumetric fire** (mattatz): `https://github.com/mattatz/unity-procedural-volumetric-fire` — Same technique, different renderer

---

## Architecture

### Files to Create

| File | Purpose |
|------|---------|
| `effects/fire/VolumetricFireMesh.ts` | Custom Mesh subclass with raymarching ShaderMaterial |
| `effects/fire/fire-noise.glsl.ts` | 3D simplex noise GLSL (from webgl-noise, inlined as string) |
| `effects/fire/FireColorCurve3D.ts` | Color ramp presets → 1D uniform arrays for shader |

### Files to Modify

| File | Change |
|------|--------|
| `effects/fire/FireRenderer3D.ts` | Replace Points-based renderer with VolumetricFireMesh management |
| `effects/EffectOrchestrator3D.svelte` | No change needed — already feeds FireTipInput to FireRenderer3D |

### Files to Delete

| File | Reason |
|------|--------|
| `effects/fire/FireMaterial3D.ts` | Replaced by VolumetricFireMesh's internal material |

---

## Shader Design

### Vertex Shader

Standard pass-through that computes:
- `vOrigin`: camera position in object space (for ray origin)
- `vDirection`: ray direction from camera through this fragment in object space
- Uses `inverse(modelMatrix)` to transform camera into box's local space

### Fragment Shader

1. **Ray setup**: origin at camera (object space), direction toward fragment
2. **Box intersection**: compute entry/exit t-values for the unit cube
3. **Raymarching loop**: step through the volume (32-64 steps depending on quality tier)
4. **Density sampling**: at each step, sample 3D simplex noise to get fire density
   - Noise is scrolled upward over time (fire rises)
   - Multiple octaves: large swirl (scale 1.0) + fine turbulence (scale 2.0-4.0)
   - Density falls off radially from center axis (flame is cylindrical, not cubic)
   - Density falls off toward top (flame tapers)
5. **Color lookup**: density/temperature maps to the color ramp (hot white → yellow → orange → red → smoke)
6. **Alpha accumulation**: front-to-back compositing along the ray
7. **Early exit**: when accumulated alpha > 0.95, stop marching

### Noise Function

Inline 3D simplex noise from webgl-noise (Stefan Gustavson's implementation). Two octaves:
- Octave 1: `snoise(pos * 1.0 + time * scrollSpeed)` — large-scale flame shape
- Octave 2: `snoise(pos * 3.0 + time * scrollSpeed * 1.5) * 0.5` — fine turbulence detail

### Uniforms

```glsl
uniform float uTime;           // Elapsed time for noise scrolling
uniform float uIntensity;      // Fire density multiplier (0-2)
uniform float uTurbulence;     // Noise amplitude multiplier (0-3)
uniform float uScrollSpeed;    // How fast flames rise (0.5-3.0)
uniform float uFlameHeight;    // Vertical extent of the flame (0.5-2.0)
uniform float uFlameRadius;    // Radial extent (0.3-1.0)
uniform vec3 uHotColor;        // Color at max temperature
uniform vec3 uWarmColor;       // Mid temperature
uniform vec3 uCoolColor;       // Low temperature
uniform vec3 uSmokeColor;      // Dying/smoke color
uniform float uSmokeThreshold; // Temperature below which smoke blending begins
```

---

## Quality Tier Adaptation

| Setting | High | Medium | Low |
|---------|------|--------|-----|
| Ray steps | 64 | 32 | 16 |
| Noise octaves | 3 | 2 | 1 |
| Box resolution | 1.0 | 0.8 | 0.6 |
| Dynamic light | Yes (flickering) | Yes (no flicker) | No |

---

## Integration with Existing System

### FireRenderer3D Changes

Replace the current `Points`-based particle system with `VolumetricFireMesh` instances:

```typescript
// Before: Points with 3000 particles
this.points = new Points(geometry, material);

// After: One mesh per fire tip (2 tips per staff = 4 meshes total)
this.meshes = tips.map(() => new VolumetricFireMesh(options));
```

Each frame, update each mesh's:
- `position` — track the prop tip via TipPositionBridge3D
- `uTime` uniform — advance noise scrolling
- `rotation` — optionally face the camera or remain world-aligned
- `scale` — modulate by prop velocity (fast swing = elongated flame)

### Color Curve Presets

Same four presets as 2D:

| Preset | Hot | Warm | Cool | Smoke |
|--------|-----|------|------|-------|
| Classic | #FFF0DC | #FFB41E | #DC320A | #28231E |
| Blue | #DCF0FF | #50A0FF | #1E32B4 | #1E1E2D |
| Spirit | #DCFFE6 | #28DC78 | #0A6450 | #19231E |
| Custom | User-defined | User-defined | User-defined | User-defined |

### Velocity Inheritance

When the prop swings fast, the fire should trail behind. Implementation:
- Offset the noise sampling coordinates by the inverse of tip velocity
- This shifts the flame shape in the direction opposite to motion
- Fast swings = long trailing flame, slow/stationary = upright flame

---

## Performance Budget

Target: 60fps on mid-range laptop (RTX 3060 or equivalent).

- 4 fire meshes (2 per prop × 2 props) × 32-64 ray steps × 2 noise octaves
- Each ray step: 2 noise samples (octaves) × ~20 ALU ops per noise sample
- Total per frame: 4 × 48 × 2 × 20 = ~7,680 ALU ops per pixel covered
- At 25% screen coverage (~500×500 pixels): ~1.9 billion ALU ops
- Modern GPUs handle 5-10 billion ALU/frame easily

### Optimization Strategies

1. **Adaptive step count**: fewer steps when fire is far from camera
2. **LOD**: switch to billboard sprite at distance > 10 units
3. **Temporal reprojection**: on LOW tier, render fire at half resolution and upscale
4. **Early ray termination**: stop marching when alpha saturates

---

## Implementation Plan

1. Inline webgl-noise 3D simplex noise as a GLSL string constant
2. Build `VolumetricFireMesh` — BoxGeometry + raymarching ShaderMaterial
3. Test standalone: mount one mesh at a fixed position, verify it looks like fire
4. Replace `FireRenderer3D` internals: swap Points for VolumetricFireMesh instances
5. Wire color presets from 2D fire config
6. Add velocity-based flame trailing
7. Add dynamic point light with noise-coherent flicker
8. Quality tier adaptation (step count, octaves, LOD)
9. Performance profiling and optimization

---

## Open Questions

- Should smoke particles still exist as a separate particle layer above the volumetric flame? (Would add realism but costs extra)
- Should the bounding box be a sphere or cylinder instead of a cube? (Cylinder matches flame shape better, less wasted ray steps)
- Do we want the fire volume to cast light on the avatar skin? (Requires shadow mapping from fire light)
