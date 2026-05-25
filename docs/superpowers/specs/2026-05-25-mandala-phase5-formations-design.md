# Mandala Formations — Phase 5 Design Spec

## Summary

Phase 5 adds a new viewer mode where N mandalas are arranged in geometric formations — ring, grid, spiral, hexagonal — and breathe with configurable phase offsets. A ring of 8 mandalas produces a breathing wave that ripples around the circle. The formation itself rotates and scales independently of the individual mandalas. Phase 5 is self-contained: it lives in a new `FormationPane` that parallels the existing `MandalaPane`, re-using `SequenceMandala`'s animation logic and the Canvas renderer from `mandala-renderer.ts`.

**Phase 5 has three prerequisite fixes that must land before Phase 5a work begins. See the Prerequisites section below.**

---

## Architecture Overview

The existing rendering stack:

- `SequenceMandala.svelte` — single-mandala animated component. Each instance owns its own RAF loop, easing state, and color phase.
- `mandala-renderer.ts` — exports `renderMandalaSVG()` (SVG string) and `renderMandalaToCanvas()` (Canvas 2D). Both are stateless and fast.
- `MandalaGeometryCalculator` — converts sequence steps → `MandalaPaths` at a given `tipDx`. Expensive: allocates new path objects every call.
- `MandalaPane.svelte` — single-mandala viewer with controls rail. The formation viewer follows its pattern.

**Rendering approach: single offscreen canvas, per-frame compositing.**

N SVG elements mounted in the DOM is ruled out. Each `{@html svgString}` triggers a DOM parse, browser layout, and filter evaluation (glow, feather, bloom) per mandala per frame. At N=16 this is 16 × SVG-parse × filter-pass per frame at 60 fps — a guaranteed jank budget bust. SVG works fine for a single mandala; it does not scale to formations.

WebGL instancing is the eventual ceiling for N>50, but it requires re-implementing the entire SVG path renderer in GLSL and is out of scope for Phase 5. The formation use case tops out at N≈32 in practice, and Canvas 2D handles that range cleanly.

**Chosen approach:** one `<canvas>` element for the entire formation. Each frame:
1. Compute each mandala's current `tipDx` and `rotationDeg` from its phase-offset animation state.
2. Call `calculator.calculate(steps, ...)` → `MandalaPaths`.
3. Call `renderMandalaToCanvas(ctx, paths, { offsetX, offsetY, size, ... })` to stamp it at its formation position.
4. The canvas holds the full composite frame.

This matches how `MandalaPane` already does MP4 export — the export loop in `MandalaPane.svelte` uses `renderMandalaSVG` + `svgToCanvas` per frame. Phase 5 adopts Canvas 2D as the primary render path, not just the export path.

**Geometry pre-computation:** `MandalaPaths` at a given `tipDx` are cheap to compute (pure math, no DOM). The bottleneck is N path computations per frame. For N=16 at 60 fps this is ~960 path computations/sec — acceptable on modern hardware. At N=32 it becomes noticeable. The caching strategy: if two mandalas share the same `sequenceId` and `tipDx` (rounded to nearest integer), share the `MandalaPaths` result. In a synchronized formation all mandalas share a `tipDx` — the cache collapses N path computations to 1.

---

## Prerequisites

These three fixes must be merged before any Phase 5a work begins. They correct bugs in the shared canvas renderer that formation rendering depends on.

### P1 — Fix `renderMandalaToCanvas` tipDx scaling (blocks C1)

**File:** `src/lib/shared/mandala/mandala-renderer.ts`, line 235

**Problem:** The canvas renderer hardcodes `MANDALA_STANDARD_TIP_DX` for its scale computation, so when `tipDx` exceeds the standard value the mandala tips are drawn outside the computed bounds and clipped. `renderMandalaSVG` already handles this correctly.

**Fix:** Port the `effectiveTipDx` guard from `renderMandalaSVG`:

```typescript
// Change:
const tipReach = MANDALA_STANDARD_TIP_DX * MANDALA_GRID_RADIUS / ENGINE_GRID_RADIUS;
// To:
const effectiveTipDx = Math.max(options.tipDx ?? MANDALA_STANDARD_TIP_DX, MANDALA_STANDARD_TIP_DX);
const tipReach = effectiveTipDx * MANDALA_GRID_RADIUS / ENGINE_GRID_RADIUS;
```

This benefits the existing `ImageComposer` export path today and is required for formation rendering correctness.

### P2 — Pre-allocate overlap OffscreenCanvas pair (blocks I1)

**File:** `src/lib/shared/mandala/mandala-renderer.ts`, lines 291–292

