<!--
Dash.svelte - Letter Dash Component

Renders the dash suffix for Type3 and Type5 letters (e.g., "X-", "Φ-").
Positioned to the right of the letter with a small gap.

This component exists because legacy architecture renders the dash separately
from the letter, allowing the direction dot to center over just the letter.

Dark mode: This component is rendered INSIDE TKAGlyph's group, which applies
filter: invert(0.9) for dark mode. Therefore, Dash should ALWAYS be black
(like the letter SVGs) and let the parent's filter handle the inversion.
DO NOT add dark mode color logic here - it would cause double-inversion!
-->
<script lang="ts">
  // Constants from legacy implementation and dash.svg viewBox
  const DASH_WIDTH = 70;
  const DASH_HEIGHT = 20;
  const DASH_GAP = 10; // Gap between letter and dash

  // Dash fill color - always black like letter SVGs
  // TKAGlyph's filter: invert(0.9) handles dark mode inversion
  const DASH_FILL = "#231f20";

  let {
    letterWidth = 100,
    letterHeight = 100,
    visible = true,
    previewMode = false,
  } = $props<{
    /** Width of the letter this dash follows */
    letterWidth: number;
    /** Height of the letter (for vertical centering) */
    letterHeight: number;
    /** Visibility control (tied to TKA glyph) */
    visible?: boolean;
    /** Show at reduced opacity when not visible */
    previewMode?: boolean;
  }>();

  // Position dash to the right of the letter, vertically centered
  const dashX = $derived(letterWidth + DASH_GAP);
  const dashY = $derived((letterHeight - DASH_HEIGHT) / 2);

  // Center point for scale animation
  const centerX = $derived(dashX + DASH_WIDTH / 2);
  const centerY = $derived(dashY + DASH_HEIGHT / 2);

  // ============================================================================
  // DASH APPEARANCE ANIMATION
  // ============================================================================
  // Track when dash appears (visibility goes from false to true).
  // Note: The parent TKAGlyph handles letter change animations, so we only
  // animate when the dash itself appears (non-dash → dash letter change).

  let prevVisible = $state<boolean | undefined>(undefined);
  let isAnimating = $state(false);

  $effect(() => {
    // Animate when dash appears (visibility becomes true after being false)
    let timeout: ReturnType<typeof setTimeout> | undefined;
    if (prevVisible === false && visible === true) {
      isAnimating = true;
      timeout = setTimeout(() => { isAnimating = false; }, 180);
    }
    prevVisible = visible;
    return () => { if (timeout) clearTimeout(timeout); };
  });
</script>

<!-- Dash - only render when visible (or in preview mode) -->
{#if visible || previewMode}
  <g
    class="letter-dash"
    class:visible
    class:preview-mode={previewMode}
    transform="translate({dashX}, {dashY})"
  >
    <!-- Always black fill - TKAGlyph's filter handles dark mode inversion -->
    <rect
      class="dash-rect"
      class:animating={isAnimating}
      x="0"
      y="0"
      width={DASH_WIDTH}
      height={DASH_HEIGHT}
      rx="9.5"
      ry="9.5"
      fill={DASH_FILL}
      style="transform-origin: {DASH_WIDTH / 2}px {DASH_HEIGHT / 2}px"
    />
  </g>
{/if}

<style>
  .letter-dash {
    /* Match TKA glyph fade behavior */
    opacity: 0;
    transition: opacity var(--duration-fast) ease-out;
  }

  .letter-dash.visible {
    opacity: 1;
  }

  /* Preview mode: show at reduced opacity */
  .letter-dash.preview-mode:not(.visible) {
    opacity: 0.4;
  }

  /* Scale-pulse animation when dash appears */
  @keyframes dash-pulse {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(0.88);
    }
    100% {
      transform: scale(1);
    }
  }

  .dash-rect.animating {
    animation: dash-pulse 180ms ease-in-out;
  }

  /* Respect reduced motion preference */
  @media (prefers-reduced-motion: reduce) {
    .dash-rect.animating {
      animation: none;
    }
  }
</style>
