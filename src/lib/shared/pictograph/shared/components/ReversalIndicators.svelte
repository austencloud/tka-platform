<!--
ReversalIndicators.svelte - Reversal Indicator Component

Renders blue and red reversal indicators as colored dots stacked vertically.
Color-coded dots indicate which motion (blue/red) is reversing between pictographs.
-->
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
  }>();

  // Get global visibility manager to respect motion visibility settings
  const visibilityManager = getVisibilityStateManager();

  // Get animation visibility manager for cached colors
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
    visibilityManager.registerObserver(handleVisibilityChange, ["motion"]);
    animationVisibilityManager.registerObserver(handleColorChange);

    return () => {
      visibilityManager.unregisterObserver(handleVisibilityChange);
      animationVisibilityManager.unregisterObserver(handleColorChange);
    };
  });

  // Filter reversals based on global motion visibility
  const effectiveBlueReversal = $derived.by(() => {
    visibilityUpdateCount; // Force reactivity
    return (
      blueReversal && visibilityManager.getMotionVisibility(MotionColor.BLUE)
    );
  });

  const effectiveRedReversal = $derived.by(() => {
    visibilityUpdateCount; // Force reactivity
    return (
      redReversal && visibilityManager.getMotionVisibility(MotionColor.RED)
    );
  });

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
</script>

{#if shouldRender()}
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
    {#if effectiveRedReversal}
      <circle
        cx={X_POSITION}
        cy={redDotY}
        r={DOT_RADIUS}
        fill={RED_COLOR}
      />
    {/if}
    {#if effectiveBlueReversal}
      <circle
        cx={X_POSITION}
        cy={blueDotY}
        r={DOT_RADIUS}
        fill={BLUE_COLOR}
      />
    {/if}
  </g>
{/if}

<style>
  .reversal-indicators {
    /* Beautiful fade in/out effect */
    opacity: 0;
    transition: opacity var(--duration-normal) ease;
  }

  .reversal-indicators.visible {
    opacity: 1;
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