**Problem:** When `show === "both"` (the default), `renderMandalaToCanvas` allocates two full-canvas-sized `OffscreenCanvas` objects per call for the purple overlap masking. At N=16 on a 1080p canvas this creates 32 × ~4.7MB allocations per frame = ~150MB allocation throughput per frame at 60fps. GC pressure alone causes visible jank before path computation becomes the bottleneck.

**Browser support note:** `OffscreenCanvas` (both the constructor form `new OffscreenCanvas(w, h)` used here for overlap buffers, and `transferControlToOffscreen()` used in Phase 5a for the worker path) requires Safari 16.6+. Safari 16.4 does **not** support it. Before shipping P2, verify the project's `browserslist` config does not target Safari 16.4 — if it targets "last 2 Safari versions" from a 2026 baseline, 16.4 is already out of range and no fallback is needed. If the browserslist does reach 16.4, add a feature-detect fallback that allocates a regular `<canvas>` element instead.

**Fix:** Introduce `OverlapBuffers` — two pre-allocated `OffscreenCanvas` objects owned by the caller, resized only when canvas dimensions change, passed into each `renderMandalaToCanvas` call:

```typescript
interface OverlapBuffers {
  maskA: OffscreenCanvas;
  maskB: OffscreenCanvas;
}

// renderMandalaToCanvas signature gains an optional parameter:
export function renderMandalaToCanvas(
  ctx: CanvasRenderingContext2D,
  paths: MandalaPaths,
  options: RenderMandalaCanvasOptions,
  overlapBuffers?: OverlapBuffers   // ← new; allocates internally if not supplied (backwards-compat)
): void
```

`FormationCanvas` allocates one `OverlapBuffers` instance on mount, resizes it in a reactive statement keyed to canvas dimensions, and passes it on every `renderMandalaToCanvas` call. This eliminates 32 allocations/frame at N=16.

The internal fallback (allocate if not supplied) preserves all existing call sites.

### P3 — Extract `BreathAnimator` interface (required by Phase 6)

**Files:** `src/lib/shared/mandala/SequenceMandala.svelte`, `src/lib/shared/mandala/mandala-easing.ts` (new)

**Problem:** `UndulationEasing`, `MandalaPathShape`, and `MandalaPresetId` are currently exported from `.svelte` component files. Importing types from `.svelte` files is fragile — SvelteKit's module bundler can emit incorrect type declarations when a `.svelte` file is consumed purely for its type exports, and tree-shaking is unreliable across this boundary. Phase 5 (`formation-types.ts`) and Phase 6 (`BreathAnimator`) both need these types cleanly importable from plain `.ts` modules.

**Fix:** Extract to standalone modules before Phase 5a begins:

```
src/lib/shared/mandala/domain/
  mandala-easing.ts      — UndulationEasing enum + easing functions (moved from SequenceMandala.svelte)
  mandala-path-shape.ts  — MandalaPathShape type (moved from SequenceMandala.svelte, or add to mandala-types.ts)
  mandala-presets.ts     — MandalaPresetId + palette lookup (moved from MandalaViewerControls.svelte)
```

Re-export from the `.svelte` files for backwards compatibility. All Phase 5 type definitions then import from the plain `.ts` modules.

**BreathAnimator interface (deliverable for Phase 6):** Once the easing types are in plain `.ts` modules, add the `BreathAnimator` interface to `mandala-easing.ts`:

```typescript
/** Encapsulates per-slot breathing state for a single animation phase.
 *  Phase 6 uses this to drive per-slot speed overrides and trigger-chained breathing. */
export interface BreathAnimator {
  /** Current tipDx given the master time and this slot's phase offset. */
  computeTipDx(masterTime: number, phaseOffset: number): number;
  /** Current rotation in degrees. */
  computeRotationDeg(masterTime: number): number;
  /** The settings driving this animator (serializable). */
  readonly settings: BreathAnimatorSettings;
}

export interface BreathAnimatorSettings {
  period: number;
  animateMin: number;
  animateMax: number;
  easing: UndulationEasing;
  individualRotation: number;  // deg/cycle
}
```

Phase 5's `formation-animation.ts` implements `BreathAnimator` (one instance shared across all slots since speed overrides are deferred). Phase 6 swaps in per-slot `BreathAnimator` instances without touching `FormationCanvas`.

---

## Formation Types

### Ring

N mandalas placed evenly on a circle of radius R.

```
angle_i = (2π / N) × i + startAngle
x_i = cx + R × cos(angle_i)
y_i = cy + R × sin(angle_i)
```

