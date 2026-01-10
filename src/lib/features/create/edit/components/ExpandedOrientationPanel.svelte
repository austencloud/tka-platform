<!-- ExpandedOrientationPanel.svelte - Expanded orientation controls with 2x2 grid -->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";

  // Props
  const {
    color,
    currentBeatData,
    layoutMode = "comfortable",
    onOrientationChanged,
    onCollapse,
  } = $props<{
    color: "blue" | "red";
    currentBeatData: BeatData | null;
    layoutMode?: "compact" | "balanced" | "comfortable";
    onOrientationChanged: (color: string, orientation: string) => void;
    onCollapse: () => void;
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

  function handleClose() {
    hapticService?.trigger("selection");
    onCollapse();
  }

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });
</script>

<div
  class="orientation-panel"
  class:blue={color === "blue"}
  class:red={color === "red"}
  class:compact={layoutMode === "compact"}
  class:balanced={layoutMode === "balanced"}
  class:comfortable={layoutMode === "comfortable"}
  data-testid={`expanded-orientation-panel-${color}`}
>
  <!-- Header -->
  <div class="orientation-header">
    <div class="orientation-title">
      <span class="orientation-label">{displayLabel()}</span>
      <span class="current-badge">{currentOrientation().toUpperCase()}</span>
    </div>
    <button class="close-btn" onclick={handleClose} aria-label="Close panel">
      <i class="fas fa-times" aria-hidden="true"></i>
    </button>
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
  /* Base panel */
  .orientation-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    border-radius: 12px;

    /* Smooth height transition for expansion/collapse */
    max-height: 500px; /* Large enough to accommodate all content */
    overflow: hidden;
    transition:
      max-height var(--transition-normal, 0.3s cubic-bezier(0.4, 0, 0.2, 1)),
      opacity var(--transition-normal, 0.3s cubic-bezier(0.4, 0, 0.2, 1)),
      transform var(--transition-normal, 0.3s cubic-bezier(0.4, 0, 0.2, 1));

    /* Initial animation when first rendered */
    animation: expandIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Compact mode (Desktop) */
  .orientation-panel.compact {
    gap: 8px;
    padding: 8px;
    border-width: 2px;
    border-radius: 8px;
  }

  /* Balanced mode (Tablet) */
  .orientation-panel.balanced {
    gap: 10px;
    padding: 12px;
    border-width: 3px;
    border-radius: 10px;
  }

  /* Comfortable mode (Mobile) */
  .orientation-panel.comfortable {
    gap: 12px;
    padding: 16px;
    border-width: 4px;
    border-radius: 12px;
  }

  /* Color variants */
  .orientation-panel.blue {
    border-color: var(--semantic-info);
    border-style: solid;
    background: linear-gradient(
      135deg,
      rgba(59, 130, 246, 0.05) 0%,
      white 100%
    );
  }

  .orientation-panel.red {
    border-color: var(--semantic-error);
    border-style: solid;
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, white 100%);
  }

  @keyframes expandIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  /* Header */
  .orientation-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid rgba(0, 0, 0, 0.1);
  }

  .orientation-panel.compact .orientation-header {
    padding-bottom: 6px;
  }

  .orientation-panel.balanced .orientation-header {
    padding-bottom: 8px;
  }

  .orientation-panel.comfortable .orientation-header {
    padding-bottom: 10px;
  }

  .orientation-title {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .orientation-label {
    font-weight: 700;
  }

  .orientation-panel.compact .orientation-label {
    font-size: var(--font-size-sm);
  }

  .orientation-panel.balanced .orientation-label {
    font-size: var(--font-size-sm);
  }

  .orientation-panel.comfortable .orientation-label {
    font-size: var(--font-size-base);
  }

  .orientation-panel.blue .orientation-label {
    color: var(--semantic-info);
  }

  .orientation-panel.red .orientation-label {
    color: var(--semantic-error);
  }

  .current-badge {
    background: rgba(0, 0, 0, 0.08);
    border-radius: 6px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #333;
  }

  .orientation-panel.compact .current-badge {
    padding: 2px 6px;
    font-size: var(--font-size-compact);
  }

  .orientation-panel.balanced .current-badge {
    padding: 2px 6px;
    font-size: var(--font-size-compact);
  }

  .orientation-panel.comfortable .current-badge {
    padding: 3px 8px;
    font-size: var(--font-size-compact);
  }

  .close-btn {
    border: none;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.08);
    color: #666;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .orientation-panel.compact .close-btn {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    min-width: var(--min-touch-target);
    min-height: var(--min-touch-target);
    font-size: var(--font-size-sm);
  }

  .orientation-panel.balanced .close-btn {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    min-width: var(--min-touch-target);
    min-height: var(--min-touch-target);
    font-size: var(--font-size-base);
  }

  .orientation-panel.comfortable .close-btn {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    min-width: var(--min-touch-target);
    min-height: var(--min-touch-target);
    font-size: var(--font-size-lg);
  }

  .close-btn:hover {
    background: rgba(0, 0, 0, 0.12);
    transform: scale(1.1);
  }

  .close-btn:active {
    transform: scale(0.95);
  }

  /* Orientation grid - 2x2 layout */
  .orientation-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    flex: 1;
  }

  .orientation-panel.compact .orientation-grid {
    gap: 8px;
  }

  .orientation-panel.balanced .orientation-grid {
    gap: 10px;
  }

  .orientation-panel.comfortable .orientation-grid {
    gap: 12px;
  }

  .orientation-btn {
    border-radius: 8px;
    background: white;
    color: black;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .orientation-panel.compact .orientation-btn {
    min-height: var(--min-touch-target);
    font-size: var(--font-size-compact);
    border-width: 2px;
  }

  .orientation-panel.balanced .orientation-btn {
    min-height: var(--min-touch-target);
    font-size: var(--font-size-compact);
    border-width: 3px;
  }

  .orientation-panel.comfortable .orientation-btn {
    min-height: var(--min-touch-target);
    font-size: var(--font-size-sm);
    border-width: 4px;
  }

  .orientation-panel.blue .orientation-btn {
    border-color: var(--semantic-info);
    border-style: solid;
  }

  .orientation-panel.red .orientation-btn {
    border-color: var(--semantic-error);
    border-style: solid;
  }

  .orientation-btn:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 12px var(--theme-shadow);
  }

  .orientation-btn:active {
    transform: scale(0.98);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
  }

  .orientation-panel.blue .orientation-btn.active {
    background: var(--semantic-info);
    color: white;
  }

  .orientation-panel.red .orientation-btn.active {
    background: var(--semantic-error);
    color: white;
  }
</style>
