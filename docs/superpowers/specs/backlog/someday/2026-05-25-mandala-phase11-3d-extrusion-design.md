# Mandala Phase 11: 3D Extrusion — Design Spec

**Status:** Design  
**Date:** 2026-05-25  
**Phase:** 11 of 11 in the mandala roadmap  
**Tier:** Premium (Scribe)

---

## Overview

The 2D breathing mandala becomes a sculptural 3D object. Prop tip paths — currently rendered as SVG strokes — are extruded into physical geometry: tubes and ribbons that occupy 3D space. Users orbit around the mandala with the camera while it continues to breathe, expanding and contracting in all three dimensions simultaneously.

This is the flagship tier of the mandala system. The visual vocabulary shifts from "glowing diagram" to "sacred geometry object." The goal is the sensation of looking at something that was carved rather than drawn.

The feature lives as a dedicated `Mandala3DPane` — a peer to `MandalaPane` — within the sequence viewer content type system. It does not replace the 2D pane; it coexists as a separate tab.

---

## Architecture Context

### What exists today

`MandalaGeometryCalculator` computes `MandalaPaths`: arrays of `SVGPathData` objects (one per prop tip), each containing a `d`-attribute string built from Catmull-Rom splines over sampled `MandalaPoint[]` arrays. The `d` string is an SVG M/C sequence; the underlying `MandalaPoint[]` is computed but not exposed directly.

The calculator returns `{ blue: SVGPathData[], red: SVGPathData[] }` — typically 2 paths per hand (one per tip), 4 total paths for a full mandala.

The 3D pipeline is Threlte (Svelte wrapper for Three.js). `OrbitControls.svelte` wraps `camera-controls` by yomotsu and is already used across the codebase. `ScenePostProcessing.svelte` provides the `postprocessing` package pipeline with `BloomEffect`, `ChromaticAberrationEffect`, `VignetteEffect`. `BloomEffect.svelte` wraps the component API.

### What this feature adds

1. `MandalaGeometryCalculator` exposes raw `MandalaPoint[]` data (not just SVG strings) — a new method that returns the point arrays directly so the 3D pipeline can consume them without re-parsing SVG.
2. A `Mandala3DExtruder` service converts `MandalaPoint[]` into Three.js `CatmullRomCurve3` → `TubeGeometry` or `BufferGeometry`-based ribbon.
3. A `Mandala3DScene.svelte` Threlte component renders the extruded geometry with materials, lighting, and orbit controls.
4. A `Mandala3DPane.svelte` wrapper slots into the sequence viewer alongside `MandalaPane`.

---

## Geometry Pipeline

### Step 1 — Expose raw point data from the calculator

`MandalaGeometryCalculator` currently returns only SVG `d` strings. Add a `calculatePoints()` method (or extend `calculate()` return type) that also returns the raw `MandalaPoint[][]` arrays — one array per path, before SVG serialization.

```typescript
interface MandalaPaths3D {
  blue: MandalaPoint[][];   // [pathIndex][sampleIndex]
  red: MandalaPoint[][];
}
```

The calculator already has the arrays in `bluePointSets` / `redPointSets` — this is exposing them, not recomputing them. Cache key remains unchanged. The existing `MandalaPaths` return type is preserved for all 2D callers.

The `tipDx` override path (used for animation) passes through the same way: caller provides `{ dx: currentDx, dy: 0 }` and gets back the point arrays for that breath frame.

### Step 2 — 2D to 3D coordinate mapping

The mandala coordinate space has:
- Center at origin `(0, 0)` in SVG space
- Grid radius `MANDALA_GRID_RADIUS = 80` in mandala units
- Max extent ~175 units (grid radius + tip reach at max dx)

Map to Three.js world space: `threeX = point.x / 80`, `threeY = -point.y / 80`, `threeZ = 0` — dividing by the grid radius normalizes to unit scale. This places the mandala in a roughly 2-unit-radius disc (−2 to +2 on X/Y), fitting comfortably in a scene with no environment (clean void).

The minus-Y is required because SVG Y increases downward while Three.js Y increases upward.

