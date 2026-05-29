# Gaussian Splatting Premium Scene (Spark 2.0) — Design

**Date:** 2026-05-29
**Status:** Draft (spike-gated — emerging tech, prove before committing)
**Source:** 2026 pipeline audit (2026-05-29), sourcing prong. Flagged the clearest "ahead-of-the-curve" lever available.

## Problem / Opportunity

Mesh-based GLB scenes can't match the photoreal density of a captured or
AI-generated environment. 3D Gaussian splatting crossed the web-production line
in the last ~60 days: **Spark 2.0** (MIT-licensed, World Labs, released
2026-04-15) renders splats on `three.js` + WebGL2 **fused with ordinary meshes
in one scene**, and 2.0 added LoD streaming + GPU virtual memory + a `.RAD`
format with HTTP Range requests — purpose-built for mobile budgets. TKA already
runs three 0.182 + threlte, so splats can share the existing Viewer3DCanvas with
the GLB ocean props.

This is a **premium differentiator**, not a replacement for the mesh pipeline.

## Goal

Render a Gaussian-splat environment (captured or World-Labs-generated) fused
with the existing GLB ocean meshes in the sequence viewer's 3D pane, within a
documented mobile budget, gated behind the premium/lab path.

## Uniqueness check (per effects-earn-their-slot ethos)

Splatting visualizes **photoreal volumetric environment capture** — something no
mesh GLB or procedural scene in TKA can produce. It is not a tweak to an existing
scene type; it's a distinct rendering primitive (splats vs triangles).

## Design

### 1. Spike first (gate)

`npm install @sparkjsdev/spark`. Throwaway route renders one splat asset next to
one GLB mesh in the three 0.182 / threlte stack. Prove: (a) splat+mesh depth
compositing works, (b) it loads via threlte's render loop, (c) mobile FPS is
acceptable. **No further work until the spike renders.**

### 2. Asset acquisition

- Capture: Polycam / Luma → `.ply`/`.spz`.
- Generate: World Labs (text/image → environment).
- Compress to `.spz`/`.sog` or Spark's `.RAD` for HTTP-Range LoD streaming.
- Target budget: **15-30 MB, 200-500K splats, 30-45 FPS** (Spark 2.0 documented mobile envelope).

### 3. Integration

A `SplatEnvironment.svelte` that wraps Spark's renderer object inside a threlte
`<T>` / custom-renderer seam, reporting load through the scene-feature context
like GLB scenes. Slots into the **environment registry** (see
`2026-05-29-glb-environment-registry-design.md`) as a new `kind: "splat"` entry
alongside `kind: "glb"` — the registry already abstracts "what loads this scene."

### 4. Gating

Premium/lab path only (it's v0.x emerging tech). Quality-tier detection
(`detectOceanQuality`) gates it off on low-end GPUs → fall back to the mesh scene.

## Files

- Spike: throwaway `src/routes/test/splat/+page.svelte`
- Create (post-spike): `SplatEnvironment.svelte`, registry `kind: "splat"` support
- Dep: `@sparkjsdev/spark`

## Verification

- Spike screenshot: splat + GLB mesh in one frame, correct depth. **Browser-gated → user on :5173.**
- Mobile FPS trace within budget (chrome devtools performance, throttled).
- License: Spark MIT ✓; splat asset license recorded in its registry entry.

## Risks

- **v0.x maturity** — treat as emerging; gate behind premium, keep mesh fallback.
- three version: Spark built on three; confirm compatibility with 0.182 (or bump to 0.184 per the runtime prong) during the spike.
- Splat editing/authoring is not Blender-first — this is the one scene kind that
  bypasses the Blender pipeline by nature (capture/generate, not model). Document
  the exception.

## Out of scope

- Authoring/editing splats in-app.
- Replacing the mesh ocean scene (splatting augments, doesn't replace).
