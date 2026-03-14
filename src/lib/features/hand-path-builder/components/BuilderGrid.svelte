<!--
  BuilderGrid.svelte - Tappable grid for the Hand Path Builder

  Uses the real GridSvg component and GridHitTargetCalculator.
  Renders a single hand SVG at the current position. When a new location
  is tapped, the hand animates from previous → new along the actual path
  (arc for shifts, straight line for dashes). Path lines trace the real
  movement geometry, not just straight point-to-point connectors.

  SVG coordinate system uses 950x950 viewBox (same as GridSvg).
-->
<script lang="ts">
  import GridSvg from "$lib/shared/pictograph/grid/components/GridSvg.svelte";
  import { GridHitTargetCalculator } from "$lib/features/assemble-lab/services/implementations/GridHitTargetCalculator";
  import type { GridHitTarget } from "$lib/features/assemble-lab/services/contracts/IGridHitTargetCalculator";
  import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { propSvgLoader } from "$lib/shared/pictograph/prop/services/implementations/PropSvgLoader";
  import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
  import type { PropRenderData } from "$lib/shared/pictograph/prop/domain/models/PropRenderData";
  import { HandPathAnimator, getPathD } from "../services/HandPathAnimator";
  import type { HandMove } from "../state/builder-state.svelte";
  import { getBuilderContext } from "../context/builder-context";

  const builder = getBuilderContext();
  const calculator = new GridHitTargetCalculator();
  const blueAnimator = new HandPathAnimator();
  const redAnimator = new HandPathAnimator();

  const ANIMATION_DURATION_MS = 350;

  const hitTargets = $derived(calculator.getHitTargets(builder.gridMode));
  const hitRadius = calculator.getHitTargetRadius();

  let blueHandData = $state<PropRenderData | null>(null);
  let redHandData = $state<PropRenderData | null>(null);

  let activeBlueHandRef: SVGGElement | null = $state(null);
  let activeRedHandRef: SVGGElement | null = $state(null);

  // Load hand SVGs on mount
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
    builder.setAnimationCallback(async (move: HandMove) => {
      const handData = builder.phase === "blue" ? blueHandData : redHandData;
      const handRef = builder.phase === "blue" ? activeBlueHandRef : activeRedHandRef;
      if (!handRef || !handData?.svgData) return;

      const animator = builder.phase === "blue" ? blueAnimator : redAnimator;
      await animator.animate({
        element: handRef,
        startPosition: move.from,
        endPosition: move.to,
        durationMs: ANIMATION_DURATION_MS,
        handCenter: handData.svgData.center,
      });
    });
  });

  const blueColor = "var(--prop-blue, #2e8bf0)";
  const redColor = "var(--prop-red, #ed1c24)";
  const FALLBACK_RADIUS = 28;

  function findTarget(location: GridLocation): GridHitTarget | undefined {
    return hitTargets.find(t => t.location === location);
  }

  function handTransform(x: number, y: number, center: { x: number; y: number }): string {
    return `translate(${x}px, ${y}px) translate(${-center.x}px, ${-center.y}px)`;
  }

  // Build SVG path "d" strings that follow the actual movement path
  // (arc for shifts, straight line for dashes)
  const bluePathDs = $derived(buildPathDs(builder.blueLocations));
  const redPathDs = $derived(buildPathDs(builder.redLocations));

  function buildPathDs(locations: readonly GridLocation[]): string[] {
    const ds: string[] = [];
    for (let i = 0; i < locations.length - 1; i++) {
      ds.push(getPathD(locations[i]!, locations[i + 1]!));
    }
    return ds;
  }

  function handleTap(loc: GridLocation): void {
    builder.addLocation(loc);
  }

  function getLabel(loc: GridLocation): string {
    const phaseLabel = builder.phase === "blue" ? "Blue" : "Red";
    return `Add ${loc} to ${phaseLabel} hand path`;
  }

  // Active hand: last location of the current phase
  const activeBlueTarget = $derived.by(() => {
    if (builder.blueLocations.length === 0) return null;
    return findTarget(builder.blueLocations[builder.blueLocations.length - 1]!);
  });
  const activeRedTarget = $derived.by(() => {
    if (builder.redLocations.length === 0) return null;
    return findTarget(builder.redLocations[builder.redLocations.length - 1]!);
  });
