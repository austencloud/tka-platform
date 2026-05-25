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

### Radial expansion (primary)
The `tipDx` parameter drives the geometry update exactly as it does in 2D: each frame, call `calculator.calculatePoints()` with the current `tipDx`, get updated `MandalaPoint[][]`, rebuild `CatmullRomCurve3` objects, update geometry.

**Performance concern:** Rebuilding `TubeGeometry` or the ribbon `BufferGeometry` every frame for 4 paths is the core perf challenge. Strategy: pre-allocate geometry with the maximum vertex count (at `animateMax` dx), then update vertex positions via `BufferAttribute.needsUpdate = true` rather than creating new geometry objects. `TubeGeometry` buffers are accessible as `position`, `normal`, `uv` `BufferAttribute` instances — update `position` in-place.

### Z-axis elevation (secondary)
During the inhale phase, paths also rise off the XY plane. Each vertex gets a Z offset:

```
zOffset = sin(phase * π) * maxZLift * (distFromCenter / maxRadius)
```

Where `distFromCenter` is the vertex's XY distance from origin, normalized 0–1. This makes the outer edges of the mandala lift higher than the center — like a flower opening toward the viewer.

`maxZLift` = 0.4 world units. This is additive to the base Z position (0).

### Tube radius / ribbon width pulsing (tertiary)
During the inhale, tube radius and ribbon width expand slightly:  
`currentRadius = baseRadius * (1 + 0.3 * breathPhase)`  
This gives the paths a sense of pressure — they thicken as the mandala expands.

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
`MeshPhysicalMaterial` with `transmission = 1`, `thickness = 0.3`, `roughness = 0`, `ior = 1.5`, `transparent = true`. Requires `renderer.physicallyCorrectLights = true`. The path becomes a refractive glass tube — slightly distorts whatever is behind it. Appearance: crystal mandala. More expensive to render (~2x) but visually spectacular. Gate behind quality check.

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

Uses the existing `ScenePostProcessing.svelte` infrastructure but with a dedicated configuration for the mandala scene — lighter than the ocean pipeline:

- **Bloom** — `BloomEffect`, `intensity = 2.0`, `luminanceThreshold = 0.3`, `radius = 0.8`, `levels = 8`. Bloom is the primary visual differentiator for Neon mode. Threshold is lower than the stage scene (0.3 vs 0.4) because the emissive-only geometry has precise bright pixels rather than broad environmental brightness.
- **Vignette** — `VignetteEffect`, `darkness = 0.7`, `offset = 0.3`. Darker than stage (0.5) because the background is pure black and the vignette blends to it.
- **No chromatic aberration** — too distracting at close camera distances on geometric shapes.
- **No god rays** — no light sources that qualify.

Glass material requires `renderer.outputColorSpace = THREE.SRGBColorSpace` and a `PMREMGenerator`-backed `envMap`. These are already true in the Threlte canvas defaults.

---

## Performance Strategy

### Target

60fps at 4 paths × ~640 vertices each (64 samples/beat × 10 beats, typical mandala) = ~2560 total vertices before extrusion. After TubeGeometry (8 radial segments × 640 tubular × 2 triangles = ~10k triangles per path, ~40k total) — lightweight by modern standards. The bottleneck is not vertex count.

### The real bottleneck: per-frame geometry updates

Naively creating new `TubeGeometry` every frame costs GC pressure. Solution: morphable geometry.

Pre-allocate geometry at initialization with vertex count matching `MAX_SAMPLES * radialSegments`. On each breath frame, update only the `position` buffer attribute in place:

```typescript
const posAttr = geometry.getAttribute('position') as BufferAttribute;
// overwrite Float32Array values directly:
for (let i = 0; i < vertexCount; i++) {
  posAttr.setXYZ(i, newX, newY, newZ);
}
posAttr.needsUpdate = true;
geometry.computeVertexNormals(); // required for lighting in non-Neon modes
```

Normal recomputation (`computeVertexNormals`) is the one non-trivial step — it iterates triangles to average face normals. For 10k triangles this runs in < 0.5ms. In Neon mode (no lighting), skip normal recomputation entirely.

Frame budget allocation (target 60fps = 16.67ms):
- Physics/animation state: ~0.5ms
- Point recomputation (calculator): ~1ms (64 samples × 4 paths)
- Vertex buffer writes: ~0.5ms
- Normal recomputation (Chrome/Glass only): ~2ms
- Three.js render + postprocessing: ~8ms
- Overhead/reserve: ~4ms

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
  Mandala3DScene.svelte       — Threlte scene: geometry, lights, camera, post-processing
  Mandala3DControls.svelte    — right-rail settings panel
```

### Modified files

```
src/lib/shared/mandala/services/implementations/MandalaGeometryCalculator.ts
  — add calculatePoints(): MandalaPaths3D method

src/lib/shared/mandala/services/contracts/types.ts
  — add MandalaPaths3D interface

src/lib/shared/sequence-viewer/...
  — add "mandala-3d" to ContentType union + pane routing
  — add Mandala3DPane to content type selector
```

### MandalaExtruder interface

```typescript
// Stateful service — holds pre-allocated geometry objects
class MandalaExtruder {
  constructor(method: ExtrusionMethod, quality: ExtruderQuality) {}

  // First call allocates geometry; subsequent calls update in place
  updateGeometry(paths: MandalaPaths3D, breathPhase: number): void;

  // Access pre-allocated Three.js meshes for scene mounting
  readonly meshes: { blue: Mesh[], red: Mesh[] };

  // Release GPU resources
  dispose(): void;
}
```

The `Mandala3DScene.svelte` component owns a single `MandalaExtruder` instance, creates it on mount, calls `updateGeometry` in the `useTask` loop, and calls `dispose` on `onDestroy`.

### Geometry update loop

```typescript
// Inside useTask in Mandala3DScene.svelte
useTask((delta) => {
  // Advance breath phase (same triangle wave + easing as 2D pane)
  breathTime += delta;
  const cyclePos = (breathTime % period) / period;
  const triangle = cyclePos < 0.5 ? cyclePos * 2 : 2 - cyclePos * 2;
  const breathPhase = breatheEase(triangle);
  const currentDx = animateMax * breathPhase;

  // Recompute paths for current dx
  const paths3d = calculator.calculatePoints(
    sequence.steps, bluePropType, redPropType, pathOptions, { dx: currentDx, dy: 0 }
  );

  // Update geometry in place
  extruder.updateGeometry(paths3d, breathPhase);

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

## Spec Notes

- `MandalaExtruder` holds pre-allocated `BufferGeometry` objects — callers must not create new geometries per frame.
- Glass material's `transmission` requires `WebGLRenderer` with `logarithmicDepthBuffer = false` (Threlte default). Verify at runtime; fall back to Chrome if transmission is unsupported.
- `computeVertexNormals()` on every frame is acceptable for Tube geometry (no texture seams). Ribbon geometry has analytically defined normals (always [0,0,1] for the flat ribbon) — can skip `computeVertexNormals` and set normal attribute directly.
- The 3D canvas uses a separate `<Canvas>` element from the stage viewer. Do not attempt to share a renderer or WebGL context between them.
- The `Lathe` extrusion method is visually experimental — it only makes geometric sense for paths that are roughly radially symmetric. Surface this as an "Experimental" badge in the UI. LOOP sequences are radially symmetric by construction so this will always produce valid geometry.
- Z-lift during breathing means the mandala clips through a hypothetical floor plane. There is no floor in this scene — pure void with radial gradient skybox.
