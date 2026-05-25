# Audit: Phase 11 — 3D Extrusion Design Spec

**Spec:** `docs/superpowers/specs/2026-05-25-mandala-phase11-3d-extrusion-design.md`  
**Auditor:** Claude Opus 4.6  
**Date:** 2026-05-25  

---

## VERDICT: CONDITIONAL PASS

The spec demonstrates strong understanding of the existing codebase, correct identification of the geometry pipeline, and a realistic performance strategy. Three critical issues must be resolved before implementation: (1) the `physicallyCorrectLights` reference is a removed API, (2) the TubeGeometry in-place vertex update strategy is more complex than described because TubeGeometry's internal vertex layout depends on the curve shape, and (3) the ContentType integration requires changes to more files than the spec accounts for. The overall architecture is sound.

---

## STRENGTHS

1. **Accurate codebase mapping.** The spec correctly identifies `bluePointSets` / `redPointSets` at lines 567-576 of `MandalaGeometryCalculator.ts` as pre-SVG point arrays. The claim that these exist but are not currently exposed is verified — `calculate()` builds them internally and immediately converts them to SVG `d` strings via `pointsToSVGPath()`. Exposing them as a parallel return path is minimal-risk.

2. **Coordinate mapping is correct.** `MANDALA_GRID_RADIUS = 80` (confirmed at `mandala-constants.ts:9`). Dividing by 80 normalizes the grid-radius circle to a unit circle. Tip reach extends to ~175 units (grid 80 + `MANDALA_STANDARD_TIP_DX = 130` scaled by `gridRadius/ENGINE_GRID_RADIUS = 80/150`), which produces a max extent of ~80 + 130*(80/150) = ~149 units, normalizing to ~1.86 world units. The spec's "roughly 2-unit-radius disc" is accurate. The SVG-Y inversion (`-point.y / 80`) is required and correctly noted.

3. **Separate canvas decision is well-justified.** The existing `UnifiedViewerCanvas.svelte` tightly couples its camera modes (`orthographic-2d` / `perspective-3d`) to the performer avatar pipeline. Confirmed in the source: it gates on `avatarState && sequenceData` for 3D mounting. The mandala scene has no avatar, so a separate `<Canvas>` is the correct approach. Threlte supports multiple Canvas instances — this is confirmed by the codebase already running multiple canvases (e.g., `WebGPUCanvas.svelte` for museum/procedural, `UnifiedViewerCanvas.svelte` for viewer).

4. **OrbitControls reuse is feasible.** The spec's proposed `OrbitControls.svelte` config (`minDistance`, `maxDistance`, `minPolarAngle`, `maxPolarAngle`, `enablePan`, `autoRotate`, `autoRotateSpeed`, `smoothTime`) maps 1:1 to the existing component's props (confirmed at `OrbitControls.svelte:43-93`). No modification of the shared component needed.

5. **Realistic performance budget.** 40k triangles with 4 tubes is well within GPU capacity. The identification of per-frame geometry rebuild as the real bottleneck (not vertex count) is correct.

6. **Svelte 5 reactivity strategy is correct.** Keeping animation state in `useTask` locals (not `$state`) and only using `$state`/`$effect` for control panel settings matches the codebase's established pattern (e.g., `ScenePostProcessing.svelte` uses `useTask` for render loop, `$derived` for config).

---

## ISSUES

### Critical

