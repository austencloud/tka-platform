<!--
Simple Arrow Component - Just renders an arrow with provided data
Now with click interaction and selection visual feedback
Now with intelligent rotation animation matching prop behavior!

Position Cache System:
When components are recreated (e.g., during {#each} rerender), the module-level
cache preserves the last rendered position. This allows the component to start
at the cached position and animate to the new one, enabling smooth transitions
even when Svelte recreates the component instance.

Ported from scribe's ArrowSvg with config injection.
-->
<script module lang="ts">
  // Module-level position cache - persists across component instance recreation
  // Key format: `${cellIndex}-${color}`
  const arrowPositionCache = new Map<string, { x: number; y: number }>();

  /**
   * Clear the arrow position cache. Call this when clearing a sequence to ensure
   * fresh generation doesn't animate from stale positions.
   */
  export function clearArrowPositionCache(): void {
    arrowPositionCache.clear();
  }
</script>

<script lang="ts">
  import {
    Orientation,
    RotationDirection,
    MotionColor,
  } from "@tka/types";
  import type { MotionData } from "@tka/types";
  import type {
    ArrowAssets,
    ArrowPosition,
  } from "../domain/arrow-models";
  import { getPictographConfig } from "../config/pictograph-context";

  let {
    motionData,
    arrowAssets,
    arrowPosition,
    shouldMirror = false,
    showArrow = true,
    color,
    isClickable = false,
    isSelected = false,
    onArrowClick = undefined,
    darkMode = undefined,
    isTransforming = false,
    cellIndex = null,
  } = $props<{
    motionData: MotionData;
    arrowAssets: ArrowAssets;
    arrowPosition: ArrowPosition;
    shouldMirror?: boolean;
    showArrow?: boolean;
    color: string;
    isClickable?: boolean;
    /** Whether this arrow is selected (scribe-specific, passed from parent) */
    isSelected?: boolean;
    /** Click handler for selection (scribe-specific) */
    onArrowClick?: (color: string) => void;
    /** Dark mode override for export */
    darkMode?: boolean;
    /** Whether the arrow is being transformed (scribe animation state) */
    isTransforming?: boolean;
    /** Cell index for position caching (enables smooth transitions on regeneration) */
    cellIndex?: number | null;
  }>();

  const config = getPictographConfig();
  const effectiveDarkMode = $derived(darkMode ?? config.getDarkMode());

  // White stroke for visibility against light backgrounds (when NOT in dark mode)
  const lightModeStroke = $derived(
    !effectiveDarkMode ? "drop-shadow(0 0 1.5px white) drop-shadow(0 0 1.5px white)" : ""
  );

  // Safe center values - guard against NaN which can occur with empty/static arrow SVGs
  const safeCenter = $derived({
    x: Number.isFinite(arrowAssets?.center?.x) ? arrowAssets.center.x : 0,
    y: Number.isFinite(arrowAssets?.center?.y) ? arrowAssets.center.y : 0,
  });

  // Safe position values - guard against NaN in position calculations
  const safePosition = $derived({
    x: Number.isFinite(arrowPosition?.x) ? arrowPosition.x : 0,
    y: Number.isFinite(arrowPosition?.y) ? arrowPosition.y : 0,
  });

  // ============================================================================
  // INTELLIGENT ROTATION ANIMATION SYSTEM (matching PropSvg behavior)
  // ============================================================================

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

  const EPSILON = 0.0001;

  // Track rotation state for intelligent animation
  let displayedRotation = $state<number>(0);
  let previousRotation: number | null = null;
  let previousSnapshot: MotionSnapshot | null = null;

  // Track displayed position for smooth CSS transitions
  let displayedX = $state<number>(0);
  let displayedY = $state<number>(0);
  let pendingPositionFrame: number | null = null;

  // Update displayed position with cache-aware frame deferral for CSS transitions
  $effect(() => {
    const targetX = safePosition?.x ?? 0;
    const targetY = safePosition?.y ?? 0;

    // Cancel any pending position update
    if (pendingPositionFrame !== null) {
      cancelAnimationFrame(pendingPositionFrame);
      pendingPositionFrame = null;
    }

    // No cell index means we're not in a grid context
    if (cellIndex === null) {
      displayedX = targetX;
      displayedY = targetY;
      return;
    }

    // Build cache key from cell index and arrow color
    const key = `${cellIndex}-${color}`;
    const cached = arrowPositionCache.get(key);

    if (cached && (cached.x !== targetX || cached.y !== targetY)) {
      displayedX = cached.x;
      displayedY = cached.y;

      // Double-RAF pattern for CSS transition
      pendingPositionFrame = requestAnimationFrame(() => {
        pendingPositionFrame = requestAnimationFrame(() => {
          displayedX = targetX;
          displayedY = targetY;
          pendingPositionFrame = null;
        });
      });
    } else {
      displayedX = targetX;
      displayedY = targetY;
    }

    arrowPositionCache.set(key, { x: targetX, y: targetY });

    return () => {
      if (pendingPositionFrame !== null) {
        cancelAnimationFrame(pendingPositionFrame);
      }
    };
  });

  // Determine optimal rotation animation based on motion data changes
  $effect(() => {
    const targetRotation = arrowPosition?.rotation ?? 0;
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

    if (direction === "auto") {
      const delta = normalizeDelta(target - previous);
      return previous + delta;
    }

    const normalizedPrevious = ((previous % 360) + 360) % 360;
    const normalizedTarget = ((target % 360) + 360) % 360;

    let delta: number;

    if (direction === "cw") {
      delta = (normalizedTarget - normalizedPrevious + 360) % 360;
      if (delta < EPSILON) {
        return target;
      }
    } else {
      delta = (normalizedTarget - normalizedPrevious - 360) % 360;
      if (Math.abs(delta) < EPSILON) {
        return target;
      }
    }

    return previous + delta;
  }

  function normalizeDelta(delta: number): number {
    let normalized = ((delta % 360) + 360) % 360;
    if (normalized > 180) normalized -= 360;
    if (normalized <= -180) normalized += 360;
    return normalized;
  }

  // Handle arrow click
  function handleArrowClick(event: MouseEvent | KeyboardEvent) {
    if (!isClickable || !onArrowClick) return;
    event.stopPropagation();
    onArrowClick(color);
  }
</script>

{#if showArrow}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <g
    class="arrow-svg {motionData.color}-arrow-svg"
    class:mirrored={shouldMirror}
    class:clickable={isClickable}
    class:selected={isSelected}
    class:no-transition={isTransforming}
    onclick={isClickable ? handleArrowClick : undefined}
    onkeydown={isClickable
      ? (e) => (e.key === "Enter" || e.key === " ") && handleArrowClick(e)
      : undefined}
    role={isClickable ? "button" : undefined}
    tabindex={isClickable ? 0 : undefined}
    aria-label={isClickable
      ? `${color} arrow - ${motionData.motionType} ${motionData.turns}`
      : undefined}
    style="
      transform: translate({displayedX}px, {displayedY}px)
                 rotate({displayedRotation}deg)
                 {shouldMirror ? 'scale(-1, 1)' : ''};
      {lightModeStroke && !isSelected ? `filter: ${lightModeStroke};` : ''}
    "
  >
    <!-- Position group at calculated coordinates, let SVG handle its own centering -->
    <g transform="translate({-safeCenter.x}, {-safeCenter.y})">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      {@html arrowAssets.imageSrc}
    </g>

    <!-- Selection highlight overlay -->
    {#if isSelected}
      <circle
        cx="0"
        cy="0"
        r="60"
        fill="none"
        stroke="var(--color-accent, var(--semantic-warning, #f59e0b))"
        stroke-width="4"
        class="selection-glow"
        opacity="0.8"
      />
    {/if}
  </g>
{/if}

<style>
  .arrow-svg {
    pointer-events: none;
    /* Smooth transition for position and rotation changes - matches prop behavior */
    /* IMPORTANT: transform must be a CSS property (not SVG attribute) for transitions to work */
    transition:
      transform 0.2s ease,
      filter 0.2s ease;
  }

  /* Disable transitions during sequence transforms */
  .arrow-svg.no-transition {
    transition: none;
  }

  .arrow-svg.clickable {
    pointer-events: all;
    cursor: pointer !important;
  }

  .arrow-svg.clickable:hover {
    filter: drop-shadow(0 0 8px rgba(251, 191, 36, 0.6));
  }

  .arrow-svg.clickable:active {
    filter: drop-shadow(0 0 4px rgba(251, 191, 36, 0.4));
  }

  .arrow-svg.selected {
    filter: drop-shadow(0 0 12px rgba(251, 191, 36, 0.9));
  }

  .selection-glow {
    animation: pulse-glow 2s ease-in-out infinite;
  }

  @keyframes pulse-glow {
    0%,
    100% {
      opacity: 0.6;
      stroke-width: 4;
    }
    50% {
      opacity: 1;
      stroke-width: 6;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .selection-glow {
      animation: none;
      opacity: 0.8;
      stroke-width: 5;
    }

    .arrow-svg {
      transition: none;
    }
  }
</style>
