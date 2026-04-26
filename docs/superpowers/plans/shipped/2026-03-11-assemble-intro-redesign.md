# Assemble Tab Initial State Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Assemble tab's initial state to be clearer, more inviting, and easier to use on mobile — bigger instruction text, warm grid background, larger touch targets, and a bubbly turn switcher.

**Architecture:** Split the monolithic `BuilderControls.svelte` overlay into three focused components: `BuilderInstructionHeader`, `BuilderTurnBar`, and `BuilderActionOverlay`. Restructure `AssembleToolPanel` from a two-section layout into a three-section vertical stack. Update grid visuals and hit target sizing.

**Tech Stack:** Svelte 5, CSS custom properties, SVG

**Spec:** `docs/superpowers/specs/2026-03-11-assemble-intro-redesign-design.md`

---

## Chunk 1: Component Split and Layout Restructure

### Task 1: Create BuilderInstructionHeader component

**Files:**
- Create: `src/lib/features/visual-builder-lab/components/BuilderInstructionHeader.svelte`

This component replaces the top-left instruction badge. It renders as a centered header above the grid.

- [ ] **Step 1: Create the component file**

```svelte
<!--
  BuilderInstructionHeader.svelte - Centered step instruction above the grid.

  Shows "Step 1 of 2" / "Step 2 of 2" label with phase-specific instruction text
  and a glowing dot in the active hand color.
-->
<script lang="ts">
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { VisualBuilderState } from "../state/visual-builder-state.svelte";

  let { builderState }: { builderState: VisualBuilderState } = $props();

  const isBlueHand = $derived(builderState.activeHand === MotionColor.BLUE);

  const stepLabel = $derived(isBlueHand ? "Step 1 of 2" : "Step 2 of 2");

  const handColor = $derived(
    isBlueHand
      ? "var(--prop-blue, #2e8bf0)"
      : "var(--prop-red, #ed1c24)"
  );

  const phaseMessage = $derived.by(() => {
    const handLabel = isBlueHand ? "Blue" : "Red";
    switch (builderState.phase) {
      case "idle": return "Tap a starting point";
      case "placing": return "Tap destination";
      case "building":
      case "animating": return "Tap next point";
      case "done": return `${handLabel} path set`;
      case "complete": return "Sequence complete";
      default: return "";
    }
  });
</script>

<div class="instruction-header" aria-live="polite" aria-atomic="true">
  <span class="step-label">{stepLabel}</span>
  <div class="step-title">
    <span
      class="hand-dot-glow"
      style="--dot-color: {handColor}"
      aria-hidden="true"
    ></span>
    <span class="step-text">{phaseMessage}</span>
  </div>
</div>

<style>
  .instruction-header {
    width: 100%;
    text-align: center;
    padding: 12px 16px 8px;
    flex-shrink: 0;
  }

  .step-label {
    display: block;
    font-size: var(--font-size-compact, 12px);
    color: rgba(255, 255, 255, 0.4);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 600;
    margin-bottom: 4px;
  }

  .step-title {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    font-size: 20px;
    font-weight: 700;
    color: #fff;
  }

  .hand-dot-glow {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--dot-color);
    box-shadow: 0 0 12px color-mix(in srgb, var(--dot-color) 60%, transparent);
    flex-shrink: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .hand-dot-glow {
      box-shadow: none;
    }
  }
</style>
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npm run check`
Expected: No new errors related to BuilderInstructionHeader

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/visual-builder-lab/components/BuilderInstructionHeader.svelte
git commit -m "feat(assemble): add BuilderInstructionHeader component"
```

---

### Task 2: Create BuilderTurnBar component

**Files:**
- Create: `src/lib/features/visual-builder-lab/components/BuilderTurnBar.svelte`

This component extracts the rotation toggle + turn count pills from BuilderControls into a standalone card below the grid.

- [ ] **Step 1: Create the component file**

```svelte
<!--
  BuilderTurnBar.svelte - Turn count and rotation direction selector.

  Renders as a card below the grid with bubbly pill buttons.
  Dimmed during idle/animating, hidden when sequence is complete.
