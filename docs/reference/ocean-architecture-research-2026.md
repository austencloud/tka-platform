# Ocean Scene Architecture Research — 2026 State of the Art

> Compiled 2026-05-26. Validated against 25+ sources including Three.js r183 release, pmndrs ecosystem, game engine patterns.

---

## Core Finding: Pipeline/DAG Architecture is 2026 Consensus

Three.js r183 (2025) introduced `RenderPipeline` — a node-based DAG replacement for `EffectComposer`. This is explicitly modeled after professional game engine pipelines:

- **Node-based graph, not linear chain**: Multiple effects can read from the same source without duplicating work; branches split off and rejoin.
- **Built on TSL (Three.js Shading Language)**: Effects are written in JavaScript, compiled to WGSL (WebGPU) or GLSL (WebGL2) at runtime. Dead code elimination at compile time.
- **Runtime reconfiguration**: Swap the entire effect graph by reassigning `outputNode` and setting `needsUpdate = true`.

**Threepipe** implements this with `IPipelinePass` — each pass declares its ID, position in pipeline, and dependants. `RenderManager` handles ordering and render target allocation.

---

## ECS: Right for Entities, Wrong for Subsystems

### When ECS fits (entity-heavy subsystems):
- Ivan Babkov's Feb 2026 benchmarks with **Koota** (pmndrs ECS library): stable 120 FPS, sub-millisecond input latency with 1,000 entities. 100,000 entities adds only 6 MB memory.
- ECS processing accounts for ~1-2% of total frame time.
- Meta's Immersive Web SDK (production XR framework) is built on ECS + Three.js.
- A-Frame (Mozilla's VR framework) is entirely ECS-based.
- **Miniplex** (hmans/pmndrs) offers "gentle" ECS focused on developer ergonomics.

### When ECS is overkill:
- Top-level scene architecture where subsystems have unique interfaces
- GPU-bound scenes where CPU entity processing isn't the bottleneck
- Fixed scene with known subsystems (not dynamic entity creation/destruction)
- When the framework (Svelte) already provides composition via `$state` + components

**Verdict**: ECS internally for fish/particles. Pipeline composition at top level.

---

## R3F/Threlte Large Scene Patterns

### React Three Fiber (pmndrs ecosystem):
- **Component composition** is primary pattern: self-contained components encapsulate own state, lifecycle, Three.js objects
- **Code splitting** via `React.lazy`: heavy 3D assets/logic lazy-loaded per feature
- **Portal-based composition**: `createPortal` renders into separate `THREE.Scene` instances while maintaining React context
- **Multi-view rendering**: `MultiView` for viewport quadrants
- **useFrame** for per-frame systems

### Threlte (Svelte ecosystem):
- **Canvas > Scene.svelte > Feature components**: strict hierarchy
- **Plugin injection at root**: `interactivity()`, `bvh()`, physics injected once at Scene level
- **Layered package composition**: `@threlte/rapier`, `@threlte/theatre`, `@threlte/xr` — each scopes own context
- **`useTask`** for frame-loop work (equivalent to R3F's `useFrame`)
- **Demand-rendered** by default (only renders when props change or useTask active)

**Shared pattern**: Scene = tree of **feature components** (Ocean, Sky, Avatar, Effects), each internally managing own Three.js objects, lifecycle, and frame-loop subscriptions.

---

## Newer Patterns (Extend, Don't Replace Pipeline)

### Render Graphs / Frame Graphs
- Originally from Frostbite (EA/DICE, 2017), now standard in AAA engines
- Each node declares inputs/outputs; graph is traversed before execution for resource state transitions, buffer allocation, optimal ordering
- **Web adoption emerging**: Three.js r183 `RenderPipeline` is a simplified render graph
- **NullGraph** (WebGPU): drops scene graph entirely, uses flat ArrayBuffers with compute shader-driven culling/sorting

### GPU-Driven Rendering
- WebGPU enables compute shaders on web — GPU-side frustum culling, sort, indirect draw
- NullGraph demonstrates: zero-copy streaming from Web Workers to GPU storage buffers
- Three.js WebGPU path supports compute but doesn't yet offer full GPU-driven pipeline out of box

### TSL Node Material System
- Three.js r184 stabilized TSL — all shader logic as JavaScript node graphs
- Cross-compiles to GLSL (WebGL2) and WGSL (WebGPU)
- Materials have "node" versions (MeshStandardNodeMaterial) where shader slots accept node graphs
- Material-level analog of render pipeline: graph-based composition of shader operations

**Verdict**: These extend pipeline composition, don't replace it. Evolution: linear chain (2015-2024) → DAG pipeline (2025+) → GPU-driven (emerging via WebGPU).

---

## Recommended 3-Layer Architecture

| Layer | Pattern | Rationale |
|-------|---------|-----------|
| **Scene composition** | Component tree (Threlte native) | Svelte reactivity + Threlte's plugin system |
| **Subsystem orchestration** | Pipeline/DAG with explicit execution order | Manages interdependencies between subsystems |
| **Per-subsystem internals** | ECS optional, only for entity-heavy subsystems | Fish swarms, particle systems — not subsystems themselves |
| **Render pipeline** | Node-based (RenderPipeline / TSL) | Post-processing as graph, not linear chain |
| **Future-proofing** | WebGPU compute for GPU-driven work | Culling, particle sim, ocean FFT |

---

## Proposed File Structure

```
ocean/
├── OceanScene.svelte (~80 lines — mounts pipeline, activates plugins)
├── pipeline/
│   ├── terrain-stage.ts (heightmap gen → exports sampler) [no deps]
│   ├── placement-stage.ts (Poisson+DLA → grid) [depends: terrain]
│   ├── sdf-stage.ts (bake collision fields) [depends: placement]
│   ├── instancing-stage.ts (InstancedMesh batches) [depends: placement, terrain]
│   ├── pipeline-graph.svelte.ts (DAG scheduler — parallel where possible)
│   └── pipeline-context.svelte.ts (reactive outputs)
├── renderers/
│   ├── TerrainRenderer.svelte
│   ├── AtmosphereRenderer.svelte (fog, god rays, caustics, particles)
│   ├── SurfaceRenderer.svelte (water, Snell's window)
│   ├── FloraRenderer.svelte (instanced coral/kelp/rocks)
│   ├── fauna/
│   │   ├── FishBoids.svelte + fish-compute.ts + fish-render.ts + fish-species.ts + fish-events.ts
│   │   └── JellyfishSwarm.svelte + jellyfish-verlet.ts + jellyfish-geometry.ts + jellyfish-shaders.ts
│   ├── InteractionRenderer.svelte
│   └── LoadingRenderer.svelte
├── postprocessing/
│   ├── ocean-render-pipeline.ts (RenderPipeline DAG — batches effects)
│   └── nodes/ (TSL-ready effect nodes)
├── shaders/ (GLSL now, TSL migration path later)
└── ocean-config.ts (flat, single ocean)
```

---

## Key Sources

- [Three.js r183 Release — RenderPipeline](https://github.com/mrdoob/three.js/releases/tag/r183)
- [Complete Guide to Three.js Post-Processing 2026](https://threejsroadmap.com/blog/the-complete-guide-to-threejs-post-processing-in-2026)
- [TSL: Better Way to Write Shaders in Three.js](https://threejsroadmap.com/blog/tsl-a-better-way-to-write-shaders-in-threejs)
- [Three.js Architecture: ECS (Ivan Babkov, Feb 2026)](https://medium.com/@i_babkov/three-js-architecture-ecs-685768c7d91f)
- [100 Three.js Tips (2026)](https://www.utsubo.com/blog/threejs-best-practices-100-tips)
- [Building Efficient Three.js Scenes (Codrops, Feb 2025)](https://tympanus.net/codrops/2025/02/11/building-efficient-three-js-scenes-optimize-performance-while-maintaining-quality/)
- [Threepipe Render Pipeline](https://threepipe.org/guide/render-pipeline.html)
- [pmndrs/koota — Performant ECS](https://github.com/pmndrs/koota)
- [Miniplex — Developer-friendly ECS](https://github.com/hmans/miniplex)
- [NullGraph: Data-Oriented WebGPU](https://www.webgpu.com/showcase/nullgraph-webgpu-framework/)
- [Structure of a WebGPU Renderer (Ryosuke, 2025)](https://whoisryosuke.com/blog/2025/structure-of-a-webgpu-renderer/)
- [WebGPU & Future of Graphics 2026](https://blog.weskill.org/2026/04/webgpu-future-of-graphics-building-2026.html)
- [Render Graph Architecture (Adept Engine)](https://andrewcjp.wordpress.com/2019/09/28/the-render-graph-architecture/)
- [Game Engine Architecture: Systems Design 2025](https://generalistprogrammer.com/game-engine-architecture)
- [Threlte Official Docs](https://threlte.xyz/docs/learn/getting-started/your-first-scene/)
- [pmndrs/postprocessing](https://github.com/pmndrs/postprocessing)
- [Viber3D — R3F + Koota Starter](https://github.com/instructa/viber3d)
- [Meta Immersive Web SDK — ECS Runtime](https://developers.meta.com/horizon/documentation/web/iwsdk-overview/)
