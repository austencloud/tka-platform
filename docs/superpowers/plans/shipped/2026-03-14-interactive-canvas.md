# InteractiveCanvas Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand path builder's homebrew `BuilderGrid.svelte` with a composable `InteractiveCanvas` that renders through AnimatorCanvas (Canvas2D) and captures clicks through a transparent SVG overlay.

**Architecture:** InteractiveCanvas wraps AnimatorCanvas + HitTargetOverlay as siblings. Parents construct `PropState` objects to position props and handle `onPointClick` callbacks to decide what clicks mean. The canvas is dumb — all business logic stays in the parent.

**Tech Stack:** Svelte 5, TypeScript, Canvas2D (via AnimatorCanvas), SVG overlays

**Spec:** `docs/superpowers/specs/2026-03-14-interactive-canvas-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/shared/interactive-canvas/InteractiveCanvas.svelte` | Create | Wrapper: AnimatorCanvas + animation overlay + HitTargetOverlay |
| `src/lib/shared/interactive-canvas/components/HitTargetOverlay.svelte` | Create | Transparent SVG with clickable circles at grid positions |
| `src/lib/features/hand-path-builder/services/contracts/IHandPropStateFactory.ts` | Create | Interface for HandPropStateFactory |
| `src/lib/features/hand-path-builder/services/implementations/HandPropStateFactory.ts` | Create | Convert grid locations → PropState (angle + no rotation) |
| `src/lib/features/hand-path-builder/HandPathBuilderLab.svelte` | Modify | Replace BuilderGrid with InteractiveCanvas |
| `src/lib/features/hand-path-builder/components/BuilderGrid.svelte` | Delete (end) | Replaced by InteractiveCanvas |
| `tests/unit/HandPropStateFactory.test.ts` | Create | Test location → PropState conversion |

---

## Chunk 1: Foundation Components

### Task 1: HandPropStateFactory — Interface + Tests

The factory converts grid locations into `PropState` objects that AnimatorCanvas uses to position props. Hands don't rotate, so `staffRotationAngle` is always 0.

**Files:**
- Create: `src/lib/features/hand-path-builder/services/contracts/IHandPropStateFactory.ts`
- Create: `tests/unit/HandPropStateFactory.test.ts`

- [ ] **Step 1: Create the interface**

```typescript
// src/lib/features/hand-path-builder/services/contracts/IHandPropStateFactory.ts
import type { PropState } from "$lib/shared/animation-engine/domain/PropState";
import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

export interface IHandPropStateFactory {
  /**
   * Convert a grid location to a PropState for AnimatorCanvas.
   * Hands don't rotate, so staffRotationAngle is always 0.
   * For most locations, uses centerPathAngle from LOCATION_ANGLES.
   */
  locationToPropState(location: GridLocation): PropState;
}
```

- [ ] **Step 2: Write failing tests**

```typescript
// tests/unit/HandPropStateFactory.test.ts
import { describe, it, expect } from "vitest";
import { HandPropStateFactory } from "$lib/features/hand-path-builder/services/implementations/HandPropStateFactory";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

describe("HandPropStateFactory", () => {
  const factory = new HandPropStateFactory();

  it("returns staffRotationAngle of 0 for all locations", () => {
    const locations = [
      GridLocation.NORTH, GridLocation.EAST,
      GridLocation.SOUTH, GridLocation.WEST,
      GridLocation.NORTHEAST, GridLocation.SOUTHEAST,
      GridLocation.SOUTHWEST, GridLocation.NORTHWEST,
    ];
    for (const loc of locations) {
      const state = factory.locationToPropState(loc);
      expect(state.staffRotationAngle).toBe(0);
    }
  });

  it("maps EAST to centerPathAngle 0", () => {
    const state = factory.locationToPropState(GridLocation.EAST);
    expect(state.centerPathAngle).toBe(0);
  });

  it("maps SOUTH to centerPathAngle PI/2", () => {
    const state = factory.locationToPropState(GridLocation.SOUTH);
    expect(state.centerPathAngle).toBeCloseTo(Math.PI / 2);
  });

  it("maps NORTH to centerPathAngle -PI/2", () => {
    const state = factory.locationToPropState(GridLocation.NORTH);
    expect(state.centerPathAngle).toBeCloseTo(-Math.PI / 2);
  });

  it("maps WEST to centerPathAngle PI", () => {
    const state = factory.locationToPropState(GridLocation.WEST);
    expect(state.centerPathAngle).toBeCloseTo(Math.PI);
  });

  it("does not set x/y for non-dash locations", () => {
    const state = factory.locationToPropState(GridLocation.NORTH);
    expect(state.x).toBeUndefined();
    expect(state.y).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/unit/HandPropStateFactory.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Commit interface + tests**

```bash
git add src/lib/features/hand-path-builder/services/contracts/IHandPropStateFactory.ts tests/unit/HandPropStateFactory.test.ts
git commit -m "test: add HandPropStateFactory interface and failing tests"
```

---

### Task 2: HandPropStateFactory — Implementation

**Files:**
- Create: `src/lib/features/hand-path-builder/services/implementations/HandPropStateFactory.ts`

- [ ] **Step 1: Implement the factory**

```typescript
// src/lib/features/hand-path-builder/services/implementations/HandPropStateFactory.ts
import type { PropState } from "$lib/shared/animation-engine/domain/PropState";
import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { IHandPropStateFactory } from "../contracts/IHandPropStateFactory";
import { LOCATION_ANGLES } from "$lib/features/compose/shared/domain/math-constants";

