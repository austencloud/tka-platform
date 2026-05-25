# Mandala Phase 9 — Wallpaper / Tessellation Export

## Overview

Phase 9 tiles mandalas in repeating geometric patterns and exports the result as static wallpapers (PNG) or animated loops (MP4). A user picks a tessellation type, configures tile parameters, previews the full pattern at reduced scale, then exports at their chosen resolution and aspect ratio.

Phase 9 depends on Phase 1 only for static export. Animated tessellation benefits from Phase 5 (formations) but is independent — each tile runs its own animation loop offset by a configurable phase delay.

### Goals

- Ship pixel-perfect static wallpapers at 4K without any server-side rendering.
- Ship seamlessly looping animated wallpapers at 1080p via the existing `h264-mp4-encoder` pipeline.
- Add zero runtime cost to the sequence viewer — the entire tessellation system is instantiated only when the export panel is open.

### Non-Goals

- Live-wallpaper platform packaging (`.heic` motion, `.lwp` Android). Deliver the MP4 loop; users install it themselves.
- GIF export. GIFs cap at 256 colors and are typically >10× the file size of equivalent MP4 for this content.
- Per-tile sequence selection (each tile uses the same sequence; color variation only).
- Phase 5 formation integration in Phase 9. Tessellation runs its own lightweight phase-offset system.

---

## Tessellation Patterns

Four tile types. All are classically edge-matching — tiles fit without gaps or overlaps.

### Square Grid

Rows and columns on a regular Cartesian grid. Tile origin at `(col * tileSize, row * tileSize)`. The simplest possible pattern and the best starting point for implementation. Tile count: `ceil(W / tileSize) * ceil(H / tileSize)` with one extra tile on each edge to handle bleed.

### Hexagonal Honeycomb

Offset rows. Even rows start at x=0; odd rows start at x=tileRadius (horizontal hex layout). Vertical spacing = `tileRadius * sqrt(3)`. Each tile is a circle/mandala inscribed in a hexagon cell. This is the most visually distinctive pattern — recommended as the featured preset.

Two sub-variants:
- **Flat-top:** hexagons have flat edges at top and bottom.
- **Pointy-top:** hexagons have vertices at top and bottom (default — aligns better with circular mandalas).

### Triangular

Each row alternates upward-pointing and downward-pointing triangles. Mandala center sits at the centroid of each triangle. Triangles are half the area of a square tile, so the same tileSize produces twice as many tiles. Visual result: dense, high-frequency patterns.

### Brick / Offset

Like square grid but every other row is offset by half a tile width. Classic brick-wall arrangement. Simpler to implement than hex while still breaking the pure grid regularity.

### Tile Parameters

All four patterns share these controls:

| Parameter | Type | Range | Default |
|---|---|---|---|
| `tileSize` | px (in design space) | 80–600 | 220 |
| `spacing` | px gap between tiles | 0–60 | 0 |
| `mandalaScale` | fraction of tile filled | 0.5–1.0 | 0.85 |
| `tileRotation` | base rotation offset (deg) | 0–360 | 0 |
| `rotationJitter` | random ± rotation per tile (deg) | 0–45 | 0 |
| `phaseOffset` | animation delay between tiles (0–1 of cycle) | 0–1 | 0 |
| `phaseMode` | how offsets distribute | enum (see below) | `wave-x` |
| `colorVariant` | per-tile color shift | enum (see below) | `uniform` |

**phaseMode options:**
- `uniform` — all tiles animate in sync.
- `wave-x` — phase increases left → right across columns.
- `wave-y` — phase increases top → bottom across rows.
- `wave-radial` — phase increases from center outward (produces ripple effect).
- `checkerboard` — alternates 0 and 0.5 offset (adjacent tiles are always at opposite points in the breath cycle).
- `random` — each tile gets a seeded random offset (same seed = reproducible pattern).

