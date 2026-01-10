<!--
SimplifiedOrientationControl.svelte - Always-visible stepper control for narrow screens

Research-backed design for 352px portrait (Z Fold):
- Zero interaction cost - all controls visible
- 44x52px touch targets (previous/next buttons)
- Horizontal stepper layout matching turn controls
- Current orientation prominently displayed
- Cycles through: In → Out → Clock → Counter → In
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";

  // Props
  const { color, currentBeatData, onOrientationChanged } = $props<{
    color: "blue" | "red";
    currentBeatData: BeatData | null;
    onOrientationChanged: (color: string, orientation: string) => void;
  }>();

  // Services
  let hapticService: IHapticFeedback;

  // Constants - orientation cycle order
  const orientations = ["in", "counter", "out", "clock"];

  // Derived values - Fixed: removed arrow functions to get actual values
  const displayLabel = $derived(color === "blue" ? "Left" : "Right");

  const currentOrientation = $derived.by(() => {
    if (!currentBeatData) return "in"; // Default to "in"
    // Fixed: access motions.blue.startOrientation instead of .blueOrientation
    const motion =
      color === "blue"
        ? currentBeatData.motions?.blue
        : currentBeatData.motions?.red;
    return motion?.startOrientation ?? "in";
  });

  // Get current orientation index
  const currentIndex = $derived.by(() => {
    const index = orientations.indexOf(currentOrientation);
    return index >= 0 ? index : 0;
  });

  // Get motion type from motion data (for badge display)
  const motionType = $derived.by(() => {
    if (!currentBeatData) return "";

    const motion =
      color === "blue"
        ? currentBeatData.motions?.blue
        : currentBeatData.motions?.red;

    if (!motion || !motion.motionType) return "Static";

    // Format motion type for display
    const type = motion.motionType;
    return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
  });

  // Handlers - cycle through orientations
  function handlePrevious() {
    hapticService?.trigger("selection");
    const prevIndex =
      currentIndex === 0 ? orientations.length - 1 : currentIndex - 1;
    const newOrientation = orientations[prevIndex];
    onOrientationChanged(color, newOrientation);
  }

  function handleNext() {
    hapticService?.trigger("selection");
    const nextIndex = (currentIndex + 1) % orientations.length;
    const newOrientation = orientations[nextIndex];
    onOrientationChanged(color, newOrientation);
  }

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });
</script>

<div
  class="simplified-orientation-control"
  class:blue={color === "blue"}
  class:red={color === "red"}
  data-testid={`simplified-orientation-control-${color}`}
>
  <!-- Left column: Color label -->
  <div class="color-label">
    {displayLabel}
  </div>

  <!-- Center column: Stepper controls (perfectly centered) -->
  <div class="center-controls">
    <!-- Previous button (←) -->
    <button
      class="stepper-btn previous"
      onclick={handlePrevious}
      aria-label={`Previous ${displayLabel} orientation`}
      type="button"
    >
      <i class="fas fa-rotate-left" aria-hidden="true"></i>
    </button>

    <!-- Orientation display -->
    <div class="orientation-display">
      {currentOrientation.toUpperCase()}
    </div>

    <!-- Next button (→) -->
    <button
      class="stepper-btn next"
      onclick={handleNext}
      aria-label={`Next ${displayLabel} orientation`}
      type="button"
    >
      <i class="fas fa-rotate-right" aria-hidden="true"></i>
    </button>
  </div>

  <!-- Right column: Motion type badge -->
  {#if motionType}
    <div class="motion-badge">
      {motionType}
    </div>
  {:else}
    <div></div>
  {/if}
</div>

<style>
  .simplified-orientation-control {
    display: grid;
    /* Flexible grid - allows side columns to shrink below 48px if needed */
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 10px; /* Reduced from 12px for tighter spacing */
    padding: 10px 12px; /* Reduced from 12px 16px */
    border-radius: 12px;
    border: 3px solid;
    background: white;
    min-height: 64px;
    container-type: inline-size;
    /* Ensure grid respects container width */
    width: 100%;
    box-sizing: border-box;
  }

  /* Color theming */
  .simplified-orientation-control.blue {
    border-color: var(--semantic-info);
    background: linear-gradient(
      135deg,
      rgba(59, 130, 246, 0.05) 0%,
      white 100%
    );
  }

  .simplified-orientation-control.red {
    border-color: var(--semantic-error);
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, white 100%);
  }

  /* Color label - left column, centered */
  .color-label {
    font-weight: 700;
    font-size: var(--font-size-base);
    letter-spacing: 0.5px;
    justify-self: center; /* Center within the left column */
  }

  .simplified-orientation-control.blue .color-label {
    color: var(--semantic-info);
  }

  .simplified-orientation-control.red .color-label {
    color: var(--semantic-error);
  }

  /* Center controls container - perfectly centered */
  .center-controls {
    display: flex;
    align-items: center;
    gap: 8px; /* Reduced from 12px */
    justify-content: center;
    /* Allow shrinking to fit container */
    min-width: 0;
  }

  /* Stepper buttons - Reduced from 44x52px for better fit */
  .stepper-btn {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    min-width: var(--min-touch-target);
    min-height: var(--min-touch-target);
    border-radius: 8px;
    border: 2px solid;
    background: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease;
    font-size: var(--font-size-sm); /* Reduced from 16px */
    flex-shrink: 0;
  }

  .simplified-orientation-control.blue .stepper-btn {
    border-color: var(--semantic-info);
    color: var(--semantic-info);
  }

  .simplified-orientation-control.red .stepper-btn {
    border-color: var(--semantic-error);
    color: var(--semantic-error);
  }

  .stepper-btn:hover {
    transform: scale(1.05);
  }

  .stepper-btn:active {
    transform: scale(0.95);
  }

  .simplified-orientation-control.blue .stepper-btn:active {
    background: rgba(59, 130, 246, 0.1);
  }

  .simplified-orientation-control.red .stepper-btn:active {
    background: rgba(239, 68, 68, 0.1);
  }

  /* Orientation display - sized for longest text "COUNTER" */
  .orientation-display {
    font-size: var(--font-size-sm); /* Reduced from 16px to fit better */
    font-weight: 700;
    color: #1a1a2e;
    --orientation-slot-width: clamp(
      72px,
      11ch,
      96px
    ); /* Future-proof spacing (covers COUNTER + localization) */
    width: var(--orientation-slot-width);
    min-width: var(--orientation-slot-width);
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 0.2px; /* Reduced from 0.3px */
    white-space: nowrap;
    flex: 0 0 var(--orientation-slot-width);
  }

  /* Motion type badge - right column, centered */
  .motion-badge {
    padding: 4px 8px; /* Reduced from 6px 12px */
    background: rgba(0, 0, 0, 0.08);
    border-radius: 6px;
    font-size: var(--font-size-compact);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px; /* Reduced from 0.5px */
    color: #666;
    white-space: nowrap;
    min-width: var(--min-touch-target); /* Reduced from 60px */
    text-align: center;
    justify-self: center; /* Center within the right column */
  }

  /* Responsive adjustments for very narrow containers */
  @container (max-width: 300px) {
    .simplified-orientation-control {
      gap: 8px;
      padding: 10px 12px;
    }

    .color-label {
      font-size: var(--font-size-sm);
      min-width: var(--min-touch-target);
    }

    .orientation-display {
      font-size: var(--font-size-base);
      --orientation-slot-width: clamp(
        60px,
        10ch,
        84px
      ); /* Tighten slot for ultra narrow containers without crushing text */
    }

    .motion-badge {
      font-size: var(--font-size-compact);
      padding: 4px 8px;
    }
  }
</style>
