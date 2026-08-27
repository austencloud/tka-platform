<script lang="ts">
  import { getVisibilityStateManager } from "../state/visibility-state.svelte";
  import { getAnimationVisibilityManager } from "../../../animation-engine/state/animation-visibility-state.svelte";
  import { MotionColor } from "../domain/enums/pictograph-enums";
  import { onMount } from "svelte";

  let {
    blueReversal = false,
    redReversal = false,
    hasValidData = true,
    visible = true,
    previewMode = false,
    onToggle = undefined,
    blueMotionVisible = true,
    redMotionVisible = true,
  } = $props<{
    /** Whether to show blue reversal indicator */
    blueReversal?: boolean;
    /** Whether to show red reversal indicator */
    redReversal?: boolean;
    /** Whether the pictograph has valid data */
    hasValidData?: boolean;
    /** Visibility control for fade effect */
    visible?: boolean;
    /** Preview mode: show at 50% opacity when off instead of hidden */
    previewMode?: boolean;
    /** Callback when glyph is clicked to toggle visibility */
    onToggle?: () => void;
    /** Blue motion visibility (dims dot when false) */
    blueMotionVisible?: boolean;
    /** Red motion visibility (dims dot when false) */
    redMotionVisible?: boolean;
  }>();

  // Get global visibility manager to respect motion visibility settings
  const visibilityManager = getVisibilityStateManager();

  const animationVisibilityManager = getAnimationVisibilityManager();

  // Reactivity counter for visibility changes
  let visibilityUpdateCount = $state(0);

  // Track colors from centralized cache (no getComputedStyle per component)
  let cachedColors = $state(animationVisibilityManager.getMotionColors());

  // Force re-render when visibility changes
  function handleVisibilityChange() {
    visibilityUpdateCount++;
  }

  // Handle color cache updates
  function handleColorChange() {
    cachedColors = animationVisibilityManager.getMotionColors();
  }

  onMount(() => {
    visibilityManager.registerObserver(handleVisibilityChange, ["glyph"]);
    animationVisibilityManager.registerObserver(handleColorChange);

    return () => {
      visibilityManager.unregisterObserver(handleVisibilityChange);
      animationVisibilityManager.unregisterObserver(handleColorChange);
    };
  });

  // Show reversal dots based on data (visibility controls opacity, not presence)
  const effectiveBlueReversal = $derived.by(() => {
    visibilityUpdateCount; // Force reactivity
    return blueReversal;
  });

  const effectiveRedReversal = $derived.by(() => {
    visibilityUpdateCount; // Force reactivity
    return redReversal;
  });

  // Per-dot opacity: dimmed when the corresponding motion is hidden
  const DIMMED_DOT_OPACITY = 0.2;
  const blueDotOpacity = $derived(blueMotionVisible ? 1 : DIMMED_DOT_OPACITY);
  const redDotOpacity = $derived(redMotionVisible ? 1 : DIMMED_DOT_OPACITY);

  // Only render if we have valid data, at least one reversal, AND when visible
  // NOTE: We check visibility here (not just CSS) because when exporting to SVG/image,
  // CSS classes don't carry over - only the raw SVG markup is captured.
  // Preview mode allows rendering at reduced opacity even when not visible.
  const shouldRender = $derived(() => {
    // Don't render if not visible (unless in preview mode which shows dimmed)
    if (!visible && !previewMode) {
      return false;
    }
    const render =
      hasValidData && (effectiveBlueReversal || effectiveRedReversal);
    return render;
  });

  // Get motion colors from centralized cache
  const BLUE_COLOR = $derived(cachedColors.blue);
  const RED_COLOR = $derived(cachedColors.red);

  // Relative positioning - scales with pictograph size
  // Using percentages of the standard 1000px pictograph dimensions
  const X_POSITION_PERCENT = 5.5; // 5.5% from left edge
  const CENTER_Y_PERCENT = 50; // 50% from top (center)
  const DOT_RADIUS_PERCENT = 1.5; // Dot radius as percentage
  const DOT_SPACING_PERCENT = 4.5; // Fixed spacing between dots as percentage (smaller for dots vs Rs)

  // Calculate actual positions based on pictograph dimensions
  // Standard SVG viewBox is 950x950, so center is at 475
  const X_POSITION = X_POSITION_PERCENT * 13; // Convert to 950px scale
  const CENTER_Y = CENTER_Y_PERCENT * 9.5; // Convert to 950px scale (50% * 9.5 = 475 = true center)
  const DOT_RADIUS = DOT_RADIUS_PERCENT * 10; // Convert to 950px scale
  const DOT_SPACING = DOT_SPACING_PERCENT * 13; // Convert to 950px scale

  // Calculate vertical positions when both dots are present (after visibility filtering)
  const redDotY = $derived.by(() => {
    if (effectiveBlueReversal && effectiveRedReversal) {
      // Both present: stack vertically with fixed spacing around center
      return CENTER_Y - DOT_SPACING / 2;
    } else if (effectiveRedReversal) {
      // Only red: center it
      return CENTER_Y;
    }
    return CENTER_Y;
  });

  const blueDotY = $derived.by(() => {
    if (effectiveBlueReversal && effectiveRedReversal) {
      // Both present: blue below red with fixed spacing
      return CENTER_Y + DOT_SPACING / 2;
    } else if (effectiveBlueReversal) {
      // Only blue: center it
      return CENTER_Y;
    }
    return CENTER_Y;
  });

  // Track reversal state changes to trigger CSS animations.
  // Use untracked previous values to avoid reactivity loops.

  let prevBlue: boolean | null = null;
  let prevRed: boolean | null = null;
  let isBlueExiting = $state(false);
  let isRedExiting = $state(false);

  // Blue dot state change detection
  $effect(() => {
    const current = effectiveBlueReversal;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    // Skip initial mount
    if (prevBlue === null) {
      prevBlue = current;
    } else if (prevBlue !== current) {
      // Only react to actual changes
      if (prevBlue && !current) {
        // Was visible, now hidden - trigger exit animation
        isBlueExiting = true;
        timeout = setTimeout(() => { isBlueExiting = false; }, 200);
      }
      prevBlue = current;
    }

    return () => { if (timeout) clearTimeout(timeout); };
  });

  // Red dot state change detection
  $effect(() => {
    const current = effectiveRedReversal;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    // Skip initial mount
    if (prevRed === null) {
      prevRed = current;
    } else if (prevRed !== current) {
      // Only react to actual changes
      if (prevRed && !current) {
        // Was visible, now hidden - trigger exit animation
        isRedExiting = true;
        timeout = setTimeout(() => { isRedExiting = false; }, 200);
      }
      prevRed = current;
    }

    return () => { if (timeout) clearTimeout(timeout); };
  });

  // For smooth exit animations, we need to keep dots in DOM but hide them with CSS
  // We use a delayed unmount pattern - keep component mounted briefly after reversals disappear
  const hasAnyReversal = $derived(blueReversal || redReversal);

  // Track if we should keep the component mounted for exit animation
  let keepMountedForExit = $state(false);
  let exitTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // Track previous state to detect when reversals disappear
  let hadReversalsBefore = $state(false);

  $effect(() => {
    const currentHasReversals = hasAnyReversal;

    if (currentHasReversals) {
      // Reversals present - clear any pending unmount and ensure mounted
      if (exitTimeoutId) {
        clearTimeout(exitTimeoutId);
        exitTimeoutId = null;
      }
      keepMountedForExit = false;
      hadReversalsBefore = true;
    } else if (!currentHasReversals && hadReversalsBefore) {
      // Reversals just disappeared - keep mounted briefly for exit animation
      keepMountedForExit = true;
      exitTimeoutId = setTimeout(() => {
        keepMountedForExit = false;
        hadReversalsBefore = false;
        exitTimeoutId = null;
      }, 300); // Match transition duration (250ms + buffer)
    }

    return () => {
      if (exitTimeoutId) {
        clearTimeout(exitTimeoutId);
      }
    };
  });

  // Render if we have reversals OR we're in exit animation
  // NOTE: We do NOT check `visible` here - we always render and use CSS opacity
  // to animate visibility changes. Checking `visible` would unmount instantly.
  const shouldRenderGroup = $derived(
    hasValidData && (hasAnyReversal || keepMountedForExit)
  );