**colorVariant options:**
- `uniform` — all tiles use the active preset.
- `hue-rotate` — adjacent tiles step +N degrees of hue rotation around the preset colors.
- `alternate` — alternates between two preset selections (first and second from the PRESETS list, or user-defined pair).
- `gradient-x` — color phase shifts linearly from left to right across the composition.
- `gradient-radial` — color phase shifts from center outward.

---

## Export Pipeline

### Static PNG (SVG → Canvas)

High-res PNG skips video encoding entirely. The pipeline:

1. Compute tile layout for target dimensions (aspect ratio + resolution).
2. For each tile, call `calculator.calculate(steps, ..., { dx: tipDxSnapshot })` at a single frozen `tipDx` value (the value at the moment the user clicks export, i.e., the current breath phase of the live preview).
3. Render each mandala to the shared `OffscreenCanvas` via `renderMandalaToCanvas()` with `offsetX/offsetY` positioned per the tessellation layout.
4. Serialize to PNG via `canvas.toBlob('image/png')` at native resolution.

The renderer already supports `offsetX`/`offsetY` in `renderMandalaToCanvas`. The tessellation exporter iterates tile positions and calls this for each tile without creating intermediate per-tile canvases — one shared canvas, many draw calls. This keeps memory flat regardless of tile count.

For very large exports (>4K or high tile density), tiles are rendered in row-batches to avoid blocking the main thread. Each batch is wrapped in a `setTimeout(0)` yield.

**No server round-trips. No Blob storage uploads. Pure client-side.**

### Animated MP4 (Frame Loop)

Extends the existing `handleDownload` logic in `MandalaPane.svelte`:

1. Compute tile layout.
2. For each frame `i` of `totalFrames`:
   a. For each tile `t`, compute its local phase: `localPhase = (globalPhase + tile.phaseOffset) % 1`.
   b. Compute `tipDx` from `localPhase` using the active easing function.
   c. Compute rotation from `localPhase`.
   d. Call `calculator.calculate(...)` with that tile's `tipDx`.
   e. Render tile to the shared canvas at its `offsetX/offsetY`.
3. Capture the full canvas frame and feed to `h264-mp4-encoder`.

Geometry calculation is the bottleneck. A 1080p wallpaper with 16 tiles at 30 fps for 5 seconds = 2,400 geometry calculations. Each `calculate()` call is ~0.5 ms, so total geometry time ≈ 1.2 s — acceptable. At 64 tiles this reaches ~5 s, which is acceptable given the "exporting..." progress indicator.

**Seamless loop requirement:** The animation is inherently seamless because both the breath oscillation (`phase % 1`) and the color phase (`phase % 1`) are periodic. The last frame at `i = totalFrames - 1` produces state equivalent to `i = -1` (one frame before frame 0). MP4 loops cleanly.

### Encoder Reuse

`h264-mp4-encoder` is loaded as a dynamic import (already done in `MandalaPane.svelte`). The tessellation exporter imports and uses the same encoder. No new dependency.

---

## Resolution and Aspect Ratios

### Aspect Ratio Presets

| Name | Ratio | Primary Use |
|---|---|---|
| Phone Portrait | 9:16 | iOS/Android lock screen, home screen |
| Desktop | 16:9 | 1080p, 1440p, 4K monitors |
| Ultrawide | 21:9 | Ultrawide monitors |
| Square | 1:1 | Social media, iPad split-view |
| iPad | 4:3 | iPad portrait wallpaper |
| Phone Landscape | 16:9 | Same as desktop, different intent |

Phone Portrait is the default — it has the most immediate shareable value.

### Resolution Presets

| Label | Pixels | Notes |
|---|---|---|
| 1080p | 1080 × 1920 (portrait) | Fast export, ~2 MB PNG |
| 1440p | 1440 × 2560 | Good for recent Android/iOS |
| 4K | 2160 × 3840 | Maximum quality, ~8 MB PNG |
| Custom | user-entered W×H | Validated: max 4096×4096 |

