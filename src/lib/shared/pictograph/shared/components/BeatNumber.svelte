<!--
BeatNumber.svelte - Beat Number Overlay Component

Renders beat numbers as SVG text overlays on pictographs.
Based on the legacy BeatNumberLabel.svelte component architecture.
-->
<script lang="ts">
  let {
    beatNumber = null,
    showBeatNumber = true,
    isStartPosition = false,
    hasValidData = true,
    darkMode = false,
  } = $props<{
    /** The beat number to display */
    beatNumber?: number | null;
    /** Whether to show the beat number */
    showBeatNumber?: boolean;
    /** Whether this is a start position (no beat number) */
    isStartPosition?: boolean;
    /** Whether the pictograph has valid data */
    hasValidData?: boolean;
    /** Dark mode - uses white fill without stroke for dark backgrounds */
    darkMode?: boolean;
  }>();

  // Colors based on dark mode
  const fillColor = $derived(darkMode ? "#ffffff" : "#000");
  const strokeColor = $derived(darkMode ? "none" : "#fff");
  const strokeWidth = $derived(darkMode ? 0 : 6);
  const startStrokeWidth = $derived(darkMode ? 0 : 5);

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
    x="50"
    y="50"
    dominant-baseline="hanging"
    text-anchor="start"
    font-size="100"
    font-family="Georgia, serif"
    font-weight="bold"
    fill={fillColor}
    stroke={strokeColor}
    stroke-width={strokeWidth}
    paint-order="stroke"
  >
    {beatNumber}
  </text>
{:else if shouldRenderStartText}
  <text
    x="50"
    y="50"
    dominant-baseline="hanging"
    text-anchor="start"
    font-size="80"
    font-family="Georgia, serif"
    font-weight="bold"
    fill={fillColor}
    stroke={strokeColor}
    stroke-width={startStrokeWidth}
    paint-order="stroke"
  >
    {displayText}
  </text>
{/if}
