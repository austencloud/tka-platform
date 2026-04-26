# Grid Lesson Point Tap Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the grid lesson's static summary step with a guided point-tap interaction where users build the 9-point grid by tapping each point into existence.

**Architecture:** Extend the existing grid experience state machine with tap tracking (tapPhase + tappedPoints array). Create one new Svelte component (GridPointTapStep) that renders an SVG grid with tappable points. Modify the orchestrator to insert the tap step before the completion screen.

**Tech Stack:** Svelte 5 (runes), TypeScript, SVG, CSS animations

**Spec:** `docs/superpowers/specs/2026-03-17-grid-lesson-point-tap-design.md`

---

### Task 1: Extend the state machine

**Files:**
- Modify: `src/lib/features/learn/components/interactive/grid-concept/grid-experience-state.svelte.ts`

- [ ] **Step 1: Add tap types and state**

Add the new types and state fields. Insert after the existing type exports (line 11):

```typescript
export type TapPhase = 'center' | 'hand' | 'outer' | 'complete';
```

Inside `createGridExperienceState()`, after the existing state declarations (after line 36):

```typescript
let tapPhase = $state<TapPhase>('center');
let tappedPoints = $state<string[]>([]);
```

- [ ] **Step 2: Update totalSteps**

Change `const totalSteps = 4;` to `const totalSteps = 5;`

- [ ] **Step 3: Add tapPoint action**

Add this function inside `createGridExperienceState()`, after `handleBackPhase()`:

```typescript
// Returns the new tapPhase after processing the tap, or null if rejected
function tapPoint(pointId: string, onAllComplete?: () => void): TapPhase | null {
  if (tappedPoints.includes(pointId)) return null;

  const centerIds = ['center'];
  const handIds = ['hn', 'he', 'hs', 'hw'];
  const outerIds = ['n', 'e', 's', 'w'];

  // Validate point belongs to current phase
  const validIds =
    tapPhase === 'center' ? centerIds :
    tapPhase === 'hand' ? handIds :
    tapPhase === 'outer' ? outerIds : [];

  if (!validIds.includes(pointId)) return null;

  tappedPoints = [...tappedPoints, pointId];

  // Check if current group is complete, advance phase
  if (tapPhase === 'center' && tappedPoints.length === 1) {
    tapPhase = 'hand';
    announce();
  } else if (tapPhase === 'hand' && tappedPoints.filter(id => handIds.includes(id)).length === 4) {
    tapPhase = 'outer';
    announce();
  } else if (tapPhase === 'outer' && tappedPoints.filter(id => outerIds.includes(id)).length === 4) {
    tapPhase = 'complete';
    announce();
    // Auto-advance to completion step after 800ms celebration
    if (onAllComplete) {
      setTimeout(onAllComplete, 800);
    }
  }

  return tapPhase;
}

function resetTapState() {
  tapPhase = 'center';
  tappedPoints = [];
}
```

- [ ] **Step 4: Update announcements**

In `getAnnouncement()`, update ALL step counts from "of 4" to "of 5" and add the new steps. Replace the entire function body:

```typescript
function getAnnouncement(): string {
  if (step === 0) return 'Step 1 of 5: The Grid. A 4-point diamond grid.';
  if (step === 1) {
    if (gridPhase === 'split')
      return 'Step 2 of 5: Two Grid Modes. Diamond and Box grids shown side by side.';
    if (gridPhase === 'diamond-labels')
      return 'Diamond mode: Cardinal directions North, East, South, West.';
    if (gridPhase === 'box-labels')
      return 'Box mode: Intercardinal directions Northeast, Southeast, Southwest, Northwest.';
    if (gridPhase === 'merged')
      return 'The grids merge to form the complete 8-point grid.';
  }
  if (step === 2) {
    if (pointTypePhase === 'center')
      return 'Step 3 of 5: Point Types. The center point is highlighted.';
    if (pointTypePhase === 'hand') return '4 hand points are highlighted.';
    if (pointTypePhase === 'outer') return '4 outer points are highlighted.';
  }
  if (step === 3) {
    if (tapPhase === 'center') return 'Step 4 of 5: Build the Grid. Tap the center point.';
    if (tapPhase === 'hand') return 'Tap each hand point.';
    if (tapPhase === 'outer') return 'Tap each outer point.';
    if (tapPhase === 'complete') return 'Grid complete!';
  }
  if (step === 4) return "Step 5 of 5: Lesson complete.";
  return '';
}
```