**C1: `renderer.physicallyCorrectLights = true` was removed in Three.js r155.**  
The spec states Glass material "requires `renderer.physicallyCorrectLights = true`." This property does not exist in Three.js r182 (the project's version, confirmed in `package.json`). It was deprecated in r150 and removed by r155. Physically correct light attenuation is now the default behavior — no opt-in required. The spec's claim is based on stale documentation.

**Fix:** Remove the `physicallyCorrectLights` requirement. Note that physically correct light decay is now the default. The `transmission` material feature works out of the box in r182 without any renderer flag.

**C2: TubeGeometry in-place vertex update is not straightforward.**  
The spec proposes pre-allocating a TubeGeometry and updating `position` buffer attributes in place each frame. The problem: `TubeGeometry` generates its vertex buffer based on the curve's `getPointAt()` / `getTangentAt()` / Frenet frames. When the curve changes shape (which it does every breath frame), the mapping from curve parameter to vertex index is the entire TubeGeometry construction algorithm. You cannot simply set new XYZ on existing vertices — you need to recompute the Frenet frame at every tubular segment, then offset each radial ring vertex by the frame's normal and binormal. This is essentially reimplementing the TubeGeometry constructor.

The spec hand-waves this as "overwrite Float32Array values directly" with a simple for-loop, but the actual update requires:
1. Recompute the curve from new points
2. Walk the curve at uniform intervals to get positions + tangents
3. Compute Frenet frames (normal, binormal) at each station
4. For each radial segment at each station, compute the ring vertex position

This is ~60 lines of math, not the 4-line snippet shown. It is still the correct approach (pre-allocate + update in place), but the implementation complexity is understated.

**Fix:** Acknowledge this is a custom TubeGeometry updater, not a trivial buffer write. Reference Three.js's `TubeGeometry` source for the Frenet frame algorithm. Alternatively, consider using morph targets (pre-compute geometry at several dx values and interpolate), which Three.js supports natively with `mesh.morphTargetInfluences`.

**C3: ContentType integration requires changes to 6+ files, not the 2-3 listed.**  
Adding `"mandala-3d"` to the `ContentType` union touches more than the spec lists:

Files confirmed to need changes:
- `src/lib/shared/sequence-viewer/services/viewer-state-persistence.ts` — type union + `isValidContentType()` guard (line 90)
- `src/lib/shared/sequence-viewer/services/viewer-state-persistence.ts` — `loadViewerMode()` validation string check (line 47)
- `src/lib/shared/sequence-viewer/components/PaneContentSelector.svelte` — `options` array (line 13)
- `src/lib/shared/sequence-viewer/components/ViewerContentRail.svelte` — `allModes` array (line 22-29)
- `src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte` — pane routing conditionals (lines 410-418, 544-552)
- `src/lib/shared/sequence-viewer/state/viewer-state.svelte.ts` — `deriveInitialExportContext`, `wants3D` derivation

The spec's "Modified files" section lists only the persistence file and a vague "add to content type selector." Missing the ViewerContentRail, ViewerSplitPane routing, and viewer-state derivations will cause the new pane to be unreachable or break mode switching.

**Fix:** Enumerate all files that switch on ContentType. Grep for `ContentType` in the sequence-viewer directory to get the full list.

### Important

**I1: The `calculatePoints()` method signature in the spec doesn't match the existing `calculate()` signature.**  
The spec proposes `calculator.calculatePoints(sequence.steps, bluePropType, redPropType, pathOptions, { dx: currentDx, dy: 0 })`. The existing `calculate()` method (line 527) takes `(steps, _bluePropType?, _redPropType?, options?, tipOverride?)`. The prop type parameters are actually unused in the current implementation (the function ignores them and uses standard tip offsets). The spec should note that `calculatePoints()` mirrors `calculate()` exactly but returns `MandalaPaths3D` instead of `MandalaPaths`. This is a minor API design clarity issue, not a bug.

**I2: The spec says `closed = true` for CatmullRomCurve3, but mandala paths are not always closed.**  
The spec states "Set `closed = true` because LOOP sequences have continuous paths." However, the existing `MandalaGeometryCalculator` does not close the path — `pointsToSVGPath()` starts with `M` and emits `C` segments but never adds a `Z` closepath. The raw point array starts at beat 1, sample 0 and ends at the last beat's last sample. For LOOP sequences, the last point and first point are nearby but not identical. Setting `closed = true` on the CatmullRomCurve3 will force a segment from last-to-first, which may produce a visible seam or kink if those points aren't exactly coincident.

**Fix:** Either (a) explicitly close the point array by appending a copy of the first point, ensuring a smooth junction, or (b) set `closed = false` and accept an open tube. Option (a) is better visually — add the closure point in the geometry pipeline, not the calculator.

**I3: `computeVertexNormals()` per frame will produce incorrect normals for tube geometry.**  
`computeVertexNormals()` averages face normals per vertex. For a tube, this produces reasonable but subtly wrong normals at the seam where the radial loop wraps — vertices at the seam share faces from both sides of the wrap, causing a visible lighting artifact. The correct approach is to compute normals analytically from the Frenet frame (normal and binormal are already available from the tube construction). The spec's own text acknowledges this for ribbons ("analytically defined normals... can skip computeVertexNormals") but doesn't apply the same logic to tubes.

**Fix:** For tube geometry, compute normals analytically during the custom vertex update (since you're already computing Frenet frames). Reserve `computeVertexNormals()` as a fallback only.

**I4: The Lathe extrusion method description is geometrically confused.**  
The spec says "treat the path as a 2D profile and revolve it around the Y-axis by one full turn." But `LatheGeometry` revolves a 2D profile (an array of Vector2 points) around a rotation axis. Mandala paths are closed curves in the XY plane — revolving them around Y produces a vase-like shape, not a toroidal surface. The claim that "LOOP sequences are radially symmetric by construction" is approximately true, but the revolution of a nearly-circular path around Y doesn't produce a torus — it produces a sphere-like shell. The description confuses revolution of a profile (LatheGeometry's input) with revolution of a planar path.

**Fix:** Clarify the geometric intent. If the goal is a torus, the correct approach is to use a cross-section profile (small circle) and sweep it along the mandala curve — which is exactly what TubeGeometry already does. If the goal is a surface of revolution, the path needs to be projected to a radial profile first (collapse azimuthal angle, keep only the radial distance vs. height). This method needs more design work.

**I5: No mention of WebGL context limits with dual canvases.**  
Running two WebGL contexts (stage viewer + mandala 3D) on the same page can hit browser limits. Most browsers allow 8-16 simultaneous WebGL contexts. The codebase already has the stage viewer canvas. Adding the mandala 3D canvas is fine in isolation, but if the user has both split panes active (e.g., 3D animation on left, mandala-3d on right), that's 2 GPU contexts. The spec should note that only one of the two Threlte canvases should be live at a time, or implement context loss handling.

### Minor

**M1: The triangle count math is off.**  
The spec says "8 radial segments x 640 tubular x 2 triangles = ~10k triangles per path." Actual count: TubeGeometry generates `tubularSegments * radialSegments * 2` triangles = 640 * 8 * 2 = 10,240. This is correct. However, the spec also says "~640 vertices" per path (64 samples/beat x 10 beats), but `generatePathPoints` uses `samples + 1` per beat (line 473: `for (let i = 0; i <= samples; i++)`). So it's 65 samples per beat, not 64. For 10 beats: 650 points, not 640. Minor discrepancy but worth noting for buffer pre-allocation.

**M2: Morph-target breathing is a simpler alternative not considered.**  
Three.js morph targets would allow pre-computing the geometry at `dx = 0` and `dx = animateMax`, then interpolating with `mesh.morphTargetInfluences[0]`. This avoids all per-frame geometry updates for the radial expansion. The Z-lift and radius pulsing could also be morph targets. The GPU handles the interpolation. The spec doesn't mention this approach, which is more performant and simpler than manual buffer writes.

**M3: The `MANDALA_STANDARD_TIP_DX` is 130, not the 125 mentioned in memory.**  
Memory file `project_mandala_tip_standardization.md` says "dx=125 universal tip" but `mandala-constants.ts:3` has `MANDALA_STANDARD_TIP_DX = 130`. The spec doesn't reference this directly but the calculator uses the constant, so the 3D pipeline will get 130. Not a spec issue, but a data consistency note.

**M4: Video export via `toDataURL()` per frame is slow.**  
The spec proposes `renderer.domElement.toDataURL()` per frame for video export. This is a synchronous readback that stalls the GPU pipeline. For 150 frames at 1080x1080, each readback takes ~5-15ms. The spec's "3-5 seconds" estimate is optimistic. A better approach: use `renderer.domElement.toBlob()` (async), or `readPixels` into a pre-allocated buffer with `WebGL2RenderingContext.readBuffer` + `readPixels` for RGBA data that feeds directly to the h264 encoder without a PNG round-trip.

**M5: Missing `dispose()` pattern for materials.**  
The spec's `MandalaExtruder` class has a `dispose()` for GPU resources but doesn't mention disposing materials. Three.js materials with envMaps (Chrome mode) and transmission maps (Glass mode) hold texture references that need explicit disposal. The spec should specify that `dispose()` also calls `material.dispose()` on all 4 materials plus any generated envMap render targets.

---

## RECOMMENDATIONS

1. **Replace the manual buffer update strategy with morph targets.** Pre-compute geometry at 3-5 key dx values (0, 25%, 50%, 75%, 100% of animateMax). Set them as morph targets. Interpolate via `morphTargetInfluences` each frame. This eliminates the per-frame Frenet frame computation entirely and runs on the GPU. Z-lift can be a separate morph target. Tube radius pulsing is the only axis that truly needs per-frame work (scale the morph targets in a vertex shader uniform).

2. **Add the WebGPU/TSL path as a future note.** The codebase already has `WebGPUCanvas.svelte` and a `terrain-compute-generator.ts` using TSL patterns. For Phase 11, WebGL is fine (40k triangles is trivial). But note that TSL-based procedural tube generation (compute shader that emits tube vertices from curve control points) would eliminate CPU-side geometry updates entirely. This is the 2026 state-of-the-art path for Three.js r182+.

3. **Consider `InstancedMesh` for the 4 tubes.** All 4 tubes share the same geometry topology (same radialSegments, same tubularSegments). An InstancedMesh with per-instance position offsets could reduce draw calls from 4 to 1. The curves differ, so this only works if using morph targets (all instances share the same base geometry but different morph weights). Worth investigating for the Chrome/Glass materials where per-draw-call cost is higher.

4. **Enumerate all ContentType consumers before implementation.** Run `Grep ContentType src/lib/shared/sequence-viewer/` and update every switch/conditional. The spec should contain an exhaustive file list.

5. **Handle sharp corners.** Mandala paths from `static` motion types (hand doesn't move, only prop rotates) produce cusps at the junction between beats. In 2D SVG these appear as sharp bends. In 3D tube geometry, sharp bends cause self-intersection (the tube folds through itself). Mitigate with: (a) `CatmullRomCurve3` tension parameter (the spec's 0.5 helps), (b) a minimum-radius clamp on the tube at high-curvature regions, or (c) smoothing the input points with a moving-average filter before constructing the curve.