export class HandPropStateFactory implements IHandPropStateFactory {
  locationToPropState(location: GridLocation): PropState {
    return {
      centerPathAngle: LOCATION_ANGLES[location],
      staffRotationAngle: 0,
    };
  }
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run tests/unit/HandPropStateFactory.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/hand-path-builder/services/implementations/HandPropStateFactory.ts
git commit -m "feat: implement HandPropStateFactory — grid locations to PropState"
```

---

### Task 3: HitTargetOverlay Component

Transparent SVG layer with clickable circles at each grid position. Uses the same `GridHitTargetCalculator` and 950x950 coordinate system as the existing grid overlays.

**Files:**
- Create: `src/lib/shared/interactive-canvas/components/HitTargetOverlay.svelte`

**Reference files (read before implementing):**
- `src/lib/features/hand-path-builder/components/BuilderGrid.svelte:178-325` — existing hit target rendering + CSS (reuse the pulse animations and styling)
- `src/lib/features/assemble-lab/services/implementations/GridHitTargetCalculator.ts` — `getHitTargets(gridMode)` and `getHitTargetRadius()`
- `src/lib/features/assemble-lab/services/contracts/IGridHitTargetCalculator.ts` — `GridHitTarget` interface: `{ location: GridLocation, x: number, y: number }`

- [ ] **Step 1: Create the component**

```svelte
<!-- src/lib/shared/interactive-canvas/components/HitTargetOverlay.svelte -->
<!--
  Transparent SVG overlay with clickable circles at grid positions.
  Positioned absolutely over AnimatorCanvas. Uses 950x950 viewBox
  (same coordinate space as GridSvg, GlyphOverlay, and the canvas).

  pointer-events: none on the SVG root so canvas interactions
  (pinch, pan) pass through. pointer-events: auto only on the
  clickable circles themselves.
-->
<script lang="ts">
  import { GridHitTargetCalculator } from "$lib/features/assemble-lab/services/implementations/GridHitTargetCalculator";
  import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

  interface Props {
    gridMode: GridMode;
    activePhaseColor: "blue" | "red" | null;
    currentPosition: GridLocation | null;
    disabled: boolean;
    onPointClick: (location: GridLocation) => void;
  }

  let {
    gridMode,
    activePhaseColor = null,
    currentPosition = null,
    disabled = false,
    onPointClick,
  }: Props = $props();

  const calculator = new GridHitTargetCalculator();
  const hitRadius = calculator.getHitTargetRadius();

  const hitTargets = $derived(calculator.getHitTargets(gridMode));

  function handleClick(location: GridLocation): void {
    if (disabled) return;
    onPointClick(location);
  }

  function handleKeydown(e: KeyboardEvent, location: GridLocation): void {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick(location);
    }
  }

  function getLabel(location: GridLocation): string {
    const phase = activePhaseColor === "blue" ? "Blue" : activePhaseColor === "red" ? "Red" : "";
    return `${phase} ${location}`.trim();
  }
</script>

<svg
  class="hit-target-overlay"
  viewBox="0 0 950 950"
  xmlns="http://www.w3.org/2000/svg"
  preserveAspectRatio="xMidYMid meet"