- `N`: 2–24 (default 8)
- `R`: 100–600px in canvas space (default auto-fit to canvas)
- `startAngle`: 0° default (first mandala at 12 o'clock = −π/2)
- Auto-radius: `R = min(canvasW, canvasH) / 2 - mandalaSizeOnCanvas / 2 - padding`

### Grid

M × N rectangular grid with configurable horizontal/vertical spacing.

```
x_i = originX + (i % cols) × (size + gapX)
y_i = originY + floor(i / cols) × (size + gapY)
```

- `cols`: 2–8 (default 3)
- `rows`: 1–8 (default 3), total mandalas = cols × rows
- `gapX`, `gapY`: 0–200px (default 20)
- Grid is centered in canvas.

### Spiral

Logarithmic or Archimedean spiral. Mandalas shrink toward the center.

**Archimedean** (uniform spacing along arm): `r_i = a + b × θ_i`, where `θ_i = i × angularStep`. Simple, predictable, works for N≤16.

**Logarithmic** (exponential spacing): `r_i = a × e^(b × θ_i)`. Produces the nautilus shell look. Mandalas shrink dramatically toward center.

```
θ_i = i × (2π / turnsPerArm) / N
r_i = rMin + (rMax - rMin) × (i / N)    // Archimedean
scale_i = scaleMin + (1 - scaleMin) × (i / N)  // outer = full size, inner = scaleMin
x_i = cx + r_i × cos(θ_i)
y_i = cy + r_i × sin(θ_i)
```

- `turnsPerArm`: 1–4 (default 2)
- `scaleMin`: 0.2–1.0 (default 0.3) — smallest mandala at spiral center
- `spiralType`: `"archimedean"` | `"logarithmic"` (default archimedean)

### Hexagonal

Honeycomb tessellation. Start from a center mandala and add rings.

Ring 0: 1 mandala (center)
Ring 1: 6 mandalas (hexagonal neighbors)
Ring 2: 12 mandalas (second ring)
Ring k: 6k mandalas

Neighbor offsets for a flat-top hex grid with side length S:
```
axial direction vectors × S:
E  = (S, 0)
NE = (S/2, S*√3/2)
NW = (-S/2, S*√3/2)
W  = (-S, 0)
SW = (-S/2, -S*√3/2)
SE = (S/2, -S*√3/2)
```

- `rings`: 0–3 (0=1 mandala, 1=7, 2=19, 3=37)
- `spacing`: hex side length in canvas px (default: mandala diameter × 1.05 — slight overlap)
- Rendering clips to canvas bounds.

### Custom (Phase 6+ extension point)

Freeform drag-to-place. Not in scope for Phase 5 but the `FormationSlot` type is designed to accept arbitrary `{x, y, scale}` so it extends naturally.

---

## Formation Slot Model

Every formation type reduces to an array of `FormationSlot`:

```typescript
interface FormationSlot {
  id: string;               // stable identifier for keying animation state
  x: number;                // canvas position (center of mandala)
  y: number;
  scale: number;            // size multiplier (1.0 = base mandala size)
  phaseOffset: number;      // 0..1, animation phase offset
  sequenceId?: string;      // if null, inherits formation-level sequence
}
```

The formation layout engine is a pure function:

```typescript
function computeFormationLayout(
  config: FormationConfig,
  canvasSize: { width: number; height: number },
  baseMandalaSize: number
): FormationSlot[]
```

This is the only coupling between the layout system and the renderer. Everything downstream works from `FormationSlot[]`.

---

## Phase Offset System

Phase offset controls the breathing animation delay for each mandala relative to the formation's master clock.

**Distribution modes:**

| Mode | Description | Visual effect |
|------|-------------|---------------|
| `sequential` | `phaseOffset_i = i / N` | Wave ripples around formation in slot order |
| `random` | Random [0,1) per slot, seeded for reproducibility | Organic, scattered breathing |
| `synchronized` | All offsets = 0 | All breathe in unison |
| `alternating` | Even slots = 0, odd slots = 0.5 | Checkerboard inhale/exhale |
| `radial` | For ring: offset = angular position / 2π. For grid: offset = normalized distance from center | Wave emanates from center outward |
| `reverse` | `phaseOffset_i = 1 - (i / N)` | Wave travels opposite direction |

**Master clock:** A single formation-level RAF loop tracks `masterTime` (seconds). Each mandala's effective phase:

```
effectivePhase_i = ((masterTime / period) + phaseOffset_i) % 1
```

This keeps all mandalas locked to the same period — they breathe at the same speed, just offset in time. A period change affects all mandalas instantly.

**Individual speed overrides are not in Phase 5.** Each mandala can have a different sequence, palette, and scale, but all share the same period and easing curve. This keeps the wave coherent. Phase-chained breathing with custom trigger points is Phase 6.

---

## Formation-Level Transforms

The formation as a whole supports:

| Transform | Range | Default | Description |
|-----------|-------|---------|-------------|
| `rotation` | 0–360°/cycle | 0 | Formation rotates while mandalas breathe |
| `scale` | 0.5–2.0 | 1.0 | Formation zoom |
| `scalePulse` | 0–0.3 amplitude | 0 | Formation breathes (scale oscillates) |
| `scalePulsePeriod` | 1–30s | links to mandala period | Period of scale pulse |
| `translatePath` | `"none"` \| `"orbit"` \| `"figure8"` | `"none"` | Formation drifts/orbits while running |
| `orbitRadius` | 0–200px | 50 | Radius of orbit path |
| `orbitPeriod` | 2–60s | 20 | Seconds per orbit |

All formation transforms are applied as a CSS `transform` on the canvas container element — not baked into canvas pixels. This lets the GPU handle formation-level motion while the CPU handles mandala-level rendering.

Exception: when exporting to MP4, formation transforms are baked per-frame since canvas export reads pixel data.

---

## Individual Mandala Controls

**Per-slot overrides (in Phase 5):**

| Setting | Scope | Default |
|---------|-------|---------|
| `sequenceId` | Per slot | Formation-level sequence |
| `palette` / `preset` | Per slot | Formation-level palette |
| `pathShape` | Formation-wide | `"arc"` |
| `style` | Formation-wide | `"stroke"` |
| `show` | Formation-wide | `"both"` |
| `strokeWidth` | Formation-wide | 2.5 |

Per-slot sequence assignment enables the primary use case: ring of 8 mandalas, each showing a different letter from a word. The visual difference between sequences is the mandala fingerprint — users see how the motions relate spatially.

Per-slot color presets are a Phase 5 stretch goal (low complexity, high visual impact). Each slot can pull from a different preset, creating a rainbow formation.

---

## Component Structure

```
src/lib/shared/sequence-viewer/components/
  FormationPane.svelte              — full-pane wrapper, owns master RAF loop
  FormationControls.svelte          — right controls rail
  FormationCanvas.svelte            — <canvas> element + hit testing

src/lib/shared/mandala/
  formations/
    formation-layout.ts             — pure layout engine (ring, grid, spiral, hex)
    formation-types.ts              — FormationConfig, FormationSlot, PhaseOffsetMode
    formation-animation.ts          — master clock, per-slot dx/rotation computation
    formation-exporter.ts           — MP4 export for formations
```

`FormationPane` is the entry point. It wires together:
- `FormationControls` → emits `FormationConfig` updates
- `formation-layout.ts` → computes `FormationSlot[]` from config
- `formation-animation.ts` → drives per-slot `tipDx` and `rotationDeg`
- `FormationCanvas` → renders slots to canvas each frame

---

## FormationPane Props

```typescript
interface FormationPaneProps {
  // Primary sequence (used for all slots unless overridden)
  sequence: SequenceData;
  // Optional: supply multiple sequences for multi-slot formations
  sequences?: SequenceData[];
  bluePropType?: string;
  redPropType?: string;
}
```

If `sequences` is supplied and has length >= N, slot i uses `sequences[i % sequences.length]`. This enables the "word as a ring" use case.

---

## Rendering Loop

`FormationPane` owns a single RAF loop:

```typescript
function tick(time: DOMHighResTimeStamp) {
  const masterTime = (time - startTime) / 1000;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Formation-level transform (CSS, not canvas)
  formationRotation = (masterTime / rotationPeriod) * 360;

  // Per-slot render
  for (const slot of slots) {
    const phase = ((masterTime / period) + slot.phaseOffset) % 1;
    const triangle = phase < 0.5 ? phase * 2 : 2 - phase * 2;
    const eased = easeFn(triangle);
    const tipDx = animateMin + (animateMax - animateMin) * eased;
    const slotRotDeg = (masterTime / period) * animateRotation * 360;

    // Cache hit: same sequenceId + same rounded tipDx → reuse MandalaPaths
    const paths = pathsCache.get(slot.sequenceId, Math.round(tipDx))
      ?? calculator.calculate(slot.steps, ..., { dx: tipDx });

    const size = baseMandalaSize * slot.scale;
    renderMandalaToCanvas(ctx, paths, {
      size, style, show, showGridDots: false,
      offsetX: slot.x - size / 2,
      offsetY: slot.y - size / 2,
      transparentBackground: true,
      palette: slot.palette ?? formationPalette,
      strokeWidth,
      tipDx
    });

    // Individual mandala rotation: rotate ctx around slot center
    // Implemented as ctx.save() → translate to slot center → rotate → translate back
  }

  rafId = requestAnimationFrame(tick);
}
```

**Individual mandala rotation**: `renderMandalaToCanvas` renders at `offsetX/offsetY` without rotation. To rotate individual mandalas, wrap the draw call in `ctx.save() / ctx.translate(slot.x, slot.y) / ctx.rotate(slotRotDeg) / ctx.translate(-slot.x, -slot.y)`. This adds two matrix ops per mandala per frame — negligible cost.

**devicePixelRatio handling**: `FormationCanvas` must set canvas physical dimensions at `dpr` × logical size and apply `ctx.scale(dpr, dpr)` once at setup (or on each `clearRect` frame after resetting the transform). All layout math and slot coordinates operate in logical pixels. On retina/HiDPI displays this produces sharp rendering at the native resolution. If the `devicePixelRatio` changes (display moved between monitors), the canvas must be re-sized and `overlapBuffers` re-allocated.

```typescript
// FormationCanvas mount / resize handler:
const dpr = window.devicePixelRatio ?? 1;
canvas.width = logicalWidth * dpr;
canvas.height = logicalHeight * dpr;
ctx.scale(dpr, dpr);
// computeFormationLayout receives { width: logicalWidth, height: logicalHeight }
```

**Canvas coordinate system**: `FormationSlot.x` and `FormationSlot.y` are pixel coordinates in the canvas's logical pixel space (i.e. `canvas.width / devicePixelRatio` × `canvas.height / devicePixelRatio`). `computeFormationLayout` receives `canvasSize` in logical pixels and outputs slots in the same space. On export, pass the export canvas's logical pixel dimensions to `computeFormationLayout` — layout math scales automatically. Do not use normalized [0,1] coordinates; the rendering loop passes `slot.x - size / 2` directly as `offsetX`.

---

## PathsCache

Two-level cache to eliminate both geometry recomputation and SVG-string-to-Path2D re-parsing across frames.

**Level 1 — `FormationPathsCache` (geometry structs):**

```typescript
class FormationPathsCache {
  private map = new Map<string, MandalaPaths>();
  private hitCount = 0;

  get(sequenceId: string, tipDxInt: number): MandalaPaths | null {
    return this.map.get(`${sequenceId}:${tipDxInt}`) ?? null;
  }

  set(sequenceId: string, tipDxInt: number, paths: MandalaPaths): void {
    // Evict all entries for this sequenceId at old dx values
    // (keep cache small — max 1 entry per sequence in synchronized mode)
    this.map.set(`${sequenceId}:${tipDxInt}`, paths);
  }

  clear(): void {
    this.map.clear();
    this.hitCount = 0;
  }
}
```

**Level 2 — `Path2DCache` (parsed Path2D objects):**

```typescript
class Path2DCache {
  private map = new Map<string, Path2D[]>();

  get(sequenceId: string, tipDxInt: number): Path2D[] | null {
    return this.map.get(`${sequenceId}:${tipDxInt}`) ?? null;
  }

  set(sequenceId: string, tipDxInt: number, paths: Path2D[]): void {
    this.map.set(`${sequenceId}:${tipDxInt}`, paths);
  }

  clear(): void {
    this.map.clear();
  }
}
```

`Path2D` objects are reusable — once constructed from an SVG path string, the same object can be passed to `ctx.fill(path2d)` / `ctx.stroke(path2d)` on every subsequent frame without reconstruction. `renderMandalaToCanvas` gains an optional `prebuiltPaths?: Path2D[]` parameter; when supplied, it skips all `new Path2D(d)` construction. The formation render loop populates `Path2DCache` on first use (or on `tipDxInt` change) and passes the cached array on all subsequent frames.

**Why this matters:** At N=16 synchronized mode, Level 1 reduces geometry computation to 1 call/frame. Without Level 2, `renderMandalaToCanvas` still constructs ~50 `Path2D` objects per mandala × 16 mandalas = ~800 `Path2D` constructions/frame from the same cached `MandalaPaths`. With Level 2, synchronized mode drops to ~50 constructions total per `tipDxInt` change — effectively zero at steady state. This gap is especially significant on Firefox, where Path2D parsing from SVG strings is historically slower than V8.

Cache eviction strategy: both caches clear on formation config change (new sequences, new formation type). Within a frame the caches are write-once-read-many — every slot in a synchronized formation reads the same entry written by slot 0.

---

## Performance Budget

Target: 60 fps at N=16. Measured on a mid-range laptop (2024 MacBook Air, Intel i5 equivalent).

| N | Mode | Path computations/frame | Canvas ops/frame | Projected cost |
|---|------|------------------------|-----------------|----------------|
| 8 | synchronized | 1 (cache hit) | 8 | ~1ms |
| 16 | synchronized | 1 (cache hit) | 16 | ~2ms |
| 16 | sequential (all different tipDx) | 16 | 16 | ~6ms |
| 32 | sequential | 32 | 32 | ~12ms |
| 8 | 8 different sequences | 8 | 8 | ~3ms |

Canvas 2D Path2D construction (the `new Path2D(d)` call inside `renderMandalaToCanvas`) is the true bottleneck without caching. Each mandala has ~20–80 paths depending on sequence length. At N=32 sequential mode with no cache: 32 × 50 paths = ~1600 `Path2D` objects per frame at 60fps = 96k/sec. With the Level 2 `Path2DCache` in place, sequential mode retains one construction per unique `sequenceId:tipDxInt` change, and synchronized mode drops to near-zero at steady state. See the PathsCache section for the full two-level cache design.

**Hard performance limit: N ≤ 32.** The UI caps the slot count at 32. For showcase use cases where users want wall-to-wall mandalas, Phase 9 (Wallpaper/Tessellation Export) is the right tool — it renders offline and exports a static image or pre-baked video.

**OffscreenCanvas worker path (Phase 5a):** The render loop (`formation-animation.ts` + `renderMandalaToCanvas`) is DOM-free and stateless, making it worker-compatible with minimal adaptation. `FormationCanvas.svelte` calls `canvas.transferControlToOffscreen()` on mount and posts `FormationSlot[]` + config each frame. The existing `composition.worker.ts` in `src/lib/shared/render/workers/` is the template. This eliminates UI jank during control interactions (period slider, formation type selector, phase mode buttons) at any N — a 6ms frame on the main thread blocks style recalculation during the same frame. This is included in Phase 5a, not deferred.

---

## Controls — FormationControls

Right rail, collapsible sections, same pattern as `MandalaViewerControls`.

### Formation Section (always visible)
- **Type** — button group: Ring / Grid / Spiral / Hex
- **Count** — slider or stepper (per-type range)
- **Phase Mode** — button group: Wave / Sync / Random / Alt / Radial

### Mandala Section (expandable)
- **Path Shape** — Arc / Linear / Concave / Motion Aware
- **Easing** — Breathe (default), Sine, Ease, Soft Elastic, Heartbeat, Drift, Bloom, Tidal
- **Period** — 1–20s
- **Depth** — 0–100 (maps to animateMax)
- **Rotation** — None / 45° / 90° / 180° / 360° (individual mandala rotation per cycle)
- **Line Weight** — 1–6px
- **Color Preset** — Aurora / Neon / Ember / Twilight / Ice / Solar (shared across all slots)
- **Color Mode** — Solid / Flow

### Formation Transforms Section (expandable)
- **Formation Rotation** — None / Slow (30s/cycle) / Medium (10s/cycle) / Fast (5s/cycle)
- **Scale Pulse** — toggle, amplitude slider
- **Translate Path** — None / Orbit / Figure 8

### Ring-Specific (shown when type = Ring)
- **Radius** — auto (default) or manual slider

### Grid-Specific (shown when type = Grid)
- **Columns** — 2–8
- **Gap** — px slider

### Spiral-Specific (shown when type = Spiral)
- **Spiral Type** — Archimedean / Logarithmic
- **Turns** — 1–4
- **Scale Range** — min size of center mandala (0.2–1.0)

### Hex-Specific (shown when type = Hex)
- **Rings** — 0–3 (1/7/19/37 mandalas)
- **Spacing** — tight / normal / loose

### Export Section
- **Download MP4** — exports the full formation animation

---

## Viewer Integration

`FormationPane` is a new `ContentType` in the viewer pane system, parallel to the existing `"mandala"` content type.

```typescript
// viewer-state-persistence.ts
export type ContentType = "sequence" | "mandala" | "formation" | ...
```

`PaneContentSelector` gets a new entry: grid/formation icon, label "Formation". The formation pane activates with sensible defaults when selected — no configuration required to see something interesting.

Default state on first open:
- Formation type: Ring
- Count: 8
- Phase mode: Wave (sequential)
- Uses the viewer's current sequence for all slots
- Color: Aurora / Flow

---

## Multi-Sequence Support

`FormationPane` accepts an optional `sequences` prop (up to N sequences, one per slot). If supplied and `sequences.length >= N`, slot `i` uses `sequences[i % sequences.length]`. This enables word-as-a-ring: caller passes the letter sequences in order and the ring shows each letter's mandala breathing together.

### "Use Deck" feature — Phase 5b

The "Use Deck" toggle requires a deck-fetching layer that does not currently exist in the viewer. The viewer state model (`viewer-state.svelte.ts`) receives a single `SequenceData`; it has no `sequences[]` array or deck context. Building this feature involves the following plumbing — it must be fully scoped before Phase 5b implementation begins:

**Required changes:**
1. `BrowseDeckPage` (or equivalent browse context) threads a `deckSequences: SequenceData[]` prop down to `SequenceViewer`.
2. `SequenceViewer` passes `deckSequences` to `FormationPane` when the pane is active.
3. `FormationPane` exposes a `useDeck` toggle in `FormationControls` that switches slot population from single-sequence-repeated to `deckSequences[i % deckSequences.length]`.

If the viewer is opened standalone (deeplink to a single sequence, not a deck browse session), `deckSequences` is undefined and the "Use Deck" toggle is hidden — formation always uses the single sequence repeated.

**Scope note:** This is not a one-liner. It requires threading a prop through at least two component layers and adding a state flag to `FormationSettings`. Implementation estimate for Phase 5b should budget this explicitly.

**Alternative for Phase 5a:** The `sequences` prop on `FormationPane` is available to any caller that has multiple sequences in hand. No "Use Deck" toggle required for Phase 5a — power users can pass sequences directly. The toggle is purely a UX convenience for the deck-browse context.

---

## MP4 Export

The formation export mirrors the single-mandala export in `MandalaPane.svelte`. Key differences:

- Canvas size: 1920×1080 (landscape) or 1080×1080 (square). User selects.
- Each frame: compute all slot positions scaled to export resolution, render all mandalas, bake formation rotation into canvas transform.
- h264-mp4-encoder pipeline is identical to the existing single-mandala export.
- Export duration: one full formation cycle = one full wave (period × 1 for synchronized, period for sequential, since the wave repeats after 1 period).
- Frame count: `ceil(fps × period)` at 30fps, 1080p. For a 5s period: 150 frames × N path computations. At N=16: 2400 path computations total — fast enough to run in the main thread without a worker.
- **Export DPR pinning:** Export always uses `dpr=1`. Pass `{ width: config.width, height: config.height }` directly to `computeFormationLayout` — do not multiply by `window.devicePixelRatio`. Without this, the export canvas on a retina display would be 3840×2160 / 2160×2160 instead of the intended 1920×1080 / 1080×1080, producing 4× the intended pixel count. The live rendering path uses the actual device DPR for sharp display; the export path always targets nominal pixel dimensions regardless of the display it runs on.

```typescript
// formation-exporter.ts
export async function exportFormationToMp4(
  slots: FormationSlot[],
  sequences: SequenceData[],
  config: FormationExportConfig
): Promise<Blob>
```

Export config:
```typescript
interface FormationExportConfig {
  width: 1080 | 1920;
  height: 1080;
  fps: 30 | 60;
  period: number;         // seconds
  animateMin: number;
  animateMax: number;
  easingFn: (t: number) => number;
  individualRotation: number;  // deg/cycle per mandala
  formationRotation: number;   // deg/cycle for whole formation
  palette: MandalaPalette;           // type from mandala-types.ts (not MandalaColorPaletteConfig — that type does not exist)
  colorMode: "solid" | "flow";
  pathShape: MandalaPathShape;
  style: "stroke" | "filled";
  strokeWidth: number;
  /** Always 1 for export. Never use window.devicePixelRatio here — that would produce 4× pixels on retina. */
  dpr: 1;
}
```

---

## Formation State Model

All formation settings are local component state in `FormationPane`. They are not persisted to Firestore in Phase 5 — that belongs to Phase 3 (Shareable Links), which will need to handle both single-mandala and formation configs via a common `MandalaViewerSettings` discriminated union.

After P3 extraction, `UndulationEasing` and `MandalaPathShape` are imported from `src/lib/shared/mandala/domain/mandala-easing.ts` and `mandala-path-shape.ts`; `MandalaPresetId` from `mandala-presets.ts`. `FormationSettings` composes them into a single serializable config object.

```typescript
// formation-types.ts
// Imports: UndulationEasing from mandala-easing.ts, MandalaPathShape from mandala-path-shape.ts,
//          MandalaPresetId from mandala-presets.ts  (all plain .ts after P3 extraction)

export type FormationType = "ring" | "grid" | "spiral" | "hex";

export type PhaseOffsetMode =
  | "sequential"
  | "synchronized"
  | "random"
  | "alternating"
  | "radial"
  | "reverse";

export interface RingConfig {
  type: "ring";
  count: number;       // 2–24
  radius: number | "auto";
  startAngle: number;  // degrees, default -90 (top)
}

export interface GridConfig {
  type: "grid";
  cols: number;        // 2–8
  rows: number;        // 1–8
  gapX: number;        // px
  gapY: number;        // px
}

export interface SpiralConfig {
  type: "spiral";
  count: number;       // 3–32
  turns: number;       // 1–4
  spiralType: "archimedean" | "logarithmic";
  scaleMin: number;    // 0.2–1.0
}

export interface HexConfig {
  type: "hex";
  rings: number;       // 0–3
  spacing: "tight" | "normal" | "loose";
}

export type FormationConfig = RingConfig | GridConfig | SpiralConfig | HexConfig;

export interface FormationSettings {
  formation: FormationConfig;
  phaseOffsetMode: PhaseOffsetMode;
  phaseSeed: number;               // for random mode reproducibility
  // Mandala-level settings (shared across all slots)
  period: number;
  animateMin: number;
  animateMax: number;
  easing: UndulationEasing;
  individualRotation: number;
  pathShape: MandalaPathShape;
  style: "stroke" | "filled";
  strokeWidth: number;
  colorMode: "solid" | "flow";
  colorPreset: MandalaPresetId;
  // Formation-level transforms
  formationRotationPeriod: number | null;  // null = no rotation
  scalePulse: { enabled: boolean; amplitude: number } | null;
  translatePath: "none" | "orbit" | "figure8";
  orbitRadius: number;
  orbitPeriod: number;
}
```

---

## What Is NOT in Phase 5

- **Per-slot easing overrides** — all slots share the formation easing. Phase-chained breathing (custom trigger points) is Phase 6.
- **Individual slot speed** — all slots share the period.
- **Freeform/drag-to-place custom layout** — `FormationSlot` supports it, UI doesn't.
- **Audio-reactive formation** — Phase 7.
- **Shareable formation links** — Phase 3 extension.
- **Per-slot trails** — Phase 2 trails work on single mandalas; formation trails require compositing N trail buffers and are out of scope.
- **WebGL instancing** — N>32 is a Phase 9 (tessellation) concern.
- **Formation preset library** — Phase 5 ships default state only. Saving named formations is a stretch goal.

---

## Implementation Phases

**Prerequisites (must merge before Phase 5a):**
- P1: Fix `renderMandalaToCanvas` tipDx scaling in `mandala-renderer.ts`
- P2: Add `OverlapBuffers` parameter to `renderMandalaToCanvas`; pre-allocate in `FormationCanvas`
- P3: Extract `UndulationEasing`, `MandalaPathShape`, `MandalaPresetId` to `src/lib/shared/mandala/domain/*.ts`; define `BreathAnimator` + `BreathAnimatorSettings` interfaces in `mandala-easing.ts`

**Phase 5a — Core:**
1. `formation-types.ts` — all type definitions above (imports from domain/*.ts, not .svelte files)
2. `formation-layout.ts` — ring, grid, spiral, hex layout engines (pure functions, unit-testable)
3. `formation-animation.ts` — master clock + per-slot dx/rotation computation; implements `BreathAnimator`
4. `FormationCanvas.svelte` — canvas element with dpr handling, pre-allocated `OverlapBuffers`, `Path2DCache`, and `transferControlToOffscreen()` on mount; posts `FormationSlot[]` + config to the formation worker each frame
5. `formation.worker.ts` — OffscreenCanvas worker (based on `composition.worker.ts`); owns the RAF loop and all `renderMandalaToCanvas` calls; posts completion signal back to the main thread for export sync
6. `FormationPane.svelte` — wires layout + animation + canvas; minimal controls (type, count, phase mode)
7. Viewer integration: new `ContentType = "formation"` in `viewer-state-persistence.ts` (type + validator + migration) + `PaneContentSelector` entry + `ViewerSplitPane` switch case + `ViewerContentRail` handling (5 files — see audit I2)

**Phase 5b — Controls + Export:**
8. `FormationControls.svelte` — full controls rail
9. `formation-exporter.ts` — MP4 export pipeline (export runs on main thread; worker is for live rendering only)
10. Multi-sequence "Use Deck" toggle — requires deck-context plumbing through `BrowseDeckPage` → `SequenceViewer` → `FormationPane` (see Multi-Sequence Support section for full scope)
11. Formation rotation + scale pulse transforms

**Phase 5c — Polish:**
12. Per-slot color preset overrides (rainbow formations)
13. Hex neighbor spacing presets (tight/normal/loose computed from mandala size)
14. Spiral logarithmic mode
15. Translate path (orbit / figure-8) implementation

---

## Success Criteria

- Prerequisites P1/P2/P3 merged: `renderMandalaToCanvas` produces identical output to `renderMandalaSVG` at any `tipDx` value; no OffscreenCanvas allocation in the formation render loop; easing/shape/preset types importable from plain `.ts` modules
- Ring-8 with Wave phase offset runs at 60fps on a 2023 mid-range laptop, sharp on retina displays (dpr handled)
- Switching formation type (ring → grid → spiral → hex) recomputes layout and resets animation without flicker
- Passing `sequences[]` to `FormationPane` populates slots from the array — ring-16 with 16 different letter sequences shows each mandala's distinct fingerprint
- "Use Deck" toggle (Phase 5b) requires deck-context plumbing to be in place before the criterion is testable; not a Phase 5a success gate
- MP4 export of a ring-8 formation at 1080p produces a seamless 5-second loop
- Formation render and single-mandala render are visually consistent (same colors, same path rendering fidelity)