- [ ] **Step 5: Update prevStep to reset tap state**

In `prevStep()`, add a reset when returning to step 3. After the existing `if (step === 2)` block:

```typescript
if (step === 3) {
  resetTapState();
}
```

- [ ] **Step 6: Update skipToSummary target**

Change `step = 3` to `step = 4` in `skipToSummary()` since summary is now step 4.

- [ ] **Step 7: Expose new state in return object**

Add to the return object's getters:

```typescript
get tapPhase() { return tapPhase; },
get tappedPoints() { return tappedPoints; },
```

Add to the return object's actions:

```typescript
tapPoint,
resetTapState,
```

- [ ] **Step 8: Verify typecheck passes**

Run: `npm run check 2>&1 | grep -c "Error"` — should show same error count as before starting (no new errors introduced).

- [ ] **Step 9: Commit**

```
feat(learn): extend grid experience state with tap interaction tracking
```

---

### Task 2: Create GridPointTapStep component

**Files:**
- Create: `src/lib/features/learn/components/interactive/grid-concept/GridPointTapStep.svelte`

- [ ] **Step 1: Create the component**

```svelte
<!--
  GridPointTapStep - Interactive grid building through point tapping
  User taps center → hand points → outer points to build the complete grid
-->
<script lang="ts">
  import { GRID, CARDINAL_HAND, CARDINAL_OUTER } from '../grid-merge/grid-merge-constants';
  import { container } from '$lib/shared/di';
  import type { TapPhase } from './grid-experience-state.svelte';

  let {
    tapPhase,
    tappedPoints,
    onTapPoint,
  } = $props<{
    tapPhase: TapPhase;
    tappedPoints: string[];
    onTapPoint: (pointId: string) => TapPhase | null;
  }>();

  const hapticService = container.items.hapticFeedback;

  // All 9 points with their metadata
  const ALL_POINTS = [
    { id: 'center', x: GRID.CENTER, y: GRID.CENTER, group: 'center' as const, label: 'Center', ariaLabel: 'Center point' },
    ...CARDINAL_HAND.map(p => ({ id: p.id, x: p.x, y: p.y, group: 'hand' as const, label: p.id.slice(1).toUpperCase(), ariaLabel: `${({ hn: 'North', he: 'East', hs: 'South', hw: 'West' } as Record<string, string>)[p.id]} hand point` })),
    ...CARDINAL_OUTER.map(p => ({ id: p.id, x: p.x, y: p.y, group: 'outer' as const, label: p.id.toUpperCase(), ariaLabel: `${({ n: 'North', e: 'East', s: 'South', w: 'West' } as Record<string, string>)[p.id]} outer point` })),
  ];

  // Track which points just got tapped for the pop animation
  let recentlyTapped = $state<string | null>(null);

  // Instruction text per phase
  const instruction = $derived(
    tapPhase === 'center' ? 'Tap the center point' :
    tapPhase === 'hand' ? 'Tap each hand point' :
    tapPhase === 'outer' ? 'Tap each outer point' :
    'Grid complete!'
  );

  function getPointState(point: typeof ALL_POINTS[0]): 'hidden' | 'pulsing' | 'filled' {
    if (tappedPoints.includes(point.id)) return 'filled';
    if (point.group === tapPhase) return 'pulsing';
    return 'hidden';
  }

  function handleTap(pointId: string) {
    const newPhase = onTapPoint(pointId);
    if (newPhase === null) return;

    hapticService?.trigger('selection');
    recentlyTapped = pointId;
    setTimeout(() => {
      if (recentlyTapped === pointId) recentlyTapped = null;
    }, 800);

    // The state machine handles auto-advance timing when phase is 'complete'
    if (newPhase === 'complete') {
      hapticService?.trigger('success');
    }
  }

  function handleKeydown(event: KeyboardEvent, pointId: string) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleTap(pointId);
    }
  }

  // Tap target radius: 44px minimum in SVG space (WCAG AAA)
  const TAP_RADIUS = 44;
  // Visual radii per group
  const VISUAL_RADIUS = {
    center: GRID.CENTER_POINT_RADIUS,
    hand: GRID.HAND_POINT_RADIUS,
    outer: GRID.POINT_RADIUS,
  };
</script>

<div class="tap-step">
  <h2 class="tap-title anim-item" style="--anim-order: 0">Build the Grid</h2>
  <p class="tap-instruction anim-item" style="--anim-order: 1">{instruction}</p>

  <div class="tap-grid-container anim-item" style="--anim-order: 2">
    <svg viewBox="0 0 {GRID.SIZE} {GRID.SIZE}" class="tap-svg">
      {#each ALL_POINTS as point (point.id)}
        {@const state = getPointState(point)}
        {@const visualR = VISUAL_RADIUS[point.group]}
        <g class="tap-point-group">
          <!-- Invisible tap target (always meets 44px minimum) -->
          {#if state === 'pulsing'}
            <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
            <circle
              cx={point.x}
              cy={point.y}
              r={TAP_RADIUS}
              class="tap-target"
              role="button"
              tabindex="0"
              aria-label={point.ariaLabel}
              onclick={() => handleTap(point.id)}
              onkeydown={(e) => handleKeydown(e, point.id)}
            />
          {/if}

          <!-- Visual point -->
          <circle
            cx={point.x}
            cy={point.y}
            r={visualR}
            class="tap-point"
            class:hidden={state === 'hidden'}
            class:pulsing={state === 'pulsing'}
            class:filled={state === 'filled'}
            class:pop={recentlyTapped === point.id}
          />

          <!-- Floating label on tap -->
          {#if recentlyTapped === point.id}
            <text
              x={point.x}
              y={point.y - visualR - 20}
              class="tap-label"
              text-anchor="middle"
              dominant-baseline="auto"
            >
              {point.label}
            </text>
          {/if}
        </g>
      {/each}

      <!-- Completion glow -->
      {#if tapPhase === 'complete'}
        <circle
          cx={GRID.CENTER}
          cy={GRID.CENTER}
          r={GRID.OUTER_RADIUS + 40}
          class="completion-glow"
        />
      {/if}
    </svg>
  </div>
</div>

<style>
  .tap-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-md, 1rem);
    width: 100%;
    max-width: 700px;
    flex: 1;
    justify-content: center;
  }

  .tap-title {
    font-size: 2rem;
    font-weight: 800;
    color: var(--theme-text);
    margin: 0;
    text-align: center;
    letter-spacing: -0.02em;
  }

  .tap-instruction {
    font-size: 1.125rem;
    color: var(--theme-text);
    margin: 0;
    text-align: center;
    min-height: 1.8em;
  }

  .tap-grid-container {
    width: 100%;
    max-width: 500px;
    display: flex;
    justify-content: center;
  }

  .tap-svg {
    width: 100%;
    height: auto;
  }

  /* Tap target: invisible, large hit area */
  .tap-target {
    fill: transparent;
    cursor: pointer;
    outline: none;
  }

  .tap-target:focus-visible {
    stroke: var(--theme-accent, #22d3ee);
    stroke-width: 3;
    stroke-dasharray: 6 3;
  }

  /* Point visual states */
  .tap-point {
    transition: opacity 0.3s ease, transform 0.3s ease;
    transform-origin: center;
    fill: var(--theme-accent, #22d3ee);
  }

  .tap-point.hidden {
    opacity: 0;
    pointer-events: none;
  }

  .tap-point.pulsing {
    opacity: 0.5;
    stroke: var(--theme-accent, #22d3ee);
    stroke-width: 2;
    fill: transparent;
    animation: pulse 1.5s ease-in-out infinite;
  }

  .tap-point.filled {
    opacity: 1;
  }

  .tap-point.pop {
    animation: popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }

  /* Floating label */
  .tap-label {
    font-size: 28px;
    font-weight: 700;
    fill: var(--theme-text, #fff);
    font-family: system-ui, -apple-system, sans-serif;
    animation: labelFloat 0.8s ease-out forwards;
    pointer-events: none;
  }

  /* Completion glow */
  .completion-glow {
    fill: none;
    stroke: var(--theme-accent, #22d3ee);
    stroke-width: 2;
    opacity: 0;
    animation: glowPulse 0.5s ease-out forwards;
  }

  /* Animations */
  @keyframes pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.8; }
  }

  @keyframes popIn {
    0% { transform: scale(0); opacity: 0; }
    70% { transform: scale(1.2); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }

  @keyframes labelFloat {
    0% { opacity: 0; transform: translateY(5px); }
    20% { opacity: 1; transform: translateY(0); }
    80% { opacity: 1; }
    100% { opacity: 0; }
  }

  @keyframes glowPulse {
    0% { opacity: 0; transform: scale(0.8); }
    50% { opacity: 0.6; }
    100% { opacity: 0; transform: scale(1.1); }
  }

  /* Animation entry items */
  .anim-item {
    opacity: 0;
    transform: translateY(20px);
  }

  :global(.animate-in) .anim-item {
    animation: fadeSlideUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    animation-delay: calc(var(--anim-order, 0) * 120ms);
  }

  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Responsive */
  @media (max-width: 768px) {
    .tap-title { font-size: 1.75rem; }
    .tap-instruction { font-size: 1rem; }
  }

  @media (max-height: 1000px) {
    .tap-step { gap: var(--spacing-sm, 0.5rem); }
    .tap-title { font-size: 1.5rem; }
    .tap-grid-container { max-width: 400px; }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .tap-point.pulsing { animation: none; opacity: 0.6; }
    .tap-point.pop { animation: none; opacity: 1; }
    .tap-label { animation: none; opacity: 1; }
    .completion-glow { animation: none; opacity: 0.4; }
    .anim-item { opacity: 1; transform: none; }
    :global(.animate-in) .anim-item { animation: none; opacity: 1; transform: none; }
  }
</style>
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run check 2>&1 | grep -c "Error"` — should show same count as before.

