# WebGPU Renderer Migration — Design Spec

**Date:** 2026-05-21
**Status:** Backlog
**Tier:** 7 (3D / Premium)
**Value:** 4 (future-proofs all shaders, unlocks TSL compute for particles/fish/effects)
**Effort:** L (touches every custom shader across all scenes)

---

## Problem

The TKA platform uses Three.js `WebGLRenderer` with raw GLSL shader strings for all custom materials (ocean seabed, ruins platform, god ray shafts, caustics, water surface, forest ground, winter snow, cosmic nebula). The `postprocessing` EffectComposer handles bloom/CA/vignette. GPUComputationRenderer handles fish boids via texture ping-pong.

All of this is the WebGL-era approach. Three.js r171+ ships `WebGPURenderer` with TSL (Three Shading Language) — a node-based shader system that compiles to WGSL (WebGPU) and GLSL (WebGL2 fallback). WebGPU is baseline in all major browsers as of Sep 2025 (Safari 26 was the last holdout).

Migrating unlocks:
- TSL compute shaders (StorageBufferNode) — proper compute, not fragment shader hacks
- Single-source shaders that work on both WebGPU and WebGL2
- Better GPU profiling and debugging tools
- Future Three.js investment is in TSL, not raw GLSL

## Scope

### Must migrate:
- `<Canvas>` renderer creation → `WebGPURenderer` via `createRenderer` prop
- All custom `ShaderMaterial` with GLSL strings → TSL node materials
- GPUComputationRenderer → TSL `StorageBufferNode` compute
- `postprocessing` EffectComposer → Three.js native post-processing nodes (or verify compatibility)
- Async renderer init (`await renderer.init()`) pattern

### Custom GLSL shaders to rewrite (audit needed, known so far):
- `ocean/RuinsPlatform.svelte` — voronoi cracks, moss gradient, bioluminescent glow
- `ocean/ProceduralSeabed.svelte` — ripple noise, sand color
- `ocean/FishSchool.svelte` — boids velocity/position compute + render vertex/fragment
- `ocean/WaterSurface.svelte` — refraction, Snell's window
- God ray shaft geometry shaders (additive blend)
- Caustics projection shader
- Forest, winter, cosmic scene custom materials (TBD — full audit required)

### Post-processing migration:
- Current: `postprocessing` npm package (EffectComposer, BloomEffect, ChromaticAberrationEffect, VignetteEffect)
- Target: Three.js native `PostProcessing` class with TSL effect nodes, OR verify `postprocessing` WebGPU compatibility
- Risk: `postprocessing` library may not support WebGPURenderer. Need to test.

### Threlte-specific concerns:
- HMR crash: WebGPURenderer disposal fails on hot reload (threlte/threlte#1667). Workaround exists.
- Async init: requires `renderMode='manual'` → `await renderer.init()` → switch to `'on-demand'`
- Vite config: `esbuildOptions: { target: 'esnext' }` and `build: { target: 'esnext' }` for top-level await

## Approach

1. **Audit phase:** Catalog every custom GLSL shader across all scenes. Estimate per-shader TSL conversion effort.
2. **Post-processing spike:** Test `postprocessing` library with `WebGPURenderer`. If incompatible, prototype equivalent effects with Three.js native post-processing nodes.
3. **Scene-by-scene migration:** Convert one scene at a time, starting with the simplest (PureBlack/Cosmic → Winter → Forest → Ocean). Each scene is independently verifiable.
4. **Compute migration:** Convert GPUComputationRenderer (fish boids, future particle systems) to TSL StorageBufferNode compute. The fish personality system is designed renderer-agnostic for this reason.
5. **Fallback verification:** Confirm WebGL2 fallback works on all converted shaders (TSL compiles to both WGSL and GLSL).

## Success Criteria

- All scenes render identically (or better) on WebGPURenderer
- WebGL2 fallback works for browsers without WebGPU
- Post-processing effects (bloom, CA, vignette) functional
- Fish boids running on TSL compute
- No GLSL string shaders remaining in the codebase
- Performance equal or better than WebGL path

## References

- [Threlte WebGPU docs](https://threlte.xyz/docs/learn/advanced/webgpu/)
- [Threlte 8 blog post](https://threlte.xyz/blog/threlte-8/)
- [Maxime Heckel — Field Guide to TSL and WebGPU](https://blog.maximeheckel.com/posts/field-guide-to-tsl-and-webgpu/)
- [Nik Lever — TSL compute tutorials](https://niklever.com/tutorials/getting-to-grips-with-threejs-shading-language-tsl-6/)
- [Three.js TSL spec](https://threejs.org/docs/TSL.html)
- [WebGPU compute boids sample](https://webgpu.github.io/webgpu-samples/?sample=computeBoids)
- [HMR crash workaround — threlte#1667](https://github.com/threlte/threlte/issues/1667)
