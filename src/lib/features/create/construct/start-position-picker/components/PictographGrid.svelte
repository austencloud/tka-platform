<!-- PictographGrid.svelte - Pictograph grid display for StartPositionPicker -->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import { getLetterBorderColorSafe } from "$lib/shared/pictograph/shared/utils/letter-border-utils";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import { onMount } from "svelte";

  const {
    pictographDataSet,
    selectedPictograph = null,
    onPictographSelect,
  }: {
    pictographDataSet: PictographData[];
    selectedPictograph?: PictographData | null;
    onPictographSelect: (pictograph: PictographData) => void;
  } = $props();

  // Animation disabled - positions appear instantly for speed
  let animatedPictographs = $state(new Set<string>());

  // Layout stabilization: Force horizontal layout briefly on mount to prevent
  // flicker during workspace collapse animation (container is transiently narrow)
  let isLayoutStabilizing = $state(true);

  // Services
  let hapticService: HapticFeedback | undefined;

  onMount(() => {
    hapticService = getHapticFeedback();

    // Brief stabilization to let container queries settle after layout change
    // Matches the parent's in:scale delay (200ms) so both views feel symmetric
    const stabilizationTimer = setTimeout(() => {
      isLayoutStabilizing = false;
    }, 200);

    return () => clearTimeout(stabilizationTimer);
  });

  // Animation handlers (kept for compatibility but never trigger)
  function handleAnimationEnd(pictographId: string) {
    animatedPictographs.add(pictographId);
    animatedPictographs = new Set(animatedPictographs);
  }

  function shouldPictographAnimate(_pictographId: string): boolean {
    return false; // Animation disabled
  }

  // Handle pictograph selection with haptic feedback
  function handlePictographSelect(pictograph: PictographData) {
    // Trigger selection haptic feedback for pictograph selection
    hapticService?.trigger("selection");

    onPictographSelect(pictograph);
  }
</script>

<div class="pictograph-row" class:layout-stabilizing={isLayoutStabilizing}>
  {#each pictographDataSet as pictographData, index (pictographData.id)}
    <div
      class="pictograph-container"
      class:selected={selectedPictograph?.id === pictographData.id}
      class:animate={shouldPictographAnimate(pictographData.id)}
      role="button"
      tabindex="0"
      style:--letter-border-color={getLetterBorderColorSafe(
        pictographData.letter
      )}
      style:--animation-delay="{index * 80}ms"
      onclick={() => handlePictographSelect(pictographData)}
      onkeydown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handlePictographSelect(pictographData);
        }
      }}
      onanimationend={() => handleAnimationEnd(pictographData.id)}
    >
      <!-- Render pictograph using Pictograph component -->
      <div class="pictograph-wrapper">
        <PictographContainer {pictographData} />
      </div>
    </div>
  {/each}
</div>