-->
<script lang="ts">
  import { RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { VisualBuilderState } from "../state/visual-builder-state.svelte";

  let { builderState }: { builderState: VisualBuilderState } = $props();

  const isActive = $derived(
    builderState.phase === "placing" || builderState.phase === "building"
  );
  const isAnimating = $derived(builderState.phase === "animating");
  const isDonePhase = $derived(builderState.phase === "done");
  const isIdle = $derived(builderState.phase === "idle");
  const isComplete = $derived(builderState.phase === "complete");

  const motionEnabled = $derived(isActive);
  const motionDimmed = $derived(isAnimating || isIdle || isDonePhase);
  const motionHidden = $derived(isComplete);

  const TURN_OPTIONS = [0, 0.5, 1, 1.5, 2, 2.5, 3] as const;

  function turnAriaLabel(t: number): string {
    if (t === 0) return "No turns";
    if (t === 0.5) return "Half turn";
    if (t === 1) return "1 turn";
    if (t === 1.5) return "1 and a half turns";
    if (t === 2) return "2 turns";
    if (t === 2.5) return "2 and a half turns";
    if (t === 3) return "3 turns";
    return `${t} turns`;
  }

  function toggleRotation(): void {
    const next = builderState.rotationDirection === RotationDirection.CLOCKWISE
      ? RotationDirection.COUNTER_CLOCKWISE
      : RotationDirection.CLOCKWISE;
    builderState.setRotationDirection(next);
  }

  const rotLabel = $derived(
    builderState.rotationDirection === RotationDirection.CLOCKWISE ? "CW" : "CCW"
  );

  const rotAriaLabel = $derived(
    builderState.rotationDirection === RotationDirection.CLOCKWISE
      ? "Rotation direction: Clockwise"
      : "Rotation direction: Counter-clockwise"
  );

  const isFlipped = $derived(
    builderState.rotationDirection === RotationDirection.COUNTER_CLOCKWISE
  );
</script>

<div
  class="turn-bar-card"
  class:dimmed={motionDimmed}
  class:hidden-bar={motionHidden}
>
  <button
    class="rotation-toggle"
    onclick={toggleRotation}
    disabled={!motionEnabled}
    aria-disabled={!motionEnabled}
    aria-label={rotAriaLabel}
  >
    <i class="fas fa-rotate-right" class:flipped={isFlipped} aria-hidden="true"></i>
    <span class="rot-label">{rotLabel}</span>
  </button>

  <div class="divider" aria-hidden="true"></div>

  <div class="turns-strip" role="radiogroup" aria-label="Turn count">
    {#each TURN_OPTIONS as t}
      <button
        class="turn-pill"
        class:active={builderState.turnCount === t}
        role="radio"
        aria-checked={builderState.turnCount === t}
        aria-label={turnAriaLabel(t)}
        disabled={!motionEnabled}
        aria-disabled={!motionEnabled}
        onclick={() => builderState.setTurnCount(t)}
      >
        {t}
      </button>
    {/each}
  </div>
</div>

<style>
  .turn-bar-card {
    display: flex;
    align-items: center;
    gap: 0;
    background: linear-gradient(145deg, rgba(20, 25, 40, 0.9), rgba(15, 18, 30, 0.95));
    border-radius: 16px;
    border: 1.5px solid rgba(255, 255, 255, 0.08);
    padding: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    flex-shrink: 0;
    transition: opacity 0.2s ease;
  }

  .turn-bar-card.dimmed {
    opacity: 0.3;
    pointer-events: none;
  }

  .turn-bar-card.hidden-bar {
    opacity: 0;
    pointer-events: none;
  }

  .rotation-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 14px;
    border: none;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.7);
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    min-height: var(--min-touch-target, 44px);
    transition: background 0.15s ease;
    flex-shrink: 0;
  }

  .rotation-toggle:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
  }

  .rotation-toggle:disabled {
    cursor: default;
  }

  .rotation-toggle i {
    font-size: 14px;
    transition: transform 0.2s ease;
  }

  .rotation-toggle i.flipped {
    transform: scaleX(-1);
  }

  .rot-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    letter-spacing: 0.04em;
  }

  .divider {
    width: 1px;
    height: 28px;
    background: rgba(255, 255, 255, 0.1);
    margin: 0 6px;
    flex-shrink: 0;
  }

  .turns-strip {
    display: flex;
    gap: 4px;
    flex: 1;
  }

  .turn-pill {
    flex: 1;
    padding: 10px 4px;
    border: none;
    border-radius: 10px;
    background: transparent;
    color: rgba(255, 255, 255, 0.5);
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    min-height: var(--min-touch-target, 44px);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .turn-pill:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.85);
  }

  .turn-pill.active {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
  }

  .turn-pill:disabled {
    cursor: default;
  }

  /* Focus indicators */
  .turn-pill:focus-visible,
  .rotation-toggle:focus-visible {
    outline: 2px solid #ffffff;
    outline-offset: 2px;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .turn-bar-card,
    .turn-pill,
    .rotation-toggle,
    .rotation-toggle i {
      transition: none;
    }
  }
