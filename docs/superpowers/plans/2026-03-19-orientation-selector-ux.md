# Orientation Selector UX Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix orientation selector labels (CW→clock, CCW→counter), fix popover positioning, add a transient directional arrow overlay on orientation change, and add a "?" help panel explaining orientation.

**Architecture:** Four independent changes to the assemble-lab module. Labels are a two-file find-and-replace. Popover positioning is a CSS fix. The arrow overlay adds an SVG element + transient state to InteractiveGrid. The help panel is a new component using the existing Drawer.

**Tech Stack:** Svelte 5, TypeScript, SVG, CSS animations

**Spec:** `docs/superpowers/specs/2026-03-19-orientation-selector-ux-improvements.md`

---

## File Structure

| File | Status | Responsibility |
|------|--------|----------------|
| `src/lib/features/assemble-lab/components/BuilderControls.svelte` | Modify | Label fix, popover positioning fix, add "?" button |
| `src/lib/features/assemble-lab/components/BuilderTurnBar.svelte` | Modify | Label fix, add "?" button |
| `src/lib/features/assemble-lab/components/InteractiveGrid.svelte` | Modify | Arrow SVG overlay + fade animation |
| `src/lib/features/assemble-lab/state/assemble-state.svelte.ts` | Modify | Add `showOrientationArrow` + `arrowOrientation` transient state |
| `src/lib/features/assemble-lab/components/OrientationExplainer.svelte` | Create | Slide-up help panel with interactive orientation demo |

---

### Task 1: Fix orientation labels

**Files:**
- Modify: `src/lib/features/assemble-lab/components/BuilderControls.svelte:46-51`
- Modify: `src/lib/features/assemble-lab/components/BuilderTurnBar.svelte:48-53`

- [ ] **Step 1: Update BuilderControls ORIENTATIONS array**

In `BuilderControls.svelte` lines 46-51, change:
```typescript
const ORIENTATIONS = [
  { value: Orientation.IN, label: "in", ariaLabel: "in orientation" },
  { value: Orientation.OUT, label: "out", ariaLabel: "out orientation" },
  { value: Orientation.CLOCK, label: "clock", ariaLabel: "clock orientation" },
  { value: Orientation.COUNTER, label: "counter", ariaLabel: "counter orientation" },
] as const;
```

Also update the fallback in `currentOriLabel` (line 65): change `?? "In"` to `?? "in"`.

- [ ] **Step 2: Update BuilderTurnBar ORIENTATIONS array**

In `BuilderTurnBar.svelte` lines 48-53, apply the same label changes:
```typescript
const ORIENTATIONS = [
  { value: Orientation.IN, label: "in", ariaLabel: "in orientation" },
  { value: Orientation.OUT, label: "out", ariaLabel: "out orientation" },
  { value: Orientation.CLOCK, label: "clock", ariaLabel: "clock orientation" },
  { value: Orientation.COUNTER, label: "counter", ariaLabel: "counter orientation" },
] as const;
```