>
  {#each hitTargets as target (target.location)}
    <circle
      cx={target.x}
      cy={target.y}
      r={hitRadius}
      class="hit-target"
      class:is-selected={currentPosition === target.location}
      class:phase-blue={activePhaseColor === "blue"}
      class:phase-red={activePhaseColor === "red"}
      class:disabled={disabled}
      role="button"
      tabindex="0"
      aria-label={getLabel(target.location)}
      onclick={() => handleClick(target.location)}
      onkeydown={(e) => handleKeydown(e, target.location)}
    />
  {/each}
</svg>

<style>
  .hit-target-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 10;
    pointer-events: none;
  }

  .hit-target {
    pointer-events: auto;
    fill: rgba(255, 255, 255, 0.04);
    stroke: rgba(255, 255, 255, 0.25);
    stroke-width: 2.5;
    cursor: pointer;
    transition: fill 0.14s ease, stroke 0.14s ease, stroke-width 0.14s ease;
  }

  .hit-target.disabled {
    cursor: not-allowed;
    pointer-events: none;
    opacity: 0.3;
  }

  .hit-target.phase-blue:not(.is-selected):not(.disabled) {
    fill: color-mix(in srgb, var(--prop-blue, #2e8bf0) 8%, transparent);
    stroke: color-mix(in srgb, var(--prop-blue, #2e8bf0) 50%, transparent);
    animation: pulse-blue 1.8s ease-in-out infinite;
  }

  .hit-target.phase-red:not(.is-selected):not(.disabled) {
    fill: color-mix(in srgb, var(--prop-red, #ed1c24) 8%, transparent);
    stroke: color-mix(in srgb, var(--prop-red, #ed1c24) 50%, transparent);
    animation: pulse-red 1.8s ease-in-out infinite;
  }

  .hit-target.is-selected.phase-blue {
    fill: color-mix(in srgb, var(--prop-blue, #2e8bf0) 22%, transparent);
    stroke: var(--prop-blue, #2e8bf0);
    stroke-width: 3;
    animation: none;
  }

  .hit-target.is-selected.phase-red {
    fill: color-mix(in srgb, var(--prop-red, #ed1c24) 22%, transparent);
    stroke: var(--prop-red, #ed1c24);
    stroke-width: 3;
    animation: none;
  }

  .hit-target:hover:not(.is-selected):not(.disabled) {
    stroke-width: 3.5;
  }

  .hit-target.phase-blue:hover:not(.is-selected):not(.disabled) {
    fill: color-mix(in srgb, var(--prop-blue, #2e8bf0) 20%, transparent);
    stroke: var(--prop-blue, #2e8bf0);
  }

  .hit-target.phase-red:hover:not(.is-selected):not(.disabled) {
    fill: color-mix(in srgb, var(--prop-red, #ed1c24) 20%, transparent);
    stroke: var(--prop-red, #ed1c24);
  }

  .hit-target:focus-visible {
    outline: none;
    stroke-width: 4;
    stroke: var(--theme-accent, #3b82f6);
  }

  @keyframes pulse-blue {
    0%   { fill: color-mix(in srgb, var(--prop-blue, #2e8bf0)  5%, transparent); stroke-opacity: 0.40; stroke-width: 2; }
    50%  { fill: color-mix(in srgb, var(--prop-blue, #2e8bf0) 18%, transparent); stroke-opacity: 0.90; stroke-width: 3.5; }
    100% { fill: color-mix(in srgb, var(--prop-blue, #2e8bf0)  5%, transparent); stroke-opacity: 0.40; stroke-width: 2; }
  }

  @keyframes pulse-red {
    0%   { fill: color-mix(in srgb, var(--prop-red, #ed1c24)  5%, transparent); stroke-opacity: 0.40; stroke-width: 2; }
    50%  { fill: color-mix(in srgb, var(--prop-red, #ed1c24) 18%, transparent); stroke-opacity: 0.90; stroke-width: 3.5; }
    100% { fill: color-mix(in srgb, var(--prop-red, #ed1c24)  5%, transparent); stroke-opacity: 0.40; stroke-width: 2; }
  }

  @media (prefers-reduced-motion: reduce) {
    .hit-target.phase-blue:not(.disabled),
    .hit-target.phase-red:not(.disabled) {
      animation: none;
    }
  }
</style>
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run check`
Expected: No new errors from HitTargetOverlay.svelte

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/interactive-canvas/components/HitTargetOverlay.svelte
git commit -m "feat: create HitTargetOverlay — SVG click targets for grid points"
```

---

### Task 4: InteractiveCanvas Wrapper

Thin wrapper that composes AnimatorCanvas + optional animation overlay + HitTargetOverlay. Passes through all AnimatorCanvas props and adds interaction-specific ones.

**Files:**
- Create: `src/lib/shared/interactive-canvas/InteractiveCanvas.svelte`

**Reference files (read before implementing):**
- `src/lib/shared/animation-engine/components/AnimatorCanvas.svelte:50-117` — full props interface
- `src/lib/shared/animation-engine/domain/PropState.ts` — PropState type
- `src/lib/shared/interactive-canvas/components/HitTargetOverlay.svelte` — just created

- [ ] **Step 1: Create the component**

```svelte
<!-- src/lib/shared/interactive-canvas/InteractiveCanvas.svelte -->
<!--
  Unified builder surface. Composes AnimatorCanvas (Canvas2D rendering)
  with HitTargetOverlay (click detection) and an optional animation
  overlay layer. Parents construct PropState objects and handle click
  callbacks — this component is a pure pass-through.

  Layer stack:
    z-index  0: Canvas2D (AnimatorCanvas)
    z-index  5: GlyphOverlay (inside AnimatorCanvas)
    z-index  8: Animation overlay (optional, for prop movement SVGs)
    z-index 10: HitTargetOverlay (click circles)
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { PropState } from "$lib/shared/animation-engine/domain/PropState";
  import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
  import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import HitTargetOverlay from "./components/HitTargetOverlay.svelte";

  interface Props {
    // AnimatorCanvas rendering props
    blueProp: PropState | null;
    redProp: PropState | null;
    gridMode?: GridMode;
    gridVisible?: boolean;
    stepData?: StartPositionData | StepData | null;
    backgroundAlpha?: number;
    bluePropType?: string | null;
    redPropType?: string | null;
    // InteractiveCanvas-specific props
    interactive?: boolean;
    activePhaseColor?: "blue" | "red" | null;
    currentPosition?: GridLocation | null;
    disabled?: boolean;
    onPointClick?: (location: GridLocation) => void;
    animationLayer?: Snippet;
    // Pass-through for any other AnimatorCanvas props
    [key: string]: unknown;
  }

  let {
    // AnimatorCanvas props
    blueProp,
    redProp,
    gridMode = GridMode.DIAMOND,
    gridVisible = true,
    stepData = null,
    backgroundAlpha = 1,
    bluePropType = null,
    redPropType = null,
    // InteractiveCanvas props
    interactive = true,
    activePhaseColor = null,
    currentPosition = null,
    disabled = false,
    onPointClick = () => {},
    animationLayer,
    // Rest passed to AnimatorCanvas
    ...restProps
  }: Props = $props();
</script>

<div class="interactive-canvas-wrapper">
  <AnimatorCanvas
    {blueProp}
    {redProp}
    {gridMode}
    {gridVisible}
    {stepData}
    {backgroundAlpha}
    {bluePropType}
    {redPropType}
    {...restProps}
  />
  {#if animationLayer}
    <svg
      class="animation-overlay"
      viewBox="0 0 950 950"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
    >
      {@render animationLayer()}
    </svg>
  {/if}
  {#if interactive}
    <HitTargetOverlay
      {gridMode}
      {activePhaseColor}
      {currentPosition}
      {disabled}
      {onPointClick}
    />
  {/if}
</div>

<style>
  .interactive-canvas-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    border-radius: 20px;
    overflow: hidden;
    border: 1.5px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .animation-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 8;
    pointer-events: none;
  }

  @media (max-width: 768px) {
    .interactive-canvas-wrapper {
      border-radius: 16px;
    }
  }
</style>
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run check`
Expected: No new errors from InteractiveCanvas.svelte

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/interactive-canvas/InteractiveCanvas.svelte
git commit -m "feat: create InteractiveCanvas — AnimatorCanvas + HitTargetOverlay wrapper"
```

---

## Chunk 2: Hand Path Builder Migration

### Task 5: Replace BuilderGrid with InteractiveCanvas

The hand path builder currently uses `BuilderGrid.svelte` — a standalone SVG that renders its own grid, hands, path lines, and hit targets. Replace it with `InteractiveCanvas` which delegates rendering to AnimatorCanvas.

This task modifies `HandPathBuilderLab.svelte` to:
1. Construct `PropState` objects from builder locations via `HandPropStateFactory`
2. Pass them to `InteractiveCanvas` for rendering
3. Use the `animationLayer` snippet for hand movement animation
4. Render path trace lines in the animation overlay

**Files:**
- Modify: `src/lib/features/hand-path-builder/HandPathBuilderLab.svelte`

**Reference files (read before implementing):**
- `src/lib/features/hand-path-builder/components/BuilderGrid.svelte` — current implementation being replaced. Study: hand SVG loading, animation callback registration, path line rendering
- `src/lib/features/hand-path-builder/state/builder-state.svelte.ts` — builder state (phase, locations, animation callback)
- `src/lib/features/hand-path-builder/services/HandPathAnimator.ts` — `HandPathAnimator` class for movement animation, `getPathD()` for SVG path geometry
- `src/lib/shared/animation-engine/domain/PropState.ts` — `PropState` interface
- `src/lib/features/compose/shared/domain/math-constants.ts` — `LOCATION_ANGLES` mapping
- `src/lib/shared/pictograph/prop/domain/enums/PropType.ts` — `PropType.HAND` enum value

- [ ] **Step 1: Read current HandPathBuilderLab.svelte**

Read `src/lib/features/hand-path-builder/HandPathBuilderLab.svelte` to understand the current template structure and how BuilderGrid is used.

- [ ] **Step 2: Rewrite HandPathBuilderLab to use InteractiveCanvas**

The key changes:
- Import `InteractiveCanvas` instead of `BuilderGrid`
- Import `HandPropStateFactory` to convert locations → PropState
- Import `HandPathAnimator` and `getPathD` for animation + path lines
- Load hand SVGs via `propSvgLoader` (moved from BuilderGrid to here)
- Register animation callback on builder state
- Derive `blueProp`/`redProp` PropState from builder locations
- Use `animationLayer` snippet for path lines and animated hand SVGs
- Pass `activePhaseColor`, `currentPosition`, `disabled` to control hit targets

The parent now owns all rendering logic that was previously in BuilderGrid:
- Hand SVG loading (via propSvgLoader)
- Animation callback (HandPathAnimator drives SVG `<g>` in animation overlay)
- Path trace lines (SVG `<path>` elements in animation overlay using `getPathD()`)
- Phase-based hit target coloring (passed as `activePhaseColor` prop)

```svelte
<script lang="ts">
  import { createBuilderState } from "./state/builder-state.svelte";
  import { setBuilderContext } from "./context/builder-context";
  import InteractiveCanvas from "$lib/shared/interactive-canvas/InteractiveCanvas.svelte";
  import { HandPropStateFactory } from "./services/implementations/HandPropStateFactory";
  import { HandPathAnimator, getPathD } from "./services/HandPathAnimator";
  import { propSvgLoader } from "$lib/shared/pictograph/prop/services/implementations/PropSvgLoader";
  import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { PropRenderData } from "$lib/shared/pictograph/prop/domain/models/PropRenderData";
  import type { PropState } from "$lib/shared/animation-engine/domain/PropState";
  import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { HandMove } from "./state/builder-state.svelte";
  import PathPreview from "./components/PathPreview.svelte";
  import BuilderControls from "./components/BuilderControls.svelte";
  import GridModeSelector from "./components/GridModeSelector.svelte";

  const state = createBuilderState();
  setBuilderContext(state);

  const propStateFactory = new HandPropStateFactory();
  const blueAnimator = new HandPathAnimator();
  const redAnimator = new HandPathAnimator();

  const ANIMATION_DURATION_MS = 350;

  // Load hand SVGs on mount
  let blueHandData = $state<PropRenderData | null>(null);
  let redHandData = $state<PropRenderData | null>(null);

  let activeBlueHandRef: SVGGElement | null = $state(null);
  let activeRedHandRef: SVGGElement | null = $state(null);

  $effect(() => {
    const blueMotion = createMotionData({ propType: PropType.HAND, color: MotionColor.BLUE });
    propSvgLoader.loadPropSvg(
      { positionX: 0, positionY: 0, rotationAngle: 0 }, blueMotion, false,
    ).then(data => { blueHandData = data; }).catch(() => {});

    const redMotion = createMotionData({ propType: PropType.HAND, color: MotionColor.RED });
    propSvgLoader.loadPropSvg(
      { positionX: 0, positionY: 0, rotationAngle: 0 }, redMotion, false,
    ).then(data => { redHandData = data; }).catch(() => {});
  });

  // Register animation callback
  $effect(() => {
    state.setAnimationCallback(async (move: HandMove) => {
      const handData = state.phase === "blue" ? blueHandData : redHandData;
      const handRef = state.phase === "blue" ? activeBlueHandRef : activeRedHandRef;
      if (!handRef || !handData?.svgData) return;

      const animator = state.phase === "blue" ? blueAnimator : redAnimator;
      await animator.animate({
        element: handRef,
        startPosition: move.from,
        endPosition: move.to,
        durationMs: ANIMATION_DURATION_MS,
        handCenter: handData.svgData.center,
      });
    });
  });

  // Derive PropState for each hand from their last location
  const blueProp = $derived.by((): PropState | null => {
    if (state.blueLocations.length === 0) return null;
    const lastLoc = state.blueLocations[state.blueLocations.length - 1]!;
    return propStateFactory.locationToPropState(lastLoc);
  });

  const redProp = $derived.by((): PropState | null => {
    if (state.redLocations.length === 0) return null;
    const lastLoc = state.redLocations[state.redLocations.length - 1]!;
    return propStateFactory.locationToPropState(lastLoc);
  });

  // Phase-based hit target color
  const activePhaseColor = $derived(
    state.phase === "blue" ? "blue" as const
    : state.phase === "red" ? "red" as const
    : null
  );

  // Path line SVG "d" attributes
  function buildPathDs(locations: readonly GridLocation[]): string[] {
    const ds: string[] = [];
    for (let i = 0; i < locations.length - 1; i++) {
      ds.push(getPathD(locations[i]!, locations[i + 1]!));
    }
    return ds;
  }

  const bluePathDs = $derived(buildPathDs(state.blueLocations));
  const redPathDs = $derived(buildPathDs(state.redLocations));

  const blueColor = "var(--prop-blue, #2e8bf0)";
  const redColor = "var(--prop-red, #ed1c24)";
</script>

<div class="hand-path-builder">
  <header class="lab-header">
    <h2 class="lab-title">Hand Path Builder</h2>
    <p class="lab-subtitle">Tap grid points to draw spatial paths for each hand.</p>
  </header>

  <div class="mode-bar">
    <GridModeSelector />
  </div>

  <div class="grid-area">
    <InteractiveCanvas
      {blueProp}
      {redProp}
      gridMode={state.gridMode}
      gridVisible={true}
      interactive={state.phase !== "complete"}
      {activePhaseColor}
      currentPosition={state.lastLocation}
      disabled={state.isAnimating}
      onPointClick={(loc) => state.addLocation(loc)}
      bluePropType="hand"
      redPropType="hand"
    >
      {#snippet animationLayer()}
        <!-- Path trace lines -->
        {#each bluePathDs as d, i (i)}
          <path {d} fill="none" stroke={blueColor} stroke-width="4" stroke-linecap="round" opacity="0.7" />
        {/each}
        {#each redPathDs as d, i (i)}
          <path {d} fill="none" stroke={redColor} stroke-width="4" stroke-linecap="round" opacity="0.7" />
        {/each}

        <!-- Animated hand SVGs (driven by HandPathAnimator) -->
        {#if state.blueLocations.length > 0 && blueHandData?.svgData}
          <g bind:this={activeBlueHandRef} class="hand-anim-group">
            {@html blueHandData.svgData.svgContent}
          </g>
        {/if}
        {#if state.redLocations.length > 0 && redHandData?.svgData}
          <g bind:this={activeRedHandRef} class="hand-anim-group">
            {@html redHandData.svgData.svgContent}
          </g>
        {/if}

        <!-- Complete state text -->
        {#if state.phase === "complete"}
          <text
            x="475" y="475"
            text-anchor="middle" dominant-baseline="middle"
            font-size="20" fill="rgba(255,255,255,0.45)"
          >Paths complete</text>
        {/if}
      {/snippet}
    </InteractiveCanvas>
  </div>

  <div class="preview-area">
    <PathPreview />
  </div>

  <div class="controls-area">
    <BuilderControls />
  </div>
</div>
```

The `<style>` block carries over from the existing `HandPathBuilderLab.svelte` unchanged:

```svelte
<style>
  .hand-path-builder {
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    padding: 16px;
    gap: 12px;
    overflow-y: auto;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    box-sizing: border-box;
  }

  .lab-header {
    text-align: center;
    flex-shrink: 0;
  }

  .lab-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--theme-text, #fff);
    margin: 0 0 4px;
  }

  .lab-subtitle {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.45));
    margin: 0;
  }

  .mode-bar {
    width: 100%;
    max-width: 440px;
    flex-shrink: 0;
  }

  .grid-area {
    width: 100%;
    max-width: 400px;
    flex-shrink: 0;
  }

  .preview-area {
    width: 100%;
    max-width: 440px;
    flex-shrink: 0;
  }

  .controls-area {
    width: 100%;
    max-width: 440px;
    flex-shrink: 0;
  }

  @media (max-width: 768px) {
    .hand-path-builder {
      padding: 10px;
      gap: 10px;
    }

    .lab-title {
      font-size: 16px;
    }
  }
</style>
```

**Important implementation note:** The hand SVGs in the animation overlay are positioned by `HandPathAnimator.applyPosition()` which sets `element.style.transform`. This is the same pattern BuilderGrid uses today — the animator directly manipulates the SVG `<g>` element's transform. The `blueProp`/`redProp` PassState objects tell AnimatorCanvas where the prop "officially" is (for Canvas2D rendering), while the SVG animation overlay handles the visual movement between positions.

**Dual rendering consideration:** AnimatorCanvas will render hands at their PropState positions via Canvas2D, AND the animation overlay renders hand SVGs for movement animation. During animation, the overlay hand moves visually while the Canvas2D hand stays at the previous position. When animation completes, `state.addLocation()` updates the location array, which updates `blueProp`/`redProp`, which moves the Canvas2D hand to the new position. At that point, remove or hide the overlay hand.

If the Canvas2D hand is visually distracting during animation (you see two hands), set `blueProp`/`redProp` to `null` during animation and only set them after animation completes. Test this visually and pick whichever looks better.

- [ ] **Step 3: Verify typecheck**

Run: `npm run check`
Expected: No new errors

- [ ] **Step 4: Test manually**

Open the hand path builder in the browser. Verify:
1. Grid renders via AnimatorCanvas (Canvas2D)
2. Hit targets pulse with phase color (blue/red)
3. Tapping a point places a hand at that position
4. Hand animates from previous → new position (arc for shifts, straight for dashes)
5. Path trace lines follow actual movement geometry
6. Grid mode switching works (diamond/box/skewed)
7. Undo removes last location
8. Phase transition (blue → red → complete) works

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/hand-path-builder/HandPathBuilderLab.svelte
git commit -m "feat: migrate hand path builder to InteractiveCanvas

Replace BuilderGrid with InteractiveCanvas composition.
Hands now render through AnimatorCanvas (Canvas2D) with
HitTargetOverlay for click detection. Path lines and hand
animation use the SVG animation overlay layer."
```

---

### Task 6: Delete BuilderGrid + Verify

**Files:**
- Delete: `src/lib/features/hand-path-builder/components/BuilderGrid.svelte`

- [ ] **Step 1: Check for any remaining imports of BuilderGrid**

Search for any file that imports `BuilderGrid`. After the migration in Task 5, nothing should import it.

Run: `grep -r "BuilderGrid" src/ --include="*.svelte" --include="*.ts"`
Expected: Zero results (or only the file itself)

- [ ] **Step 2: Delete BuilderGrid.svelte**

```bash
rm src/lib/features/hand-path-builder/components/BuilderGrid.svelte
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run check`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add -u src/lib/features/hand-path-builder/components/BuilderGrid.svelte
git commit -m "chore: delete BuilderGrid — replaced by InteractiveCanvas"
```

---

## Future Work (Not In This Plan)

### Phase 2: Assemble Tab Migration

Replace `InteractiveGrid.svelte` in `AssembleLabModule.svelte` with `InteractiveCanvas`. The assemble tab is more complex (prop rotation, ghost props, SvgPropAnimator), so it gets its own plan after Phase 1 validates the pattern.

### Phase 3: Cleanup

- Move `GridHitTargetCalculator` from `assemble-lab/services/` to `shared/`
- Remove `HandPathAnimator.ts` if animation moves fully to Canvas2D interpolation
- Audit orphaned SVG rendering code
