<!--
  InteractiveGrid.svelte - Clickable pictograph grid for visual sequence building

  Free-form dual-hand model: build both hands' paths in any order via hand switcher.
  SvgPropAnimator drives arc/line animation on each click.

  SVG Layers (render order):
  0. Dark background rect
  1. GridSvg (grid lines and hand points)
  2. Active and inactive hand hover-path previews
  3. Ghost prop for inactive hand (animated in sync during the other hand's building phase)
  4. Active hand's prop indicator (animated <g> driven by SvgPropAnimator)
  5. Hit target circles (always on top for click capture)
-->
<script lang="ts">
  import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import {
    MotionColor,
    Orientation,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import GridSvg from "$lib/shared/pictograph/grid/components/GridSvg.svelte";
  import type { GridHitTarget } from "$lib/shared/assemble-lab/domain/types";
  import { getHitTargets } from "$lib/shared/assemble-lab/services/grid-hit-target-calculator";
  import HitTargetOverlay from "$lib/shared/interactive-canvas/components/HitTargetOverlay.svelte";
  import {
    getBuilderMotionPathD,
    SvgPropAnimator,
  } from "../services/svg-prop-animator";
  import { getBuilderComparisonStep } from "../services/builder-path-editor";
  import type {
    AssembleState,
    BuilderStep,
  } from "../state/assemble-state.svelte";

  // Prop SVG rendering.
  // Trust boundary: svgData.svgContent below is injected via {@html}. The source
  // is this internal propSvgLoader service (bundled static prop SVGs), never user
  // or external input, so it is a trusted, non-XSS surface — no sanitization pass.
  import { propSvgLoader } from "$lib/shared/pictograph/prop/services/prop-svg-loader";
  import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
  import { PropRotAngleManager } from "$lib/shared/pictograph/prop/services/prop-rot-angle-manager";
  import { LOCATION_ANGLES } from "$lib/shared/foundation/domain/math-constants";
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import type { PropRenderData } from "$lib/shared/pictograph/prop/domain/models/prop-render-data";

  let {
    builderState,
    onStepCapExceeded,
  }: {
    builderState: AssembleState;
    /** Called when the user tries to add a motion. Return true to block the action and show the nudge. */
    onStepCapExceeded?: () => boolean;
  } = $props();

  // Services
  const animator = new SvgPropAnimator();
  const ghostAnimator = new SvgPropAnimator();

  // Grid hit targets derived from current grid mode
  const hitTargets = $derived(
    getHitTargets(builderState.gridMode, builderState.showCenter)
  );
  const LOCATION_TO_KEY_LABEL: Record<string, string> = {
    [GridLocation.NORTHWEST]: "7",
    [GridLocation.NORTH]: "8",
    [GridLocation.NORTHEAST]: "9",
    [GridLocation.WEST]: "4",
    [GridLocation.CENTER]: "5",
    [GridLocation.EAST]: "6",
    [GridLocation.SOUTHWEST]: "1",
    [GridLocation.SOUTH]: "2",
    [GridLocation.SOUTHEAST]: "3",
  };

  // Fallback circle radius (shown while SVG loads)
  const FALLBACK_RADIUS = 28;

  // Animation duration in ms
  const ANIMATION_DURATION_MS = 400;

  // SVG element ref for the active prop's animated group
  let activePropGroupRef: SVGGElement | null = $state(null);
  let ghostBluePropGroupRef: SVGGElement | null = $state(null);
  let ghostRedPropGroupRef: SVGGElement | null = $state(null);

  // Track whether the active prop just appeared (for scale-in animation)
  let justPlaced = $state(false);

  // Prop SVG render data (loaded async, keyed on prop type + color)
  let bluePropData = $state<PropRenderData | null>(null);
  let redPropData = $state<PropRenderData | null>(null);
  let previewLocation = $state<GridLocation | null>(null);

  // Reactive prop types for rotation checks
  const currentBluePropType = $derived(
    getSettings().bluePropType ?? PropType.STAFF
  );
  const currentRedPropType = $derived(
    getSettings().redPropType ?? PropType.STAFF
  );

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
    propSvgLoader
      .loadPropSvg(
        { positionX: 0, positionY: 0, rotationAngle: 0 },
        blueMotion,
        false
      )
      .then((data) => {
        bluePropData = data;
      })
      .catch(() => {
        /* SVG unavailable; fallback circle renders */
      });

    // Load red prop SVG
    const redMotion = createMotionData({
      propType: redPropType,
      color: MotionColor.RED,
    });
    propSvgLoader
      .loadPropSvg(
        { positionX: 0, positionY: 0, rotationAngle: 0 },
        redMotion,
        false
      )
      .then((data) => {
        redPropData = data;
      })
      .catch(() => {
        /* SVG unavailable; fallback circle renders */
      });
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
  // Hands don't rotate - they sit flat at every grid position
  const activeRotation = $derived.by(() => {
    if (builderState.currentPosition === null) return 0;
    const settings = getSettings();
    const activePropType =
      builderState.activeHand === MotionColor.BLUE
        ? (settings.bluePropType ?? PropType.STAFF)
        : (settings.redPropType ?? PropType.STAFF);
    if (activePropType === PropType.HAND) return 0;
    return PropRotAngleManager.calculateRotation(
      builderState.currentPosition,
      builderState.currentOrientation,
      builderState.gridMode
    );
  });

  // Helper: find the hit target matching a grid location
  function findTarget(location: GridLocation): GridHitTarget | undefined {
    return hitTargets.find((t) => t.location === location);
  }

  // Resolve the final position of a completed hand path
  function getFinalPosition(steps: BuilderStep[]): GridLocation | null {
    if (steps.length === 0) return null;
    return steps[steps.length - 1]!.endPosition;
  }

  // Compute rotation for a prop at a specific location/orientation
  // Hands don't rotate - always return 0 for hand props
  function getRotation(
    location: GridLocation,
    orientation: Orientation,
    propType?: PropType
  ): number {
    if (propType === PropType.HAND) return 0;
    return PropRotAngleManager.calculateRotation(
      location,
      orientation,
      builderState.gridMode
    );
  }

  // Build CSS transform for a prop SVG at a grid position
  function propTransform(
    x: number,
    y: number,
    rotation: number,
    center: { x: number; y: number }
  ): string {
    return `translate(${x}px, ${y}px) rotate(${rotation}deg) translate(${-center.x}px, ${-center.y}px)`;
  }

  // Fade out an SVG element over a duration, synchronized with the active prop animation
  function fadeOutElement(
    element: SVGGElement,
    durationMs: number
  ): Promise<void> {
    return new Promise((resolve) => {
      const anim = element.animate([{ opacity: 0.35 }, { opacity: 0 }], {
        duration: durationMs,
        easing: "ease-out",
        fill: "forwards",
      });
      anim.onfinish = () => resolve();
      anim.oncancel = () => resolve();
    });
  }

  // Register animation callback on state so addMotion() can trigger animation
  $effect(() => {
    const clearAnimationCallback = builderState.setAnimationCallback(
      async (step: BuilderStep, durationMs?: number) => {
        if (!activePropGroupRef) return;
        const animations: Promise<void>[] = [];

        // Animate active hand's prop
        animations.push(
          animator.animate({
            element: activePropGroupRef,
            startPosition: step.startPosition,
            endPosition: step.endPosition,
            rotationDirection: step.rotationDirection,
            turnCount: step.turnCount,
            startOrientation: step.startOrientation,
            durationMs: durationMs ?? ANIMATION_DURATION_MS,
            propCenter: activePropCenter,
          })
        );

        // During red building, animate ghost blue through its corresponding step,
        // or fade it out if blue has no step at this beat
        if (
          builderState.activeHand === MotionColor.RED &&
          ghostBluePropGroupRef &&
          bluePropData?.svgData
        ) {
          const blueIndex = builderState.redSteps.length;
          const blueStep = builderState.blueSteps[blueIndex];
          if (blueStep) {
            animations.push(
              ghostAnimator.animate({
                element: ghostBluePropGroupRef,
                startPosition: blueStep.startPosition,
                endPosition: blueStep.endPosition,
                rotationDirection: blueStep.rotationDirection,
                turnCount: blueStep.turnCount,
                startOrientation: blueStep.startOrientation,
                durationMs: durationMs ?? ANIMATION_DURATION_MS,
                propCenter: bluePropData.svgData.center,
              })
            );
          } else {
            // Blue has no step here - fade out in sync with the active prop's animation
            animations.push(
              fadeOutElement(
                ghostBluePropGroupRef,
                durationMs ?? ANIMATION_DURATION_MS
              )
            );
          }
        }

        // During blue building (after going back), animate ghost red through its corresponding step,
        // or fade it out if red has no step at this beat
        if (
          builderState.activeHand === MotionColor.BLUE &&
          ghostRedPropGroupRef &&
          redPropData?.svgData
        ) {
          const redIndex = builderState.blueSteps.length;
          const redStep = builderState.redSteps[redIndex];
          if (redStep) {
            animations.push(
              ghostAnimator.animate({
                element: ghostRedPropGroupRef,
                startPosition: redStep.startPosition,
                endPosition: redStep.endPosition,
                rotationDirection: redStep.rotationDirection,
                turnCount: redStep.turnCount,
                startOrientation: redStep.startOrientation,
                durationMs: durationMs ?? ANIMATION_DURATION_MS,
                propCenter: redPropData.svgData.center,
              })
            );
          } else {
            // Red has no step here - fade out in sync with the active prop's animation
            animations.push(
              fadeOutElement(
                ghostRedPropGroupRef,
                durationMs ?? ANIMATION_DURATION_MS
              )
            );
          }
        }

        await Promise.all(animations);
      }
    );
    return () => {
      clearAnimationCallback();
      animator.cancel();
      ghostAnimator.cancel();
    };
  });

  // Detect when a first-click placement happens (for scale-in animation).
  // Plain let, NOT $state: the effect below reads and writes it, so making it
  // reactive re-runs the effect immediately, whose cleanup clears the 300ms
  // timer and latches justPlaced permanently true.
  let previousPhase = "idle";

  // After SvgPropAnimator finishes, suppress CSS transitions for two frames
  // so Svelte can settle the reactive transform without triggering a visible
  // transition from the animator's final value (which may differ slightly due
  // to different angle calculations).
  let suppressTransition = $state(false);

  $effect(() => {
    const currentPhase = builderState.phase;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let rafId: number | null = null;
    let rafId2: number | null = null;

    if (previousPhase === "idle" && currentPhase === "placing") {
      justPlaced = true;
      timeout = setTimeout(() => {
        justPlaced = false;
      }, 300);
    }

    // When leaving animating phase, suppress transitions briefly
    if (previousPhase === "animating" && currentPhase !== "animating") {
      suppressTransition = true;
      rafId = requestAnimationFrame(() => {
        rafId2 = requestAnimationFrame(() => {
          suppressTransition = false;
          rafId2 = null;
        });
        rafId = null;
      });
    }

    previousPhase = currentPhase;
    return () => {
      if (timeout) clearTimeout(timeout);
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (rafId2 !== null) cancelAnimationFrame(rafId2);
    };
  });

  // Click handler for hit targets
  function handleTargetClick(location: GridLocation): void {
    // When a prop is already placed (placing/building phase), clicking creates a
    // motion on the active hand. Check the beat cap before allowing it.
    if (
      onStepCapExceeded &&
      builderState.stepEditMode === null &&
      (builderState.phase === "placing" || builderState.phase === "building") &&
      builderState.currentPosition !== null
    ) {
      if (onStepCapExceeded()) return;
    }
    builderState.handlePointClick(location);
  }

  // Accessible label for each hit target
  function getTargetLabel(
    _location: GridLocation,
    defaultLabel: string
  ): string {
    const handLabel =
      builderState.activeHand === MotionColor.BLUE ? "Blue" : "Red";
    if (builderState.stepEditMode === "replace") {
      return `Set ${handLabel} step ${
        (builderState.selectedStepIndex ?? 0) + 1
      } destination to ${defaultLabel}`;
    }
    if (builderState.phase === "idle") {
      return `Place ${handLabel} prop at ${defaultLabel}`;
    }
    if (builderState.phase === "placing" || builderState.phase === "building") {
      return `Move ${handLabel} prop to ${defaultLabel}`;
    }
    return defaultLabel;
  }

  const candidatePathD = $derived.by(() => {
    const startPosition = builderState.candidateStartPosition;
    if (
      startPosition === null ||
      previewLocation === null ||
      builderState.phase === "animating" ||
      builderState.phase === "complete"
    ) {
      return null;
    }
    return getBuilderMotionPathD({
      startPosition,
      endPosition: previewLocation,
      startOrientation: builderState.candidateStartOrientation,
      rotationDirection: builderState.candidateRotationDirection,
      turnCount: builderState.candidateTurnCount,
    });
  });

  const comparisonStep = $derived.by(() => {
    const activeSteps =
      builderState.activeHand === MotionColor.BLUE
        ? builderState.blueSteps
        : builderState.redSteps;
    const inactiveSteps =
      builderState.activeHand === MotionColor.BLUE
        ? builderState.redSteps
        : builderState.blueSteps;
    const editIndex =
      builderState.stepEditMode === "replace"
        ? builderState.selectedStepIndex
        : null;
    return getBuilderComparisonStep(activeSteps, inactiveSteps, editIndex);
  });

  const comparisonPathD = $derived.by(() => {
    const step = comparisonStep;
    if (candidatePathD === null || step === null) return null;
    return getBuilderMotionPathD({
      startPosition: step.startPosition,
      endPosition: step.endPosition,
      startOrientation: step.startOrientation,
      rotationDirection: step.rotationDirection,
      turnCount: step.turnCount,
    });
  });

  const activePhaseColor = $derived<"blue" | "red">(
    builderState.activeHand === MotionColor.BLUE ? "blue" : "red"
  );
  const targetsDisabled = $derived(
    builderState.phase === "animating" || builderState.phase === "complete"
  );

  // Blue's final orientation (for complete-phase rendering)
  const blueFinalOrientation = $derived.by(() => {
    const steps = builderState.blueSteps;
    if (steps.length === 0) return Orientation.IN;
    return steps[steps.length - 1]!.endOrientation;
  });

  // Ghost blue: tracks rest position during red building (syncs with red step count).
  // Returns null once red goes past blue's last step - the ghost fades out.
  const ghostBlueState = $derived.by(() => {
    if (builderState.activeHand !== MotionColor.RED) return null;
    if (builderState.blueSteps.length === 0) return null;
    if (builderState.phase === "complete") return null;

    const redStepsDone = builderState.redSteps.length;

    // Red has gone past all blue steps - blue doesn't exist at this beat.
    // Use > not >= so the ghost stays visible when both hands are at the same count.
    if (redStepsDone > builderState.blueSteps.length) return null;

    if (redStepsDone === 0) {
      return {
        position: builderState.blueSteps[0]!.startPosition,
        orientation: builderState.blueSteps[0]!.startOrientation,
      };
    }
    return {
      position: builderState.blueSteps[redStepsDone - 1]!.endPosition,
      orientation: builderState.blueSteps[redStepsDone - 1]!.endOrientation,
    };
  });

  // Ghost red: tracks rest position during blue building when red has steps ahead.
  // Returns null once blue goes past red's last step - the ghost fades out.
  const ghostRedState = $derived.by(() => {
    if (builderState.activeHand !== MotionColor.BLUE) return null;
    if (builderState.redSteps.length === 0) return null;
    if (builderState.phase === "complete") return null;

    const blueStepsDone = builderState.blueSteps.length;

    // Blue has gone past all red steps - red doesn't exist at this beat.
    // Use > not >= so the ghost stays visible when both hands are at the same count.
    if (blueStepsDone > builderState.redSteps.length) return null;

    if (blueStepsDone === 0) {
      return {
        position: builderState.redSteps[0]!.startPosition,
        orientation: builderState.redSteps[0]!.startOrientation,
      };
    }
    return {
      position: builderState.redSteps[blueStepsDone - 1]!.endPosition,
      orientation: builderState.redSteps[blueStepsDone - 1]!.endOrientation,
    };
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

  // Arrow direction in degrees, computed from grid position + orientation
  const arrowRotationDeg = $derived.by(() => {
    if (!builderState.currentPosition) return 0;
    const theta = LOCATION_ANGLES[builderState.currentPosition];
    const thetaDeg = theta * (180 / Math.PI);
    switch (builderState.arrowOrientation) {
      case Orientation.IN:
        return thetaDeg + 180; // toward center
      case Orientation.OUT:
        return thetaDeg; // away from center
      case Orientation.CLOCK:
        return thetaDeg + 90; // CW tangent
      case Orientation.COUNTER:
        return thetaDeg - 90; // CCW tangent
      default:
        return thetaDeg;
    }
  });
</script>

<div
  class="interactive-grid"
  role="application"
  aria-label="Visual sequence builder grid"
>
  <svg
    viewBox="0 0 950 950"
    xmlns="http://www.w3.org/2000/svg"
    preserveAspectRatio="xMidYMid meet"
  >
    <!-- Layer 0: Gradient background (semi-transparent on mobile via CSS) -->
    <defs>
      <linearGradient id="grid-bg-gradient" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="rgb(20, 25, 40)" />
        <stop offset="100%" stop-color="rgb(10, 12, 22)" />
      </linearGradient>
    </defs>
    <rect
      class="grid-bg"
      x="0"
      y="0"
      width="950"
      height="950"
      fill="url(#grid-bg-gradient)"
    />

    <!-- Layer 1: Grid lines and points -->
    <GridSvg gridMode={builderState.gridMode} />

    <!-- Layer 2: Compare the other hand's same-beat route with the next click. -->
    {#if comparisonPathD}
      <path
        class="comparison-path motion-preview-path"
        class:blue-path={builderState.activeHand === MotionColor.RED}
        class:red-path={builderState.activeHand === MotionColor.BLUE}
        d={comparisonPathD}
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      />
    {/if}

    {#if candidatePathD}
      <path
        class="candidate-path motion-preview-path"
        class:blue-path={builderState.activeHand === MotionColor.BLUE}
        class:red-path={builderState.activeHand === MotionColor.RED}
        d={candidatePathD}
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      />
    {/if}

    <!-- Layer 3: Ghost props (the inactive hand animated in sync during building).
         Fades out when the active hand goes past the other hand's last step. -->
    {#if ghostBlueState && builderState.phase !== "complete"}
      {@const ghostTarget = findTarget(ghostBlueState.position)}
      {#if ghostTarget}
        {#if bluePropData?.svgData}
          <g
            bind:this={ghostBluePropGroupRef}
            class="prop-svg-group dimmed-prop"
            style="transform: {propTransform(
              ghostTarget.x,
              ghostTarget.y,
              getRotation(
                ghostBlueState.position,
                ghostBlueState.orientation,
                currentBluePropType
              ),
              bluePropData.svgData.center
            )}"
          >
            {@html bluePropData.svgData.svgContent}
          </g>
        {:else}
          <circle
            cx={ghostTarget.x}
            cy={ghostTarget.y}
            r={FALLBACK_RADIUS}
            class="prop-fallback blue-fallback dimmed-prop"
          />
        {/if}
      {/if}
    {/if}

    {#if ghostRedState && builderState.phase !== "complete"}
      {@const ghostRedTarget = findTarget(ghostRedState.position)}
      {#if ghostRedTarget}
        {#if redPropData?.svgData}
          <g
            bind:this={ghostRedPropGroupRef}
            class="prop-svg-group dimmed-prop"
            style="transform: {propTransform(
              ghostRedTarget.x,
              ghostRedTarget.y,
              getRotation(
                ghostRedState.position,
                ghostRedState.orientation,
                currentRedPropType
              ),
              redPropData.svgData.center
            )}"
          >
            {@html redPropData.svgData.svgContent}
          </g>
        {:else}
          <circle
            cx={ghostRedTarget.x}
            cy={ghostRedTarget.y}
            r={FALLBACK_RADIUS}
            class="prop-fallback red-fallback dimmed-prop"
          />
        {/if}
      {/if}
    {/if}

    <!-- Layer 4: Active hand's prop indicator (animated group) -->
    {#if activeTarget && builderState.phase !== "complete"}
      <g
        bind:this={activePropGroupRef}
        class="active-prop-group"
        class:no-transition={builderState.phase === "animating" ||
          suppressTransition}
        style="transform: {propTransform(
          activeTarget.x,
          activeTarget.y,
          activeRotation,
          activePropCenter
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

    <!-- Layer 4.5: Orientation ring indicator (sibling of prop group to avoid
         compounding parent rotation and interfering with CSS transition) -->
    {#if activeTarget && builderState.showOrientationArrow && builderState.phase !== "complete"}
      <g
        class="ori-indicator"
        style="transform: translate({activeTarget.x}px, {activeTarget.y}px) rotate({arrowRotationDeg}deg)"
      >
        <!-- Directional arcs sweeping in facing direction -->
        <path
          d="M 60,0 A 60,60 0 0,1 30,52"
          fill="none"
          stroke="var(--color-gold, #FFD700)"
          stroke-width="5"
          stroke-linecap="round"
        />
        <path
          d="M 60,0 A 60,60 0 0,0 30,-52"
          fill="none"
          stroke="var(--color-gold, #FFD700)"
          stroke-width="5"
          stroke-linecap="round"
        />
        <!-- Arrowhead at the tip -->
        <polygon points="55,-8 72,0 55,8" fill="var(--color-gold, #FFD700)" />
        <!-- Outer glow ring -->
        <circle
          cx="0"
          cy="0"
          r="80"
          fill="none"
          stroke="var(--color-gold, #FFD700)"
          stroke-width="2"
          opacity="0.2"
        />
      </g>
    {/if}

    <!-- When complete, show both hands at their final positions -->
    {#if builderState.phase === "complete"}
      <!-- Blue final -->
      {@const blueFinalLoc = getFinalPosition(builderState.blueSteps)}
      {#if blueFinalLoc}
        {@const blueFinalT = findTarget(blueFinalLoc)}
        {#if blueFinalT}
          {#if bluePropData?.svgData}
            <g
              class="prop-svg-group"
              style="transform: {propTransform(
                blueFinalT.x,
                blueFinalT.y,
                getRotation(
                  blueFinalLoc,
                  blueFinalOrientation,
                  currentBluePropType
                ),
                bluePropData.svgData.center
              )}"
            >
              {@html bluePropData.svgData.svgContent}
            </g>
          {:else}
            <circle
              cx={blueFinalT.x}
              cy={blueFinalT.y}
              r={FALLBACK_RADIUS}
              class="prop-fallback blue-fallback"
            />
          {/if}
        {/if}
      {/if}
      <!-- Red final -->
      {@const redFinal = getFinalPosition(builderState.redSteps)}
      {#if redFinal}
        {@const redFinalT = findTarget(redFinal)}
        {@const redFinalOri =
          builderState.redSteps.length > 0
            ? builderState.redSteps[builderState.redSteps.length - 1]!
                .endOrientation
            : Orientation.IN}
        {#if redFinalT}
          {#if redPropData?.svgData}
            <g
              class="prop-svg-group"
              style="transform: {propTransform(
                redFinalT.x,
                redFinalT.y,
                getRotation(redFinal, redFinalOri, currentRedPropType),
                redPropData.svgData.center
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
  </svg>
  <HitTargetOverlay
    gridMode={builderState.gridMode}
    showCenter={builderState.showCenter}
    {activePhaseColor}
    currentPosition={builderState.currentPosition}
    disabled={targetsDisabled}
    pulseTargets={false}
    keyLabels={builderState.keyboardMode ? LOCATION_TO_KEY_LABEL : {}}
    labelForLocation={getTargetLabel}
    onPointClick={handleTargetClick}
    onPointPreview={(location) => {
      previewLocation = location;
    }}
  />
</div>

<style>
  .interactive-grid {
    position: relative;
    width: min(100cqi, 100cqb);
    height: auto;
    max-width: 100%;
    max-height: 100%;
    aspect-ratio: 1;
    place-self: start center;
    box-sizing: border-box;
    border-radius: var(--settings-radius-lg, 20px);
    overflow: hidden;
    border: 1.5px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.16));
    box-shadow:
      0 18px 48px color-mix(in srgb, var(--theme-shadow, #000) 38%, transparent),
      0 0 0 1px color-mix(in srgb, var(--theme-accent, #8b6cff) 8%, transparent),
      inset 0 1px 0 var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  /* Semi-transparent background - lets the app background bleed through */
  .interactive-grid :global(.grid-bg) {
    opacity: 0.9;
    transition: opacity 0.3s ease;
  }

  /* Slightly more transparent on mobile */
  @container tool-panel (max-width: 768px) {
    .interactive-grid {
      place-self: center;
      border-radius: var(--settings-radius-lg, 16px);
      border-color: var(--theme-stroke, rgba(255, 255, 255, 0.06));
      box-shadow: 0 4px 20px var(--theme-shadow, rgba(0, 0, 0, 0.3));
    }

    .interactive-grid :global(.grid-bg) {
      opacity: 0.82;
    }
  }

  .interactive-grid svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  .motion-preview-path {
    pointer-events: none;
    filter: drop-shadow(0 0 7px currentColor);
    animation: preview-path-in var(--duration-fast, 150ms) ease-out;
  }

  .comparison-path {
    stroke-width: 14;
    opacity: 0.34;
  }

  .candidate-path {
    stroke-width: 8;
    stroke-dasharray: 16 12;
    opacity: 0.82;
    animation:
      preview-path-in var(--duration-fast, 150ms) ease-out,
      candidate-path-flow 900ms linear infinite;
  }

  .motion-preview-path.blue-path {
    stroke: var(--prop-blue, #2e8bf0);
    color: var(--prop-blue, #2e8bf0);
  }

  .motion-preview-path.red-path {
    stroke: var(--prop-red, #ed1c24);
    color: var(--prop-red, #ed1c24);
  }

  @keyframes preview-path-in {
    from {
      opacity: 0;
    }
  }

  @keyframes candidate-path-flow {
    to {
      stroke-dashoffset: -28;
    }
  }

  /* Background now uses SVG gradient defined in <defs> */

  /* Prop SVG groups (real prop rendering) */
  .prop-svg-group {
    pointer-events: none;
    opacity: 0.85;
  }

  .prop-svg-group.dimmed-prop {
    opacity: 0.35;
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

  /* Active prop group: no pointer events (hits pass through to targets) */
  .active-prop-group {
    pointer-events: none;
    /* Smooth transition for orientation changes (setOrientation) */
    transition: transform var(--duration-normal, 200ms) ease;
  }

  /* Disable CSS transition during SvgPropAnimator-driven motion animation
     (RAF-based animation conflicts with CSS transitions on the same property) */
  .active-prop-group.no-transition {
    transition: none;
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

  /* Orientation ring indicator */
  .ori-indicator {
    pointer-events: none;
    animation: ori-fade 1.2s ease forwards;
    filter: drop-shadow(0 0 8px var(--color-gold, #ffd700))
      drop-shadow(
        0 0 18px color-mix(in srgb, var(--color-gold, #ffd700) 50%, transparent)
      );
  }

  @keyframes ori-fade {
    0% {
      opacity: 0;
    }
    8% {
      opacity: 1;
    }
    65% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .motion-preview-path,
    .candidate-path {
      animation: none;
    }

    .scale-in {
      animation: none;
    }

    .active-prop-group {
      transition: none;
    }

    .interactive-grid :global(.grid-bg) {
      transition: none;
    }

    .ori-indicator {
      animation: none;
      opacity: 0.7;
    }
  }
</style>
