# Sequence Mandala Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate unique SVG mandalas from LOOP sequences by tracing prop tip paths through headless animation engine math, and integrate them into card backs, gallery views, and animation playback.

**Architecture:** A `MandalaGeometryCalculator` replicates the PropInterpolator/EndpointCalculator math headlessly, sampling prop tip positions per beat to produce point arrays. A `MandalaRenderer` converts those points to SVG paths (Catmull-Rom to Bezier). `SequenceMandala.svelte` renders the final SVG in various contexts. The geometry is purely mathematical — no animation engine dependency.

**Tech Stack:** TypeScript, Svelte 5, ITI DI, SVG path generation

**Spec:** `docs/superpowers/specs/2026-03-26-sequence-mandala-design.md`
**Prototype:** `scripts/mandala-prototype.cjs` (validated — all junction gaps 0px, 20px tip inset confirmed)

---

## File Map

### New Files

| File | Responsibility |
|------|----------------|
| `src/lib/shared/mandala/domain/mandala-types.ts` | Type definitions: MandalaPaths, SVGPathData, MandalaRenderOptions |
| `src/lib/shared/mandala/domain/mandala-constants.ts` | Default tip inset (20px), sampling rate (64), colors, grid radius |
| `src/lib/shared/mandala/services/contracts/IMandalaGeometryCalculator.ts` | Interface for geometry calculation |
| `src/lib/shared/mandala/services/contracts/IMandalaRenderer.ts` | Interface for SVG/Canvas rendering |
| `src/lib/shared/mandala/services/implementations/MandalaGeometryCalculator.ts` | Headless interpolation pipeline — the core math |
| `src/lib/shared/mandala/services/implementations/MandalaRenderer.ts` | Point arrays → SVG paths, handles styles/dots/sizing |
| `src/lib/shared/mandala/components/SequenceMandala.svelte` | Main Svelte component wrapping calculator + renderer |
| `src/lib/shared/di/containers/sequence-mandala-container.ts` | DI registration |
| `tests/unit/MandalaGeometryCalculator.test.ts` | Unit tests for geometry math |

### Modified Files

| File | Change |
|------|--------|
| `src/lib/shared/di/index.ts` | Import and wire `sequenceMandalaContainer` |
| `src/lib/shared/di/container-types.ts` | Add `SequenceMandalaContainer` type to `IAppContainerItems` |
| `src/lib/features/choreo-card/components/card-back/CardBackV5.svelte` | Embed `SequenceMandala` as hero for LOOP sequences |
| `src/lib/shared/navigation/config/tab-definitions.ts` | Rename mandala-generator tab label to "Arrow Mandalas" |
| `src/lib/features/mandala-generator/components/MandalaGeneratorModule.svelte` | Update heading text |

---

## Task 1: Domain Types and Constants

**Files:**
- Create: `src/lib/shared/mandala/domain/mandala-types.ts`
- Create: `src/lib/shared/mandala/domain/mandala-constants.ts`

- [ ] **Step 1: Create mandala-types.ts**

```typescript
// src/lib/shared/mandala/domain/mandala-types.ts

export interface SVGPathData {
  /** SVG path "d" attribute string */
  d: string;
  /** 0 = left end, 1 = right end (tip) — matches trail system endType */
  endType: 0 | 1;
}

export interface MandalaPaths {
  blue: SVGPathData[];
  red: SVGPathData[];
}

export interface MandalaRenderOptions {
  /** Pixel size of the SVG viewBox (square) */
  size: number;
  /** Stroke or filled petal rendering */
  style: "stroke" | "filled";
  /** Show cardinal/intercardinal grid dots + center */
  showGridDots: boolean;
  /** Which hands to render */
  show: "blue" | "red" | "both";
  /** SVG stroke width */
  strokeWidth?: number;
}

export type MandalaMode = "card-back" | "gallery" | "animated";

export interface MandalaPoint {
  x: number;
  y: number;
}
```

- [ ] **Step 2: Create mandala-constants.ts**

