<!-- SequenceThumbnail.svelte - Individual sequence thumbnail widget -->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { generateSequenceThumbnail } from "../domain/types/write";
  import { onMount } from "svelte";

  // Props
  let { sequence, position, onSequenceClicked, onRemoveRequested } = $props<{
    sequence: SequenceData;
    position: number;
    onSequenceClicked?: (position: number) => void;
    onRemoveRequested?: (position: number) => void;
  }>();

  // Services
  let hapticService: HapticFeedback;

  onMount(() => {
    hapticService = getHapticFeedback();
  });

  // Handle sequence click
  function handleSequenceClick() {
    // Trigger selection haptic feedback for sequence selection
    hapticService?.trigger("selection");

    onSequenceClicked?.(position);
  }

  // Handle keyboard events
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleSequenceClick();
    }
  }

  // Handle remove button click
  function handleRemoveClick(event: Event) {
    event.stopPropagation(); // Prevent sequence click

    // Trigger warning haptic feedback for remove action (destructive)
    hapticService?.trigger("warning");

    onRemoveRequested?.(position);
  }

  // Generate thumbnail
  const thumbnailSrc = $derived(
    sequence.thumbnails?.[0] || generateSequenceThumbnail(sequence)
  );
  const beatsCount = $derived(sequence.steps.length);
</script>

<div
  class="sequence-thumbnail"
  onclick={handleSequenceClick}
  onkeydown={handleKeyDown}
  role="button"
  tabindex="0"
  aria-label="Select sequence {sequence.word || sequence.name}"
>
  <!-- Header with position and remove button -->
  <div class="thumbnail-header">
    <span class="position-number">{position + 1}</span>
    <button
      class="remove-button"
      onclick={handleRemoveClick}
      title="Remove sequence"
      aria-label="Remove sequence"
    >
      ×
    </button>
  </div>

  <!-- Sequence preview -->
  <div class="sequence-preview">
    <img src={thumbnailSrc} alt={sequence.word || sequence.name} />
  </div>

  <!-- Sequence info -->
  <div class="sequence-info">
    <div class="sequence-name">{sequence.word || sequence.name}</div>
    <div class="steps-count">
      {beatsCount} beat{beatsCount !== 1 ? "s" : ""}
    </div>
  </div>
</div>

<style>
  .sequence-thumbnail {
    background: var(--surface-color);
    backdrop-filter: var(--glass-backdrop);
    border: var(--glass-border);
    border-radius: var(--border-radius-lg);
    box-shadow: var(--shadow-glass);
    width: 120px;
    height: 110px;
    cursor: pointer;
    transition: all var(--transition-normal);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
  }

  .sequence-thumbnail:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
    box-shadow: var(--shadow-glass-hover);
  }

  .sequence-thumbnail:active {
    transform: translateY(0);
  }

  .thumbnail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-xs);
    background: var(--theme-card-bg);
    border-bottom: var(--glass-border);
  }

  .position-number {
    color: white;
    font-size: var(--font-size-xs);
    font-weight: bold;
    background: var(--primary-color);
    padding: 2px 6px;
    border-radius: var(--border-radius-sm);
    min-width: 20px;
    text-align: center;
    box-shadow: 0 2px 8px
      color-mix(
        in srgb,
        var(--theme-accent, var(--theme-accent)) 30%,
        transparent
      );
  }

  .remove-button {
    background: var(--secondary-color);
    border: none;
    border-radius: 50%;
    width: 18px;
    height: 18px;
    color: white;
    font-size: var(--font-size-compact);
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
    line-height: 1;
    box-shadow: 0 2px 8px rgba(236, 72, 153, 0.3);
  }

  .remove-button:hover {
    background: var(--secondary-light);
    transform: scale(1.1);
    box-shadow: 0 4px 12px rgba(236, 72, 153, 0.4);
  }

  .remove-button:active {
    transform: scale(0.95);
  }

  .sequence-preview {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-xs);
    background: rgba(255, 255, 255, 0.02);
  }

  .sequence-preview img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    border-radius: 4px;
  }

  .sequence-info {
    padding: var(--spacing-xs);
    background: var(--theme-card-bg);
    border-top: var(--glass-border);
  }

  .sequence-name {
    color: white;
    font-size: var(--font-size-xs);
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-bottom: 2px;
  }

  .steps-count {
    color: var(--text-secondary);
    font-size: var(--font-size-compact);
    text-align: center;
  }

  /* Focus styles for accessibility */
  .sequence-thumbnail:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .sequence-thumbnail {
      width: 100px;
      height: 90px;
    }

    .position-number {
      font-size: var(--font-size-compact);
      padding: 1px 4px;
      min-width: 16px;
    }

    .remove-button {
      width: 16px;
      height: 16px;
      font-size: var(--font-size-compact);
    }

    .sequence-name {
      font-size: var(--font-size-compact);
    }

    .steps-count {
      font-size: var(--font-size-compact);
    }
  }

  @media (max-width: 480px) {
    .sequence-thumbnail {
      width: 80px;
      height: 70px;
    }

    .thumbnail-header {
      padding: 2px;
    }

    .sequence-info {
      padding: 2px;
    }

    .position-number {
      font-size: var(--font-size-compact);
      padding: 1px 3px;
      min-width: 14px;
    }

    .remove-button {
      width: 14px;
      height: 14px;
      font-size: var(--font-size-compact);
    }

    .sequence-name {
      font-size: var(--font-size-compact);
      margin-bottom: 1px;
    }

    .steps-count {
      font-size: var(--font-size-compact);
    }
  }
</style>
