<!--
BeatNumber.svelte - Beat Number Overlay Component

Renders beat numbers as SVG text overlays on pictographs.
Based on the legacy BeatNumberLabel.svelte component architecture.

Dark mode: Polls visibility manager for dark mode state (supports pictograph
dark mode independent of app dark mode). Export uses explicit darkMode prop.
-->
<script lang="ts">
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";

  let {
    beatNumber = null,
    showBeatNumber = true,
    isStartPosition = false,
    hasValidData = true,
    darkMode = undefined,
    musicalPosition = undefined,
  } = $props<{
    /** The beat number to display */
    beatNumber?: number | null;
    /** Whether to show the beat number */
    showBeatNumber?: boolean;
    /** Whether this is a start position (no beat number) */
    isStartPosition?: boolean;
    /** Whether the pictograph has valid data */
    hasValidData?: boolean;
    /** Dark mode override for export. When set, overrides visibility manager state. */
    darkMode?: boolean;
    /** Musical position string (e.g., "1", "1.5", "2e") - overrides beatNumber display when present */
    musicalPosition?: string;
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

  // Fill color based on effective dark mode (no stroke used)
  const fillColor = $derived(
    effectiveDarkMode ? "#ffffff" : "#231f20"
  );

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

  // Get display text - musical position (if available), beat number, or "Start"
  const displayText = $derived.by(() => {
    if (beatNumber === 0) {
      return "Start";
    }
    // Use musical position if provided, otherwise fall back to beat number
    if (musicalPosition !== undefined) {
      return musicalPosition;
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
    fill={fillColor}
  >
    {displayText}
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
    fill={fillColor}
  >
    {displayText}
  </text>
{/if}

<style>
  /* Smooth color transitions for dark mode toggle */
  .beat-number {
    transition: fill 150ms ease-out;
  }
</style>