```typescript
// src/lib/shared/mandala/domain/mandala-constants.ts

/** Default inward offset from exact tip — creates visible lobes on 0-turn motions */
export const DEFAULT_TIP_INSET_PX = 20;

/** Points sampled per beat per tip. Adaptive: multiplied by ceil(turns) for high-turn motions */
export const BASE_SAMPLES_PER_BEAT = 64;

/** Grid radius in mandala coordinate space */
export const MANDALA_GRID_RADIUS = 80;

/** SVG viewBox size (square) */
export const MANDALA_DEFAULT_SIZE = 500;

/** TKA canonical colors */
export const BLUE_STROKE = "#2e3192";
export const RED_STROKE = "#ed1c24";
export const BLUE_FILL = "rgba(46, 49, 146, 0.2)";
export const RED_FILL = "rgba(237, 28, 36, 0.2)";

/**
 * Grid radius in the animation engine's coordinate space (prop-local units).
 * This is the distance from center to cardinal grid points in a 950px viewBox.
 * Also equals staff half-length (staff tip dx=150).
 * Tip offsets are scaled by (MANDALA_GRID_RADIUS / ENGINE_GRID_RADIUS) to fit
 * the mandala's coordinate space.
 */
export const ENGINE_GRID_RADIUS = 150;
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/mandala/domain/
git commit -m "feat(mandala): add domain types and constants"
```

---

## Task 2: MandalaGeometryCalculator — Interface + Implementation

This is the core math. Port the validated prototype logic from `scripts/mandala-prototype.cjs` into a proper TypeScript service.

**Files:**
- Create: `src/lib/shared/mandala/services/contracts/IMandalaGeometryCalculator.ts`
- Create: `src/lib/shared/mandala/services/implementations/MandalaGeometryCalculator.ts`

- [ ] **Step 1: Create the interface**

```typescript
// src/lib/shared/mandala/services/contracts/IMandalaGeometryCalculator.ts

import type { MandalaPaths, MandalaPoint } from "../../domain/mandala-types";

export interface IMandalaGeometryCalculator {
  /**
   * Compute prop tip paths for one full LOOP cycle.
   *
   * Takes the sequence step data (with motions, orientations, turns)
   * and traces the tip positions through each beat using the same
   * interpolation math as the animation engine.
   *
   * @param steps - Array of step objects with motions.blue / motions.red
   * @param bluePropType - Prop type for blue hand (for tip point lookup)
   * @param redPropType - Prop type for red hand (for tip point lookup)
   * @returns MandalaPaths with SVG path "d" strings per hand per tip
   */
  calculate(
    steps: readonly StepLike[],
    bluePropType?: string,
    redPropType?: string,
  ): MandalaPaths;
}

/**
 * Minimal step shape the calculator needs.
 * Compatible with both SequenceData steps and compact deck beat format.
 */
export interface StepLike {
  motions?: {
    blue?: MotionLike | null;
    red?: MotionLike | null;
  } | null;
}

export interface MotionLike {
  motionType: string;
  rotationDirection: string;
  startLocation: string;
  endLocation: string;
  turns?: number | string;
  startOrientation?: string;
  endOrientation?: string;
}
```

- [ ] **Step 2: Create the implementation**

Port the math from `scripts/mandala-prototype.cjs`. Key pieces:
- Angle math: `normalizeAnglePositive`, `normalizeAngleSigned`, `lerpAngle`, `mapOrientationToAngle` — import from existing `AngleCalculator.ts` standalone functions
- Endpoint calculation: replicate `EndpointCalculator.calculateMotionEndpoints` logic per motion type
- Interpolation: replicate `PropInterpolator` logic (arc for PRO/ANTI, Cartesian for DASH, static for STATIC/FLOAT)
- Tip position: rotation transform with tip offset
- Staff angle chaining across beats (critical — prevents junction gaps)
- Tip inset: before passing tip offsets to `computeTipPosition()`, reduce `|dx|` by `DEFAULT_TIP_INSET_PX` (e.g., staff dx=150 becomes dx=130). Apply this reduction after reading from `getTipPoints()` / `getTrailPointConfig()`, in the `generateMandalaPath()` method.
- Tip resolution for non-staff props: call `getTipPoints(propType)` and `getTrailPointConfig(propType)` to resolve the actual tip offsets. Do NOT hardcode staff dx=150. Bilateral props get 2 distinct tips, unilateral props get the same tip for both left and right (see `TrailOverlayCanvas` lines 150-160 for the `isBilateralProp` logic).
- Field name mapping: the `MotionLike` interface uses `startLocation`, `rotationDirection`, etc. (Firestore/SequenceData format). The prototype used shorthand (`startLoc`, `rotDir`). The implementation must use the full field names directly — no mapping needed since SequenceData already uses them.
- Catmull-Rom to Bezier SVG path conversion