### Step 3 — CatmullRomCurve3

For each `MandalaPoint[]` array, construct a `CatmullRomCurve3` from the mapped Vector3 array. Set `closed = true` because LOOP sequences have continuous paths. Set `curveType = "catmullrom"` with `tension = 0.5`.

The existing `MandalaGeometryCalculator` already samples the paths densely (64 samples per beat, adaptive for high-turn motions). The 3D curve does not need to resample — use the full point array directly as curve control points. This matches the existing visual fidelity.

### Step 4 — Extrusion methods

Three methods, selectable per session:

**Tube (default)**  
`TubeGeometry(curve, tubularSegments, radius, radialSegments, closed)` — wraps a circular cross-section along the path. Smooth, volumetric, jewelry-like.  
- `tubularSegments`: match point count (one per sample point)  
- `radius`: 0.015 world units at rest, scales with breath  
- `radialSegments`: 8 (lower = faster; 8 gives a satisfying faceted surface)  
- `closed`: true

**Ribbon**  
Custom `BufferGeometry`. For each consecutive pair of path points, emit two vertices offset perpendicular to the path tangent: `point ± (tangent × up) * halfWidth`. Results in a flat strip lying in the plane of the mandala. Visually closer to the 2D stroke — a 3D version of the SVG line.  
- `halfWidth`: 0.02 world units at rest  
- Normal direction: `(tangent × Z_AXIS).normalize()` — ribbon lies in XY plane  
- UV layout: U along the path (0→1), V across the width (0→1)

**Lathe**  
For each path, treat the path as a 2D profile and revolve it around the Y-axis by one full turn. Produces a surface of revolution — the path describes a rotationally symmetric shell. Only works well for paths that are roughly circular (all LOOP sequences qualify because prop paths orbit the center). Produces the most alien, toroidal geometry.  
- `segments`: 64 (revolution steps)  
- Profile points: the 2D mandala points projected onto the XZ plane of a half-revolution

The active method is a UI toggle. Default is Tube.

---

## Animation System — 3D Breathing

The 2D undulation oscillates `tipDx` between 0 and `animateMax` on an easing curve. In 3D this maps to three simultaneous modulations:

### Radial expansion (primary) — morph target approach

The `tipDx` parameter drives the geometry update. Naively rebuilding `TubeGeometry` every frame requires recomputing the Frenet frame at every tubular segment for every ring vertex — this is the entire TubeGeometry construction algorithm in ~60 lines of math, not a trivial buffer write. Instead, use Three.js native morph targets:

**Pre-computation at initialization:**  
Call `calculator.calculatePoints()` at 6 evenly-spaced `dx` keyframes across the breath range (e.g., `dx = [0, animateMax*0.2, animateMax*0.4, animateMax*0.6, animateMax*0.8, animateMax]`). For each keyframe, build a `TubeGeometry` from the resulting `CatmullRomCurve3`. The keyframe geometries become morph targets on the base mesh. Cap at 6 — see texture budget note in Performance Strategy.

```typescript
// Initialization (once)
const keyframeDx = Array.from({ length: 6 }, (_, i) => animateMax * (i / 5));
const baseGeometry = buildTubeGeometry(calculator.calculatePoints(..., { dx: 0 }));
baseGeometry.morphAttributes.position = keyframeDx.map(dx => {
  const kfGeo = buildTubeGeometry(calculator.calculatePoints(..., { dx }));
  return kfGeo.getAttribute('position') as BufferAttribute;
});

mesh.morphTargetInfluences = new Array(keyframeDx.length).fill(0);
mesh.morphTargetDictionary = Object.fromEntries(keyframeDx.map((_, i) => [`kf${i}`, i]));
```

> **Threlte mount timing caveat:** `mesh.morphTargetInfluences` must be set AFTER the mesh is added to the scene graph. Threlte's reconciliation pass processes `morphAttributes` during the first render, and any influences set before mount risk being overwritten. The safe pattern: `MandalaExtruder.initialize()` adds meshes to the scene via `scene.current.add(mesh)`, then `setBreathPhase()` is only ever called from `useTask` (which runs post-mount) or a `$effect` guarded by an `onMount` flag. Do not call `setBreathPhase()` synchronously during `initialize()`.

