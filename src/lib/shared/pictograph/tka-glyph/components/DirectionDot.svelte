<!--
DirectionDot.svelte - Same/Opp Direction Indicator

Renders a dot above (same) or below (opp) the TKA letter to indicate
whether both hands are rotating in the same direction or opposite directions.

Props:
- direction: "s" | "o" | null - The direction from the parsed turns tuple
- letterDimensions: Width and height of the letter SVG (already base letter for dash letters)
- visible: Visibility control (tied to TKA glyph visibility)
- previewMode: Show at reduced opacity when not visible

Position Calculation (matches legacy):
- SAME: 10px above letter top, horizontally centered on letter
- OPP: 10px below letter bottom, horizontally centered on letter

Dark mode: Polls visibility manager for dark mode state (supports pictograph
dark mode independent of app dark mode). Export uses explicit darkMode prop.

NOTE: For dash letters (Type3/Type5), letterDimensions is already the BASE letter dimensions
because TKAGlyph now loads the base letter SVG and caches it under the full letter key.
-->
<script lang="ts">
  import type { DirectionValue } from "../utils/turn-tuple-parser";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";

  // Constants from legacy implementation
  const DOT_PADDING = 10;
  const DOT_SIZE = 25; // SVG viewBox is 25x25

  let {
    direction = null,
    letter = null,
    letterDimensions = { width: 100, height: 100 },
    x = 50,
    y = 800,
    scale = 1,
    visible = true,
    previewMode = false,
    darkMode = undefined,
  } = $props<{
    /** Direction from parsed turns tuple: "s" (same), "o" (opp), or null */
    direction: DirectionValue;
    /** The letter string (optional, for data attributes) */
    letter?: string | null;
    /** Letter dimensions - for dash letters, this is already the base letter dimensions */
    letterDimensions: { width: number; height: number };
    /** Base X position (matches TKAGlyph) */
    x?: number;
    /** Base Y position (matches TKAGlyph) */
    y?: number;
    /** Scale factor */
    scale?: number;
    /** Visibility control (tied to TKA glyph) */
    visible?: boolean;
    /** Show at reduced opacity when not visible */
    previewMode?: boolean;
    /** Dark mode override for export. When set, overrides visibility manager state. */
    darkMode?: boolean;
  }>();

  // Get centralized visibility manager for dark mode state
  const visibilityManager = getAnimationVisibilityManager();

  // Track dark mode from centralized state (polls visibility manager)
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

  // Only show dot for "s" (same) or "o" (opp) directions
  const shouldShow = $derived(direction === "s" || direction === "o");

  // Calculate dot position relative to letter
  // X: centered on letter
  // Y: above (same) or below (opp) with padding
  const dotPosition = $derived.by(() => {
    const dotX = letterDimensions.width / 2 - DOT_SIZE / 2;

    if (direction === "s") {
      // SAME: above letter (negative Y, accounting for dot height)
      return { x: dotX, y: -DOT_PADDING - DOT_SIZE };
    } else if (direction === "o") {
      // OPP: below letter
      return { x: dotX, y: letterDimensions.height + DOT_PADDING };
    }

    return { x: dotX, y: 0 };
  });
</script>

<!-- Direction Dot - only render when direction is same or opp -->
{#if shouldShow && (visible || previewMode)}
  <g
    class="direction-dot"
    class:visible
    class:preview-mode={previewMode}
    class:same={direction === "s"}
    class:opp={direction === "o"}
    transform="translate({x}, {y}) scale({scale})"
    data-direction={direction}
  >
    <!-- Fill color via CSS variable or explicit override for export -->
    <circle
      cx={dotPosition.x + DOT_SIZE / 2}
      cy={dotPosition.y + DOT_SIZE / 2}
      r={DOT_SIZE / 2}
      fill={fillColor}
    />
  </g>
{/if}

<style>
  .direction-dot {
    /* Match TKA glyph fade behavior */
    opacity: 0;
    transition: opacity var(--duration-fast) ease-out;
  }

  .direction-dot.visible {
    opacity: 1;
  }

  /* Preview mode: show at reduced opacity */
  .direction-dot.preview-mode:not(.visible) {
    opacity: 0.4;
  }

  /* Animate fill color changes for dark mode transition */
  .direction-dot circle {
    transition: fill var(--duration-fast) ease-out;
  }
</style>
