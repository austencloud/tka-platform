<!--
  InteractiveGrid.svelte - Clickable pictograph grid for visual sequence building

  Sequential per-hand model: build blue's multi-beat path, click Done, build red's.
  SvgPropAnimator drives arc/line animation on each click.

  SVG Layers (render order):
  0. Dark background rect
  1. GridSvg (grid lines and hand points)
  2. Completed beat motion arrows (lines with arrowheads)
  3. Completed hand's prop at final position (dimmed, when blue is done)
  4. Active hand's prop indicator (animated <g> driven by SvgPropAnimator)
  5. Hit target circles (always on top for click capture)
-->
<script lang="ts">
  import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import {
    MotionColor,
    Orientation,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import GridSvg from "$lib/shared/pictograph/grid/components/GridSvg.svelte";
  import type { GridHitTarget } from "../services/contracts/IGridHitTargetCalculator";
  import { GridHitTargetCalculator } from "../services/implementations/GridHitTargetCalculator";
  import { SvgPropAnimator } from "../services/implementations/SvgPropAnimator";
  import type { VisualBuilderState, BuilderBeat } from "../state/visual-builder-state.svelte";

  // Prop SVG rendering
  import { propSvgLoader } from "$lib/shared/pictograph/prop/services/implementations/PropSvgLoader";
  import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
  import { PropRotAngleManager } from "$lib/shared/pictograph/prop/services/implementations/PropRotAngleManager";
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import type { PropRenderData } from "$lib/shared/pictograph/prop/domain/models/PropRenderData";

  let { builderState }: { builderState: VisualBuilderState } = $props();

  // Services
  const calculator = new GridHitTargetCalculator();
  const animator = new SvgPropAnimator();

  // Grid hit targets derived from current grid mode
  const hitTargets = $derived(calculator.getHitTargets(builderState.gridMode));
  const hitRadius = calculator.getHitTargetRadius();

  // Fallback circle radius (shown while SVG loads)
  const FALLBACK_RADIUS = 28;

  // Animation duration in ms
  const ANIMATION_DURATION_MS = 400;

  // SVG element ref for the active prop's animated group
  let activePropGroupRef: SVGGElement | null = $state(null);

  // Track whether the active prop just appeared (for scale-in animation)
  let justPlaced = $state(false);

  // Prop SVG render data (loaded async, keyed on prop type + color)
  let bluePropData = $state<PropRenderData | null>(null);
  let redPropData = $state<PropRenderData | null>(null);

  // Load prop SVGs reactively when prop type changes in settings
  $effect(() => {
    const settings = getSettings();
    const bluePropType = settings.bluePropType ?? PropType.STAFF;
    const redPropType = settings.redPropType ?? PropType.STAFF;

    // Load blue prop SVG
    const blueMotion = createMotionData({
      propType: bluePropType,
      color: MotionColor.BLUE,
    });
    propSvgLoader.loadPropSvg(
      { positionX: 0, positionY: 0, rotationAngle: 0 },
      blueMotion,
      false,
    ).then(data => { bluePropData = data; });

    // Load red prop SVG
    const redMotion = createMotionData({
      propType: redPropType,
      color: MotionColor.RED,
    });
    propSvgLoader.loadPropSvg(
      { positionX: 0, positionY: 0, rotationAngle: 0 },
      redMotion,
      false,
    ).then(data => { redPropData = data; });
  });

  // Active hand's prop render data
  const activePropData = $derived(
    builderState.activeHand === MotionColor.BLUE ? bluePropData : redPropData
  );

  // SVG center point for transform offset (falls back to 0,0 while loading)
  const activePropCenter = $derived(
    activePropData?.svgData?.center ?? { x: 0, y: 0 }
  );

  // Rotation angle for active prop at current position
  const activeRotation = $derived.by(() => {
    if (builderState.currentPosition === null) return 0;
    return PropRotAngleManager.calculateRotation(
      builderState.currentPosition,
      builderState.currentOrientation,
      builderState.gridMode,
    );
  });

  // Helper: find the hit target matching a grid location
  function findTarget(location: GridLocation): GridHitTarget | undefined {
    return hitTargets.find(t => t.location === location);
  }

  // Resolve the final position of a completed hand path
  function getFinalPosition(beats: BuilderBeat[]): GridLocation | null {
    if (beats.length === 0) return null;
    return beats[beats.length - 1]!.endPosition;
  }

  // Resolve the starting position of a hand path
  function getStartPosition(beats: BuilderBeat[]): GridLocation | null {
    if (beats.length === 0) return null;
    return beats[0]!.startPosition;
  }

  // Compute rotation for a prop at a specific location/orientation
  function getRotation(location: GridLocation, orientation: Orientation): number {
    return PropRotAngleManager.calculateRotation(
      location,
      orientation,
      builderState.gridMode,
    );
  }

  // Build CSS transform for a prop SVG at a grid position
  function propTransform(
    x: number,
    y: number,
    rotation: number,
    center: { x: number; y: number },
  ): string {
    return `translate(${x}px, ${y}px) rotate(${rotation}deg) translate(${-center.x}px, ${-center.y}px)`;
  }

  // Register animation callback on state so addMotion() can trigger animation
  $effect(() => {
    builderState.setAnimationCallback(async (beat: BuilderBeat) => {
      if (!activePropGroupRef) return;
      await animator.animate({
        element: activePropGroupRef,
        startPosition: beat.startPosition,
        endPosition: beat.endPosition,
        rotationDirection: beat.rotationDirection,
        turnCount: beat.turnCount,
        startOrientation: beat.startOrientation,
        durationMs: ANIMATION_DURATION_MS,
        propCenter: activePropCenter,
      });
    });
  });

  // Detect when a first-click placement happens (for scale-in animation)
  let previousPhase = $state(builderState.phase);
  $effect(() => {
    const currentPhase = builderState.phase;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    if (previousPhase === "idle" && currentPhase === "placing") {
      justPlaced = true;
      timeout = setTimeout(() => { justPlaced = false; }, 300);
    }
    previousPhase = currentPhase;
    return () => { if (timeout) clearTimeout(timeout); };
  });

  // Click handler for hit targets
  function handleTargetClick(target: GridHitTarget): void {
    builderState.handlePointClick(target.location);
  }

  // Determine if a target is clickable in the current phase
  function isActiveTarget(_target: GridHitTarget): boolean {
    if (builderState.phase === "idle") return true;
    if (builderState.phase === "placing" || builderState.phase === "building") return true;
    return false;
  }

  // Accessible label for each hit target
  function getTargetLabel(target: GridHitTarget): string {
    const handLabel = builderState.activeHand === MotionColor.BLUE ? "Blue" : "Red";
    if (builderState.phase === "idle") {
      return `Place ${handLabel} prop at ${target.label}`;
    }
    if (builderState.phase === "placing" || builderState.phase === "building") {
      return `Move ${handLabel} prop to ${target.label}`;
    }
    return target.label;
  }

  // Derived: blue's completed beats exist and blue hand is done
  const blueIsFinished = $derived(builderState.isBlueComplete);
  const blueFinalTarget = $derived.by(() => {
    const loc = getFinalPosition(builderState.blueBeats);
    return loc ? findTarget(loc) : null;
  });
  const blueStartTarget = $derived.by(() => {
    const loc = getStartPosition(builderState.blueBeats);
    return loc ? findTarget(loc) : null;
  });

  // Blue's final and start orientations (for prop rotation when dimmed)
  const blueFinalOrientation = $derived.by(() => {
    const beats = builderState.blueBeats;
    if (beats.length === 0) return Orientation.IN;
    return beats[beats.length - 1]!.endOrientation;
  });
  const blueStartOrientation = $derived.by(() => {
    const beats = builderState.blueBeats;
    if (beats.length === 0) return Orientation.IN;
    return beats[0]!.startOrientation;
  });

  // Active prop position (for non-animating rest state)
  const activeTarget = $derived.by(() => {
    if (builderState.currentPosition === null) return null;
    return findTarget(builderState.currentPosition);
  });

  // Active hand color for CSS glow
  const activeColor = $derived(
    builderState.activeHand === MotionColor.BLUE
      ? "var(--prop-blue, #2e8bf0)"
      : "var(--prop-red, #ed1c24)"
  );
</script>

<div class="interactive-grid" role="application" aria-label="Visual sequence builder grid">
  <svg viewBox="0 0 950 950" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
    <!-- Layer 0: Dark background matching pictograph style -->
    <rect x="0" y="0" width="950" height="950" class="grid-background" />

    <!-- Layer 1: Grid lines and points -->
    <GridSvg gridMode={builderState.gridMode} />

    <!-- Layer 2: Reserved for future motion visualization -->

    <!-- Layer 3: Completed hand's prop at final position (dimmed) -->
    {#if blueIsFinished && builderState.activeHand === MotionColor.RED && builderState.blueBeats.length > 0}
      <!-- Blue's final position prop (dimmed) -->
      {#if blueFinalTarget}
        {@const finalLoc = getFinalPosition(builderState.blueBeats)}
        {#if bluePropData?.svgData && finalLoc}
          <g
            class="prop-svg-group dimmed-prop"
            style="transform: {propTransform(
              blueFinalTarget.x,
              blueFinalTarget.y,
              getRotation(finalLoc, blueFinalOrientation),
              bluePropData.svgData.center,
            )}"
          >
            {@html bluePropData.svgData.svgContent}
          </g>
        {:else}
          <circle
            cx={blueFinalTarget.x}
            cy={blueFinalTarget.y}
            r={FALLBACK_RADIUS}
            class="prop-fallback blue-fallback dimmed-prop"
          />
        {/if}
      {/if}
      <!-- Blue's start position prop (more dimmed) -->
      {#if blueStartTarget && blueStartTarget !== blueFinalTarget}
        {@const startLoc = getStartPosition(builderState.blueBeats)}
        {#if bluePropData?.svgData && startLoc}
          <g
            class="prop-svg-group start-prop"
            style="transform: {propTransform(
              blueStartTarget.x,
              blueStartTarget.y,
              getRotation(startLoc, blueStartOrientation),
              bluePropData.svgData.center,
            )} scale(0.7)"
          >
            {@html bluePropData.svgData.svgContent}
          </g>
        {:else}
          <circle
            cx={blueStartTarget.x}
            cy={blueStartTarget.y}
            r={FALLBACK_RADIUS * 0.7}
            class="prop-fallback blue-fallback start-prop"
          />
        {/if}
      {/if}
    {/if}

    <!-- Layer 4: Active hand's prop indicator (animated group) -->
    {#if activeTarget && builderState.phase !== "complete" && builderState.phase !== "done"}
      <g
        bind:this={activePropGroupRef}
        class="active-prop-group"
        style="transform: {propTransform(
          activeTarget.x,
          activeTarget.y,
          activeRotation,
          activePropCenter,
        )}"
      >
        {#if activePropData?.svgData}
          <g
            class="active-prop-inner"
            class:scale-in={justPlaced}
            style="--active-color: {activeColor}; filter: drop-shadow(0 0 6px {activeColor})"
          >
            {@html activePropData.svgData.svgContent}
          </g>
        {:else}
          <!-- Fallback circle while SVG loads -->
          <circle
            cx="0"
            cy="0"
            r={FALLBACK_RADIUS}
            class="prop-fallback"
            class:blue-fallback={builderState.activeHand === MotionColor.BLUE}
            class:red-fallback={builderState.activeHand === MotionColor.RED}
            class:scale-in={justPlaced}
          />
        {/if}
      </g>
    {/if}

    <!-- When complete, show both hands at their final positions -->
    {#if builderState.phase === "complete"}
      <!-- Blue final -->
      {#if blueFinalTarget}
        {@const blueFinalLoc = getFinalPosition(builderState.blueBeats)}
        {#if bluePropData?.svgData && blueFinalLoc}
          <g
            class="prop-svg-group"
            style="transform: {propTransform(
              blueFinalTarget.x,
              blueFinalTarget.y,
              getRotation(blueFinalLoc, blueFinalOrientation),
              bluePropData.svgData.center,
            )}"
          >
            {@html bluePropData.svgData.svgContent}
          </g>
        {:else}
          <circle
            cx={blueFinalTarget.x}
            cy={blueFinalTarget.y}
            r={FALLBACK_RADIUS}
            class="prop-fallback blue-fallback"
          />
        {/if}
      {/if}
      <!-- Red final -->
      {@const redFinal = getFinalPosition(builderState.redBeats)}
      {#if redFinal}
        {@const redFinalT = findTarget(redFinal)}
        {@const redFinalOri = builderState.redBeats.length > 0
          ? builderState.redBeats[builderState.redBeats.length - 1]!.endOrientation
          : Orientation.IN}
        {#if redFinalT}
          {#if redPropData?.svgData}
            <g
              class="prop-svg-group"
              style="transform: {propTransform(
                redFinalT.x,
                redFinalT.y,
                getRotation(redFinal, redFinalOri),
                redPropData.svgData.center,
              )}"
            >
              {@html redPropData.svgData.svgContent}
            </g>
          {:else}
            <circle
              cx={redFinalT.x}
              cy={redFinalT.y}
              r={FALLBACK_RADIUS}
              class="prop-fallback red-fallback"
            />
          {/if}
        {/if}
      {/if}
    {/if}

    <!-- Layer 5: Hit targets (always on top for clicks) -->
    {#each hitTargets as target (target.location)}
      <circle
        cx={target.x}
        cy={target.y}
        r={hitRadius}
        class="hit-target"
        class:active-hand-blue={builderState.activeHand === MotionColor.BLUE}
        class:active-hand-red={builderState.activeHand === MotionColor.RED}
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

  /* Prop SVG groups (real prop rendering) */
  .prop-svg-group {
    pointer-events: none;
    opacity: 0.85;
  }

  .prop-svg-group.dimmed-prop {
    opacity: 0.35;
  }

  .prop-svg-group.start-prop {
    opacity: 0.2;
  }

  /* Fallback circles (shown while prop SVGs load) */
  .prop-fallback {
    pointer-events: none;
  }

  .blue-fallback {
    fill: var(--prop-blue, #2e8bf0);
    opacity: 0.85;
  }

  .red-fallback {
    fill: var(--prop-red, #ed1c24);
    opacity: 0.85;
  }

  .prop-fallback.dimmed-prop {
    opacity: 0.35;
  }

  .prop-fallback.start-prop {
    opacity: 0.2;
  }

  /* Active prop group: no pointer events (hits pass through to targets) */
  .active-prop-group {
    pointer-events: none;
  }

  /* Active prop inner: the actual SVG content wrapper */
  .active-prop-inner {
    pointer-events: none;
  }

  /* Scale-in animation for first placement */
  .scale-in {
    animation: prop-scale-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }

  @keyframes prop-scale-in {
    from {
      transform: scale(0);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
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
    pointer-events: none;
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

    .scale-in {
      animation: none;
    }
  }
</style>