The implementation should:
1. Filter out non-motion steps (start position)
2. For each hand (blue, red), for each trail tip (left, right):
   - Chain staff angles across beats
   - Sample N points per beat
   - Convert points to SVG path via `pointsToSVGPath()`
3. Return `MandalaPaths`

Reference the prototype at `scripts/mandala-prototype.cjs` lines 67-220 for the validated math. The key functions to port:
- `calculateMotionEndpoints()` → method on the calculator
- `interpolate()` → private method
- `computeTipPosition()` → private method
- `generateMandalaPath()` → private method (with staff angle chaining)
- `pointsToSVGPath()` → private method (Catmull-Rom to Bezier)

Use `LOCATION_ANGLES` from `src/lib/features/compose/shared/domain/math-constants.ts` and angle functions from `src/lib/features/compose/services/implementations/AngleCalculator.ts`.

For tip point resolution, use `getTipPoints()` from `src/lib/shared/animation-engine/domain/types/PropTipPoints.ts`. For trail config overrides, use the trail point assignment system from `src/lib/shared/animation-engine/domain/types/TrailPointTypes.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/mandala/services/
git commit -m "feat(mandala): implement MandalaGeometryCalculator with headless interpolation"
```

---

## Task 3: Unit Tests for Geometry Calculator

The math is the riskiest part. Test the silent-bug scenarios: junction gaps, orientation chaining, motion type formulas.

**Files:**
- Create: `tests/unit/MandalaGeometryCalculator.test.ts`

- [ ] **Step 1: Write tests**

Test cases:
1. **Junction continuity** — for a known multi-beat sequence, verify that the last point of beat N equals the first point of beat N+1 (gap < 0.01px)
2. **PRO motion produces arc** — a single PRO beat from S→W with 0 turns should trace points along the grid circle (verify radius is approximately constant)
3. **DASH motion goes through center** — a DASH from S→N should have a point near (0,0) at t=0.5
4. **STATIC motion stays in place** — hand position doesn't change, only tip rotates
5. **FLOAT produces no path** — should return empty SVG path data
6. **Tip inset applied** — verify dx is reduced by DEFAULT_TIP_INSET_PX
7. **Staff angle chaining** — feed the ALΦ sequence (pro→anti→dash), verify zero junction gap on beat 2→3 transition (this was the 160px bug we fixed)
8. **Full 16-beat loop** — feed the Ω-YΩXΩ-YΩX sequence, verify all 15 junctions have < 0.01px gap and last point ≈ first point (closed loop)
9. **ANTI motion staff rotation** — verify ANTI uses `-centerMovement` (opposite sign from PRO). A PRO and ANTI beat with same start/end locations and same turns should produce different staff rotation deltas.
10. **Adaptive sampling** — verify a 1.5-turn motion produces more sample points than a 0-turn motion (samples scale with `ceil(turns)`)

Use the test sequences from the prototype session:
- ALΦ (3-beat seed expanded to 6): tests basic chaining
- Ω-YΩXΩ-YΩX (16-beat from Firestore at `scripts/test-sequence.json`): tests real-world complexity

- [ ] **Step 2: Run tests, verify they fail**

```bash
npm test -- MandalaGeometryCalculator
```

- [ ] **Step 3: Fix any issues until tests pass**

- [ ] **Step 4: Commit**

```bash
git add tests/unit/MandalaGeometryCalculator.test.ts
git commit -m "test(mandala): add geometry calculator unit tests for junction continuity and motion types"
```

---

## Task 4: MandalaRenderer — Interface + Implementation

**Files:**
- Create: `src/lib/shared/mandala/services/contracts/IMandalaRenderer.ts`
- Create: `src/lib/shared/mandala/services/implementations/MandalaRenderer.ts`

- [ ] **Step 1: Create the interface**