For animated exports, resolution is capped at 1080p regardless of selection. 4K animated would require per-tile geometry at each frame at full resolution — acceptable for static but impractical for video export with the client-side encoder.

---

## UI and Preview

### Entry Point

A new **"Wallpaper"** button appears in the `MandalaViewerControls` export section, alongside the existing MP4 download. Clicking it opens a `WallpaperExportDrawer` — a full-height right-edge panel that slides in over the controls rail, same pattern as `ExportVideoDrawer` used elsewhere in the viewer.

The existing MP4 download button stays untouched. Wallpaper is additive, not a replacement.

### WallpaperExportDrawer Layout

Five sections in a scrollable panel:

**1. Pattern**
Button group: Square / Hex / Triangular / Brick. Hex is highlighted as default. Below: `tileSize` slider.

**2. Animation**
Toggle button: Static / Animated. Static is default. When Animated is selected, a `phaseMode` selector appears (wave-x default). Wave period slider: how many seconds for one complete wave to travel across the full composition width (1–10 s, default 3 s). This controls the `phaseOffset` spread across tiles — a shorter period means adjacent tiles are more out of phase with each other.

**3. Colors**
`colorVariant` selector (Uniform / Hue Rotate / Alternate / Gradient X / Gradient Radial). When not Uniform, a secondary intensity slider appears (how much variation across the pattern).

**4. Canvas**
Aspect ratio preset buttons. Resolution preset buttons. For animated, resolution is locked to 1080p with an explanatory note.

**5. Export**
A single "Export" button. When exporting, it becomes a progress indicator ("Rendering frame 12 / 150..."). On completion, the browser download is triggered automatically.

### Preview

A scaled-down live preview sits at the top of the drawer above the settings sections. It renders the tessellation pattern at screen resolution (not export resolution) using the same `renderMandalaToCanvas` pipeline. The preview updates reactively as settings change, but is debounced 200 ms to avoid thrashing during slider drags.

Preview dimensions: full drawer width × (drawer width / aspect ratio) — a proportional thumbnail showing the full composition. Maximum preview height: 300 px. If the computed height exceeds 300 px, the preview is letterboxed with `object-fit: contain`.

The preview is always animated (regardless of static/animated export mode) so users can see phase-offset effects in real time before committing to a static export.

---

## Technical Architecture

### New Files

```
src/lib/shared/mandala/
  tessellation/
    tessellation-types.ts          — TessellationConfig, TileDescriptor, PhaseMode, ColorVariant
    tessellation-layout.ts         — computeTileLayout(config, W, H): TileDescriptor[]
    tessellation-exporter.ts       — exportStaticPNG(), exportAnimatedMP4()
    tessellation-preview.ts        — TessellationPreviewRenderer (Canvas 2D, RAF loop)

src/lib/shared/sequence-viewer/components/
  WallpaperExportDrawer.svelte     — full drawer UI, wraps tessellation-exporter
```

### Modified Files

```
src/lib/shared/sequence-viewer/components/
  MandalaViewerControls.svelte     — add "Wallpaper" button to export section
  MandalaPane.svelte               — pass sequence/settings to WallpaperExportDrawer
```

### TessellationConfig

```ts
interface TessellationConfig {
  pattern: "square" | "hex" | "triangular" | "brick";
  hexOrientation?: "flat-top" | "pointy-top";   // hex only
  tileSize: number;         // px in design space
  spacing: number;          // px gap
  mandalaScale: number;     // 0.5–1.0
  tileRotation: number;     // base rotation deg
  rotationJitter: number;   // ± random rotation deg
  phaseOffset: number;      // 0–1, max offset between first and last tile
  phaseMode: PhaseMode;
  colorVariant: ColorVariant;
  colorIntensity: number;   // 0–1, variation amount for non-uniform modes
  animationSeed: number;    // for reproducible random jitter
}
```