**Per-frame animation (GPU-side):**  
Each breath frame, compute which two keyframes straddle the current `breathPhase` and set their influences to blend between them. All other influences are zero.

```typescript
// Inside useTask — no geometry rebuild, no CPU Frenet math
const normalizedPhase = breathPhase; // 0→1
const kfFloat = normalizedPhase * (keyframeDx.length - 1);
const kfLow = Math.floor(kfFloat);
const kfHigh = Math.min(kfLow + 1, keyframeDx.length - 1);
const t = kfFloat - kfLow;

mesh.morphTargetInfluences!.fill(0);
mesh.morphTargetInfluences![kfLow] = 1 - t;
mesh.morphTargetInfluences![kfHigh] = t;
```

The GPU interpolates vertex positions between keyframes entirely on-chip. No `BufferAttribute.needsUpdate`, no `computeVertexNormals()` per frame (morph target normals can be pre-baked into `morphAttributes.normal` at the same keyframes).

### Z-axis elevation (secondary) — morph target

Z-lift is a second independent morph target layered on top of the radial expansion. Pre-compute a single Z-lifted geometry at `breathPhase = 1` where each vertex receives:

```
zOffset = sin(phase * π) * maxZLift * (distFromCenter / maxRadius)
```

Where `distFromCenter` is the vertex's XY distance from origin, normalized 0–1. This makes the outer edges lift higher than the center — like a flower opening toward the viewer. `maxZLift` = 0.4 world units.

Store the Z-lift offsets as a dedicated morph target (index `keyframeDx.length`). Its influence tracks `breathPhase` directly:
```typescript
mesh.morphTargetInfluences![zLiftIndex] = breathPhase;
```

### Tube radius / ribbon width pulsing (tertiary)

During the inhale, tube radius expands via a uniform rather than geometry: pass `breathPhase` as a `userData` float and drive it in a `onBeforeRender` callback or a lightweight custom `ShaderMaterial` layer. Alternatively, bake the radius swell into the morph target keyframes (larger tube radius at higher dx keyframes) so the GPU handles it automatically.  
`currentRadius = baseRadius * (1 + 0.3 * breathPhase)`

All three modulations share the same easing function and period as the 2D pane (breathe easing, 5s default period). They are synchronized to a single `breathPhase` value (0→1 per half-cycle) driven by `useTask`.

---

## Materials and Lighting

### Material system

Three material presets, matching the premium aesthetic vocabulary:

**Neon (default)**  
`MeshStandardMaterial` with `emissive` color set to the path color and `emissiveIntensity = 1.5`. `color = black`. `metalness = 0`, `roughness = 1`. The material glows from within — no external light needed, but bloom in the post-processing pipeline amplifies the emissive output. Appearance: the SVG neon-on-black look translated to 3D.

**Chrome**  
`MeshStandardMaterial` with `metalness = 1`, `roughness = 0.08`, `envMapIntensity = 1`. Requires an environment map for reflections. Use `THREE.PMREMGenerator` to bake the scene's dark environment into a CubeRenderTarget. Color matches the path color but is visible only as reflection tint. Appearance: brushed-metal sacred geometry.

**Glass**  
`MeshPhysicalMaterial` with `transmission = 1`, `thickness = 0.3`, `roughness = 0`, `ior = 1.5`, `transparent = true`. The path becomes a refractive glass tube — slightly distorts whatever is behind it. Appearance: crystal mandala. More expensive to render (~2x) but visually spectacular. Gate behind quality check.