- [ ] **Step 3: Commit**

```
feat(learn): add GridPointTapStep component for interactive grid building
```

---

### Task 3: Wire into GridConceptExperience orchestrator

**Files:**
- Modify: `src/lib/features/learn/components/interactive/GridConceptExperience.svelte`

- [ ] **Step 1: Add import**

Add after the existing imports:

```typescript
import GridPointTapStep from './grid-concept/GridPointTapStep.svelte';
```

- [ ] **Step 2: Update skip link condition**

Change `{#if experienceState.step < 3}` to `{#if experienceState.step < 4}`.

- [ ] **Step 3: Update step rendering**

Replace the condition `{#if experienceState.step <= 2}` block through `{:else if experienceState.step === 3}` to handle the new step layout:

```svelte
{#if experienceState.step <= 2}
  <!-- Steps 0, 1 & 2: Grid content (unchanged) -->
  <div class="step-content step-grid-content">
    <GridStepHeader
      step={experienceState.step}
      gridPhase={experienceState.gridPhase}
      pointTypePhase={experienceState.pointTypePhase}
    />

    <div class="merge-animation-container">
      <GridMergeAnimation
        phase={experienceState.effectivePhase}
        highlightPhase={experienceState.effectiveHighlightPhase}
      />
    </div>

    <div
      class="navigation-area anim-item"
      style="--anim-order: {experienceState.step === 0 ? 3 : experienceState.step === 1 ? 4 : 2}"
    >
      <button class="next-button" onclick={handleNext} bind:this={nextButtonRef}>Next</button>
      <ExperienceProgressIndicator currentStep={experienceState.step + 1} totalSteps={experienceState.totalSteps} />
    </div>
  </div>
{:else if experienceState.step === 3}
  <!-- Step 3: Point tap interaction -->
  <div class="step-content step-grid-content">
    <GridPointTapStep
      tapPhase={experienceState.tapPhase}
      tappedPoints={experienceState.tappedPoints}
      onTapPoint={(id) => experienceState.tapPoint(id, () => experienceState.nextStep(focusNextAction))}
    />
    <ExperienceProgressIndicator currentStep={experienceState.step + 1} totalSteps={experienceState.totalSteps} />
  </div>
{:else if experienceState.step === 4}
  <GridSummaryStep
    animateIn={experienceState.animateIn}
    totalSteps={experienceState.totalSteps}
    currentStep={experienceState.step + 1}
    onComplete={handleComplete}
    bind:this={summaryStepRef}
  />
{/if}
```

