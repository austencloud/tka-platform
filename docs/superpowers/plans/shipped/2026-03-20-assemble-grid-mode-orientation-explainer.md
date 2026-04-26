# Assemble Grid Mode Toggle & Orientation Explainer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add grid mode toggle (Diamond/Box/Merged) + center toggle to the assemble "tap starting point" phase, and rewrite the orientation explainer to show the full grid with the user's actual prop at any location.

**Architecture:** The assemble state already has `gridMode` (hardcoded to DIAMOND) and `GridHitTargetCalculator` already supports DIAMOND/BOX/SKEWED. We expose these via new UI controls, add center point support, then rewrite OrientationExplainer to use real grid coordinates, rotation maps, and the user's prop SVG.

**Tech Stack:** Svelte 5 (runes), TypeScript, existing rotation-maps.ts angle data, existing grid-coordinates.ts positions

**Spec:** `docs/superpowers/specs/2026-03-20-assemble-grid-mode-orientation-explainer-design.md`

---

### Task 1: Add grid mode + center state to assemble state

**Files:**
- Modify: `src/lib/features/assemble-lab/state/assemble-state.svelte.ts`

- [ ] **Step 1: Add `showCenter` state and setters**

Add after line 42 (`let gridMode = ...`):

```typescript
let showCenter = $state<boolean>(false);
```

Add after `setOrientation` function (line 294):

```typescript
function setGridMode(mode: GridMode): void {
  // Frozen once steps exist
  if (blueSteps.length > 0 || redSteps.length > 0) return;
  // If current position is invalid for new mode, reset to idle
  if (currentPosition !== null && !isLocationValidForMode(currentPosition, mode, showCenter)) {
    currentPosition = null;
    phase = "idle";
  }
  gridMode = mode;
}

function setShowCenter(show: boolean): void {
  // Frozen once steps exist
  if (blueSteps.length > 0 || redSteps.length > 0) return;
  // If at center and turning center off, reset to idle
  if (!show && currentPosition === GridLocation.CENTER) {
    currentPosition = null;
    phase = "idle";
  }
  showCenter = show;
}
```

Add helper at the bottom of the file (after `calculateEndOrientation`):

```typescript
/** Check if a grid location is valid for the given mode + center setting */
function isLocationValidForMode(location: GridLocation, mode: GridMode, centerEnabled: boolean): boolean {
  if (location === GridLocation.CENTER) return centerEnabled;
  const CARDINAL = [GridLocation.NORTH, GridLocation.EAST, GridLocation.SOUTH, GridLocation.WEST];
  const INTERCARDINAL = [GridLocation.NORTHEAST, GridLocation.SOUTHEAST, GridLocation.SOUTHWEST, GridLocation.NORTHWEST];
  switch (mode) {
    case GridMode.DIAMOND: return CARDINAL.includes(location);
    case GridMode.BOX: return INTERCARDINAL.includes(location);
    case GridMode.SKEWED: return CARDINAL.includes(location) || INTERCARDINAL.includes(location);
    default: return true;
  }
}
```

- [ ] **Step 2: Add `canChangeGridMode` derived and expose new state in return object**

Add derived after existing derived values (after `canFinishHand`):

```typescript
const canChangeGridMode = $derived(blueSteps.length === 0 && redSteps.length === 0);
```

Add to the return object's readable state section:

```typescript
get showCenter() { return showCenter; },
get canChangeGridMode() { return canChangeGridMode; },
```

Add to the return object's actions section:

```typescript
setGridMode,
setShowCenter,
```

- [ ] **Step 3: Reset `showCenter` in the `reset()` function**

In the `reset()` function, add after `gridMode` would be reset:

```typescript
showCenter = false;
gridMode = GridMode.DIAMOND;
```

Note: `gridMode` is already declared but never reset. Add both lines to the reset function body.

- [ ] **Step 4: Run typecheck**