**Note:** The `rotLabel` on line 74-75 ("CW"/"CCW") stays unchanged — that's rotation direction (movement), not orientation (facing). These are correct as-is.

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: No errors. Labels are display-only; enum values (`Orientation.CLOCK`, `Orientation.COUNTER`) are already correct.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/assemble-lab/components/BuilderControls.svelte src/lib/features/assemble-lab/components/BuilderTurnBar.svelte
git commit -m "fix: use correct orientation labels (in/out/clock/counter) in assemble builder"
```

---

### Task 2: Fix popover positioning

**Files:**
- Modify: `src/lib/features/assemble-lab/components/BuilderControls.svelte:57-62, 426-445`

- [ ] **Step 1: Update getPopoverTop to also return left position**

Replace the `getPopoverTop` function (lines 57-62) with a function that returns both `top` and `left`:

```typescript
function getPopoverPosition(triggerRef: HTMLElement | null): { top: string; left: string } {
  if (!triggerRef) return { top: "40%", left: "8px" };
  const rect = triggerRef.getBoundingClientRect();
  return {
    top: `${rect.bottom + 8}px`,
    left: `${rect.left}px`,
  };
}
```

- [ ] **Step 2: Update popover template to use new positioning**

Update the orientation popover div (line 170) from:
```svelte
<div class="popover-panel" style:top={getPopoverTop(oriTriggerRef)} ...>
```
to:
```svelte
{@const oriPos = getPopoverPosition(oriTriggerRef)}
<div class="popover-panel" style:top={oriPos.top} style:left={oriPos.left} ...>
```

Update the turns popover div (line 215) from:
```svelte
<div class="popover-panel turns-popover" style:top={getPopoverTop(turnsTriggerRef)} ...>
```
to:
```svelte
{@const turnsPos = getPopoverPosition(turnsTriggerRef)}
<div class="popover-panel turns-popover" style:top={turnsPos.top} style:left={turnsPos.left} ...>
```

- [ ] **Step 3: Update popover CSS to remove centering**

In the `.popover-panel` CSS (lines 426-445), remove the centering properties:

```css
.popover-panel {
  position: fixed;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 0;
  background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
  border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  border-radius: 14px;
  padding: 6px;
  box-shadow: 0 8px 32px var(--theme-shadow, rgba(0, 0, 0, 0.3));
  animation: popover-in 0.15s ease-out;
  width: fit-content;
  max-width: calc(100vw - 16px);
}
```

Remove: `left: 8px;`, `right: 8px;`, `margin: 0 auto;`. The `left` is now set via inline style from `getPopoverPosition`.

- [ ] **Step 4: Verify build passes**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/assemble-lab/components/BuilderControls.svelte
git commit -m "fix: anchor orientation popover to trigger button instead of screen center"
```

---

### Task 3: Add transient directional arrow on orientation change

**Files:**
- Modify: `src/lib/features/assemble-lab/state/assemble-state.svelte.ts:250-252`
- Modify: `src/lib/features/assemble-lab/components/InteractiveGrid.svelte:459-493`

- [ ] **Step 1: Add arrow state to assemble-state**

In `assemble-state.svelte.ts`, add the three new state variables above line 250, then replace the existing `setOrientation` function (lines 250-252) with the enhanced version:

```typescript
// Transient arrow overlay state
let showOrientationArrow = $state(false);
let arrowOrientation = $state<Orientation>(Orientation.IN);
let arrowTimeout: ReturnType<typeof setTimeout> | null = null;

function setOrientation(ori: Orientation): void {
  currentOrientation = ori;

  // Show directional arrow only when prop is placed
  if (currentPosition !== null) {
    arrowOrientation = ori;
    showOrientationArrow = true;
    if (arrowTimeout) clearTimeout(arrowTimeout);
    arrowTimeout = setTimeout(() => {
      showOrientationArrow = false;
      arrowTimeout = null;
    }, 1000);
  }
}
```

Add to the return object:
```typescript
get showOrientationArrow() { return showOrientationArrow; },
get arrowOrientation() { return arrowOrientation; },
```

- [ ] **Step 2: Add arrow SVG to InteractiveGrid**

In `InteractiveGrid.svelte`, import `LOCATION_ANGLES` and add the arrow direction computation. After the `activeColor` derived (line 380-384), add:

```typescript
import { LOCATION_ANGLES } from "$lib/features/compose/shared/domain/math-constants";

// Arrow direction in degrees, computed from grid position + orientation
const arrowRotationDeg = $derived.by(() => {
  if (!builderState.currentPosition) return 0;
  const theta = LOCATION_ANGLES[builderState.currentPosition];
  const thetaDeg = theta * (180 / Math.PI);
  switch (builderState.arrowOrientation) {
    case Orientation.IN: return thetaDeg + 180; // toward center
    case Orientation.OUT: return thetaDeg;       // away from center
    case Orientation.CLOCK: return thetaDeg + 90;  // CW tangent
    case Orientation.COUNTER: return thetaDeg - 90; // CCW tangent
    default: return thetaDeg;
  }
});
```

- [ ] **Step 3: Add arrow SVG element inside the active prop group**

In the template, add the arrow SVG *after* the closing `</g>` of `.active-prop-inner` (around line 479) but still *inside* the `activePropGroupRef` `<g>` (before line 492). It must be a sibling of `.active-prop-inner`, not nested inside it, so the arrow rotates around the prop center (local origin `0,0`):