- [ ] **Step 4: Update focusNextAction**

Change `experienceState.step === 3` to `experienceState.step === 4` in `focusNextAction()`, since the summary step (which has the complete button) is now step 4:

```typescript
function focusNextAction() {
  requestAnimationFrame(() => {
    if (experienceState.step === 4 && summaryStepRef) {
      summaryStepRef.focusCompleteButton();
    } else if (nextButtonRef) {
      nextButtonRef.focus();
    }
  });
}
```

- [ ] **Step 5: Update keyboard handler**

In `handleKeydown`, disable ArrowRight/ArrowDown during step 3:

```typescript
function handleKeydown(event: KeyboardEvent) {
  if (viewMode !== 'step') return;

  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    if (experienceState.step === 3) return; // Tap step advances via tapping
    event.preventDefault();
    handleNext();
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault();
    handleBack();
  }
}
```

- [ ] **Step 6: Verify typecheck passes**

Run: `npm run check 2>&1 | grep -c "Error"`

- [ ] **Step 7: Commit**

```
feat(learn): wire GridPointTapStep into grid lesson at step 3
```

---

### Task 4: Simplify GridSummaryStep

**Files:**
- Modify: `src/lib/features/learn/components/interactive/grid-concept/GridSummaryStep.svelte`

- [ ] **Step 1: Remove summary cards**