Run: `npx svelte-check --threshold error`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/assemble-lab/state/assemble-state.svelte.ts
git commit -m "feat: add grid mode + center toggle state to assemble builder"
```

---

### Task 2: Add center point support to GridHitTargetCalculator

**Files:**
- Modify: `src/lib/features/assemble-lab/services/implementations/GridHitTargetCalculator.ts`
- Modify: `src/lib/features/assemble-lab/services/contracts/IGridHitTargetCalculator.ts`

- [ ] **Step 1: Read the interface contract**

Read: `src/lib/features/assemble-lab/services/contracts/IGridHitTargetCalculator.ts`

- [ ] **Step 2: Add `showCenter` parameter to `getHitTargets`**

Update the interface to accept an optional `showCenter` parameter:

```typescript
getHitTargets(gridMode: GridMode, showCenter?: boolean): GridHitTarget[];
```

- [ ] **Step 3: Add center target constant and update implementation**

In `GridHitTargetCalculator.ts`, add after `SKEWED_TARGETS`:

```typescript
const CENTER_TARGET: GridHitTarget = {
  location: GridLocation.CENTER, x: 475, y: 475, label: "Center"
};
```

Update the `getHitTargets` method:

```typescript
getHitTargets(gridMode: GridMode, showCenter: boolean = false): GridHitTarget[] {
  let targets: GridHitTarget[];
  switch (gridMode) {
    case GridMode.DIAMOND:
      targets = DIAMOND_TARGETS;
      break;
    case GridMode.BOX:
      targets = BOX_TARGETS;
      break;
    case GridMode.SKEWED:
      targets = SKEWED_TARGETS;
      break;
    default:
      targets = DIAMOND_TARGETS;
  }
  return showCenter ? [...targets, CENTER_TARGET] : targets;
}
```

- [ ] **Step 4: Run typecheck**

Run: `npx svelte-check --threshold error`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/assemble-lab/services/implementations/GridHitTargetCalculator.ts src/lib/features/assemble-lab/services/contracts/IGridHitTargetCalculator.ts
git commit -m "feat: add center point support to grid hit target calculator"
```

---

### Task 3: Pass showCenter through InteractiveGrid

**Files:**
- Modify: `src/lib/features/assemble-lab/components/InteractiveGrid.svelte`

- [ ] **Step 1: Read the file to find where `getHitTargets` is called**

Read: `src/lib/features/assemble-lab/components/InteractiveGrid.svelte`

Find the line where `gridHitTargetCalculator.getHitTargets(builderState.gridMode)` is called.

- [ ] **Step 2: Pass `showCenter` to `getHitTargets`**

Update the call to include `showCenter`:

```typescript
gridHitTargetCalculator.getHitTargets(builderState.gridMode, builderState.showCenter)
```

- [ ] **Step 3: Run typecheck**

Run: `npx svelte-check --threshold error`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/assemble-lab/components/InteractiveGrid.svelte
git commit -m "feat: pass showCenter to grid hit target calculator"
```

---

### Task 4: Extract GridModePicker shared component

**Files:**
- Create: `src/lib/features/assemble-lab/components/GridModePicker.svelte`

This component is used in both the assemble flow controls AND the orientation explainer, so extract it once.

- [ ] **Step 1: Create the component**

```svelte
<!--
  GridModePicker.svelte - Grid mode pills + center toggle.
  Used in both the assemble flow and the orientation explainer.
-->
<script lang="ts">
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

  let {
    gridMode,
    showCenter,
    disabled = false,
    onGridModeChange,
    onCenterChange,
  }: {
    gridMode: GridMode;
    showCenter: boolean;
    disabled?: boolean;
    onGridModeChange: (mode: GridMode) => void;
    onCenterChange: (show: boolean) => void;
  } = $props();

  const MODES = [
    { value: GridMode.DIAMOND, label: "Diamond" },
    { value: GridMode.BOX, label: "Box" },
    { value: GridMode.SKEWED, label: "Merged" },
  ] as const;