```svelte
<!-- Orientation direction arrow overlay -->
{#if builderState.showOrientationArrow}
  <g
    class="orientation-arrow"
    style="transform: rotate({arrowRotationDeg}deg)"
  >
    <line x1="0" y1="0" x2="60" y2="0" stroke="currentColor" stroke-width="4" stroke-linecap="round" />
    <polygon points="60,-8 76,0 60,8" fill="currentColor" />
  </g>
{/if}
```

- [ ] **Step 4: Add arrow CSS animation**

In the `<style>` block, add:

```css
/* Orientation direction arrow */
.orientation-arrow {
  color: var(--theme-accent, #6366f1);
  pointer-events: none;
  opacity: 0;
  animation: arrow-pulse 1s ease forwards;
  filter: drop-shadow(0 0 8px currentColor);
}

@keyframes arrow-pulse {
  0% {
    opacity: 0;
    transform: rotate(var(--arrow-rot, 0deg)) scale(0.8);
  }
  10% {
    opacity: 0.9;
    transform: rotate(var(--arrow-rot, 0deg)) scale(1);
  }
  60% {
    opacity: 0.9;
  }
  100% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .orientation-arrow {
    animation: none;
    opacity: 0.8;
  }
}
```

**Important note on animation:** The CSS animation approach above won't work with the inline `rotate()` transform competing with the keyframe transforms. Use a simpler approach — just animate opacity, and keep rotation as the inline style:

```css
.orientation-arrow {
  color: var(--theme-accent, #6366f1);
  pointer-events: none;
  animation: arrow-fade 1s ease forwards;
  filter: drop-shadow(0 0 8px currentColor) drop-shadow(0 0 16px currentColor);
}

@keyframes arrow-fade {
  0% { opacity: 0; }
  10% { opacity: 0.9; }
  70% { opacity: 0.9; }
  100% { opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .orientation-arrow {
    animation: none;
    opacity: 0.7;
  }
}
```

- [ ] **Step 5: Verify build passes**

Run: `npm run build`

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/assemble-lab/state/assemble-state.svelte.ts src/lib/features/assemble-lab/components/InteractiveGrid.svelte
git commit -m "feat: show transient directional arrow when orientation changes in builder"
```

---

### Task 4: Add "?" help button and orientation explainer panel

**Files:**
- Modify: `src/lib/features/assemble-lab/components/BuilderControls.svelte`
- Modify: `src/lib/features/assemble-lab/components/BuilderTurnBar.svelte`
- Create: `src/lib/features/assemble-lab/components/OrientationExplainer.svelte`

- [ ] **Step 1: Create OrientationExplainer component**

Create `src/lib/features/assemble-lab/components/OrientationExplainer.svelte`:

```svelte
<!--
  OrientationExplainer.svelte - Slide-up panel explaining orientation concept.

  Uses component-local state for the interactive demo. Does NOT access
  the builder's AssembleState context.
