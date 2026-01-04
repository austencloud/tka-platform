<!--
Simple Prop Component - Just renders a prop with provided data
Now with smooth transitions when position or orientation changes!
-->
<script lang="ts">
  import {
    Orientation,
    MotionColor,
    RotationDirection,
  } from "../../shared/domain/enums/pictograph-enums";
  import { PropType } from "../domain/enums/PropType";
  import type { MotionData } from "../../shared/domain/models/MotionData";
  import type { PropAssets } from "../domain/models/PropAssets";
  import type { PropPosition } from "../domain/models/PropPosition";
  import { getSettings } from "../../../application/state/app-state.svelte";

  // Buugeng family - asymmetric props that can be flipped
  const BUUGENG_FAMILY = new Set([
    PropType.BUUGENG,
    PropType.BIGBUUGENG,
    PropType.FRACTALGENG,
  ]);

  let {
    motionData,
    propAssets,
    propPosition,
    showProp = true,
  } = $props<{
    motionData: MotionData;
    propAssets: PropAssets;
    propPosition: PropPosition;
    showProp?: boolean;
  }>();

  type MotionSnapshot = {
    startOrientation?: Orientation;
    turns?: number | "fl";
    rotationDirection?: RotationDirection;
  };

  type RotationAnimationDirection = "cw" | "ccw" | "auto";

  const ORIENTATION_CYCLE: Orientation[] = [
    Orientation.IN,
    Orientation.COUNTER,
    Orientation.OUT,
    Orientation.CLOCK,
  ];

  // Initialize with 0, $effect below handles initial and subsequent prop changes
  let displayedRotation = $state<number>(0);
  let previousRotation: number | null = null;
  let previousSnapshot: MotionSnapshot | null = null;

  // Check if this prop should be mirrored (flipped horizontally)
  // - Red HAND is always mirrored (left/right hands are anatomically mirrored)
  // - Buugeng family can be flipped via user preference (asymmetric prop)
  //
  // IMPORTANT: We call getSettings() directly inside $derived.by to ensure
  // Svelte 5 tracks the reactive settings properties. Using an intermediate
  // $derived(getSettings()) doesn't preserve reactivity for property access.
  //
  // NOTE: We check BOTH motionData.propType AND the settings prop type because
  // motionData may have a stored prop type (e.g., "staff") while settings has
  // the actual rendered prop type (e.g., "buugeng"). The flip applies to the
  // RENDERED prop, so we need to check settings.
  const shouldMirror = $derived.by(() => {
    const settings = getSettings();

    // Determine the actual prop type being rendered
    // If motionData explicitly specifies HAND (e.g., Assembly mode), use it
    // Otherwise, use settings override > stored prop type
    const actualPropType =
      motionData.propType === PropType.HAND
        ? PropType.HAND
        : motionData.color === MotionColor.BLUE
          ? (settings.bluePropType ?? motionData.propType)
          : motionData.color === MotionColor.RED
            ? (settings.redPropType ?? motionData.propType)
            : motionData.propType;

    // Red hand is always mirrored
    if (
      actualPropType === PropType.HAND &&
      motionData.color === MotionColor.RED
    ) {
      return true;
    }

    // Check buugeng flip preference based on hand color
    if (BUUGENG_FAMILY.has(actualPropType as PropType)) {
      if (motionData.color === MotionColor.BLUE) {
        return settings.blueBuugengFlipped ?? false;
      } else if (motionData.color === MotionColor.RED) {
        return settings.redBuugengFlipped ?? false;
      }
    }

    return false;
  });

  // Build the complete transform string
  const transformString = $derived(
    `translate(${propPosition.x}px, ${propPosition.y}px) ` +
      `rotate(${displayedRotation}deg) ` +
      (shouldMirror ? "scaleX(-1) " : "") +
      `translate(${-propAssets.center.x}px, ${-propAssets.center.y}px)`
  );

  $effect(() => {
    const targetRotation = propPosition?.rotation ?? 0;
    const snapshot: MotionSnapshot = {
      startOrientation: motionData?.startOrientation,
      turns: motionData?.turns,
      rotationDirection: motionData?.rotationDirection,
    };

    if (previousSnapshot === null || previousRotation === null) {
      displayedRotation = targetRotation;
    } else {
      const direction = determineAnimationDirection(previousSnapshot, snapshot);
      displayedRotation = resolveRotation(
        previousRotation,
        targetRotation,
        direction
      );
    }

    previousRotation = displayedRotation;
    previousSnapshot = snapshot;
  });

  function determineAnimationDirection(
    previous: MotionSnapshot,
    current: MotionSnapshot
  ): RotationAnimationDirection {
    const previousTurns =
      typeof previous.turns === "number" ? previous.turns : null;
    const currentTurns =
      typeof current.turns === "number" ? current.turns : null;

    if (
      previousTurns !== null &&
      currentTurns !== null &&
      previousTurns !== currentTurns
    ) {
      const rotationDir = current.rotationDirection;
      if (currentTurns > previousTurns) {
        return mapRotationDirection(rotationDir) ?? "cw";
      }
      if (currentTurns < previousTurns) {
        const direction = mapRotationDirection(rotationDir);
        if (direction === "cw") return "ccw";
        if (direction === "ccw") return "cw";
        return "ccw";
      }
    }

    if (
      previous.startOrientation &&
      current.startOrientation &&
      previous.startOrientation !== current.startOrientation
    ) {
      return getOrientationDirection(
        previous.startOrientation,
        current.startOrientation,
        current.rotationDirection
      );
    }

    return "auto";
  }

  function mapRotationDirection(
    direction?: RotationDirection
  ): RotationAnimationDirection | null {
    if (!direction || direction === RotationDirection.NO_ROTATION) {
      return null;
    }
    return direction === RotationDirection.COUNTER_CLOCKWISE ? "ccw" : "cw";
  }

  function getOrientationDirection(
    previousOrientation: Orientation,
    nextOrientation: Orientation,
    rotationDirection?: RotationDirection
  ): RotationAnimationDirection {
    const previousIndex = ORIENTATION_CYCLE.indexOf(previousOrientation);
    const nextIndex = ORIENTATION_CYCLE.indexOf(nextOrientation);

    if (previousIndex === -1 || nextIndex === -1) {
      return mapRotationDirection(rotationDirection) ?? "cw";
    }

    const cycleLength = ORIENTATION_CYCLE.length;
    const forwardSteps =
      (nextIndex - previousIndex + cycleLength) % cycleLength;
    const backwardSteps =
      (previousIndex - nextIndex + cycleLength) % cycleLength;

    if (forwardSteps === 0) {
      return "auto";
    }

    if (forwardSteps === backwardSteps) {
      return mapRotationDirection(rotationDirection) ?? "cw";
    }

    return forwardSteps < backwardSteps ? "cw" : "ccw";
  }

  function resolveRotation(
    previous: number,
    target: number,
    direction: RotationAnimationDirection
  ): number {
    if (!Number.isFinite(previous)) {
      return target;
    }

    // Normalize both angles to [0, 360) range for comparison
    const normalizedPrevious = ((previous % 360) + 360) % 360;
    const normalizedTarget = ((target % 360) + 360) % 360;

    if (direction === "cw") {
      // Calculate the clockwise distance from previous to target
      let cwDistance = (normalizedTarget - normalizedPrevious + 360) % 360;
      // Apply that distance to the previous rotation (maintaining the rotation cycle)
      return previous + cwDistance;
    }

    if (direction === "ccw") {
      // Calculate the counter-clockwise distance from previous to target
      let ccwDistance = (normalizedPrevious - normalizedTarget + 360) % 360;
      // Apply that distance in the negative direction
      return previous - ccwDistance;
    }

    const delta = normalizeDelta(target - previous);
    return previous + delta;
  }

  function normalizeDelta(delta: number): number {
    let normalized = ((delta % 360) + 360) % 360;
    if (normalized > 180) normalized -= 360;
    if (normalized <= -180) normalized += 360;
    return normalized;
  }
</script>

{#if showProp}
  <g
    class="prop-svg {motionData.color}-prop-svg"
    data-prop-type={motionData?.propType}
    style="transform: {transformString};"
  >
    {@html propAssets.imageSrc}
  </g>
{/if}

<style>
  .prop-svg {
    pointer-events: none;
    /* Smooth transition for position and rotation changes - matches arrow and grid behavior */
    /* IMPORTANT: transform must be a CSS property (not SVG attribute) for transitions to work */
    transition: transform 0.2s ease;
  }
</style>