</style>
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npm run check`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/visual-builder-lab/components/BuilderTurnBar.svelte
git commit -m "feat(assemble): add BuilderTurnBar component"
```

---

### Task 3: Slim down BuilderControls to action overlay only

**Files:**
- Modify: `src/lib/features/visual-builder-lab/components/BuilderControls.svelte`

Remove the instruction badge (lines 104-127) and the bottom-left motion card (lines 129-166) from BuilderControls. Keep only the bottom-right action buttons (undo, back, done, complete, new, trash) and the orientation pills. The orientation row stays as a grid overlay since it appears during the placing phase.

- [ ] **Step 1: Remove instruction badge and turn bar from BuilderControls**

Remove from the template:
- The entire `.cluster.top-left` div (the instruction badge) — but keep the orientation row, moving it to a standalone position
- The entire `.cluster.bottom-left` div (the motion card with rotation + turns)

The remaining template should be:
- The `.controls-overlay` wrapper
- The orientation row (repositioned to top-left as its own cluster)
- The `.cluster.bottom-right` with all action buttons

Remove from the `<style>`:
- `.instruction-badge`, `.hand-dot`, `.instruction-text` rules
- `.motion-card`, `.rotation-toggle`, `.rot-label`, `.divider`, `.turns-strip`, `.turn-pill` rules
- `.cluster.bottom-left` rules

Remove from `<script>`:
- `phaseMessage` derivation
- `TURN_OPTIONS` constant
- `turnAriaLabel` function
- `toggleRotation` function
- `rotLabel`, `rotAriaLabel`, `isFlipped` derivations
- `motionEnabled`, `motionDimmed`, `motionHidden` derivations (these are now in BuilderTurnBar)

Keep in `<script>`:
- `handLabel`, `handColor` (used by action buttons)
- `isAnimating`, `isActive`, `isComplete`, `isDonePhase`, `isIdle` (used by action buttons and orientation)
- `showOrientation`, `ORIENTATIONS` (orientation pills stay)
- `isBlueHand` (used by action buttons)

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npm run check`
Expected: No new errors. BuilderControls still compiles with just action buttons + orientation.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/visual-builder-lab/components/BuilderControls.svelte
git commit -m "refactor(assemble): slim BuilderControls to action overlay + orientation"
```

---

### Task 4: Restructure AssembleToolPanel layout

**Files:**
- Modify: `src/lib/features/create/visual-builder/components/AssembleToolPanel.svelte`

Change from two-section (controls + grid) to three-section vertical stack (instruction header + grid + turn bar), with BuilderControls as an overlay on the grid section.

- [ ] **Step 1: Update the component**