```typescript
// src/lib/shared/mandala/services/contracts/IMandalaRenderer.ts

import type { MandalaPaths, MandalaRenderOptions } from "../../domain/mandala-types";

export interface IMandalaRenderer {
  /**
   * Render mandala paths to an SVG string.
   */
  renderSVG(paths: MandalaPaths, options: MandalaRenderOptions): string;

  /**
   * Render mandala paths to a Canvas 2D context (for print pipeline).
   */
  renderToCanvas(
    ctx: CanvasRenderingContext2D,
    paths: MandalaPaths,
    options: MandalaRenderOptions & { offsetX: number; offsetY: number },
  ): void;
}
```

- [ ] **Step 2: Create the implementation**

The renderer takes pre-computed `MandalaPaths` and renders them.

For `renderSVG()`:
- Build an SVG element with viewBox
- Add grid dots if `showGridDots` is true (9 circles: 8 cardinal/intercardinal + center)
- Add `<path>` elements for each SVGPathData in blue/red arrays
- Apply stroke or fill styles based on `options.style`
- Filter by `options.show` (blue/red/both)

For `renderToCanvas()`:
- Parse SVG path "d" strings into Canvas 2D path commands
- Use `Path2D` constructor which accepts SVG path data strings directly
- Apply stroke/fill styles via canvas context
- This enables the print pipeline (`CardBackCanvasRenderer`) to draw mandalas

Port the SVG generation from `scripts/mandala-prototype.cjs` `generateDecomposedSVG()` function.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/mandala/services/contracts/IMandalaRenderer.ts src/lib/shared/mandala/services/implementations/MandalaRenderer.ts
git commit -m "feat(mandala): implement MandalaRenderer with SVG and Canvas output"
```

---

## Task 5: DI Container Wiring

**Files:**
- Create: `src/lib/shared/di/containers/sequence-mandala-container.ts`
- Modify: `src/lib/shared/di/index.ts`
- Modify: `src/lib/shared/di/container-types.ts`

- [ ] **Step 1: Create the container**

```typescript
// src/lib/shared/di/containers/sequence-mandala-container.ts
import { createContainer } from "iti";
import { MandalaGeometryCalculator } from "$lib/shared/mandala/services/implementations/MandalaGeometryCalculator";
import { MandalaRenderer } from "$lib/shared/mandala/services/implementations/MandalaRenderer";

export const sequenceMandalaContainer = createContainer()
  .add({ mandalaGeometryCalculator: () => new MandalaGeometryCalculator() })
  .add({ mandalaRenderer: () => new MandalaRenderer() });

export type SequenceMandalaContainer = typeof sequenceMandalaContainer;
```

- [ ] **Step 2: Wire into composition root**

In `src/lib/shared/di/index.ts`:
- Add import: `import { sequenceMandalaContainer } from "./containers/sequence-mandala-container";`
- Add to the `buildAppContainer()` chain: `.add(() => sequenceMandalaContainer.items)`

In `src/lib/shared/di/container-types.ts`:
- Add import: `import type { SequenceMandalaContainer } from "./containers/sequence-mandala-container";`
- Add `ItemsOf<SequenceMandalaContainer>` to the `IAppContainerItems` intersection

- [ ] **Step 3: Verify build compiles**

```bash
npm run check
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/di/containers/sequence-mandala-container.ts src/lib/shared/di/index.ts src/lib/shared/di/container-types.ts
git commit -m "feat(mandala): register sequence mandala services in DI container"
```

---

## Task 6: SequenceMandala Svelte Component

**Files:**
- Create: `src/lib/shared/mandala/components/SequenceMandala.svelte`

- [ ] **Step 1: Create the component**

Props:
- `sequence: SequenceData` — the LOOP sequence
- `mode: MandalaMode` — "card-back" | "gallery" | "animated"
- `style: "stroke" | "filled"` — rendering style (default "stroke")
- `show: "blue" | "red" | "both"` — which hands (default "both")
- `size: number` — SVG size (default from constants)
- `currentStep?: number` — for animated mode, drives stroke-dashoffset

The component:
1. Derives `MandalaPaths` from `sequence` via `mandalaGeometryCalculator` (from DI)
2. Derives render options from `mode` (card-back = no dots, gallery = dots, etc.)
3. Calls `mandalaRenderer.renderSVG()` to get the SVG string
4. Renders via `{@html svgString}`
5. For animated mode: wraps SVG paths with `stroke-dasharray` and `stroke-dashoffset` driven by `currentStep`

Use `$derived` for geometry computation (recomputes when sequence changes).
Use `onMount` to resolve DI services.

- [ ] **Step 2: Verify it renders**

Temporarily import `SequenceMandala` somewhere visible (e.g., a lab tab) with a hardcoded test sequence. Visually confirm the mandala renders. Remove the temporary import after.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/mandala/components/SequenceMandala.svelte
git commit -m "feat(mandala): add SequenceMandala Svelte component"
```

