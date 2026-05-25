# Phase 11: 3D Extrusion — Web Research Audit

**Spec:** `docs/superpowers/specs/2026-05-25-mandala-phase11-3d-extrusion-design.md`  
**Auditor:** Claude Sonnet 4.6 (web research pass)  
**Date:** 2026-05-25  
**Companion audit:** `phase11-3d-extrusion-audit.md` (codebase analysis)

---

## Summary

The spec is largely current. The two areas where it needs upgrading are: (1) post-processing — the project already uses pmndrs/postprocessing which is WebGL-only and should stay on WebGL for this feature, but the spec doesn't acknowledge the newer Three.js RenderPipeline and what it changes; (2) TSL/WebGPU — these are now production-ready and the spec should at minimum acknowledge them as an upgrade path, since the project already has WebGPU infrastructure. Morph targets (the spec's primary animation strategy) are confirmed sound. TubeGeometry is confirmed the right choice.

---

## Findings

### 1. Three.js Morph Targets (r182+)

**Spec says:** Pre-compute 7–8 `TubeGeometry` keyframes, store them as `morphAttributes.position` entries on a base geometry, interpolate with `morphTargetInfluences` on the GPU each frame. Bake normals into `morphAttributes.normal` alongside positions.

**2026 SOTA:** Morph targets in Three.js have been texture-based internally since roughly r143–r148 — the renderer packs morph attribute data into a `DataTexture` and uploads it to the GPU rather than using vertex attribute slots. This is why `WebGLRenderer.maxMorphTargets` and `maxMorphNormals` were removed (the old 8-target / 4-target-with-normals WebGL vertex attrib limit no longer applies). The `DataTexture` approach has a known performance concern (GitHub issue #26692, now closed): the renderer was iterating every element of the ArrayBuffer before upload, taking ~16ms vs. ~0.66ms for the actual GPU upload. That issue was addressed. At r182, the practical limit is GPU memory and texture unit budget, not a hard 8-target ceiling.

**Verdict:** ✅ Spec is current — with one gotcha to document.

**Recommendation:** The spec's 7–8 morph targets per mesh is well inside current limits. However, add a spec note: since each morph target keyframe is stored as a `DataTexture` row, 8 keyframes × 4 meshes = 32 morph textures, which adds texture unit pressure. The project already hits texture unit warnings at r182 (noted in GitHub issue linked from forum). Cap keyframes at 6 per mesh and verify with `renderer.capabilities.maxTextures` on mount. Also confirm that baking normals into `morphAttributes.normal` (as the spec requires) doubles the texture count per mesh — plan for 12 textures per mesh (6 position + 6 normal). Still fine, but worth tracking.

---

### 2. TubeGeometry vs. MeshLine/Line2

**Spec says:** Use `TubeGeometry` as the default extrusion method. Full mesh material support including emissive, transmission, and metalness.

**2026 SOTA:** `TubeGeometry` produces a `THREE.Mesh` — a closed circular cross-section geometry — that works with all `MeshStandardMaterial` / `MeshPhysicalMaterial` properties including emissive, transmission, metalness, envMap, and UV mapping. `THREE.Line2` / `MeshLine` are optimized for screen-space line width (constant pixel width regardless of depth). They use a specialized `LineMaterial` with limited feature support — no transmission, no metalness, no envMap. They are appropriate for technical diagrams where consistent width matters; for artistic "glowing tube" and "glass crystal" appearances, they are the wrong tool.

**Verdict:** ✅ Spec is current. TubeGeometry is the correct choice for the visual vocabulary (jewelry, glass, chrome).

**Recommendation:** No change needed. The only case where `Line2` would be preferable is if the spec required pixel-perfect consistent stroke width at all zoom levels (it does not — the spec wants volumetric depth). Confirm this stays true if users zoom very close and the tube radius feels too thick — if so, scale `radius` with `camera.position.length()`, not switch to Line2.

---

### 3. Three.js TSL (Three Shading Language)

**Spec says:** Uses `MeshStandardMaterial` (Neon, Chrome) and `MeshPhysicalMaterial` (Glass) — plain Three.js materials, no TSL.

**2026 SOTA:** TSL was introduced as stable in r184 and is the 2026-recommended way to customize materials in Three.js. It compiles to GLSL for WebGL and WGSL for WebGPU from the same JavaScript code. The project uses Three.js `^0.182.0`, which is below the r184 TSL stable milestone but already ships TSL in a functional (pre-stable) state. TSL node materials (`MeshStandardNodeMaterial`, `MeshPhysicalNodeMaterial`) are available at r182. Threlte's own WebGPU docs show `MeshPhysicalNodeMaterial` in examples.

For the Phase 11 materials, TSL offers two concrete improvements over standard materials:

1. **Emissive pulsing without `onBeforeRender` hacks**: Drive `emissiveNode = breathPhase * emissiveColor` directly as a TSL uniform — the GPU evaluates it per-fragment with zero CPU-side material mutation per frame.
2. **Custom Z-lift vertex displacement**: The spec's Z-lift morph target bakes a single elevation curve. TSL's `positionNode` override could compute the Z offset analytically per-vertex from the vertex's XY distance from origin — eliminating the need for a dedicated Z-lift morph target entirely and saving texture budget.

However, TSL requires either WebGPURenderer or explicitly using `MeshStandardNodeMaterial` with WebGLRenderer (which Three.js supports since r175 via the node material system's WebGL backend).

**Verdict:** ⚠️ Better approach exists for emissive animation and Z-lift. Standard materials are safe and correct for Phase 11, but TSL node materials would reduce the morph target count and eliminate the `onBeforeRender` emission update.

**Recommendation:** Phase 11 can ship with standard materials as specced — this is not a blocker. Add a `# Future upgrade` note: replace the Z-lift morph target with a TSL `positionNode` that computes `zOffset = sin(breathPhase * PI) * maxZLift * (distFromCenter / maxRadius)` analytically. This eliminates one morph target per mesh (saving 4 DataTextures) and makes the Z-lift formula live in one place. Syntax at r182:

```typescript
import { MeshStandardNodeMaterial } from 'three/webgpu'; // works with WebGL via node backend
const mat = new MeshStandardNodeMaterial();
mat.positionNode = positionLocal.add(vec3(0, 0, zLiftOffset));
```

---

### 4. SVG to 3D Geometry Pipeline

**Spec says:** `MandalaGeometryCalculator` exposes raw `MandalaPoint[]` arrays directly. The 3D pipeline consumes these without parsing SVG strings. Builds `CatmullRomCurve3` from the raw points → `TubeGeometry`.

**2026 SOTA:** Three.js ships `SVGLoader` (addon: `three/addons/loaders/SVGLoader.js`) which parses SVG `d`-attribute strings into `ShapePath` objects via `SVGLoader.createShapes()`, returning `Shape` instances that can be extruded with `ExtrudeGeometry`. This is the standard pipeline when starting from SVG strings. However, `ExtrudeGeometry` extrudes flat shapes perpendicular to the XY plane — it produces slabs, not tubes. For path-following tubes, Three.js's own `TubeGeometry(CatmullRomCurve3, ...)` is still the standard approach.

The spec avoids `SVGLoader` entirely by going directly to the source `MandalaPoint[]` arrays — this is the correct approach. Parsing SVG strings through `SVGLoader` would re-introduce floating-point serialization rounding that the direct array path avoids.

**Verdict:** ✅ Spec is current. Bypassing SVGLoader in favor of raw point arrays is the right call.

**Recommendation:** No change. Document in `MandalaExtruder.ts` that SVGLoader was considered and rejected in favor of direct point access for precision. Worth a one-line code comment.

---

### 5. WebGPU Renderer

**Spec says:** No explicit WebGPU mention. Uses standard Threlte `<Canvas>` (implies WebGLRenderer). Glass material requires `WebGLRenderer` with `logarithmicDepthBuffer = false`.

**2026 SOTA:** As of September 2025 (Three.js r171), `WebGPURenderer` is production-ready. As of early 2026, WebGPU has baseline support across Chrome, Edge, Firefox 141+ (Windows), and Safari 26. Total browser coverage is approximately 70% on desktop, 60% on mobile, with automatic WebGL2 fallback for the remainder. Three.js's `import * as THREE from 'three/webgpu'` automatically handles the fallback — no user-facing degradation.

The project already has `WebGPUCanvas.svelte` (used by museum/procedural scenes). Threlte supports WebGPU via the `createRenderer` Canvas prop:

```svelte
<Canvas createRenderer={(canvas) => new WebGPURenderer({ canvas, antialias: true, forceWebGL: false })}>
```

The `MeshPhysicalMaterial` transmission / glass effect is fully supported under WebGPURenderer. The `logarithmicDepthBuffer` caveat the spec mentions applies to WebGLRenderer only — WebGPU handles depth precision natively.

**Verdict:** ⚠️ Better approach available — though WebGL is safe and correct for Phase 11.

**Recommendation:** Phase 11 does not need to migrate to WebGPU to ship. However, given the project already has `WebGPUCanvas.svelte`, the `Mandala3DScene.svelte` should use the same WebGPU canvas pattern for consistency and future-proofing. This is particularly relevant for the Glass material — WebGPU's native depth precision eliminates the `logarithmicDepthBuffer = false` requirement. Estimated migration cost: swap `<Canvas>` to `<Canvas createRenderer={...}>` with `WebGPURenderer`, update material imports to `three/webgpu` equivalents. Mark as a Phase 11.1 follow-on if shipping WebGL first is preferable.

---

### 6. Post-Processing

**Spec says:** Uses `ScenePostProcessing.svelte` with `BloomEffect` (pmndrs/postprocessing), `VignetteEffect`. No chromatic aberration. No god rays.

**2026 SOTA:** Two important developments since the spec was written:

**A. pmndrs/postprocessing is WebGL-only.** The `EffectComposer` from pmndrs/postprocessing (`^6.38.2`, already in `package.json`) does not work with `WebGPURenderer`. If the mandala scene uses WebGPU (see Topic 5 above), pmndrs/postprocessing is incompatible.

**B. Three.js r183 introduced `RenderPipeline`.** This is a node-based post-processing system built on TSL, designed for WebGPURenderer from the ground up with automatic WebGL2 fallback. Bloom, vignette, and other effects are first-class TSL nodes. Example: `bloom()` from `'three/tsl'`. `RenderPipeline` handles tone mapping, color space conversion, and resize automatically.

However, the project's current `ScenePostProcessing.svelte` is deeply wired to pmndrs/postprocessing and is tightly coupled to the ocean scene. The spec correctly notes that the mandala scene should use a **dedicated configuration** of `ScenePostProcessing.svelte`. Looking at the existing implementation, `ScenePostProcessing.svelte` only activates when `backgroundType === BackgroundType.OCEAN` — it would not fire for the mandala canvas at all.

**Verdict:** ⚠️ The spec assumes `ScenePostProcessing.svelte` is reusable for the mandala, but the existing component is ocean-specific and WebGL-only. The mandala needs its own post-processing setup.

**Recommendation:** For Phase 11 on WebGL:
- Do not try to reuse `ScenePostProcessing.svelte` — it is ocean-gated.
- Create `Mandala3DPostProcessing.svelte` using pmndrs/postprocessing directly (same `EffectComposer` pattern, no ocean effects). This is simpler and already proven.
- Bloom config as specced: `intensity = 2.0`, `luminanceThreshold = 0.3`, `mipmapBlur: true`.

If Phase 11 later moves to WebGPU, replace `Mandala3DPostProcessing.svelte` with a `RenderPipeline`-based equivalent using `bloom()` from `three/tsl`. The spec's bloom parameters translate directly.

---

### 7. 3D Export Formats (AR)

**Spec says:** Screenshot (PNG) and video (h264) export only. No 3D model export.

**2026 SOTA:** Three.js ships `GLTFExporter` (`three/addons/exporters/GLTFExporter.js`) and `USDZExporter` (`three/addons/exporters/USDZExporter.js`) as standard addons. Exporting the mandala as a GLB (binary glTF) would allow viewing in Android AR (model-viewer web component, ARCore), while USDZ export would enable native iOS AR Quick Look. The export pipeline:

```typescript
const exporter = new GLTFExporter();
exporter.parse(scene, (gltf) => {
  const blob = new Blob([gltf as ArrayBuffer], { type: 'model/gltf-binary' });
  // download as .glb
}, { binary: true });
```

USDZ is trickier — it cannot represent transmission/glass materials in the way Three.js renders them, and USDZ's physical material model differs from glTF's. There is also active data loss when converting between the formats.

**Verdict:** ⚠️ Opportunity exists but is explicitly out of scope for Phase 11. Flag for Phase 11.1.

**Recommendation:** No change to Phase 11 scope. Add a `# Out of scope / future` note: GLB export via `GLTFExporter` is a low-effort add-on that opens AR viewing for free. USDZ export should be considered separately due to transmission material incompatibilities. The morph target animation will export correctly in GLB (glTF 2.0 supports morph targets natively).

---

### 8. Instanced Rendering for Multiple Tubes

**Spec says:** 4 separate `Mesh` objects (one per path), each with its own `TubeGeometry` and `morphAttributes`. 4 draw calls.

**2026 SOTA:** `THREE.InstancedMesh` renders N copies of a single geometry+material in one draw call. The constraint: all instances must share the same geometry topology. The 4 mandala tubes have different `CatmullRomCurve3` shapes, so they cannot share the same `TubeGeometry` — each curve produces different vertex positions. `InstancedMesh` is therefore not applicable here.

`THREE.BatchedMesh` (Three.js r155+) allows batching geometries of different topology into a single draw call. However, it does not support morph targets. Using `BatchedMesh` would require abandoning the morph target animation strategy.

At 4 draw calls for ~40k total triangles, the overhead is negligible on any device that can handle WebGL2. The instancing optimization is not worth the complexity.

**Verdict:** ✅ Spec is correct. 4 separate meshes is the right approach.

**Recommendation:** No change. Document in the spec why `InstancedMesh` and `BatchedMesh` were rejected: different curve shapes preclude shared geometry, and `BatchedMesh` lacks morph target support. 4 draw calls at this vertex count is not a bottleneck.

---

### 9. Threlte Integration Patterns

**Spec says:** Uses `useTask` for animation loop, `$state`/`$effect` for control panel settings, `onDestroy` for disposal. Custom geometry created imperatively and mounted via `<T.Mesh>` or equivalent.

**2026 SOTA:** Threlte's `<T>` component wraps any Three.js export. For procedurally-created `Mesh` objects (like the extruder's pre-allocated meshes), the recommended pattern is to add them imperatively to the scene graph via `useThrelte().scene.current.add(mesh)` and remove in `onDestroy` — or bind a Three.js object as a prop. The `<T.Mesh>` declarative API works for static-topology objects but adds reconciliation overhead for objects that change structure on mount.

Morph targets require one non-obvious setup in Threlte: `mesh.morphTargetInfluences` must be initialized **after** the mesh is added to the scene, because Threlte's `<T>` component processes `morphAttributes` during the first render pass. If setting influences before mount, they may be reset. The safe pattern is to set them in a `$effect` that runs after mount, or in the first `useTask` frame.

Threlte does not have built-in morph target helpers (`@threlte/extras` has no `<MorphTarget>` component as of current documentation). All morph target setup is vanilla Three.js.

**Verdict:** ✅ Spec's approach (imperative Three.js geometry + Threlte task loop) is the correct Threlte pattern for this use case.

**Recommendation:** Add a spec note: initialize `morphTargetInfluences` inside the first `useTask` frame (or in a `$effect` with an `onMount` guard) rather than immediately after constructing the geometry, to avoid Threlte's reconciliation overwriting them. The `MandalaExtruder.initialize()` call should complete before `setBreathPhase()` is called, and the extruder's meshes should be added to the scene before `initialize()` returns.

---

## Cross-Cutting Findings

### Three.js Version Alignment

The project is on `^0.182.0`. The spec correctly handles the `physicallyCorrectLights` removal (r155) per the companion audit. TSL stabilized at r184 — the spec's use of standard materials is therefore safe at r182. `RenderPipeline` is also r183+ only. The spec is version-appropriate for `^0.182.0`.

If the lockfile resolves to `r183` or `r184` (semver allows it under `^0.182.0`), TSL-based emissive nodes and `RenderPipeline` become available without a package bump. Add a `package.json` check on mount: `THREE.REVISION >= 183` to optionally activate these improvements.

### pmndrs/postprocessing + WebGPU Incompatibility

This is the most consequential finding for the project's long-term direction. The existing `ScenePostProcessing.svelte` is wired to pmndrs/postprocessing, which is WebGL-only. If the project migrates scenes to WebGPU (which the existing `WebGPUCanvas.svelte` suggests is already underway), post-processing must migrate to `RenderPipeline` + TSL effects. Phase 11 is an opportunity to set the pattern for the mandala's dedicated post-processing by writing a `Mandala3DPostProcessing.svelte` that could be built as either a pmndrs or RenderPipeline variant depending on the renderer choice.

### Morph Target Texture Budget

With 4 paths × 6 keyframes × 2 attributes (position + normal) = 48 morph `DataTexture` uploads at initialization. Each texture is `(vertexCount × 4)` floats wide. At 650 vertices per path, each texture is a `650 × 1` RGBA32F texture — trivially small. The initialization cost runs once on mount. Per-frame cost is only setting 2 `morphTargetInfluences` floats per mesh — confirmed essentially free at < 0.1ms as the spec claims.

---

## Action Items for Implementer

| Priority | Action |
|----------|--------|
| Required | Create `Mandala3DPostProcessing.svelte` — do not reuse `ScenePostProcessing.svelte` (ocean-gated) |
| Required | Cap morph keyframes at 6 per mesh; check texture unit budget on mount |
| Required | Initialize `morphTargetInfluences` after mesh is added to scene graph, not before |
| Recommended | Add `# Future upgrade` note about TSL `positionNode` replacing Z-lift morph target |
| Recommended | Add `# Future upgrade` note about WebGPU `createRenderer` path (pattern already exists in codebase) |
| Optional | Add `# Out of scope` note about GLB/USDZ export for AR |
