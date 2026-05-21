# Ocean Scene Redesign — Research (2026-05-20)

Research findings for AAA underwater scene. This document persists across sessions.

## Gold Standard References

### Award-Winning Sites
- **The Sea We Breathe** — https://theseawebreathe.com/ — Awwwards SOTD, Three.js, custom Blender pipeline, Stephen Fry narration. Three immersive underwater journeys.
- **OceanX 2025** — https://2025.oceanx.org/ — Scroll-driven ocean timeline, Three.js + Blender.
- **Anderson Mancini Water Sim** — https://water-simulation.vercel.app/ — R3F. RGB caustics, dynamic waterline, screen droplets, underwater distortion. Most technically complete single-dev demo.
- **Three.js Water Pro** — https://docs.threejswaterpro.com/ — Commercial. FFT waves, Gerstner swells, animated caustics from wave refraction, per-pixel waterline, subsurface scattering. WebGPU-first.
- **"And we were..." Underwater Museum** — https://forum.babylonjs.com/t/underwater-interactive-museum-and-we-were/60752 — Babylon.js. Sculptures + immersive audio. Same concept space as TKA ocean.

### Game Art Direction
- **ABZU** — GDC talk: https://www.gdcvault.com/play/1024409/Creating-the-Art-of-ABZU — "Dream of the ocean, not simulation." Soft blues/greens, iconic simplification, overwhelming density managed through visual noise control. God rays as primary atmosphere. Red drops out first with distance.
- **Subnautica 2** (UE5) — Lumen GI through water volume, bioluminescence for readability at depth, volumetric god rays, per-channel light absorption.
- **Subnautica palette**: #1d395e → #3b5b81 → #4c8dc2 → #6dd4e3 → #9ce4f2

## Repos to Clone and Study

### Direct Dependencies (npm install)
- **`three-good-godrays`** — npm package. Volumetric screen-space raymarched god rays built on `postprocessing` (already in our deps). Drop-in replacement for GodRayShafts geometry. Repo: https://github.com/Ameobea/three-good-godrays

### Reference Repos to Clone
- **`riki-k-dev/mini-aquarium`** — https://github.com/riki-k-dev/mini-aquarium — R3F aquarium with MeshTransmissionMaterial for glass tank refraction. Animated koi, swaying plants (skinned mesh bone animation), instanced bubbles with Float, Lightformer + accumulative shadows. **Closest reference to our dome concept.**
- **`martinRenou/threejs-caustics`** — https://github.com/martinRenou/threejs-caustics — Physically-based refraction caustics using GLSL `refract()`. Two-pass environment mapping (shadow-map inspired). Article: https://medium.com/@martinRenou/real-time-rendering-of-water-caustics-59cda1d74aa
- **`N8python/caustics`** — https://github.com/N8python/caustics — CC0 license. Raymarching projection onto catcher plane. The implementation adopted into pmndrs/drei.
- **`jeantimex/webgpu-water`** — https://github.com/jeantimex/webgpu-water — Evan Wallace port to WebGPU/WGSL. Heightfield sim, raytraced reflections/refractions, 1024x1024 caustics.

### Particle / VFX
- **`@newkrok/three-particles`** — npm. GPU particle system, 50K-350K+ particles. WebGPU compute. Jan 2026 update.
- **`three.quarks`** — npm. Unity-compatible VFX engine. Batched rendering, sub-emitters, trail/ribbon.
- **Three.js `webgl_gpgpu_birds`** — https://threejs.org/examples/webgl_gpgpu_birds.html — Official GPGPU boids pattern for fish schooling.

### Volumetric
- **`three-good-godrays`** — Screen-space raymarched god rays with shadow occlusion. https://github.com/Ameobea/three-good-godrays
- **`three-volumetric-pass`** — Raymarched volumetric fog/clouds. https://github.com/Ameobea/three-volumetric-pass

## What AAA Underwater Scenes Have That We Don't

| Technique | TKA Status | What Premium Does |
|---|---|---|
| God rays | Geometry planes, additive blend | Screen-space raymarched volumetric with shadow occlusion (three-good-godrays) |
| Caustics | Voronoi post-process (disabled) | Projected from wave geometry via refraction tracing, or texture projection on surfaces |
| Fog/absorption | FogExp2 single color | Per-channel RGB absorption — red dies first (Inigo Quilez technique: https://iquilezles.org/articles/fog/) |
| Water surface from below | Flat plane with sine displacement | Snell's window — 97° cone overhead shows sky, total internal reflection outside |
| Fish | Independent sine-orbit paths | GPGPU boids — separation/alignment/cohesion computed on GPU |
| Glass dome | MeshPhysicalMaterial, 8% opacity | MeshTransmissionMaterial with chromatic aberration, normal-mapped imperfections, Fresnel rim |
| Bubbles | Points/particles | InstancedMesh spheres with refractive material (transmission + IOR) |
| Post-processing | Absorption + distortion (broken) | Bloom + chromatic aberration + vignette + DOF — for emphasis, not "underwater filter" |

## Key Technical Articles
- Maxime Heckel: Caustics in WebGL — https://blog.maximeheckel.com/posts/caustics-in-webgl/
- Maxime Heckel: Volumetric Lighting — https://blog.maximeheckel.com/posts/shaping-light-volumetric-lighting-with-post-processing-and-raymarching/
- Inigo Quilez: Colored Fog — https://iquilezles.org/articles/fog/
- Martin Renou: Water Caustics — https://medium.com/@martinRenou/real-time-rendering-of-water-caustics-59cda1d74aa
- Codrops GPGPU Particles — https://tympanus.net/codrops/2024/12/19/crafting-a-dreamy-particle-effect-with-three-js-and-gpgpu/
- NVIDIA GPU Gems Ch.2 Water Caustics — https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-2-rendering-water-caustics

## What "10/10" Requires (Summary)

Nobody has combined ABZU-level art direction with Water Pro-level tech fidelity in a browser. That gap is the opportunity.

Consistent elements across all premium underwater scenes:
1. Per-channel depth fog with exponential falloff
2. Animated caustic patterns on surfaces (not screen-space)
3. Volumetric or screen-space god rays
4. Ambient particles at controlled density
5. Biome-specific color palettes (warm-teal shallow → cold-navy deep)
6. Snell's window when looking up at water surface
7. Dense environment — every depth layer filled (foreground, midground, background)
8. Bloom + chromatic aberration for bioluminescence emphasis
