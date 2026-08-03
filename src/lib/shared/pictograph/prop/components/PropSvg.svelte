<!--
Simple Prop Component - Just renders a prop with provided data
Now with smooth transitions when position or orientation changes!

Position Cache System:
When components are recreated (e.g., during {#each} rerender), the module-level
cache preserves the last rendered position. This allows the component to start
at the cached position and animate to the new one, enabling smooth transitions
even when Svelte recreates the component instance.
-->
<script module lang="ts">
  import {
    getPropPositionCache,
    clearPropPositionCache,
  } from "../prop-position-cache";
  const positionCache = getPropPositionCache();
  export { clearPropPositionCache };
</script>

<script lang="ts">
  import { onDestroy } from "svelte";
  import {
    Orientation,
    MotionColor,
    RotationDirection,
  } from "../../shared/domain/enums/pictograph-enums";
  import { PropType } from "../domain/enums/prop-type";
  import type { MotionData } from "../../shared/domain/models/motion-data";
  import type { PropAssets } from "../domain/models/prop-assets";
  import type { PropPosition } from "../domain/models/prop-position";
  import {
    applyEditorTorchPalette,
    needsEditorContrast,
    type PropRenderContext,
  } from "../domain/prop-render-context";
  import { getSettings } from "../../../application/state/app-state.svelte";
  import { getAnimationVisibilityManager } from "../../../animation-engine/state/animation-visibility-state.svelte";

  // Buugeng family - asymmetric props that can be flipped
  const BUUGENG_FAMILY = new Set([
    PropType.BUUGENG,
    PropType.BIGBUUGENG,
    PropType.TRIGENG,
  ]);

  // Get centralized visibility manager for transform state
  const visibilityManager = getAnimationVisibilityManager();

  // Track transform state to disable transitions during sequence transforms
  let isTransforming = $state(visibilityManager.isTransforming());

  // Register for updates when visibility state changes
  $effect(() => {
    const handler = () => {
      isTransforming = visibilityManager.isTransforming();
    };
    visibilityManager.registerObserver(handler);
    return () => visibilityManager.unregisterObserver(handler);
  });

  // Track SVG content changes for fade transition on prop type swap
  let propFading = $state(false);
  let previousImageSrc: string | null = null;
  let fadeTimeoutId: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    const currentSrc = propAssets?.imageSrc;
    if (previousImageSrc !== null && currentSrc !== previousImageSrc) {
      // SVG content actually changed (prop type swap) - trigger a brief fade.
      // Schedule the reset ONLY inside this branch. Do NOT clear the pending
      // reset from the effect teardown: this effect re-runs whenever the parent
      // hands down a new propAssets object, even when imageSrc is byte-identical
      // (regeneration). If the teardown cleared the timeout on such a re-run,
      // the `if` above would be skipped (same src) and no new reset would be
      // scheduled, stranding propFading = true and leaving the prop at opacity
      // 0.15 permanently. Keeping the timer alive lets it reset the fade even
      // across unrelated re-runs.
      propFading = true;
      if (fadeTimeoutId !== null) clearTimeout(fadeTimeoutId);
      fadeTimeoutId = setTimeout(() => {
        propFading = false;
        fadeTimeoutId = null;
      }, 150);
    }
    previousImageSrc = currentSrc ?? null;
  });

  // Unmount cleanup only. Deliberately not the effect teardown (see above).
  onDestroy(() => {
    if (fadeTimeoutId !== null) clearTimeout(fadeTimeoutId);
  });

  let {
    motionData,
    propAssets,
    propPosition,
    showProp = true,
    isClickable = false,
    isSelected = false,
    onPropClick,
    // Cell index for position caching (enables smooth transitions on regeneration)
    cellIndex = null,
    propRenderContext = "standard",
    darkMode = false,
  } = $props<{
    motionData: MotionData;
    propAssets: PropAssets;
    propPosition: PropPosition;
    showProp?: boolean;
    isClickable?: boolean;
    isSelected?: boolean;
    onPropClick?: () => void;
    /** Cell index for position caching (enables smooth transitions on regeneration) */
    cellIndex?: number | null;
    /** Editor grids opt in to a surface-aware torch palette. */
    propRenderContext?: PropRenderContext;
    /** The actual pictograph surface, used to choose the opposing shaft color. */
    darkMode?: boolean;
  }>();

  const renderedPropType = $derived(propAssets.propType ?? motionData.propType);
  const showEditorContrast = $derived(
    needsEditorContrast(propRenderContext, renderedPropType)
  );
  const renderedArtwork = $derived(
    applyEditorTorchPalette(
      propAssets.imageSrc,
      propRenderContext,
      renderedPropType,
      darkMode
    )
  );

  type MotionSnapshot = {
    startOrientation?: Orientation;
    turns?: number | "fl";
    rotationDirection?: RotationDirection;
  };

  type RotationAnimationDirection = "cw" | "ccw" | "auto";

  // These cycles follow the prop's rendered SVG angle, where increasing
  // degrees rotate clockwise. Radial labels run in the opposite order from
  // the center-compass vocabulary, so one shared semantic cycle cannot choose
  // the visible transition direction for both families.
  const RADIAL_ROTATION_CYCLE: Orientation[] = [
    Orientation.IN,
    Orientation.COUNTER_IN,
    Orientation.COUNTER,
    Orientation.COUNTER_OUT,
    Orientation.OUT,
    Orientation.CLOCK_OUT,
    Orientation.CLOCK,
    Orientation.CLOCK_IN,
  ];

  const CENTER_ROTATION_CYCLE: Orientation[] = [
    Orientation.CENTER_N,
    Orientation.CENTER_NE,
    Orientation.CENTER_E,
    Orientation.CENTER_SE,
    Orientation.CENTER_S,
    Orientation.CENTER_SW,
    Orientation.CENTER_W,
    Orientation.CENTER_NW,
  ];

  // Initialize with 0, $effect below handles initial and subsequent prop changes
  let displayedRotation = $state<number>(0);
  let previousRotation: number | null = null;
  let previousSnapshot: MotionSnapshot | null = null;

  // Track displayed position for smooth CSS transitions
  // CSS transitions require the old value to be rendered before the new value
  // We achieve this by deferring position updates by one frame
  let displayedX = $state<number>(0);
  let displayedY = $state<number>(0);
  let pendingPositionFrame: number | null = null;

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

    // Determine the actual prop type being rendered.
    // Settings prop type takes precedence — it's what the user chose to display.
    const settingsPropType =
      motionData.color === MotionColor.BLUE
        ? settings.bluePropType
        : motionData.color === MotionColor.RED
          ? settings.redPropType
          : undefined;
    const actualPropType: PropType | string | undefined =
      settingsPropType ?? motionData.propType;

    // Red hand is always mirrored (left/right hands are anatomically mirrored).
    // Also check the prepared motion's own prop type: a per-pictograph override
    // (export, guide pages) forces HAND onto the motion via the preparer, but the
    // user's global settings.redPropType would otherwise mask it through
    // `actualPropType` and leave the red hand looking like an un-mirrored left hand.
    if (
      motionData.color === MotionColor.RED &&
      (actualPropType === PropType.HAND ||
        motionData.propType === PropType.HAND)
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

  // Build the complete transform string using displayed values for smooth transitions
  const transformString = $derived(
    `translate(${displayedX}px, ${displayedY}px) ` +
      `rotate(${displayedRotation}deg) ` +
      (shouldMirror ? "scaleX(-1) " : "") +
      `translate(${-propAssets.center.x}px, ${-propAssets.center.y}px)`
  );

  // Update displayed position with cache-aware frame deferral for CSS transitions
  // The cache allows smooth transitions even when component instances are recreated
  $effect(() => {
    const targetX = propPosition?.x ?? 0;
    const targetY = propPosition?.y ?? 0;

    // Cancel any pending position update
    if (pendingPositionFrame !== null) {
      cancelAnimationFrame(pendingPositionFrame);
      pendingPositionFrame = null;
    }

    // No cell index means we're not in a grid context (option picker, etc.)
    // Set position immediately without caching
    if (cellIndex === null) {
      displayedX = targetX;
      displayedY = targetY;
      return;
    }

    // Build cache key from cell index and motion color
    const key = `${cellIndex}-${motionData.color}`;
    const cached = positionCache.get(key);

    if (cached && (cached.x !== targetX || cached.y !== targetY)) {
      // Position changed and we have a cached previous position
      // Start at cached position and animate to target
      displayedX = cached.x;
      displayedY = cached.y;

      // Double-RAF pattern: first RAF lets the browser paint the "from" state,
      // second RAF sets the "to" state which triggers CSS transition
      pendingPositionFrame = requestAnimationFrame(() => {
        pendingPositionFrame = requestAnimationFrame(() => {
          displayedX = targetX;
          displayedY = targetY;
          pendingPositionFrame = null;
        });
      });
    } else {
      // First render for this cell OR position hasn't changed
      // Set immediately (no animation needed)
      displayedX = targetX;
      displayedY = targetY;
    }

    // Update cache with current target position
    positionCache.set(key, { x: targetX, y: targetY });

    // Cleanup on unmount
    return () => {
      if (pendingPositionFrame !== null) {
        cancelAnimationFrame(pendingPositionFrame);
      }
    };
  });

  $effect(() => {
    const targetRotation = propPosition?.rotation ?? 0;
    const snapshot: MotionSnapshot = {
      startOrientation: motionData?.startOrientation,
      turns: motionData?.turns,
      rotationDirection: motionData?.rotationDirection,
    };

    const isFirstRender =
      previousSnapshot === null || previousRotation === null;

    if (isFirstRender) {
      displayedRotation = targetRotation;
    } else {
      const direction = determineAnimationDirection(
        previousSnapshot!,
        snapshot
      );
      displayedRotation = resolveRotation(
        previousRotation!,
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
    const cycle = getSharedRotationCycle(previousOrientation, nextOrientation);

    if (!cycle) {
      return mapRotationDirection(rotationDirection) ?? "cw";
    }

    const previousIndex = cycle.indexOf(previousOrientation);
    const nextIndex = cycle.indexOf(nextOrientation);

    if (previousIndex === -1 || nextIndex === -1) {
      return mapRotationDirection(rotationDirection) ?? "cw";
    }

    const cycleLength = cycle.length;
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

  function getSharedRotationCycle(
    previousOrientation: Orientation,
    nextOrientation: Orientation
  ): Orientation[] | null {
    if (
      RADIAL_ROTATION_CYCLE.includes(previousOrientation) &&
      RADIAL_ROTATION_CYCLE.includes(nextOrientation)
    ) {
      return RADIAL_ROTATION_CYCLE;
    }

    if (
      CENTER_ROTATION_CYCLE.includes(previousOrientation) &&
      CENTER_ROTATION_CYCLE.includes(nextOrientation)
    ) {
      return CENTER_ROTATION_CYCLE;
    }

    return null;
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

{#snippet propArtwork()}
  {#if showEditorContrast}
    <g
      class="editor-torch-artwork"
      data-editor-prop-contrast
      data-editor-torch-palette={darkMode ? "dark" : "light"}
    >
      {@html renderedArtwork}
    </g>
  {:else}
    {@html renderedArtwork}
  {/if}
{/snippet}

{#if showProp}
  {#if isClickable && onPropClick}
    <!-- Interactive prop - clickable button -->
    <g
      class="prop-svg {motionData.color}-prop-svg clickable"
      class:selected={isSelected}
      class:no-transition={isTransforming}
      class:prop-fading={propFading}
      data-prop-type={motionData?.propType}
      style="transform: {transformString};"
      onclick={onPropClick}
      onkeydown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPropClick();
        }
      }}
      role="button"
      tabindex="0"
    >
      {@render propArtwork()}
      {#if isSelected}
        <circle
          class="selection-ring"
          cx={propPosition.x}
          cy={propPosition.y}
          r="32"
          fill="none"
          stroke="var(--semantic-info, #3b82f6)"
          stroke-width="3"
          opacity="0.8"
        />
      {/if}
    </g>
  {:else}
    <!-- Non-interactive prop - display only -->
    <g
      class="prop-svg {motionData.color}-prop-svg"
      class:selected={isSelected}
      class:no-transition={isTransforming}
      class:prop-fading={propFading}
      data-prop-type={motionData?.propType}
      style="transform: {transformString};"
    >
      {@render propArtwork()}
      {#if isSelected}
        <circle
          class="selection-ring"
          cx={propPosition.x}
          cy={propPosition.y}
          r="32"
          fill="none"
          stroke="var(--semantic-info, #3b82f6)"
          stroke-width="3"
          opacity="0.8"
        />
      {/if}
    </g>
  {/if}
{/if}

<style>
  .prop-svg {
    pointer-events: none;
    /* Smooth transition for position, rotation, and prop type changes */
    /* IMPORTANT: transform must be a CSS property (not SVG attribute) for transitions to work */
    transition:
      transform var(--duration-normal) ease,
      opacity 150ms ease;
  }

  /* Brief fade when prop type changes (SVG content swap) */
  .prop-svg.prop-fading {
    opacity: 0.15;
  }

  /* Disable transitions during sequence transforms to prevent janky mid-calculation animation */
  .prop-svg.no-transition {
    transition: none;
  }

  .prop-svg.clickable {
    pointer-events: auto;
    cursor: pointer;
  }

  .prop-svg.clickable:hover {
    filter: brightness(1.15);
  }

  .selection-ring {
    pointer-events: none;
  }

  @media (forced-colors: active) {
    .editor-torch-artwork :global([data-torch-shaft]),
    .editor-torch-artwork :global([data-torch-metal]),
    .editor-torch-artwork :global([data-torch-flame-part]) {
      fill: CanvasText !important;
      stroke: CanvasText !important;
    }
  }
</style>