---

## Task 7: Card Back V5 Integration

**Files:**
- Modify: `src/lib/features/choreo-card/components/card-back/CardBackV5.svelte`

- [ ] **Step 1: Read current CardBackV5.svelte**

Understand the existing layout: corner badges, top brand, center content (.content div), bottom URL.

- [ ] **Step 2: Add SequenceMandala to center content**

In the `.content` div, between the word and the loop explanation, add `SequenceMandala` conditionally for LOOP sequences:

```svelte
{#if d.hasLoop}
  <div class="mandala-hero">
    <SequenceMandala
      {sequence}
      mode="card-back"
      style="stroke"
      show="both"
      size={300}
    />
  </div>
{/if}
```

Style the `.mandala-hero` container to center the mandala and size it appropriately within the 500x700 card layout. The mandala replaces the first `.spacer` div (between word/pronunciation and loop-explanation). The existing layout is: word → pronunciation → spacer → loop-explanation → spacer. Replace the first spacer with the mandala hero so it fills the center naturally via flexbox.

- [ ] **Step 3: Verify visually**

Navigate to the card designer and check a LOOP sequence card back. The mandala should appear as the center hero with word above and text below.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/choreo-card/components/card-back/CardBackV5.svelte
git commit -m "feat(mandala): integrate mandala hero into V5 card back for LOOP sequences"
```

---

## Task 8: Rename Existing Mandala Module to "Arrow Mandalas"

**Files:**
- Modify: `src/lib/shared/navigation/config/tab-definitions.ts` (line ~775 — the mandala lab tab label)
- Modify: `src/lib/features/mandala-generator/components/MandalaGeneratorModule.svelte`

- [ ] **Step 1: Update tab-definitions.ts**

Find the mandala-generator tab entry (the mandala is a lab tab, not a standalone module — `module-definitions.ts` only has a redirect `mandala: "lab"`). Change its `label` to `"Arrow Mandalas"` and update `description` to clarify it's about arranging arrow glyphs in symmetric patterns.

- [ ] **Step 2: Update MandalaGeneratorModule.svelte heading**

Change any heading text from "Mandala Generator" to "Arrow Mandalas" and add a brief subtitle like "Arrange arrow glyphs in symmetric patterns".

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/navigation/config/tab-definitions.ts src/lib/features/mandala-generator/components/MandalaGeneratorModule.svelte
git commit -m "refactor(mandala): rename existing mandala generator to Arrow Mandalas"
```

---

## Task 9: Geometry Caching

**Files:**
- Modify: `src/lib/shared/mandala/services/implementations/MandalaGeometryCalculator.ts`

- [ ] **Step 1: Add LRU cache**

Add a simple Map-based LRU cache (max 50 entries) keyed on a hash of:
- Sequence ID (or word as fallback)
- Blue prop type
- Red prop type

Cache the `MandalaPaths` result. Check cache before computing. Evict oldest entry when cache is full.

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/mandala/services/implementations/MandalaGeometryCalculator.ts
git commit -m "perf(mandala): add LRU geometry cache for gallery performance"
```

---

## Task 10: Final Verification

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

- [ ] **Step 2: Run TypeScript check**

```bash
npm run check
```

- [ ] **Step 3: Visual verification checklist**

1. Open card designer → select a LOOP sequence → flip to card back → mandala appears as center hero
2. Non-LOOP sequence card back → no mandala, existing V5 layout preserved
3. Lab nav → "Arrow Mandalas" label shows instead of "Mandala Generator"

- [ ] **Step 4: Final commit if any fixes needed**