-->
<script lang="ts">
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { PropRotAngleManager } from "$lib/shared/pictograph/prop/services/implementations/PropRotAngleManager";
  import { GridLocation, GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { propSvgLoader } from "$lib/shared/pictograph/prop/services/implementations/PropSvgLoader";
  import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import type { PropRenderData } from "$lib/shared/pictograph/prop/domain/models/PropRenderData";
  import { LOCATION_ANGLES } from "$lib/features/compose/shared/domain/math-constants";

  let { isOpen = $bindable(false) }: { isOpen: boolean } = $props();

  // Local demo state — isolated from builder
  let demoOrientation = $state<Orientation>(Orientation.IN);
  let showArrow = $state(false);
  let arrowTimeout: ReturnType<typeof setTimeout> | null = null;

  // Demo uses south grid point
  const DEMO_LOCATION = GridLocation.SOUTH;
  // South is at ~475, 850 in a 950x950 viewBox — use fixed coords for the mini SVG
  const DEMO_CENTER = { x: 150, y: 200 };
  const DEMO_GRID_CENTER = { x: 150, y: 150 };

  const ORIENTATIONS = [
    { value: Orientation.IN, label: "in" },
    { value: Orientation.OUT, label: "out" },
    { value: Orientation.CLOCK, label: "clock" },
    { value: Orientation.COUNTER, label: "counter" },
  ] as const;

  // Load a prop SVG for the demo
  let demoPropData = $state<PropRenderData | null>(null);

  $effect(() => {
    const settings = getSettings();
    const propType = settings.bluePropType ?? PropType.STAFF;
    const motion = createMotionData({ propType, color: MotionColor.BLUE });
    propSvgLoader.loadPropSvg(
      { positionX: 0, positionY: 0, rotationAngle: 0 },
      motion,
      false,
    ).then(data => { demoPropData = data; }).catch(() => {});
  });

  const propCenter = $derived(demoPropData?.svgData?.center ?? { x: 0, y: 0 });

  const demoRotation = $derived(
    PropRotAngleManager.calculateRotation(DEMO_LOCATION, demoOrientation, GridMode.DIAMOND)
  );

  // Arrow direction for demo
  const arrowDeg = $derived.by(() => {
    const theta = LOCATION_ANGLES[DEMO_LOCATION];
    const thetaDeg = theta * (180 / Math.PI);
    switch (demoOrientation) {
      case Orientation.IN: return thetaDeg + 180;
      case Orientation.OUT: return thetaDeg;
      case Orientation.CLOCK: return thetaDeg + 90;
      case Orientation.COUNTER: return thetaDeg - 90;
      default: return thetaDeg;
    }
  });

  function selectDemo(ori: Orientation): void {
    demoOrientation = ori;
    showArrow = true;
    if (arrowTimeout) clearTimeout(arrowTimeout);
    arrowTimeout = setTimeout(() => { showArrow = false; }, 1000);
  }
</script>

<Drawer bind:isOpen placement="bottom" ariaLabel="Orientation explained">
  <div class="explainer">
    <h3 class="explainer-title">Orientation</h3>
    <p class="explainer-desc">
      Orientation is which direction the prop faces relative to the center of the grid.
      Tap each option to see the prop rotate.
    </p>

    <!-- Interactive demo -->
    <div class="demo-area">
      <svg viewBox="0 0 300 300" class="demo-svg">
        <!-- Center dot -->
        <circle cx={DEMO_GRID_CENTER.x} cy={DEMO_GRID_CENTER.y} r="6" fill="var(--theme-text-muted, rgba(255,255,255,0.3))" />
        <!-- Grid point dot (south) -->
        <circle cx={DEMO_CENTER.x} cy={DEMO_CENTER.y} r="6" fill="var(--theme-text-dim, rgba(255,255,255,0.5))" />

        <!-- Prop -->
        {#if demoPropData?.svgData}
          <g
            class="demo-prop"
            style="transform: translate({DEMO_CENTER.x}px, {DEMO_CENTER.y}px) rotate({demoRotation}deg) translate({-propCenter.x}px, {-propCenter.y}px)"
          >
            {@html demoPropData.svgData.svgContent}
          </g>
        {:else}
          <rect
            x={DEMO_CENTER.x - 30}
            y={DEMO_CENTER.y - 3}
            width="60"
            height="6"
            rx="3"
            fill="var(--prop-blue, #2e8bf0)"
            style="transform-origin: {DEMO_CENTER.x}px {DEMO_CENTER.y}px; transform: rotate({demoRotation}deg)"
          />
        {/if}

        <!-- Direction arrow -->
        {#if showArrow}
          <g
            class="demo-arrow"
            style="transform: translate({DEMO_CENTER.x}px, {DEMO_CENTER.y}px) rotate({arrowDeg}deg)"
          >
            <line x1="0" y1="0" x2="50" y2="0" stroke="var(--theme-accent, #6366f1)" stroke-width="3" stroke-linecap="round" />
            <polygon points="50,-6 62,0 50,6" fill="var(--theme-accent, #6366f1)" />
          </g>
        {/if}
      </svg>
    </div>

    <!-- Orientation pills -->
    <div class="demo-pills" role="radiogroup" aria-label="Demo orientation">
      {#each ORIENTATIONS as ori}
        <button
          class="demo-pill"
          class:active={demoOrientation === ori.value}
          role="radio"
          aria-checked={demoOrientation === ori.value}
          onclick={() => selectDemo(ori.value)}
        >
          {ori.label}
        </button>
      {/each}
    </div>

    <button class="got-it-btn" onclick={() => { isOpen = false; }}>
      Got it
    </button>
  </div>
</Drawer>

<style>
  .explainer {
    padding: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
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

  .demo-area {
    width: 100%;
    max-width: 280px;
    aspect-ratio: 1;
  }

  .demo-svg {
    width: 100%;
    height: 100%;
  }

  .demo-prop {
    transition: transform 200ms ease;
    filter: drop-shadow(0 0 6px var(--prop-blue, #2e8bf0));
  }

  .demo-arrow {
    animation: demo-arrow-fade 1s ease forwards;
    filter: drop-shadow(0 0 8px var(--theme-accent, #6366f1));
  }

  @keyframes demo-arrow-fade {
    0% { opacity: 0; }
    10% { opacity: 0.9; }
    70% { opacity: 0.9; }
    100% { opacity: 0; }
  }

  .demo-pills {
    display: flex;
    gap: 4px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 12px;
    padding: 4px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .demo-pill {
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

  .demo-pill.active {
    background: var(--theme-accent-subtle, rgba(99, 102, 241, 0.12));
    color: var(--theme-accent, #6366f1);
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

    .demo-arrow {
      animation: none;
      opacity: 0.7;
    }
  }
</style>
```

- [ ] **Step 2: Add "?" button to BuilderControls orientation popover**

In `BuilderControls.svelte`, import the explainer and add state:

```typescript
import OrientationExplainer from "./OrientationExplainer.svelte";
let explainerOpen = $state(false);
```

Inside the `.popover-pills` div (line 171-183), after the `{#each}` loop for orientation pills, add:

```svelte
<button
  class="help-btn"
  onclick={() => { oriPopoverOpen = false; explainerOpen = true; }}
  aria-label="Learn about orientation"
>
  ?
</button>
```

At the end of the template (before `<style>`), add:

```svelte
<OrientationExplainer bind:isOpen={explainerOpen} />
```

Add CSS for the help button:

```css
.help-btn {
  width: 36px;
  height: 36px;
  min-width: 36px;
  border-radius: 50%;
  border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  background: transparent;
  color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  font-size: var(--font-size-min, 14px);
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 4px;
  transition: background 0.15s ease, color 0.15s ease;
}

.help-btn:hover {
  background: var(--theme-accent-subtle, rgba(99, 102, 241, 0.08));
  color: var(--theme-text, #fff);
}

.help-btn:focus-visible {
  outline: 2px solid var(--theme-text, #fff);
  outline-offset: 2px;
}
```

- [ ] **Step 3: Add "?" button to BuilderTurnBar orientation section**

In `BuilderTurnBar.svelte`, import the explainer and add state:

```typescript
import OrientationExplainer from "./OrientationExplainer.svelte";
let explainerOpen = $state(false);
```

Inside the placing section `bar-content` div (line 96-111), after the `{#each}` loop, add:

```svelte
<button
  class="help-btn"
  onclick={() => { explainerOpen = true; }}
  aria-label="Learn about orientation"
>
  ?
</button>
```

After the closing `</div>` of `.control-bar`, add:

```svelte
<OrientationExplainer bind:isOpen={explainerOpen} />
```

Add the same `.help-btn` CSS as above.

- [ ] **Step 4: Verify build passes**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/assemble-lab/components/OrientationExplainer.svelte src/lib/features/assemble-lab/components/BuilderControls.svelte src/lib/features/assemble-lab/components/BuilderTurnBar.svelte
git commit -m "feat: add orientation explainer panel with interactive demo in assemble builder"
```

---

### Task 5: Visual verification

- [ ] **Step 1: Run full build + typecheck**

Run: `npm run build && npm run check`
Expected: No errors.

- [ ] **Step 2: Manual verification checklist**

Ask user to verify on their running dev server:

1. Orientation pills show `in | out | clock | counter` (lowercase) on both mobile and desktop
2. Mobile: popover appears anchored below and left-aligned with the trigger button
3. When tapping different orientations during "placing" phase, a glowing arrow briefly appears on the prop pointing in the correct direction
4. The "?" button in the orientation selector opens a slide-up panel with an interactive demo
5. The demo prop rotates when tapping orientation options, and the arrow shows the facing direction
6. "Got it" dismisses the panel and returns to the builder without affecting state