</script>

<div class="grid-mode-picker" class:disabled>
  <div class="mode-pills" role="radiogroup" aria-label="Grid mode">
    {#each MODES as mode}
      <button
        class="mode-pill"
        class:active={gridMode === mode.value}
        role="radio"
        aria-checked={gridMode === mode.value}
        {disabled}
        onclick={() => onGridModeChange(mode.value)}
      >
        {mode.label}
      </button>
    {/each}
  </div>

  <button
    class="center-chip"
    class:active={showCenter}
    {disabled}
    aria-pressed={showCenter}
    aria-label="Include center point"
    onclick={() => onCenterChange(!showCenter)}
  >
    + Center
  </button>
</div>

<style>
  .grid-mode-picker {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .grid-mode-picker.disabled {
    opacity: 0.4;
    pointer-events: none;
  }

  .mode-pills {
    display: flex;
    gap: 2px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 10px;
    padding: 3px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .mode-pill {
    padding: 6px 12px;
    border: none;
    border-radius: 7px;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    min-height: var(--min-touch-target, 44px);
    transition: background 0.15s ease, color 0.15s ease;
  }

  .mode-pill.active {
    background: var(--theme-accent-subtle, rgba(99, 102, 241, 0.12));
    color: var(--theme-accent, #6366f1);
  }

  .mode-pill:focus-visible {
    outline: 2px solid var(--theme-text, #fff);
    outline-offset: 2px;
  }

  .center-chip {
    padding: 6px 12px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    min-height: var(--min-touch-target, 44px);
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  }

  .center-chip.active {
    background: var(--theme-accent-subtle, rgba(99, 102, 241, 0.12));
    color: var(--theme-accent, #6366f1);
    border-color: var(--theme-accent, #6366f1);
  }

  .center-chip:focus-visible {
    outline: 2px solid var(--theme-text, #fff);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .mode-pill,
    .center-chip {
      transition: none;
    }
  }
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `npx svelte-check --threshold error`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/assemble-lab/components/GridModePicker.svelte
git commit -m "feat: create shared GridModePicker component"
```

---

### Task 5: Add GridModePicker to BuilderControls (mobile)

**Files:**
- Modify: `src/lib/features/assemble-lab/components/BuilderControls.svelte`

- [ ] **Step 1: Read full BuilderControls template**

Read the template section (from line 230 onward) to find where the `top-status-area` div is.

- [ ] **Step 2: Import GridModePicker and add it below the instruction text during idle phase**

Add import:

```typescript
import GridModePicker from "./GridModePicker.svelte";
```

In the template, inside the `top-status-area` div, add the GridModePicker below the instruction text, shown only during idle phase:

```svelte
{#if builderState.canChangeGridMode}
  <GridModePicker
    gridMode={builderState.gridMode}
    showCenter={builderState.showCenter}
    disabled={!builderState.canChangeGridMode}
    onGridModeChange={(mode) => builderState.setGridMode(mode)}
    onCenterChange={(show) => builderState.setShowCenter(show)}
  />
{/if}
```

Note: `canChangeGridMode` is true during both "idle" and "placing" phases (no steps recorded yet). The picker disappears once any steps are added.

- [ ] **Step 3: Run typecheck**

Run: `npx svelte-check --threshold error`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/assemble-lab/components/BuilderControls.svelte
git commit -m "feat: add grid mode picker to mobile assemble controls"
```

---

### Task 6: Add GridModePicker to BuilderInstructionHeader (desktop)

**Files:**
- Modify: `src/lib/features/assemble-lab/components/BuilderInstructionHeader.svelte`

- [ ] **Step 1: Import GridModePicker**

Add import:

```typescript
import GridModePicker from "./GridModePicker.svelte";
```

- [ ] **Step 2: Add GridModePicker between instruction text and hand switcher**

In the template, after the `other-hand-hint` span and before the `hand-switcher` div, add:

```svelte
{#if builderState.canChangeGridMode}
  <GridModePicker
    gridMode={builderState.gridMode}
    showCenter={builderState.showCenter}
    disabled={!builderState.canChangeGridMode}
    onGridModeChange={(mode) => builderState.setGridMode(mode)}
    onCenterChange={(show) => builderState.setShowCenter(show)}
  />
{/if}
```

- [ ] **Step 3: Run typecheck**

Run: `npx svelte-check --threshold error`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/assemble-lab/components/BuilderInstructionHeader.svelte
git commit -m "feat: add grid mode picker to desktop assemble header"
```

---

### Task 7: Rewrite OrientationExplainer with full grid and user's prop

**Files:**
- Modify: `src/lib/features/assemble-lab/components/OrientationExplainer.svelte`

This is the largest task. The component gets a full rewrite with:
- Grid mode picker + center toggle (local state, not shared with assemble state)
- Full 950x950 grid visualization with tappable hand points
- User's actual prop SVG loaded from settings
- Rotation angles from canonical rotation-maps.ts

- [ ] **Step 1: Read the required data sources**

Read these files to understand the data:
- `src/lib/shared/render/core/constants/rotation-maps.ts` — angle values
- `src/lib/shared/render/core/constants/grid-coordinates.ts` — point coordinates
- `src/lib/shared/application/state/app-state.svelte.ts` — `getSettings()` function

- [ ] **Step 2: Write the full rewrite**

Replace the entire content of `OrientationExplainer.svelte` with:

```svelte
<!--
  OrientationExplainer.svelte - Interactive orientation demo drawer.
  Shows the full pictograph grid with the user's actual prop at any location.
  Uses real rotation angles from rotation-maps.ts.
-->
<script lang="ts">
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import { GridLocation, GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { DIAMOND_PROP_ANGLES, BOX_PROP_ANGLES } from "$lib/shared/render/core/constants/rotation-maps";
  import {
    DIAMOND_HAND_POINTS, BOX_HAND_POINTS, CENTER_POINT,
    DIAMOND_OUTER_POINTS, BOX_OUTER_POINTS,
  } from "$lib/shared/render/core/constants/grid-coordinates";
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";
  import GridModePicker from "./GridModePicker.svelte";

  let { isOpen = $bindable(false) }: { isOpen: boolean } = $props();

  // Local state (not shared with assemble state)
  let gridMode = $state<GridMode>(GridMode.DIAMOND);
  let showCenter = $state(false);
  let selectedLocation = $state<GridLocation>(GridLocation.SOUTH);
  let selectedOrientation = $state<Orientation>(Orientation.IN);

  // Available hand points based on grid mode
  const handPoints = $derived.by(() => {
    const points: Array<{ location: GridLocation; x: number; y: number; label: string }> = [];
    const LABELS: Record<string, string> = {
      n: "N", e: "E", s: "S", w: "W",
      ne: "NE", se: "SE", sw: "SW", nw: "NW", c: "C",
    };

    if (gridMode === GridMode.DIAMOND || gridMode === GridMode.SKEWED) {
      for (const [loc, coords] of Object.entries(DIAMOND_HAND_POINTS)) {
        if (coords && loc !== "c") points.push({ location: loc as GridLocation, x: coords.x, y: coords.y, label: LABELS[loc] ?? loc });
      }
    }
    if (gridMode === GridMode.BOX || gridMode === GridMode.SKEWED) {
      for (const [loc, coords] of Object.entries(BOX_HAND_POINTS)) {
        if (coords && loc !== "c") points.push({ location: loc as GridLocation, x: coords.x, y: coords.y, label: LABELS[loc] ?? loc });
      }
    }
    if (showCenter) {
      points.push({ location: GridLocation.CENTER, x: CENTER_POINT.x, y: CENTER_POINT.y, label: "C" });
    }
    return points;
  });

  // Outer boundary points for grid lines
  const outerPoints = $derived.by(() => {
    const points: Array<{ x: number; y: number }> = [];
    if (gridMode === GridMode.DIAMOND || gridMode === GridMode.SKEWED) {
      for (const coords of Object.values(DIAMOND_OUTER_POINTS)) {
        points.push(coords);
      }
    }
    if (gridMode === GridMode.BOX || gridMode === GridMode.SKEWED) {
      for (const coords of Object.values(BOX_OUTER_POINTS)) {
        points.push(coords);
      }
    }
    return points;
  });

  // Is center selected?
  const isCenterSelected = $derived(selectedLocation === GridLocation.CENTER);

  // Rotation angle from canonical maps
  const propRotation = $derived.by(() => {
    if (isCenterSelected) return 0;
    const loc = selectedLocation as string;
    const ori = selectedOrientation as string;

    // Cardinal locations use diamond angles, intercardinal use box angles
    const CARDINAL = ["n", "e", "s", "w"];
    const angleMap = CARDINAL.includes(loc)
      ? DIAMOND_PROP_ANGLES
      : BOX_PROP_ANGLES;

    const orientationAngles = (angleMap as Record<string, Record<string, number>>)[ori];
    return orientationAngles?.[loc] ?? 0;
  });

  // Prop SVG loading
  let propSvgContent = $state<string | null>(null);
  let propViewBox = $state({ width: 252.8, height: 77.8 });
  let propCenter = $state({ x: 126.4, y: 38.9 });

  const propType = $derived(getSettings()?.bluePropType ?? "staff");

  $effect(() => {
    loadPropSvg(propType);
  });

  async function loadPropSvg(propType: string): Promise<void> {
    try {
      const response = await fetch(`/images/props/pictograph/${propType}.svg`);
      if (!response.ok) {
        propSvgContent = null;
        return;
      }
      let svgText = await response.text();

      // Extract viewBox dimensions
      const vbMatch = svgText.match(/viewBox\s*=\s*"([^"]+)"/i);
      if (vbMatch) {
        const parts = vbMatch[1]!.split(/\s+/).map(parseFloat);
        if (parts.length >= 4) {
          propViewBox = { width: parts[2]!, height: parts[3]! };
        }
      }

      // Extract center point if marked
      const centerMatch = svgText.match(/id="centerPoint"[^>]*cx="([^"]+)"[^>]*cy="([^"]+)"/);
      if (centerMatch) {
        propCenter = { x: parseFloat(centerMatch[1]!), y: parseFloat(centerMatch[2]!) };
      } else {
        propCenter = { x: propViewBox.width / 2, y: propViewBox.height / 2 };
      }

      // Extract inner content (strip outer <svg> wrapper)
      const innerMatch = svgText.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
      let inner = innerMatch ? innerMatch[1]! : svgText;

      // Apply blue color
      inner = inner.replace(/#2e3192/gi, "#2e8bf0");
      inner = inner.replace(/#000000/gi, "#2e8bf0");
      inner = inner.replace(/black/gi, "#2e8bf0");
      // Remove center point marker circle
      inner = inner.replace(/<circle[^>]*id="centerPoint"[^>]*\/>/gi, "");

      propSvgContent = inner;
    } catch {
      propSvgContent = null;
    }
  }

  // Selected point coordinates
  const selectedPoint = $derived(
    handPoints.find(p => p.location === selectedLocation)
  );

  // When grid mode changes, validate selected location
  $effect(() => {
    const valid = handPoints.some(p => p.location === selectedLocation);
    if (!valid && handPoints.length > 0) {
      selectedLocation = handPoints[0]!.location;
    }
  });

  function selectLocation(loc: GridLocation): void {
    selectedLocation = loc;
  }

  function handleClose(): void {
    isOpen = false;
  }

  const ORIENTATIONS = [
    { value: Orientation.IN, label: "in" },
    { value: Orientation.OUT, label: "out" },
    { value: Orientation.CLOCK, label: "clock" },
    { value: Orientation.COUNTER, label: "counter" },
  ] as const;

  // Hit target radius for tappable areas (must be ≥80 SVG units for 44px at rendered size)
  const HIT_RADIUS = 80;
</script>

<Drawer
  bind:isOpen
  placement="bottom"
  ariaLabel="Orientation explained"
  showHandle={true}
  closeOnBackdrop={true}
  class="orientation-explainer-sheet"
>
  <div class="explainer">
    <h3 class="explainer-title">Orientation</h3>
    <p class="explainer-desc">
      Orientation is which direction the prop faces relative to the center of the grid.
      Tap a point on the grid, then pick an orientation to see the prop rotate.
    </p>

    <!-- Grid mode picker -->
    <GridModePicker
      {gridMode}
      {showCenter}
      onGridModeChange={(mode) => { gridMode = mode; }}
      onCenterChange={(show) => { showCenter = show; }}
    />

    <!-- Full grid visualization -->
    <div class="grid-area">
      <svg viewBox="100 100 750 750" class="grid-svg">
        <!-- Grid lines from center to outer points -->
        {#each outerPoints as outer}
          <line
            x1={CENTER_POINT.x} y1={CENTER_POINT.y}
            x2={outer.x} y2={outer.y}
            stroke="rgba(255,255,255,0.06)"
            stroke-width="1.5"
          />
        {/each}

        <!-- Center point marker (always visible) -->
        <circle cx={CENTER_POINT.x} cy={CENTER_POINT.y} r="10" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" />
        <circle cx={CENTER_POINT.x} cy={CENTER_POINT.y} r="3" fill="rgba(255,255,255,0.6)" />

        <!-- Hand point dots -->
        {#each handPoints as point}
          <circle
            cx={point.x} cy={point.y} r="12"
            fill={selectedLocation === point.location ? "var(--theme-accent, #6366f1)" : "rgba(255,255,255,0.2)"}
            stroke={selectedLocation === point.location ? "var(--theme-accent, #6366f1)" : "rgba(255,255,255,0.1)"}
            stroke-width="2"
          />
          <!-- Label -->
          <text
            x={point.x} y={point.y - 22}
            text-anchor="middle"
            fill={selectedLocation === point.location ? "var(--theme-accent, #6366f1)" : "rgba(255,255,255,0.3)"}
            font-size="14"
            font-weight="600"
          >{point.label}</text>
        {/each}

        <!-- Prop at selected location -->
        {#if selectedPoint}
          <g
            class="demo-prop"
            style="transform-origin: {selectedPoint.x}px {selectedPoint.y}px; transform: rotate({propRotation}deg)"
          >
            {#if propSvgContent}
              <g transform="translate({selectedPoint.x - propCenter.x}, {selectedPoint.y - propCenter.y})">
                {@html propSvgContent}
              </g>
            {:else}
              <!-- Fallback circle while loading -->
              <circle cx={selectedPoint.x} cy={selectedPoint.y} r="28" fill="#2e8bf0" opacity="0.6" />
            {/if}
          </g>
        {/if}

        <!-- Invisible hit targets for tapping (on top of everything) -->
        {#each handPoints as point}
          <circle
            cx={point.x} cy={point.y} r={HIT_RADIUS}
            fill="transparent"
            class="hit-target"
            role="button"
            tabindex="0"
            aria-label="Select {point.label} position"
            onclick={() => selectLocation(point.location)}
            onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectLocation(point.location); } }}
          />
        {/each}
      </svg>
    </div>

    <!-- Orientation pills (hidden when center is selected) -->
    {#if !isCenterSelected}
      <div class="ori-pills" role="radiogroup" aria-label="Orientation">
        {#each ORIENTATIONS as ori}
          <button
            class="ori-pill"
            class:active={selectedOrientation === ori.value}
            role="radio"
            aria-checked={selectedOrientation === ori.value}
            onclick={() => { selectedOrientation = ori.value; }}
          >
            {ori.label}
          </button>
        {/each}
      </div>
    {:else}
      <p class="center-note">
        Center orientation uses a different system (centric directions).
      </p>
    {/if}

    <button class="got-it-btn" onclick={handleClose}>
      Got it
    </button>
  </div>
</Drawer>

<style>
  :global(.orientation-explainer-sheet) {
    --sheet-bg: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    --sheet-filter: none;
    z-index: 300 !important;
  }

  .explainer {
    padding: 8px 24px 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .explainer-title {
    font-size: var(--font-size-lg, 18px);
    font-weight: 700;
    color: var(--theme-text, #fff);
    margin: 0;
  }

  .explainer-desc {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    text-align: center;
    margin: 0;
    max-width: 300px;
    line-height: 1.5;
  }

  .grid-area {
    width: 100%;
    max-width: 300px;
    aspect-ratio: 1;
  }

  .grid-svg {
    width: 100%;
    height: 100%;
  }

  .demo-prop {
    transition: transform 250ms ease;
    filter: drop-shadow(0 0 4px rgba(46, 139, 240, 0.4));
  }

  .hit-target {
    cursor: pointer;
  }

  .hit-target:focus-visible {
    outline: none;
    stroke: var(--theme-accent, #6366f1);
    stroke-width: 3;
    stroke-opacity: 0.5;
  }

  .ori-pills {
    display: flex;
    gap: 4px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 12px;
    padding: 4px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .ori-pill {
    padding: 10px 16px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    min-height: var(--min-touch-target, 44px);
    transition: background 0.15s ease, color 0.15s ease;
  }

  .ori-pill.active {
    background: var(--theme-accent-subtle, rgba(99, 102, 241, 0.12));
    color: var(--theme-accent, #6366f1);
  }

  .ori-pill:focus-visible {
    outline: 2px solid var(--theme-text, #fff);
    outline-offset: 2px;
  }

  .center-note {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-align: center;
    margin: 0;
    font-style: italic;
  }

  .got-it-btn {
    padding: 12px 32px;
    border: 1.5px solid var(--theme-accent, #6366f1);
    border-radius: 12px;
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 15%, var(--theme-card-bg, rgba(0, 0, 0, 0.6)));
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    min-height: var(--min-touch-target, 44px);
    width: 100%;
    max-width: 300px;
  }

  .got-it-btn:hover {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 30%, var(--theme-card-bg, rgba(0, 0, 0, 0.6)));
  }

  .got-it-btn:focus-visible {
    outline: 2px solid var(--theme-text, #fff);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .demo-prop {
      transition: none;
    }

    .ori-pill {
      transition: none;
    }
  }
</style>
```

- [ ] **Step 3: Run typecheck**

Run: `npx svelte-check --threshold error`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/assemble-lab/components/OrientationExplainer.svelte
git commit -m "feat: rewrite orientation explainer with full grid, location picker, and user's prop"
```

---

### Task 8: Verify everything works together

- [ ] **Step 1: Run full typecheck**

Run: `npx svelte-check --threshold error`
Expected: 0 errors

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Manual verification checklist**

Tell the user to verify:
1. Open Assemble tab → "Tap a starting point" shows Diamond/Box/Merged pills + Center toggle
2. Switching grid mode changes visible hand points on the grid
3. Enabling center shows center point as tappable
4. Grid mode controls disappear after placing a starting point and adding steps
5. Tap the `?` button on orientation control → explainer drawer opens
6. Explainer shows full grid with their prop (not a rectangle)
7. Tapping grid points moves the prop to that location
8. Orientation pills rotate the prop correctly at each location
9. Selecting center location hides orientation pills and shows centric note

- [ ] **Step 4: Commit all remaining changes**

If any fixes were needed during verification, commit them:

```bash
git add -A
git commit -m "fix: polish grid mode toggle and orientation explainer"
```