```svelte
<!--
  AssembleToolPanel - Tool panel content for the Assemble tab.

  Three-section vertical stack:
  - Instruction header (centered step label + action text)
  - Grid card (interactive pictograph with action button overlays)
  - Turn bar (rotation + turn count pills)
-->
<script lang="ts">
  import type { AssembleTabState } from "../../shared/state/assemble-tab-state.svelte";
  import BuilderInstructionHeader from "$lib/features/visual-builder-lab/components/BuilderInstructionHeader.svelte";
  import BuilderControls from "$lib/features/visual-builder-lab/components/BuilderControls.svelte";
  import InteractiveGrid from "$lib/features/visual-builder-lab/components/InteractiveGrid.svelte";
  import BuilderTurnBar from "$lib/features/visual-builder-lab/components/BuilderTurnBar.svelte";

  let { tabState }: { tabState: AssembleTabState } = $props();

  const builderState = $derived(tabState.assembleBuilderState);
</script>

<div class="assemble-tool-panel">
  <BuilderInstructionHeader {builderState} />

  <div class="grid-section">
    <InteractiveGrid {builderState} />
    <BuilderControls {builderState} />
  </div>

  <div class="turn-bar-section">
    <BuilderTurnBar {builderState} />
  </div>
</div>

<style>
  .assemble-tool-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    overflow: hidden;
    padding: 0 12px 12px;
    gap: 8px;
  }

  .grid-section {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .turn-bar-section {
    flex-shrink: 0;
  }
</style>
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npm run check`
Expected: No errors. The panel should compile with all three new components.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/create/visual-builder/components/AssembleToolPanel.svelte
git commit -m "refactor(assemble): restructure panel to 3-section vertical stack"
```

---

## Chunk 2: Visual Polish

### Task 5: Update InteractiveGrid background styling

**Files:**
- Modify: `src/lib/features/visual-builder-lab/components/InteractiveGrid.svelte`

Change the grid container and SVG background from flat black to a warm gradient card.

- [ ] **Step 1: Update the `.interactive-grid` CSS (line 448-455)**

Replace:
```css
.interactive-grid {
  width: 100%;
  height: 100%;
  aspect-ratio: 1;
  border-radius: 12px;
  overflow: hidden;
  border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
}
```

With:
```css
.interactive-grid {
  width: 100%;
  max-height: 100%;
  aspect-ratio: 1;
  border-radius: 20px;
  overflow: hidden;
  border: 1.5px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.04);
}
```

- [ ] **Step 2: Update the `.grid-background` fill (line 464-466)**

Replace:
```css
.grid-background {
  fill: var(--dm-pictograph-bg, #0a0a0f);
}
```

With:
```css
.grid-background {
  fill: #0e1118;
}
```

- [ ] **Step 3: Add an SVG gradient definition for the background**

In the SVG template (line 291), add a `<defs>` block before the background rect:

```svelte
<svg viewBox="0 0 950 950" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <defs>
    <linearGradient id="grid-bg-gradient" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="rgb(20, 25, 40)" />
      <stop offset="100%" stop-color="rgb(10, 12, 22)" />
    </linearGradient>
  </defs>
  <!-- Layer 0: Warm gradient background -->
  <rect x="0" y="0" width="950" height="950" fill="url(#grid-bg-gradient)" />
```

Remove the `class="grid-background"` from the rect since we're using `fill` directly via the gradient. Also remove the `.grid-background` CSS rule.

- [ ] **Step 4: Verify no TypeScript errors**

Run: `npm run check`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/visual-builder-lab/components/InteractiveGrid.svelte
git commit -m "style(assemble): warm gradient background and rounded grid card"
```

---

### Task 6: Increase hit target radius

**Files:**
- Modify: `src/lib/features/visual-builder-lab/services/implementations/GridHitTargetCalculator.ts:25`

- [ ] **Step 1: Update the constant**

Change line 25 from:
```typescript
const HIT_TARGET_RADIUS = 45;
```
To:
```typescript
const HIT_TARGET_RADIUS = 60;
```

Also update the comment on line 24:
```typescript
/** SVG-unit radius for hit targets. At typical render sizes, this maps to ~64px (WCAG AAA). */
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npm run check`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/visual-builder-lab/services/implementations/GridHitTargetCalculator.ts
git commit -m "style(assemble): increase grid hit target radius from 45 to 60"
```

---

### Task 7: Boost pulse animation glow intensity

**Files:**
- Modify: `src/lib/features/visual-builder-lab/components/InteractiveGrid.svelte`

Increase the peak glow values in the pulse keyframes so the larger targets have a more visible "tap me" invitation.

- [ ] **Step 1: Update the blue pulse keyframes (lines 594-610)**

Change the 50% keyframe from:
```css
fill: color-mix(in srgb, var(--prop-blue, #2e8bf0) 16%, transparent);
stroke: color-mix(in srgb, var(--prop-blue, #2e8bf0) 80%, transparent);
stroke-width: 3;
```
To:
```css
fill: color-mix(in srgb, var(--prop-blue, #2e8bf0) 20%, transparent);
stroke: color-mix(in srgb, var(--prop-blue, #2e8bf0) 90%, transparent);
stroke-width: 3.5;
```

- [ ] **Step 2: Update the red pulse keyframes (lines 613-629) with same pattern**

Change the 50% keyframe from:
```css
fill: color-mix(in srgb, var(--prop-red, #ed1c24) 16%, transparent);
stroke: color-mix(in srgb, var(--prop-red, #ed1c24) 80%, transparent);
stroke-width: 3;
```
To:
```css
fill: color-mix(in srgb, var(--prop-red, #ed1c24) 20%, transparent);
stroke: color-mix(in srgb, var(--prop-red, #ed1c24) 90%, transparent);
stroke-width: 3.5;
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/visual-builder-lab/components/InteractiveGrid.svelte
git commit -m "style(assemble): boost pulse animation glow on hit targets"
```

---

### Task 8: Final verification

- [ ] **Step 1: Run full typecheck**

Run: `npm run check`
Expected: No errors

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Visual verification**

Tell the user: "Changes are ready. Please check the Assemble tab on mobile (or narrow viewport) and confirm:
1. Centered instruction header shows 'Step 1 of 2: Tap a starting point' with blue glow dot
2. Grid has warm gradient background with rounded 20px corners
3. Grid dot targets are visibly larger
4. Turn bar below the grid has bubbly pills with proper spacing
5. Action buttons (undo, next:red, etc.) still overlay the grid correctly"
