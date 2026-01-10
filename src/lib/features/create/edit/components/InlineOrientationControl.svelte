<!-- InlineOrientationControl.svelte - Full orientation controls shown inline when space permits -->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";

  // Props
  const {
    color,
    currentBeatData,
    layoutMode = "compact",
    onOrientationChanged,
  } = $props<{
    color: "blue" | "red";
    currentBeatData: BeatData | null;
    layoutMode?: "compact" | "balanced" | "comfortable";
    onOrientationChanged: (color: string, orientation: string) => void;
  }>();

  // Services
  let hapticService: IHapticFeedback;

  // Orientation options
  const orientations = ["in", "out", "clock", "counter"];

  // Display helpers
  const displayLabel = $derived(() => (color === "blue" ? "Left" : "Right"));
  const currentOrientation = $derived(() => {
    if (!currentBeatData) return "in";
    const motion =
      color === "blue"
        ? currentBeatData.motions?.blue
        : currentBeatData.motions?.red;
    return motion?.startOrientation || "in";
  });

  // Handlers
  function handleOrientationClick(orientation: string) {
    hapticService?.trigger("selection");
    onOrientationChanged(color, orientation);
  }

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });
</script>

<div
  class="inline-orientation-control"
  class:blue={color === "blue"}
  class:red={color === "red"}
  class:compact={layoutMode === "compact"}
  class:balanced={layoutMode === "balanced"}
  class:comfortable={layoutMode === "comfortable"}
  data-testid={`inline-orientation-control-${color}`}
>
  <!-- Header with side label and current orientation -->
  <div class="control-header">
    <span class="side-label">{displayLabel()}</span>
    <span class="current-badge">{currentOrientation().toUpperCase()}</span>
  </div>

  <!-- Orientation grid - 2x2 layout -->
  <div class="orientation-grid">
    {#each orientations as orientation}
      <button
        class="orientation-btn"
        class:active={currentOrientation() === orientation}
        onclick={() => handleOrientationClick(orientation)}
        aria-label={`Set orientation to ${orientation}`}
      >
        {orientation.toUpperCase()}
      </button>
    {/each}
  </div>
</div>

<style>
  .inline-orientation-control {
    flex: 1;
    display: flex;
    flex-direction: column;
    border: 4px solid;
    border-radius: 12px;
    background: white;
    container-type: inline-size;
  }

  /* Layout mode sizing */
  .inline-orientation-control.comfortable {
    gap: 12px;
    padding: 16px;
  }

  .inline-orientation-control.balanced {
    gap: 10px;
    padding: 12px;
    border-width: 3px;
  }

  .inline-orientation-control.compact {
    gap: 8px;
    padding: 10px;
    border-width: 2px;
    border-radius: 8px;
  }

  .inline-orientation-control.blue {
    border-color: var(--semantic-info);
    background: linear-gradient(
      135deg,
      rgba(59, 130, 246, 0.05) 0%,
      white 100%
    );
  }

  .inline-orientation-control.red {
    border-color: var(--semantic-error);
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, white 100%);
  }

  /* Header */
  .control-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    min-height: 28px;
    gap: 8px;
  }

  .side-label {
    font-weight: 600;
    white-space: nowrap;
    font-size: clamp(10px, 3.5cqw, 16px);
  }

  .inline-orientation-control.blue .side-label {
    color: var(--semantic-info);
  }

  .inline-orientation-control.red .side-label {
    color: var(--semantic-error);
  }

  .current-badge {
    padding: clamp(2px, 0.5cqw, 3px) clamp(4px, 2cqw, 8px);
    background: rgba(0, 0, 0, 0.08);
    border-radius: 4px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    color: #333;
    white-space: nowrap;
    font-size: clamp(7px, 2.2cqw, 11px);
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 50%;
  }

  /* Orientation grid - 2x2 layout */
  .orientation-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    flex: 1;
  }

  .inline-orientation-control.compact .orientation-grid {
    gap: 8px;
  }

  .inline-orientation-control.balanced .orientation-grid {
    gap: 10px;
  }

  .inline-orientation-control.comfortable .orientation-grid {
    gap: 12px;
  }

  .orientation-btn {
    border: 2px solid;
    border-radius: 8px;
    background: white;
    color: black;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
    text-transform: uppercase;
    letter-spacing: 0.3px;
    font-size: clamp(9px, 2.5cqw, 13px);
  }

  /* Compact (desktop) - smaller buttons */
  .inline-orientation-control.compact .orientation-btn {
    min-height: var(--min-touch-target);
    border-width: 2px;
  }

  /* Balanced/Comfortable - larger buttons */
  .inline-orientation-control.balanced .orientation-btn {
    min-height: var(--min-touch-target);
  }

  .inline-orientation-control.comfortable .orientation-btn {
    min-height: var(--min-touch-target);
  }

  .inline-orientation-control.blue .orientation-btn {
    border-color: var(--semantic-info);
  }

  .inline-orientation-control.red .orientation-btn {
    border-color: var(--semantic-error);
  }

  .orientation-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .orientation-btn:active {
    transform: translateY(0);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .inline-orientation-control.blue .orientation-btn.active {
    background: var(--semantic-info);
    color: white;
    border-color: var(--semantic-info);
  }

  .inline-orientation-control.red .orientation-btn.active {
    background: var(--semantic-error);
    color: white;
    border-color: var(--semantic-error);
  }
</style>
