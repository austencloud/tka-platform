<!--
StepNumber.svelte - Step Number Overlay Component

Renders step numbers (sequential index: 1, 2, 3...) as SVG text overlays on pictographs.
Displays at top-left corner. Shows "Start" for step 0.

Note: Musical beat position (1.5, 2e, etc.) is handled by BeatPositionGlyph at bottom-center.

Dark mode: Polls visibility manager for dark mode state (supports pictograph
dark mode independent of app dark mode). Export uses explicit darkMode prop.
-->
<script lang="ts">
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";

  let {
    stepNumber = null,
    showStepNumber = true,
    isStartPosition = false,
    hasValidData = true,
    darkMode = undefined,
  } = $props<{
    /** The step number to display (sequential index: 1, 2, 3...) */
    stepNumber?: number | null;
    /** Whether to show the step number */
    showStepNumber?: boolean;
    /** Whether this is a start position (no step number) */
    isStartPosition?: boolean;
    /** Whether the pictograph has valid data */
    hasValidData?: boolean;
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

  // Fill color based on effective dark mode (no stroke used)
  const fillColor = $derived(
    effectiveDarkMode ? "#ffffff" : "#231f20"
  );

  // Only render beat number if conditions are met
  // Beat number 0 is excluded so it falls through to show "Start" text
  const shouldRender = $derived.by(() => {
    return (
      showStepNumber &&
      !isStartPosition &&
      hasValidData &&
      stepNumber !== null &&
      stepNumber !== -1 &&
      stepNumber !== 0 // Exclude 0 so it shows "Start" instead
    );
  });

  // Show "Start" text for beat number 0 (start position)
  // Note: showStepNumber is false for start positions, but we still want to show "Start" text
  const shouldRenderStartText = $derived.by(() => {
    return hasValidData && stepNumber === 0;
  });

  // Get display text - step number or "Start"
  const displayText = $derived.by(() => {
    if (stepNumber === 0) {
      return "Start";
    }
    return stepNumber?.toString() || "";
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
    transition: fill var(--duration-fast) ease-out;
  }
</style>