Remove the entire `.summary-content` div (the two summary cards and the intro text). Keep the title, completion section, and all their styles. The component should render:

1. "You've Got the Grid!" title
2. "Next up: Hand Positions" teaser
3. "Complete Lesson" button
4. ExperienceProgressIndicator

- [ ] **Step 2: Remove unused CSS**

Remove styles for: `.summary-content`, `.summary-text`, `.summary-cards`, `.summary-card`, `.summary-icon`, `.summary-icon i`, `.summary-card h3`, `.summary-card p`.

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run check 2>&1 | grep -c "Error"`

- [ ] **Step 4: Commit**

```
refactor(learn): simplify GridSummaryStep, remove summary cards
```

---

### Task 5: Manual verification

**Files:** None (verification only)

- [ ] **Step 1: Navigate to the grid lesson**

Open the app → Learn → Concepts → Grid. Start the lesson in step mode.

- [ ] **Step 2: Walk through steps 0-2**

Verify steps 0 (intro), 1 (grid modes), and 2 (point types) still work exactly as before. Next/Back navigation, phase transitions, animations.

- [ ] **Step 3: Verify step 3 (tap interaction)**

On step 3:
- Grid appears with no visible points
- "Build the Grid" title, "Tap the center point" instruction
- Center point pulses, tapping it fills it with a pop + "Center" label
- 4 hand points pulse, each tappable in any order, each pops + labels
- 4 outer points pulse, same behavior
- After 9th tap: glow animation, then auto-advances to step 4

- [ ] **Step 4: Verify step 4 (completion)**

- "You've Got the Grid!" title
- "Next up: Hand Positions" text
- "Complete Lesson" button works, returns to concept list

- [ ] **Step 5: Verify back navigation**

Press Back during the tap step → returns to step 2 (outer points). Navigate forward again to step 3 → tap interaction restarts from center.

- [ ] **Step 6: Verify keyboard navigation**

Tab through pulsing points, Enter/Space to tap. ArrowRight does nothing on step 3. ArrowLeft goes back.

- [ ] **Step 7: Verify Z Fold layout**

Check on Z Fold or narrow-height viewport. The tap step should fit without scrolling (max-height constraints from earlier fix still apply).

- [ ] **Step 8: Final commit (if any touch-ups needed)**

```
fix(learn): polish grid point tap interaction
```
