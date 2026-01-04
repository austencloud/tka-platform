<!--
Dash.svelte - Letter Dash Component

Renders the dash suffix for Type3 and Type5 letters (e.g., "X-", "Φ-").
Positioned to the right of the letter with a small gap.

This component exists because legacy architecture renders the dash separately
from the letter, allowing the direction dot to center over just the letter.
-->
<script lang="ts">
  // Constants from legacy implementation and dash.svg viewBox
  const DASH_WIDTH = 70;
  const DASH_HEIGHT = 20;
  const DASH_GAP = 10; // Gap between letter and dash

  let {
    letterWidth = 100,
    letterHeight = 100,
    visible = true,
    previewMode = false,
    darkMode = false,
  } = $props<{
    /** Width of the letter this dash follows */
    letterWidth: number;
    /** Height of the letter (for vertical centering) */
    letterHeight: number;
    /** Visibility control (tied to TKA glyph) */
    visible?: boolean;
    /** Show at reduced opacity when not visible */
    previewMode?: boolean;
    /** Invert to white on dark backgrounds */
    darkMode?: boolean;
  }>();

  // Position dash to the right of the letter, vertically centered
  const dashX = $derived(letterWidth + DASH_GAP);
  const dashY = $derived((letterHeight - DASH_HEIGHT) / 2);

  // Dash fill color - black on light, white on dark (matches letter inversion)
  const dashColor = $derived(darkMode ? "#ffffff" : "#231f20");
</script>

<!-- Dash - only render when visible (or in preview mode) -->
{#if visible || previewMode}
  <g
    class="letter-dash"
    class:visible
    class:preview-mode={previewMode}
    transform="translate({dashX}, {dashY})"
  >
    <!-- Render dash as inline rect for dark mode color control -->
    <rect
      x="0"
      y="0"
      width={DASH_WIDTH}
      height={DASH_HEIGHT}
      rx="9.5"
      ry="9.5"
      fill={dashColor}
    />
  </g>
{/if}

<style>
  .letter-dash {
    /* Match TKA glyph fade behavior */
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .letter-dash.visible {
    opacity: 1;
  }

  /* Preview mode: show at reduced opacity */
  .letter-dash.preview-mode:not(.visible) {
    opacity: 0.4;
  }
</style>
