<!-- DualOrientationPicker.svelte - Blue and red orientation controls for start positions -->
<script lang="ts">
  import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";

  // Props
  let {
    currentBeatData = null,
    onorientationchanged,
  }: {
    currentBeatData?: BeatData | null;
    onorientationchanged?: (data: {
      color: MotionColor;
      orientation: string;
    }) => void;
  } = $props();

  // State variables
  let blueOrientation = $state("in");
  let redOrientation = $state("in");
  let selectedColor = $state<MotionColor | null>(null);
  let selectedArrow = $state<string | null>(null);
  let hapticService: IHapticFeedback;

  // Orientation options
  const orientationOptions = ["in", "out", "clock", "counter"];

  // Handle orientation button clicks
  function handleOrientationClick(color: MotionColor, orientation: string) {
    if (color === MotionColor.BLUE) {
      blueOrientation = orientation;
    } else {
      redOrientation = orientation;
    }

    selectedColor = color;
    selectedArrow = `${color}_${orientation}`;

    // Trigger haptic feedback
    hapticService?.trigger("selection");

    // Dispatch the change event
    onorientationchanged?.({
      color,
      orientation,
    });
  }

  // Get currently selected arrow
  export function getSelectedArrow(): string | null {
    return selectedArrow;
  }

  // Update orientations from beat data
  function updateFromBeatData(beatData: BeatData | null) {
    if (!beatData) return;

    const pictograph = beatData;

    // Update orientations from pictograph data
    if (pictograph.motions?.blue?.startOrientation) {
      blueOrientation = pictograph.motions.blue.startOrientation;
    }
    if (pictograph.motions?.red?.startOrientation) {
      redOrientation = pictograph.motions.red.startOrientation;
    }
  }

  // Reactive updates
  $effect(() => {
    updateFromBeatData(currentBeatData);
  });

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });
</script>

<div class="dual-orientation-picker" data-testid="dual-orientation-picker">
  <!-- Blue orientation controls -->
  <div class="orientation-section blue-section">
    <div class="section-header">
      <h4>Blue Prop Orientation</h4>
      <span class="current-value">{blueOrientation}</span>
    </div>
    <div class="orientation-grid">
      {#each orientationOptions as orientation}
        <button
          class="orientation-btn blue-btn"
          class:active={blueOrientation === orientation &&
            selectedColor === MotionColor.BLUE}
          class:selected={blueOrientation === orientation}
          onclick={() => handleOrientationClick(MotionColor.BLUE, orientation)}
        >
          {orientation}
        </button>
      {/each}
    </div>
  </div>

  <!-- Red orientation controls -->
  <div class="orientation-section red-section">
    <div class="section-header">
      <h4>Red Prop Orientation</h4>
      <span class="current-value">{redOrientation}</span>
    </div>
    <div class="orientation-grid">
      {#each orientationOptions as orientation}
        <button
          class="orientation-btn red-btn"
          class:active={redOrientation === orientation &&
            selectedColor === MotionColor.RED}
          class:selected={redOrientation === orientation}
          onclick={() => handleOrientationClick(MotionColor.RED, orientation)}
        >
          {orientation}
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .dual-orientation-picker {
    display: flex;
    flex-direction: row;
    height: 100%;
  }

  .orientation-section {
    flex: 1;
    background: var(--theme-card-bg);
    border-radius: var(--border-radius);
    padding: var(--spacing-md);
    border: 1px solid var(--theme-stroke);
  }

  .blue-section {
    border-color: rgba(59, 130, 246, 0.3);
    background: rgba(59, 130, 246, 0.05);
  }

  .red-section {
    border-color: rgba(239, 68, 68, 0.3);
    background: rgba(239, 68, 68, 0.05);
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-md);
    padding-bottom: var(--spacing-sm);
    border-bottom: 1px solid var(--theme-stroke);
  }

  .section-header h4 {
    margin: 0;
    font-size: var(--font-size-md);
    font-weight: 600;
    color: var(--foreground);
  }

  .current-value {
    padding: var(--spacing-xs) var(--spacing-sm);
    background: rgba(255, 255, 255, 0.1);
    border-radius: var(--border-radius-sm);
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--foreground);
  }

  .orientation-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-sm);
  }

  .orientation-btn {
    padding: var(--spacing-md);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: var(--border-radius);
    background: var(--theme-card-bg);
    color: var(--foreground);
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    text-transform: uppercase;
  }

  .orientation-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    transform: translateY(-1px);
  }

  .blue-btn.selected {
    background: rgba(59, 130, 246, 0.2);
    border-color: rgba(59, 130, 246, 0.5);
    color: rgb(59, 130, 246);
  }

  .red-btn.selected {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.5);
    color: rgb(239, 68, 68);
  }

  .blue-btn.active {
    background: rgba(59, 130, 246, 0.3);
    border-color: rgb(59, 130, 246);
    box-shadow: 0 0 10px rgba(59, 130, 246, 0.3);
  }

  .red-btn.active {
    background: rgba(239, 68, 68, 0.3);
    border-color: rgb(239, 68, 68);
    box-shadow: 0 0 10px rgba(239, 68, 68, 0.3);
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .dual-orientation-picker {
      flex-direction: column;
    }

    .orientation-section {
      padding: var(--spacing-sm);
    }

    .orientation-grid {
      grid-template-columns: 1fr;
      gap: var(--spacing-xs);
    }

    .orientation-btn {
      padding: var(--spacing-sm);
      font-size: var(--font-size-xs);
    }
  }

  @media (max-width: 480px) {
    .section-header {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--spacing-xs);
    }

    .current-value {
      align-self: flex-end;
    }
  }
</style>