<style>
  .pictograph-row {
    display: grid;
    /* Default: 1x3 horizontal grid layout */
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: 1fr;
    gap: min(2cqmin, 1rem);

    flex: 1;
    width: 100%;
    height: 100%;
    padding: 0;

    /* Center items instead of stretching them */
    align-items: center;
    justify-items: center;
    align-content: center;

    /* Enable container queries for children */
    container-type: size;

    /* Smooth transition for layout changes (prevents jarring snap during animations) */
    transition:
      grid-template-columns 300ms cubic-bezier(0.4, 0, 0.2, 1),
      grid-template-rows 300ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* During layout stabilization, hide content until container dimensions settle */
  .pictograph-row.layout-stabilizing {
    opacity: 0;
  }

  /* Fade in once stabilization complete */
  .pictograph-row:not(.layout-stabilizing) {
    animation: fadeInGrid var(--duration-normal) ease-out forwards;
  }

  @keyframes fadeInGrid {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  /* Tall container (portrait): Use 3x1 column layout */
  @container (aspect-ratio < 0.75) {
    .pictograph-row {
      grid-template-columns: 1fr;
      grid-template-rows: repeat(3, 1fr);
    }
  }

  /* Wide container remains horizontal (same as default) */
  @container (aspect-ratio > 1.5) {
    .pictograph-row {
      grid-template-columns: repeat(3, 1fr);
      grid-template-rows: 1fr;
    }
  }

  .pictograph-container {
    /* Size constrained by container dimensions */
    width: fit-content;
    height: fit-content;
    max-width: 100%;
    max-height: 100%;
    min-width: 0; /* Allow shrinking below default minimums */
    min-height: 0;
    position: relative;
    cursor: pointer;
    padding: min(2cqmin, 0.5rem); /* Add padding for aesthetics */
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: visible; /* Allow wrapper effects to show */
    box-sizing: border-box;
    /* Initial state for animation - start invisible */
    opacity: 0;
    transform: scale(0.6) translateY(20px);
  }

  /* After animation completes, ensure visible state */
  .pictograph-container:not(.animate) {
    opacity: 1;
    transform: scale(1) translateY(0);
  }

  /* Entrance animation similar to StepCell */
  .pictograph-container.animate {
    animation: scaleInStaggered 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    animation-delay: var(--animation-delay, 0ms);
  }

  .pictograph-wrapper {
    /*
     * Container-query-based sizing:
     * - For horizontal layout (3 columns): each item gets ~30% of width
     * - For vertical layout (3 rows): each item gets ~30% of height
     * - Using cqmin ensures we pick the smaller dimension to prevent overflow
     * - 28cqmin ≈ 28% of the smaller container dimension (accounts for gaps/padding)
     */
    width: min(100%, 28cqmin);
    height: auto;
    /* Constrain to maintain square aspect ratio matching the SVG */
    aspect-ratio: 1 / 1;
    max-width: 100%;
    max-height: 100%;
    min-width: 0;
    min-height: 0;
    display: block; /* Use block instead of flex to avoid sizing conflicts */
    position: relative;
    box-sizing: border-box;
    transition: all var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1);
    border: 2px solid transparent;
    border-radius: 0px;
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.1),
      0 2px 4px rgba(0, 0, 0, 0.06);
  }

  /*
   * Adjust pictograph size based on container aspect ratio
   * This ensures optimal sizing for both portrait and landscape containers
   */

  /* Portrait/tall containers: size based on height (30% of container height for 3 rows) */
  @container (aspect-ratio < 0.75) {
    .pictograph-wrapper {
      width: min(100%, 30cqh);
    }
  }

  /* Landscape/wide containers: size based on width (30% of container width for 3 columns) */
  @container (aspect-ratio > 1.5) {
    .pictograph-wrapper {
      width: min(100%, 30cqw);
    }
  }

  /* Square-ish containers: use the smaller dimension */
  @container (0.75 <= aspect-ratio <= 1.5) {
    .pictograph-wrapper {
      width: min(100%, 28cqmin);
    }
  }

  /* Ensure the pictograph inside fills the wrapper exactly */
  .pictograph-wrapper :global(.pictograph) {
    width: 100%;
    height: 100%;
    display: block;
  }

  .pictograph-wrapper :global(.pictograph svg) {
    width: 100%;
    height: 100%;
    display: block;
  }

  /* Desktop hover - only on hover-capable devices */
  @media (hover: hover) {
    .pictograph-container:hover .pictograph-wrapper {
      transform: scale(1.05);
      border-color: var(--letter-border-color, var(--primary));
      box-shadow:
        0 2px 4px rgba(0, 0, 0, 0.12),
        0 4px 8px rgba(0, 0, 0, 0.08),
        0 8px 16px rgba(0, 0, 0, 0.06);
      filter: brightness(1.05);
    }
  }

  /* Mobile/universal active state */
  .pictograph-container:active .pictograph-wrapper {
    transform: scale(0.97);
    transition: transform var(--duration-instant) cubic-bezier(0.4, 0, 0.2, 1);
  }

  .pictograph-container.selected .pictograph-wrapper {
    border-color: var(--letter-border-color, var(--primary));
    background: var(--primary) / 10;
    box-shadow:
      0 0 12px rgba(100, 200, 255, 0.3),
      0 2px 4px rgba(0, 0, 0, 0.12),
      0 4px 8px rgba(0, 0, 0, 0.08);
  }

  /* Focus styles for accessibility */
  .pictograph-container:focus-visible .pictograph-wrapper {
    outline: 2px solid var(--primary-color, #6366f1);
    outline-offset: 2px;
  }

  @media (max-width: 768px) {
    .pictograph-row {
      flex-direction: row;
      gap: var(--spacing-md);
    }
  }

  /* Even smaller on very small screens */
  @media (max-width: 480px) {
    .pictograph-row {
      gap: var(--spacing-sm);
    }
  }

  /* Reduced motion preference */
  @media (prefers-reduced-motion: reduce) {
    .pictograph-row {
      transition: none;
    }

    .pictograph-row:not(.layout-stabilizing) {
      animation: none;
      opacity: 1;
    }
  }

  /* Keyframe animation for staggered entrance effect */
  @keyframes scaleInStaggered {
    0% {
      opacity: 0;
      transform: scale(0.6) translateY(20px);
    }
    60% {
      opacity: 0.8;
      transform: scale(1.1) translateY(-5px);
    }
    100% {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
</style>
