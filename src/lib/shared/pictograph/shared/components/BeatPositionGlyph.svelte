<!--
BeatPositionGlyph.svelte - Musical Beat Position Overlay Component

Renders the musical beat position (e.g., "1", "1.5", "2e") at the bottom-center
of pictographs. This is the timeline position, distinct from the step number
(sequential index) shown in the top-left.

Dark mode: Polls visibility manager for dark mode state (supports pictograph
dark mode independent of app dark mode). Export uses explicit darkMode prop.
-->
<script lang="ts">
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";

  let {
    musicalPosition = "",
    visible = true,
    previewMode = false,
    hasValidData = true,
    darkMode = undefined,
    onToggle = undefined,
    // Center X position for expanded timeline mode (default 475 = center of 950)
    centerX = 475,
  } = $props<{
    /** The formatted musical position string (e.g., "1", "1.5", "2e") */
    musicalPosition?: string;
    /** Whether the glyph is visible */
    visible?: boolean;
    /** Preview mode shows at 40% opacity when toggled off */
    previewMode?: boolean;
    /** Whether the pictograph has valid data */
    hasValidData?: boolean;
    /** Dark mode override for export. When set, overrides visibility manager state. */
    darkMode?: boolean;
    /** Toggle callback for interactive visibility controls */
    onToggle?: () => void;
    /** Center X position for expanded viewBox (default 475 = center of 950x950) */
    centerX?: number;
  }>();

  // Get centralized visibility manager for dark mode state
  const visibilityManager = getAnimationVisibilityManager();

  // Track dark mode from centralized state
  let localDarkMode = $state(visibilityManager.isDarkMode());

  // Register for updates when dark mode changes
  $effect(() => {
    const handler = () => {
      localDarkMode = visibilityManager.isDarkMode();
    };
    visibilityManager.registerObserver(handler);
    return () => visibilityManager.unregisterObserver(handler);
  });

  // Effective dark mode: prop override takes precedence, then visibility manager state
  const effectiveDarkMode = $derived(darkMode ?? localDarkMode);

  // Fill color based on effective dark mode
  const fillColor = $derived(
    effectiveDarkMode ? "#ffffff" : "#231f20"
  );

  // Compute whether to render and at what opacity
  const shouldRender = $derived.by(() => {
    if (!hasValidData || !musicalPosition) return false;
    // In preview mode, always render (at reduced opacity if hidden)
    if (previewMode) return true;
    // Otherwise only render if visible
    return visible;
  });

  const opacity = $derived.by(() => {
    if (!visible && previewMode) return 0.4;
    return 1;
  });

  // Dynamic font size: smaller for decimal values to fit the extra characters
  const fontSize = $derived.by(() => {
    // Decimal positions (e.g., "2.5") need smaller font
    if (musicalPosition.includes(".")) {
      return "50";
    }
    // Musician notation with suffixes (e.g., "1e", "1&", "1a") also need smaller font
    if (musicalPosition.length > 1) {
      return "55";
    }
    // Default size for simple single-digit numbers
    return "60";
  });

  // Click handler for interactive toggle
  function handleClick(event: MouseEvent) {
    if (onToggle && previewMode) {
      event.stopPropagation();
      onToggle();
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (onToggle && previewMode && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      event.stopPropagation();
      onToggle();
    }
  }

  // ============================================================================
  // BEAT POSITION CHANGE ANIMATION
  // ============================================================================
  // Track when musical position changes to trigger a subtle scale-pulse animation.

  let prevMusicalPosition = $state<string | undefined>(undefined);
  let isAnimating = $state(false);

  $effect(() => {
    // Skip initial mount, animate when position changes
    if (prevMusicalPosition !== undefined && musicalPosition !== prevMusicalPosition && musicalPosition) {
      isAnimating = true;
      const timeout = setTimeout(() => { isAnimating = false; }, 180);
      return () => clearTimeout(timeout);
    }
    prevMusicalPosition = musicalPosition;
  });
</script>

{#if shouldRender}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <g
    class="beat-position-glyph"
    class:clickable={previewMode && onToggle}
    style:opacity={opacity}
    onclick={handleClick}
    onkeydown={handleKeyDown}
  >
    <text
      class="beat-position-text"
      class:animating={isAnimating}
      x={centerX}
      y="900"
      dominant-baseline="auto"
      text-anchor="middle"
      font-size={fontSize}
      font-family="Georgia, serif"
      font-weight="bold"
      fill={fillColor}
      style="transform-origin: {centerX}px 900px"
    >
      {musicalPosition}
    </text>
  </g>
{/if}

<style>
  .beat-position-glyph {
    transition: opacity var(--duration-fast) ease-out;
  }

  .beat-position-text {
    transition: fill var(--duration-fast) ease-out;
  }

  .beat-position-glyph.clickable {
    cursor: pointer;
    pointer-events: auto;
  }

  .beat-position-glyph.clickable:hover {
    opacity: 0.8 !important;
  }

  /* Scale-pulse animation when beat position changes */
  @keyframes beat-position-pulse {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(0.91);
    }
    100% {
      transform: scale(1);
    }
  }

  .beat-position-text.animating {
    animation: beat-position-pulse 180ms ease-in-out;
  }

  /* Respect reduced motion preference */
  @media (prefers-reduced-motion: reduce) {
    .beat-position-text.animating {
      animation: none;
    }
  }
</style>
