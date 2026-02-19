<!--
  InteractiveGrid.svelte - Clickable pictograph grid for visual sequence building

  Renders a proper pictograph-style square with dark background and border,
  matching how pictographs appear elsewhere in the app. Grid hand points
  are overlaid with clickable hit targets.

  Layers:
  1. Dark background rect
  2. GridSvg - the grid lines/circles
  3. Props at their positions (blue/red indicators)
  4. Motion arrows between start and end
  5. Hit target circles at each grid hand point (clickable)
-->
<script lang="ts">
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import GridSvg from "$lib/shared/pictograph/grid/components/GridSvg.svelte";
  import type { GridHitTarget } from "../services/contracts/IGridHitTargetCalculator";
  import { GridHitTargetCalculator } from "../services/implementations/GridHitTargetCalculator";
  import type { VisualBuilderState } from "../state/visual-builder-state.svelte";

  let { state }: { state: VisualBuilderState } = $props();

  const calculator = new GridHitTargetCalculator();

  const hitTargets = $derived(calculator.getHitTargets(state.gridMode));
  const hitRadius = calculator.getHitTargetRadius();

  // Prop indicator radius (smaller than hit target)
  const PROP_RADIUS = 28;

  function handleTargetClick(target: GridHitTarget): void {
    state.handlePointClick(target.location);
  }

  function isBlueAt(target: GridHitTarget): boolean {
    return state.blueStart === target.location || state.blueEnd === target.location;
  }

  function isRedAt(target: GridHitTarget): boolean {
    return state.redStart === target.location || state.redEnd === target.location;
  }

  function isActiveTarget(target: GridHitTarget): boolean {
    if (state.buildPhase === "select-start") return true;
    // In select-end, all points except start are valid
    return target.location !== state.activeHandStart;
  }

  function getTargetLabel(target: GridHitTarget): string {
    const handLabel = state.activeHand === MotionColor.BLUE ? "Blue" : "Red";
    const phaseLabel = state.buildPhase === "select-start" ? "start" : "end";
    return `Set ${handLabel} ${phaseLabel} to ${target.label}`;
  }
</script>