</script>

{#if shouldRenderGroup}
  <g
    class="reversal-indicators"
    class:visible
    class:preview-mode={previewMode}
    class:interactive={onToggle !== undefined}
    onclick={onToggle}
    {...onToggle
      ? {
          role: "button",
          tabindex: 0,
          "aria-label": "Toggle Reversal indicators visibility",
        }
      : {}}
  >
    <!-- Always render both dots, use CSS classes to animate in/out smoothly -->
    <circle
      class="reversal-dot red-dot"
      class:dot-visible={effectiveRedReversal}
      class:dot-exiting={isRedExiting}
      cx={X_POSITION}
      cy={redDotY}
      r={DOT_RADIUS}
      fill={RED_COLOR}
      style="transform-origin: {X_POSITION}px {redDotY}px; opacity: {effectiveRedReversal ? redDotOpacity : 0};"
    />
    <circle
      class="reversal-dot blue-dot"
      class:dot-visible={effectiveBlueReversal}
      class:dot-exiting={isBlueExiting}
      cx={X_POSITION}
      cy={blueDotY}
      r={DOT_RADIUS}
      fill={BLUE_COLOR}
      style="transform-origin: {X_POSITION}px {blueDotY}px; opacity: {effectiveBlueReversal ? blueDotOpacity : 0};"
    />
  </g>
{/if}

<style>
  .reversal-indicators {
    /* Fade the container in/out */
    opacity: 0;
    transition: opacity var(--duration-normal, 200ms) ease;
  }

  .reversal-indicators.visible {
    opacity: 1;
  }

  /* Individual dot styling - default hidden state */
  .reversal-dot {
    opacity: 0;
    transform: scale(0);
    /* transform-origin set inline for proper SVG center-point scaling */
  }

  /* Scale-in animation */
  @keyframes dot-appear {
    from {
      transform: scale(0);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  /* Scale-out animation */
  @keyframes dot-disappear {
    from {
      transform: scale(1);
      opacity: 1;
    }
    to {
      transform: scale(0);
      opacity: 0;
    }
  }

  /* When dot is visible, show it with entrance animation */
  .reversal-dot.dot-visible {
    opacity: 1;
    transform: scale(1);
    animation: dot-appear 180ms ease-out forwards;
  }

  /* When dot is exiting, play exit animation */
  .reversal-dot.dot-exiting {
    animation: dot-disappear 150ms ease-in forwards;
  }

  /* Respect reduced motion preference */
  @media (prefers-reduced-motion: reduce) {
    .reversal-dot {
      transition: opacity 100ms ease;
    }
    .reversal-dot.dot-visible {
      animation: none;
      opacity: 1;
      transform: scale(1);
    }
    .reversal-dot.dot-exiting {
      animation: none;
      opacity: 0;
      transform: scale(0);
    }
  }

  /* Preview mode: show "off" state at 40% opacity instead of hidden */
  .reversal-indicators.preview-mode:not(.visible) {
    opacity: 0.4;
  }

  .reversal-indicators.interactive {
    cursor: pointer;
    pointer-events: auto;
  }

  /* When visible, maintain full opacity even on hover */
  .reversal-indicators.visible.interactive:hover {
    opacity: 0.9;
  }

  /* When not visible in preview mode, dim on hover */
  .reversal-indicators.preview-mode:not(.visible).interactive:hover {
    opacity: 0.5;
  }
</style>