> Note: `renderer.physicallyCorrectLights` was removed in Three.js r155. As of r182 (this project's version), physically correct light decay is the default behavior — no renderer flag is needed. `MeshPhysicalMaterial` transmission works out of the box.

Color morphing works for all three: every frame during Flow mode, update `material.color` and `material.emissiveColor` via the same palette interpolation used by `MandalaPane`. Materials are shared per path group (one material per path, 4 materials total) rather than per vertex.

### Lighting rig

All three material modes use the same light rig:

1. **Ambient** — `AmbientLight`, intensity 0.05, color white. Prevents total blackness in shadowed areas.
2. **Key light** — `PointLight` at `[0, 2, 2]`, color `#ffffff`, intensity 1.5, distance 8. Positioned above and in front of the mandala at camera side.
3. **Rim light** — `PointLight` at `[0, -1, -3]`, color matching the dominant palette color, intensity 0.8, distance 6. Behind the mandala, creates edge separation.
4. **Fill light** — `PointLight` at `[2, 0, 1]`, color complementary to rim, intensity 0.4, distance 5. Prevents flat shadows on the camera-facing side.

In Neon mode, lights 2–4 have minimal perceptual effect because emissive dominates. In Chrome and Glass modes, the lighting rig becomes the primary visual driver.

All lights are parented to the scene root, not the mandala mesh. They do not orbit or breathe.

---

## Camera

### Initial placement

On mount, the camera is positioned at `[0, 0, 4]` looking at `[0, 0, 0]`. This gives a full view of the mandala disc (diameter ~4 world units, camera 4 units away → comfortable framing).

### Orbit controls

Uses the existing `OrbitControls.svelte` component (camera-controls library). Configuration for the mandala scene:

- `minDistance = 1.5` — can't clip through the mandala
- `maxDistance = 10` — can pull back to see full context
- `minPolarAngle = 0` — can go to top-down view
- `maxPolarAngle = Math.PI` — can go underneath
- `enablePan = false` — mandala is always centered; no reason to truck
- `autoRotate = false` by default; user toggles this
- `smoothTime = 0.12` — slightly smoother than the stage viewer

### Auto-orbit

Toggle in the controls panel. When enabled: `autoRotate = true`, `autoRotateSpeed = 0.5` (about 9°/s, one revolution per 40s). The mandala continues to breathe while orbiting. This is the "ambient mode" — user sets it and walks away.

### Preset camera positions

Three buttons in the controls panel:

- **Front** — `setLookAt(0, 0, 4, 0, 0, 0)` — face-on, flat like the 2D view
- **Diagonal** — `setLookAt(2.5, 2, 3, 0, 0, 0)` — classic 3/4 view showing depth
- **Top** — `setLookAt(0, 5, 0.1, 0, 0, 0)` — directly above (slight Z offset prevents gimbal)

All transitions use `enableTransition = true` (camera-controls animated lerp, ~0.4s).

---

## Post-Processing

The mandala scene requires its own `Mandala3DPostProcessing.svelte` component. **Do not reuse `ScenePostProcessing.svelte`** — that component is ocean-gated: it only activates when `backgroundType === BackgroundType.OCEAN` and will not fire for the mandala canvas at all.

`Mandala3DPostProcessing.svelte` uses pmndrs/postprocessing (`EffectComposer`) directly, identical pattern to `ScenePostProcessing.svelte` but without ocean-specific effects:

- **Bloom** — `BloomEffect`, `intensity = 2.0`, `luminanceThreshold = 0.3`, `radius = 0.8`, `levels = 8`, `mipmapBlur: true`. Bloom is the primary visual differentiator for Neon mode. Threshold is lower than the stage scene (0.3 vs 0.4) because the emissive-only geometry has precise bright pixels rather than broad environmental brightness.
- **Vignette** — `VignetteEffect`, `darkness = 0.7`, `offset = 0.3`. Darker than stage (0.5) because the background is pure black and the vignette blends to it.
- **No chromatic aberration** — too distracting at close camera distances on geometric shapes.
- **No god rays** — no light sources that qualify.

### WebGPU post-processing divergence

pmndrs/postprocessing (`EffectComposer`) is WebGL-only and has no WebGPU migration path. Three.js r183 introduced `RenderPipeline` as the WebGPU-native post-processing system — a node-based pipeline built on TSL with automatic WebGL2 fallback. `bloom()` and vignette are first-class TSL nodes in `RenderPipeline`.

The project already has `WebGPUCanvas.svelte`. **For Phase 11 initial implementation: use pmndrs/postprocessing (WebGL2).** This is proven and already in `package.json`. When the project migrates its primary renderer to WebGPU, replace `Mandala3DPostProcessing.svelte` with a `RenderPipeline`-based equivalent — the bloom parameters (intensity, threshold) translate directly to TSL node equivalents.

Glass material requires `renderer.outputColorSpace = THREE.SRGBColorSpace` and a `PMREMGenerator`-backed `envMap`. These are already true in the Threlte canvas defaults.

---

## Performance Strategy

### Target

60fps at 4 paths × ~640 vertices each (64 samples/beat × 10 beats, typical mandala) = ~2560 total vertices before extrusion. After TubeGeometry (8 radial segments × 640 tubular × 2 triangles = ~10k triangles per path, ~40k total) — lightweight by modern standards. The bottleneck is not vertex count.

### The real bottleneck: per-frame geometry updates — solved by morph targets

Naively creating new `TubeGeometry` every frame costs GC pressure. Updating vertices in-place requires reimplementing the full TubeGeometry construction algorithm (Frenet frame computation at every tubular segment — ~60 lines of math per path per frame). Both approaches are bypassed by the morph target strategy described in the Animation System section above.

With morph targets, per-frame CPU work is:
- Advance `breathPhase` scalar: < 0.1ms
- Set 2 non-zero `morphTargetInfluences` entries per mesh: < 0.1ms
- GPU interpolates all vertex positions and normals between keyframes: 0ms CPU

The one-time initialization cost (building 6 `TubeGeometry` keyframes for each of 4 paths = 24 geometry builds) runs on mount and is not on the render-loop critical path.

### Morph target texture budget

Three.js stores morph target data as `DataTexture` rows internally since r143+. The budget for Phase 11:

- 6 keyframes × 2 attributes (position + normal) × 4 meshes = **48 DataTextures** at initialization
- Each texture is `(vertexCount × 1)` RGBA32F — at 650 vertices per path, trivially small per texture
- The project already hits texture unit warnings at r182 (see GitHub issue linked from forum)

**Guard required on mount:**

```typescript
onMount(() => {
  const { renderer } = useThrelte();
  const maxTex = renderer.capabilities.maxTextures;
  // 48 morph textures + scene textures (envMap, etc.) — verify headroom
  if (maxTex < 64) {
    console.warn(`[Mandala3D] maxTextures=${maxTex}; capping keyframes to avoid texture unit overflow`);
    // Reduce to 4 keyframes × 2 × 4 = 32 textures
  }
});
```

Cap morph keyframes at 6 per mesh (not 7–8). This keeps the morph texture total at 48 — well under the universal WebGL2 minimum of 96 texture units, with headroom for scene textures.

Frame budget allocation (target 60fps = 16.67ms):
- Animation state + morph weight update: ~0.2ms
- Three.js render + postprocessing: ~8ms
- Overhead/reserve: ~8ms

### LOD for complex mandalas

If `totalSteps > 16` (high-beat-count sequences), reduce `BASE_SAMPLES_PER_BEAT` for the 3D path to 32 (vs 64 for 2D). The 3D geometry is forgiving of slightly lower sample density because the tube shape smooths over gaps that would be visible in an SVG stroke.

### Mobile/low-end fallback

Detect on mount via `renderer.capabilities.maxVertexUniforms` or GPU tier heuristic:
- High tier: Glass material available, all 4 paths, 8 radial segments
- Mid tier: Chrome available, all 4 paths, 6 radial segments  
- Low tier: Neon only, 4 paths, 4 radial segments (square tube cross-section, still acceptable)

Tier detection uses the existing `detectOceanQuality` pattern (adapted for this scene).

---

## Scene Integration

### Not a background scene

The 3D mandala is not a member of the `BackgroundType` enum and does not appear in the scene picker alongside Forest, Ocean, Cosmic, etc. It is a standalone viewer mode with its own Threlte canvas, separate from the stage viewer canvas.

**Why separate canvas:** The stage viewer's canvas renders the performing avatar with all its effects. Mounting the mandala object into the stage canvas would require:
- A coordinate system that coexists with performer positions
- Disabling or reparenting the camera controller
- Post-processing conflicts (stage bloom vs mandala bloom)

A dedicated canvas avoids all of this and keeps the systems independent. Two canvases on the same page is fine; Threlte handles multiple instances.

### Mandala3DPane placement

In the sequence viewer, the pane content type system already switches between components (3D viewer, 2D timeline, mandala). Add `"mandala-3d"` as a `ContentType`. The tab label is "3D" and sits next to the "Mandala" tab.

```
MandalaPane      — existing 2D breathing viewer
Mandala3DPane    — new 3D extrusion viewer
```

`Mandala3DPane` is premium-gated. Users without Scribe tier see a locked state with a preview screenshot and "Upgrade to Scribe" nudge.

### Controls panel

Same right-rail pattern as `MandalaViewerControls`. Contains:

**Shape section**  
- Extrusion type: Tube / Ribbon / Lathe (button group)

**Material section**  
- Material preset: Neon / Chrome / Glass (button group, Glass dimmed on low-tier devices)
- Color mode: mirrors 2D Mandala (Solid / Flow)
- Preset palette: same 6 presets as 2D (Aurora / Neon / Ember / Twilight / Ice / Solar)

**Animation section**  
- Pause/Play
- Speed: 0.5×, 1×, 2×
- Depth (max tipDx): matches 2D control

**Camera section**  
- View: Front / Diagonal / Top (preset buttons)
- Auto-orbit toggle
- Auto-orbit speed: slider 0.1–2× (default 0.5×)

---

## Export

### Screenshot

Button in the controls panel. Calls `renderer.domElement.toDataURL('image/png')` after one rendered frame with `preserveDrawingBuffer: true` on the canvas. Downloads as `mandala-3d-{sequenceName}.png` at the current canvas resolution. Straightforward — no frame encoding required.

### Video recording (Phase 11 scope)

Same `h264-mp4-encoder` pipeline used by `MandalaPane`. For 3D, instead of re-rendering SVG frames to a canvas, capture frames by:

1. Set canvas to export resolution (1080×1080)
2. Render one full breath cycle frame by frame (30fps × period seconds = N frames)
3. Each frame: advance `breathPhase`, update geometry, call `renderer.render()`, call `renderer.domElement.toDataURL()` → decode to RGBA → feed to encoder

This is more expensive than SVG export because Three.js render is synchronous but GPU-bound. Use `renderer.setSize()` to bump to export resolution, render, then restore. On a mid-range machine a 5s × 30fps = 150-frame export takes ~3–5 seconds. Show a progress bar (same pattern as 2D export).

---

## Technical Architecture

### New files

```
src/lib/shared/mandala/services/implementations/
  MandalaExtruder.ts          — point arrays → Three.js geometry
  MandalaExtruderMaterials.ts — material factory (Neon / Chrome / Glass)

src/lib/shared/mandala/services/contracts/
  types3d.ts                  — MandalaPaths3D, ExtrusionMethod, MaterialPreset enums

src/lib/shared/sequence-viewer/components/
  Mandala3DPane.svelte        — top-level pane, canvas + controls layout
  Mandala3DScene.svelte       — Threlte scene: geometry, lights, camera
  Mandala3DControls.svelte    — right-rail settings panel
  Mandala3DPostProcessing.svelte — dedicated EffectComposer for bloom + vignette
                                   (DO NOT reuse ScenePostProcessing.svelte — ocean-gated)
```

### Modified files

```
src/lib/shared/mandala/services/implementations/MandalaGeometryCalculator.ts
  — add calculatePoints(): MandalaPaths3D method

src/lib/shared/mandala/services/contracts/types.ts
  — add MandalaPaths3D interface

src/lib/shared/sequence-viewer/services/viewer-state-persistence.ts
  — ContentType union: add 'mandala-3d' to the type alias (line 1)
  — loadViewerMode() validation: add 'mandala-3d' to the raw === ... chain (line 47)
  — isValidContentType() guard: add value === 'mandala-3d' check (line 90)

src/lib/shared/sequence-viewer/components/PaneContentSelector.svelte
  — options array: add { id: 'mandala-3d', icon: 'fa-cube', label: '3D' } entry (line 13)

src/lib/shared/sequence-viewer/components/ViewerContentRail.svelte
  — allModes array: add { id: 'mandala-3d', icon: 'fa-cube', label: '3D Sculpt' } after the
    existing 'mandala' entry (line 22-29)
  — webgl2 filter: 'mandala-3d' should also be gated behind webgl2Available (same as
    'animation-3d') — add to the filter predicate

src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte
  — Left pane routing: add {:else if splitConfig.leftPane === 'mandala-3d'} branch after the
    'mandala' branch (lines 381-391) — mounts Mandala3DPane
  — Right pane routing: add {:else if splitConfig.rightPane === 'mandala-3d'} branch after the
    'mandala' branch (lines 515+) — mounts Mandala3DPane
  — _3dLeftActive derived: extend to include 'mandala-3d' if it uses a separate canvas that
    needs the same persistent-3d treatment

src/lib/shared/sequence-viewer/state/viewer-state.svelte.ts
  — wants3D derived: add || viewerMode === 'mandala-3d' and the split-pane 'mandala-3d' check
    (lines 59-61) so the canvas mount lifecycle is correct
  — deriveInitialExportContext: 'mandala-3d' should not map to 'animation-export'; it is a
    view mode only — no action needed unless export is in scope for Phase 11

src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte
  — Rail mode handler: add else if (mode === 'mandala-3d') branch alongside the existing
    'mandala' handler (line 445) — calls ctx.viewerState.setViewerMode('mandala-3d')
  — splitConfig prop: include 'mandala-3d' in the viewerMode condition list alongside
    'animation', 'animation-3d', 'mandala' (line 497)
```

> Audit note (C3): The original spec listed only the persistence file and a vague "add to content type selector." The full grep of `ContentType` across `src/lib/shared/sequence-viewer/` reveals 5 components + 2 state files that switch on this union. Missing any one of them will leave the tab unreachable or break mode switching.

### MandalaExtruder interface

```typescript
// Stateful service — holds pre-allocated geometry with morph target keyframes
class MandalaExtruder {
  constructor(method: ExtrusionMethod, quality: ExtruderQuality) {}

  // Called once at mount: computes keyframe geometries and bakes morph targets
  initialize(calculator: MandalaGeometryCalculator, steps: StepData[], options: PathOptions, animateMax: number): void;

  // Called every frame: sets morphTargetInfluences on all 4 meshes (CPU cost ≈ 0)
  setBreathPhase(breathPhase: number): void;

  // Access pre-allocated Three.js meshes for scene mounting
  readonly meshes: { blue: Mesh[], red: Mesh[] };

  // Release GPU resources (geometries, materials, morph targets)
  dispose(): void;
}
```

The `Mandala3DScene.svelte` component owns a single `MandalaExtruder` instance, creates and initializes it on mount, calls `setBreathPhase` in the `useTask` loop, and calls `dispose` on `onDestroy`.

### Geometry update loop

```typescript
// Inside useTask in Mandala3DScene.svelte
useTask((delta) => {
  // Advance breath phase (same triangle wave + easing as 2D pane)
  breathTime += delta;
  const cyclePos = (breathTime % period) / period;
  const triangle = cyclePos < 0.5 ? cyclePos * 2 : 2 - cyclePos * 2;
  const breathPhase = breatheEase(triangle);

  // Update morph target influences — no geometry rebuild, no calculator call
  // calculator.calculatePoints() was called at initialization to pre-bake keyframes
  extruder.setBreathPhase(breathPhase); // sets morphTargetInfluences on all 4 meshes

  // Color update (Flow mode only)
  if (colorMode === 'flow') {
    updateMaterialColors(colorPhase);
  }
});
```

### Svelte 5 reactivity

All animation state (`breathTime`, `breathPhase`, `currentDx`) is local to `useTask` — not Svelte reactive state — because it changes every frame and does not need to trigger DOM updates. Material and geometry changes are applied imperatively to Three.js objects. Only control panel settings (`extrusionMethod`, `materialPreset`, `colorMode`, `preset`, `depth`) are `$state` and trigger `$effect`-based geometry/material rebuilds.

---

## Premium Gating

The `Mandala3DPane` tab is visible to all users but shows a locked overlay to non-Scribe users. The overlay follows the existing premium gate pattern used elsewhere in the app:

- Preview: a static screenshot of a mandala in Chrome material with "3D Sculpt" label
- CTA: "Unlock with Scribe — $10/mo" 
- The Threlte canvas is not mounted when the gate is active (saves GPU resources)

---

## Future Upgrades

These are explicitly **not Phase 11 scope** but are worth tracking before the code is written, as they affect architectural decisions downstream.

### TSL positionNode — eliminate Z-lift morph target

Three.js TSL (Three Shading Language) has been production-ready since r171 and is the 2026-recommended way to customize materials. TSL compiles to GLSL for WebGL and WGSL for WebGPU from the same JavaScript.

TSL's `positionNode` override could replace the Z-lift morph target entirely. Instead of pre-baking a Z-lift geometry and storing it as a morph target (costing 2 DataTextures per mesh × 4 meshes = 8 DataTextures), the offset can be computed analytically per-vertex on the GPU:

```typescript
import { MeshStandardNodeMaterial } from 'three/webgpu'; // works with WebGL via node backend (r175+)
import { positionLocal, vec3, sin, uniform, float } from 'three/tsl';

const breathPhaseUniform = uniform(0.0);
const mat = new MeshStandardNodeMaterial();
// zOffset = sin(breathPhase * PI) * maxZLift * (distFromCenter / maxRadius)
mat.positionNode = positionLocal.add(
  vec3(0, 0, sin(breathPhaseUniform.mul(Math.PI)).mul(0.4).mul(positionLocal.xy.length().div(2.0)))
);
```

Updating the breath phase becomes a single uniform write per frame — no morph target index needed. This saves 8 DataTextures and simplifies the `setBreathPhase()` implementation.

**When to apply:** When the project migrates to WebGPU as primary renderer, or when `THREE.REVISION >= 175` is confirmed in the lockfile and `MeshStandardNodeMaterial` is available without the WebGPU renderer. The standard materials specified for Phase 11 are safe and correct; this is a performance and architecture improvement for a future pass.

### RenderPipeline post-processing (WebGPU)

When `Mandala3DScene.svelte` migrates to `WebGPURenderer`, replace `Mandala3DPostProcessing.svelte` with a `RenderPipeline` equivalent. The bloom parameters map directly:

```typescript
import { bloom } from 'three/tsl';
// intensity=2.0, threshold=0.3 → direct RenderPipeline equivalents
```

`RenderPipeline` also eliminates the `EffectComposer` / `EffectPass` boilerplate and handles tone mapping and color space automatically.

---

## Spec Notes

- `MandalaExtruder` holds pre-allocated `BufferGeometry` objects with baked morph target keyframes — callers must not create new geometries per frame.
- Glass material's `transmission` requires `WebGLRenderer` with `logarithmicDepthBuffer = false` (Threlte default). Verify at runtime; fall back to Chrome if transmission is unsupported.
- Normals are baked into `morphAttributes.normal` alongside `morphAttributes.position` for each keyframe — `computeVertexNormals()` is not called per frame. Ribbon geometry uses analytically defined normals (always [0,0,1]) set once at initialization.
- The 3D canvas uses a separate `<Canvas>` element from the stage viewer. Do not attempt to share a renderer or WebGL context between them.
- The `Lathe` extrusion method is visually experimental — it only makes geometric sense for paths that are roughly radially symmetric. Surface this as an "Experimental" badge in the UI. LOOP sequences are radially symmetric by construction so this will always produce valid geometry.
- Z-lift during breathing means the mandala clips through a hypothetical floor plane. There is no floor in this scene — pure void with radial gradient skybox.