<div class="interactive-grid" role="application" aria-label="Visual sequence builder grid">
  <svg viewBox="0 0 950 950" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
    <!-- Layer 0: Dark background matching pictograph style -->
    <rect x="0" y="0" width="950" height="950" class="grid-background" />

    <!-- Layer 1: Grid lines and points -->
    <GridSvg gridMode={state.gridMode} />

    <!-- Layer 2: Prop indicators at occupied positions -->
    {#each hitTargets as target (target.location)}
      {#if isBlueAt(target)}
        <circle
          cx={target.x}
          cy={target.y}
          r={PROP_RADIUS}
          class="prop-indicator blue-prop"
          class:is-start={state.blueStart === target.location}
          class:is-end={state.blueEnd === target.location}
        />
      {/if}
      {#if isRedAt(target)}
        <circle
          cx={target.x}
          cy={target.y}
          r={PROP_RADIUS}
          class="prop-indicator red-prop"
          class:is-start={state.redStart === target.location}
          class:is-end={state.redEnd === target.location}
        />
      {/if}
    {/each}

    <!-- Layer 3: Motion arrows (lines between start and end) -->
    {#if state.blueStart !== null && state.blueEnd !== null}
      {@const startTarget = hitTargets.find(t => t.location === state.blueStart)}
      {@const endTarget = hitTargets.find(t => t.location === state.blueEnd)}
      {#if startTarget && endTarget}
        <line
          x1={startTarget.x}
          y1={startTarget.y}
          x2={endTarget.x}
          y2={endTarget.y}
          class="motion-line blue-line"
          marker-end="url(#blue-arrow)"
        />
      {/if}
    {/if}
    {#if state.redStart !== null && state.redEnd !== null}
      {@const startTarget = hitTargets.find(t => t.location === state.redStart)}
      {@const endTarget = hitTargets.find(t => t.location === state.redEnd)}
      {#if startTarget && endTarget}
        <line
          x1={startTarget.x}
          y1={startTarget.y}
          x2={endTarget.x}
          y2={endTarget.y}
          class="motion-line red-line"
          marker-end="url(#red-arrow)"
        />
      {/if}
    {/if}

    <!-- Arrow markers -->
    <defs>
      <marker id="blue-arrow" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="var(--prop-blue, #2e8bf0)" />
      </marker>
      <marker id="red-arrow" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="var(--prop-red, #ed1c24)" />
      </marker>
    </defs>

    <!-- Layer 4: Hit targets (always on top for clicks) -->
    {#each hitTargets as target (target.location)}
      <circle
        cx={target.x}
        cy={target.y}
        r={hitRadius}
        class="hit-target"
        class:active-hand-blue={state.activeHand === MotionColor.BLUE}
        class:active-hand-red={state.activeHand === MotionColor.RED}
        class:disabled={!isActiveTarget(target)}
        role="button"
        tabindex="0"
        aria-label={getTargetLabel(target)}
        onclick={() => handleTargetClick(target)}
        onkeydown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleTargetClick(target);
          }
        }}
      />
    {/each}
  </svg>
</div>

<style>
  .interactive-grid {
    width: 100%;
    height: 100%;
    aspect-ratio: 1;
    border-radius: 12px;
    overflow: hidden;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
  }

  .interactive-grid svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  /* Dark background matching pictograph containers */
  .grid-background {
    fill: rgba(10, 10, 18, 0.95);
  }

  :global(:root:not(.dark)) .grid-background {
    fill: rgba(245, 245, 250, 0.95);
  }

  /* Prop indicators */
  .prop-indicator {
    pointer-events: none;
    transition: r 0.2s ease, opacity 0.2s ease;
  }

  .blue-prop {
    fill: var(--prop-blue, #2e8bf0);
    opacity: 0.85;
  }

  .red-prop {
    fill: var(--prop-red, #ed1c24);
    opacity: 0.85;
  }

  .prop-indicator.is-start {
    opacity: 0.5;
  }

  .prop-indicator.is-end {
    opacity: 1;
  }

  /* Motion lines */
  .motion-line {
    stroke-width: 4;
    stroke-linecap: round;
    opacity: 0.7;
    pointer-events: none;
  }

  .blue-line {
    stroke: var(--prop-blue, #2e8bf0);
  }

  .red-line {
    stroke: var(--prop-red, #ed1c24);
  }

  /* Hit targets */
  .hit-target {
    fill: rgba(255, 255, 255, 0.04);
    stroke: rgba(255, 255, 255, 0.2);
    stroke-width: 2;
    cursor: pointer;
    transition: fill 0.15s ease, stroke 0.15s ease, stroke-width 0.15s ease;
  }

  .hit-target:hover {
    stroke-width: 3;
  }

  .hit-target.active-hand-blue:hover {
    fill: rgba(46, 139, 240, 0.2);
    stroke: var(--prop-blue, #2e8bf0);
  }

  .hit-target.active-hand-red:hover {
    fill: rgba(237, 28, 36, 0.2);
    stroke: var(--prop-red, #ed1c24);
  }

  .hit-target:focus-visible {
    outline: none;
    stroke-width: 4;
    stroke: var(--theme-accent, #3b82f6);
  }

  .hit-target.disabled {
    cursor: not-allowed;
    opacity: 0.3;
  }

  /* Subtle pulsing for available targets */
  @keyframes pulse-ring {
    0% { stroke-opacity: 0.4; }
    50% { stroke-opacity: 0.8; }
    100% { stroke-opacity: 0.4; }
  }

  .hit-target:not(.disabled) {
    animation: pulse-ring 2s ease-in-out infinite;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .hit-target:not(.disabled) {
      animation: none;
    }

    .prop-indicator {
      transition: none;
    }
  }
</style>