</script>

<div
  class="builder-grid"
  role="application"
  aria-label="Hand path builder grid"
>
  <svg viewBox="0 0 950 950" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
    <!-- Layer 0: Background -->
    <defs>
      <linearGradient id="hpb-bg-gradient" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="rgb(20, 25, 40)" />
        <stop offset="100%" stop-color="rgb(10, 12, 22)" />
      </linearGradient>
    </defs>
    <rect class="grid-bg" x="0" y="0" width="950" height="950" fill="url(#hpb-bg-gradient)" />

    <!-- Layer 1: Real grid lines and points -->
    <GridSvg gridMode={builder.gridMode} />

    <!-- Layer 2: Path lines that follow actual movement geometry -->
    {#each bluePathDs as d, i (i)}
      <path {d} fill="none" stroke={blueColor} stroke-width="4" stroke-linecap="round" opacity="0.7" />
    {/each}
    {#each redPathDs as d, i (i)}
      <path {d} fill="none" stroke={redColor} stroke-width="4" stroke-linecap="round" opacity="0.7" />
    {/each}

    <!-- Layer 3: Active blue hand -->
    {#if activeBlueTarget}
      {#if blueHandData?.svgData}
        <g
          bind:this={activeBlueHandRef}
          class="hand-svg-group"
          class:active-glow={builder.phase === "blue"}
          style="transform: {handTransform(activeBlueTarget.x, activeBlueTarget.y, blueHandData.svgData.center)}"
          style:filter={builder.phase === "blue" ? `drop-shadow(0 0 6px ${blueColor})` : "none"}
        >
          {@html blueHandData.svgData.svgContent}
        </g>
      {:else}
        <circle cx={activeBlueTarget.x} cy={activeBlueTarget.y} r={FALLBACK_RADIUS} fill={blueColor} />
      {/if}
    {/if}

    <!-- Layer 3: Active red hand -->
    {#if activeRedTarget}
      {#if redHandData?.svgData}
        <g
          bind:this={activeRedHandRef}
          class="hand-svg-group"
          class:active-glow={builder.phase === "red"}
          style="transform: {handTransform(activeRedTarget.x, activeRedTarget.y, redHandData.svgData.center)}"
          style:filter={builder.phase === "red" ? `drop-shadow(0 0 6px ${redColor})` : "none"}
        >
          {@html redHandData.svgData.svgContent}
        </g>
      {:else}
        <circle cx={activeRedTarget.x} cy={activeRedTarget.y} r={FALLBACK_RADIUS} fill={redColor} />
      {/if}
    {/if}

    <!-- Layer 5: Hit targets -->
    {#if builder.phase !== "complete"}
      {#each hitTargets as target (target.location)}
        <circle
          cx={target.x}
          cy={target.y}
          r={hitRadius}
          class="hit-target"
          class:is-selected={builder.lastLocation === target.location}
          class:phase-blue={builder.phase === "blue"}
          class:phase-red={builder.phase === "red"}
          class:disabled={builder.isAnimating}
          role="button"
          tabindex="0"
          aria-label={getLabel(target.location)}
          onclick={() => handleTap(target.location)}
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleTap(target.location);
            }
          }}
        />
      {/each}
    {/if}

    <!-- Complete state -->
    {#if builder.phase === "complete"}
      <text
        x="475" y="475"
        text-anchor="middle" dominant-baseline="middle"
        font-size="20" fill="rgba(255,255,255,0.45)"
      >Paths complete</text>
    {/if}
  </svg>
</div>

<style>
  .builder-grid {
    width: 100%;
    aspect-ratio: 1;
    border-radius: 20px;
    overflow: hidden;
    border: 1.5px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .builder-grid svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  .hand-svg-group {
    pointer-events: none;
    opacity: 0.85;
  }

  .hand-svg-group.active-glow {
    opacity: 1;
  }

  /* Hit targets */
  .hit-target {
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

  @media (max-width: 768px) {
    .builder-grid {
      border-radius: 16px;
    }
  }
</style>
