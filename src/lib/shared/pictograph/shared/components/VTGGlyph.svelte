<!--
VTGGlyph.svelte - VTG Glyph Component

Renders VTG mode labels (SS, SO, TS, TO, QS, QO) in the bottom-right corner
of pictographs. Only displays for Type1 letters.

Redesigned 2026-01-21: Switched from legacy SVG images to clean text labels
that adapt to dark/light mode automatically.
-->
<script lang="ts">
  import type { TNDMode } from "../domain/enums/pictograph-enums";
  import { LetterType } from "../../../foundation/domain/models/LetterType";
  import {
    type Letter,
    getLetterType,
  } from "../../../foundation/domain/models/Letter";

  let {
    vtgMode: tndMode = null,
    letter = null,
    hasValidData = true,
    visible = true,
    previewMode = false,
    onToggle = undefined,
    xOffset = 0,
    darkMode = undefined,
  } = $props<{
    /** The VTG mode to display (SS, SO, TS, TO, QS, QO) */
    tndMode?: TNDMode | null;
    /** The letter (used to check if Type1) */
    letter?: Letter | null;
    /** Whether the pictograph has valid data */
    hasValidData?: boolean;
    /** Visibility control for fade effect */
    visible?: boolean;
    /** Preview mode: show at 50% opacity when off instead of hidden */
    previewMode?: boolean;
    /** Callback when glyph is clicked to toggle visibility */
    onToggle?: () => void;
    /** X offset for expanded timeline cells (shifts glyph right) */
    xOffset?: number;
    /** Dark Mode override for export. When set, forces specific colors. */
    darkMode?: boolean;
  }>();

  // Only render for Type1 letters with valid VTG mode AND when visible
  // NOTE: We check visibility here (not just CSS) because when exporting to SVG/image,
  // CSS classes don't carry over - only the raw SVG markup is captured.
  // Preview mode allows rendering at reduced opacity even when not visible.
  const shouldRender = $derived.by(() => {
    // Don't render if not visible (unless in preview mode which shows dimmed)
    if (!visible && !previewMode) {
      return false;
    }
    if (!hasValidData || !tndMode) {
      return false;
    }
    // Only show for Type1 letters
    if (letter && getLetterType(letter) !== LetterType.TYPE1) {
      return false;
    }
    return true;
  });

  // Positioning:
  // - Positioned in bottom-right corner with padding from edges
  // - Standard pictograph size is 950x950 (viewBox)
  const PICTOGRAPH_SIZE = 950;
  const PADDING = 40;

  // Text label dimensions (approximate bounding box for "SS" at font-size 72)
  const LABEL_WIDTH = 100;
  const LABEL_HEIGHT = 72;

  // Position in bottom-right corner (with x-offset for expanded cells)
  const xPosition = $derived(PICTOGRAPH_SIZE - PADDING + xOffset);
  const yPosition = PICTOGRAPH_SIZE - PADDING;

  // Get explicit fill color for export (inline style overrides CSS)
  const explicitFill = $derived.by(() => {
    if (darkMode === true) return "rgba(255, 255, 255, 0.85)";
    if (darkMode === false) return "rgba(0, 0, 0, 0.7)";
    return undefined;
  });

  // ============================================================================
  // VTG MODE CHANGE ANIMATION
  // ============================================================================
  // Track when VTG mode changes to trigger a subtle scale-pulse animation.

  let prevTndMode = $state<TNDMode | null | undefined>(undefined);
  let isAnimating = $state(false);

  $effect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    // Skip initial mount (prevVtgMode is undefined)
    // Animate when mode changes to a new value
    if (prevTndMode !== undefined && tndMode !== prevTndMode && tndMode !== null) {
      isAnimating = true;
      timeout = setTimeout(() => { isAnimating = false; }, 180);
    }
    prevTndMode = tndMode;
    return () => { if (timeout) clearTimeout(timeout); };
  });
</script>

{#if shouldRender}
  <g
    class="vtg-glyph"
    class:visible
    class:preview-mode={previewMode}
    class:interactive={onToggle !== undefined}
    onclick={onToggle}
    {...onToggle
      ? {
          role: "button",
          tabindex: 0,
          "aria-label": "Toggle VTG glyph visibility",
        }
      : {
          "aria-label": `VTG mode: ${tndMode}`,
        }}
  >
    <text
      x={xPosition}
      y={yPosition}
      class="vtg-label"
      class:animating={isAnimating}
      text-anchor="end"
      dominant-baseline="text-bottom"
      style="transform-origin: {xPosition}px {yPosition}px; {explicitFill ? `fill: ${explicitFill}` : ''}"
    >
      {tndMode}
    </text>
  </g>
{/if}

<style>
  .vtg-glyph {
    /* Beautiful fade in/out effect */
    opacity: 0;
    transition: opacity var(--duration-normal, 200ms) ease;
  }

  .vtg-glyph.visible {
    opacity: 1;
  }

  /* Preview mode: show "off" state at 40% opacity instead of hidden */
  .vtg-glyph.preview-mode:not(.visible) {
    opacity: 0.4;
  }

  .vtg-glyph.interactive {
    cursor: pointer;
    pointer-events: auto;
  }

  /* When visible, maintain full opacity even on hover */
  .vtg-glyph.visible.interactive:hover {
    opacity: 0.9;
  }

  /* When not visible in preview mode, dim on hover */
  .vtg-glyph.preview-mode:not(.visible).interactive:hover {
    opacity: 0.5;
  }

  .vtg-label {
    font-family: "Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 72px;
    font-weight: 600;
    letter-spacing: 0.02em;
    /* Light mode default - dark text */
    fill: rgba(0, 0, 0, 0.7);
    transition: fill 150ms ease-out;
  }

  /* Scale-pulse animation when VTG mode changes */
  @keyframes vtg-pulse {
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

  .vtg-label.animating {
    animation: vtg-pulse 180ms ease-in-out;
  }

  /* Respect reduced motion preference */
  @media (prefers-reduced-motion: reduce) {
    .vtg-label.animating {
      animation: none;
    }
  }

  /* Dark mode: light text for dark backgrounds */
  :global(:root.dark) .vtg-label {
    fill: rgba(255, 255, 255, 0.85);
  }
</style>