### TileDescriptor

```ts
interface TileDescriptor {
  cx: number;              // center x in canvas space
  cy: number;              // center y in canvas space
  size: number;            // rendered mandala size (px)
  rotation: number;        // rotation offset (deg)
  phaseOffset: number;     // animation phase offset (0–1)
  colorPhaseShift: number; // added to the MandalaPane color phase (0–1)
}
```

### computeTileLayout

Pure function. Takes `TessellationConfig`, canvas `width`, canvas `height`. Returns `TileDescriptor[]`. One descriptor per tile including edge-bleed tiles. No side effects. Fully testable in isolation.

Each pattern type has its own layout function called internally:

- `squareLayout(config, W, H)` — integer row/col loop with bleed
- `hexLayout(config, W, H)` — offset row algorithm
- `triangularLayout(config, W, H)` — alternating up/down centroid placement
- `brickLayout(config, W, H)` — square grid with alternating row offset

### tessellation-exporter.ts

```ts
export async function exportStaticPNG(
  steps: StepData[],
  viewerSettings: MandalaViewerSettings,
  config: TessellationConfig,
  resolution: { width: number; height: number },
  onProgress?: (n: number, total: number) => void
): Promise<void>

export async function exportAnimatedMP4(
  steps: StepData[],
  viewerSettings: MandalaViewerSettings,
  config: TessellationConfig,
  resolution: { width: number; height: number },  // capped at 1080p
  fps: number,
  onProgress?: (frame: number, total: number) => void
): Promise<void>
```

`MandalaViewerSettings` is an extracted interface (currently inline in `MandalaPane.svelte`) covering: `pathShape`, `preset`, `colorMode`, `speed`, `depth`, `lineWeight`, `customBlue`, `customRed`.

Both functions manage their own `OffscreenCanvas` (static) or `HTMLCanvasElement` (animated, required by the encoder). Both trigger a browser download on completion. Both clean up all intermediate resources before resolving.

### TessellationPreviewRenderer

Manages a `requestAnimationFrame` loop for the preview pane. Accepts a `canvas: HTMLCanvasElement`, `tiles: TileDescriptor[]`, and the viewer's current animation state. On each frame, iterates tiles and calls `renderMandalaToCanvas` with offset phase. Exposes `start()` / `stop()` / `update(config)`. `update()` recomputes tile layout and triggers a preview re-render.

Debounced config updates (200 ms) are handled in `WallpaperExportDrawer.svelte`, not in the renderer itself — keeps the renderer stateless regarding debounce logic.

### Geometry Calculation Sharing

For animated export, geometry for tile `t` at frame `i` depends on `(steps, tipDx_t_i, pathOptions)`. Multiple tiles at the same `localPhase` (e.g., in `uniform` mode) produce identical geometry. The exporter caches `Map<string, MandalaPaths>` keyed by `tipDx.toFixed(1)` within a single frame. In `uniform` mode this reduces N tile calculations to 1. In `wave-x` mode with 8 columns, it reduces to at most 8 unique geometries per frame.

### MandalaViewerSettings Extraction

Before building `WallpaperExportDrawer`, extract `MandalaViewerSettings` as a shared interface from `MandalaPane.svelte`. This lets the drawer receive all the mandala styling context it needs via props without reaching into parent state.

---

## What Is Not In Scope

- Phase 5 formation integration — each tile is an independent single mandala.
- Per-tile sequence assignment — all tiles use the same sequence.
- GIF export — MP4 supersedes it for quality-to-filesize ratio.
- 4K animated export — client-side encoder makes this impractical.
- Server-side rendering or cloud jobs.
- Live wallpaper platform packaging (`.heic`, `.lwp`).
- Saving tessellation configs to user preferences or Firebase — local state only in Phase 9.
- Trails (Phase 2) integration in tessellation preview — trails per tile would be visually chaotic and would require per-tile offscreen history buffers.
