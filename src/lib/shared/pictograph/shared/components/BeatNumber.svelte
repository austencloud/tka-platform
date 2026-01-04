<!--
BeatNumber.svelte - Beat Number Overlay Component

Renders beat numbers as SVG text overlays on pictographs.
Based on the legacy BeatNumberLabel.svelte component architecture.

Dark mode: Uses CSS variables (--dm-text, --dm-bg) via :root.dark class on <html>
-->
<script lang="ts">
  let {
    beatNumber = null,
    showBeatNumber = true,
    isStartPosition = false,
    hasValidData = true,
  } = $props<{
    /** The beat number to display */
    beatNumber?: number | null;
    /** Whether to show the beat number */
    showBeatNumber?: boolean;
    /** Whether this is a start position (no beat number) */
    isStartPosition?: boolean;
    /** Whether the pictograph has valid data */
    hasValidData?: boolean;
  }>();

  // Only render beat number if conditions are met
  // Beat number 0 is excluded so it falls through to show "Start" text
  const shouldRender = $derived.by(() => {
    return (
      showBeatNumber &&
      !isStartPosition &&
      hasValidData &&
      beatNumber !== null &&
      beatNumber !== -1 &&
      beatNumber !== 0 // Exclude 0 so it shows "Start" instead
    );
  });

  // Show "Start" text for beat number 0 (start position)
  // Note: showBeatNumber is false for start positions, but we still want to show "Start" text
  const shouldRenderStartText = $derived.by(() => {
    return hasValidData && beatNumber === 0;
  });

  // Get display text - either beat number or "Start"
  const displayText = $derived.by(() => {
    if (beatNumber === 0) {
      return "Start";
    }
    return beatNumber?.toString() || "";
  });
</script>

{#if shouldRender}
  <text
    class="beat-number"
    x="50"
    y="50"
    dominant-baseline="hanging"
    text-anchor="start"
    font-size="100"
    font-family="Georgia, serif"
    font-weight="bold"
    fill="var(--dm-glyph-fill)"
    stroke="var(--dm-beat-stroke)"
    stroke-width="4"
    paint-order="stroke"
  >
    {beatNumber}
  </text>
{:else if shouldRenderStartText}
  <text
    class="beat-number"
    x="50"
    y="50"
    dominant-baseline="hanging"
    text-anchor="start"
    font-size="80"
    font-family="Georgia, serif"
    font-weight="bold"
    fill="var(--dm-glyph-fill)"
    stroke="var(--dm-beat-stroke)"
    stroke-width="6"
    paint-order="stroke"
  >
    {displayText}
  </text>
{/if}

<style>
  /* Smooth color transitions for dark mode toggle */
  .beat-number {
    transition:
      fill 150ms ease-out,
      stroke 150ms ease-out;
  }
</style>
