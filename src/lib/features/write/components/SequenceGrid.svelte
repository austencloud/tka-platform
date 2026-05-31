<!--
  SequenceGrid.svelte - Grid display of sequences in an act

  Shows sequence cards with thumbnails, metadata, and remove action.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import { onMount } from "svelte";

  interface Props {
    sequences?: SequenceData[];
    onSequenceClicked?: (position: number) => void;
    onSequenceRemoveRequested?: (position: number) => void;
  }

  let {
    sequences = [],
    onSequenceClicked,
    onSequenceRemoveRequested,
  }: Props = $props();

  let hapticService: HapticFeedback;

  onMount(() => {
    hapticService = getHapticFeedback();
  });

  function handleSequenceClick(sequence: SequenceData, index: number) {
    hapticService?.trigger("selection");
    onSequenceClicked?.(index);
  }

  function handleSequenceRemove(
    sequence: SequenceData,
    index: number,
    event: Event
  ) {
    event.stopPropagation();
    hapticService?.trigger("selection");
    onSequenceRemoveRequested?.(index);
  }

  function getThumbnailUrl(sequence: SequenceData): string {
    if (sequence.thumbnails && sequence.thumbnails.length > 0) {
      return (
        sequence.thumbnails[0] || "/static/thumbnails/default-sequence.png"
      );
    }
    return "/static/thumbnails/default-sequence.png";
  }

  function formatDuration(duration?: number): string {
    if (!duration) return "0:00";
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }
</script>

<div class="sequence-grid" class:empty={sequences.length === 0}>
  {#if sequences.length > 0}
    <div class="grid-header">
      <h3>
        <i class="fas fa-layer-group" aria-hidden="true"></i>
        Sequences ({sequences.length})
      </h3>
    </div>

    <div class="grid-container">
      {#each sequences as sequence, index}
        <div
          class="sequence-card"
          onclick={() => handleSequenceClick(sequence, index)}
          tabindex="0"
          role="button"
          aria-label="Select sequence {sequence.name ||
            `Sequence ${index + 1}`}"
          onkeydown={(e) =>
            (e.key === "Enter" || e.key === " ") &&
            handleSequenceClick(sequence, index)}
        >
          <!-- Sequence thumbnail -->
          <div class="sequence-thumbnail">
            <img
              src={getThumbnailUrl(sequence)}
              alt={sequence.name || `Sequence ${index + 1}`}
              loading="lazy"
            />
            <div class="sequence-position">{index + 1}</div>
          </div>

          <!-- Sequence info -->
          <div class="sequence-info">
            <div class="sequence-title">
              {sequence.name || `Sequence ${index + 1}`}
            </div>
            <div class="sequence-details">
              <span class="sequence-duration">
                <i class="fas fa-clock" aria-hidden="true"></i>
                {formatDuration(sequence.sequenceLength)}
              </span>
              {#if sequence.steps && sequence.steps.length > 0}
                <span class="sequence-steps">{sequence.steps.length} steps</span
                >
              {/if}
            </div>
          </div>

          <!-- Remove button -->
          <button
            class="remove-btn"
            onclick={(e) => handleSequenceRemove(sequence, index, e)}
            aria-label="Remove sequence from act"
          >
            <i class="fas fa-times" aria-hidden="true"></i>
          </button>
        </div>
      {/each}
    </div>
  {:else}
    <!-- Empty state -->
    <div class="empty-state">
      <div class="empty-icon">
        <i class="fas fa-film" aria-hidden="true"></i>
      </div>
      <h3>No Sequences</h3>
      <p>
        This act doesn't have any sequences yet. Add sequences from the sequence
        builder or import them.
      </p>
    </div>
  {/if}
</div>

<style>
  .sequence-grid {
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: var(--spacing-md);
  }

  .sequence-grid.empty {
    justify-content: center;
    align-items: center;
  }

  .grid-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: var(--spacing-sm);
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .grid-header h3 {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    margin: 0;
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
  }

  .grid-header h3 i {
    color: var(--theme-accent, #f43f5e);
    font-size: 1rem;
  }

  .grid-container {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--spacing-md);
    overflow-y: auto;
    padding: var(--spacing-xs);
  }

  .sequence-card {
    display: flex;
    flex-direction: column;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-lg, 12px);
    overflow: hidden;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    position: relative;
  }

  .sequence-card:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    transform: translateY(-2px);
  }

  .sequence-card:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .sequence-thumbnail {
    position: relative;
    width: 100%;
    height: 160px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.3);
  }

  .sequence-thumbnail img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform var(--duration-normal) ease;
  }

  .sequence-card:hover .sequence-thumbnail img {
    transform: scale(1.05);
  }

  .sequence-position {
    position: absolute;
    top: var(--spacing-xs);
    left: var(--spacing-xs);
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--border-radius-sm, 6px);
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
  }

  .sequence-info {
    padding: var(--spacing-md);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    flex: 1;
  }

  .sequence-title {
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-base, 16px);
    font-weight: 500;
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sequence-details {
    display: flex;
    gap: var(--spacing-sm);
    align-items: center;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .sequence-duration {
    display: flex;
    align-items: center;
    gap: 4px;
    font-weight: 500;
  }

  .sequence-duration i {
    font-size: 0.75rem;
    opacity: 0.7;
  }

  .sequence-steps {
    opacity: 0.8;
  }

  .remove-btn {
    position: absolute;
    top: var(--spacing-xs);
    right: var(--spacing-xs);
    width: 28px;
    height: 28px;
    background: rgba(239, 68, 68, 0.9);
    border: none;
    border-radius: var(--border-radius-sm, 6px);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 0.8rem;
    opacity: 0;
    transition: all var(--duration-normal) ease;
  }

  .sequence-card:hover .remove-btn {
    opacity: 1;
  }

  .remove-btn:hover {
    background: #ef4444;
    transform: scale(1.1);
  }

  .remove-btn:focus-visible {
    outline: 2px solid white;
    outline-offset: 2px;
    opacity: 1;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: var(--spacing-lg);
    max-width: 400px;
    padding: var(--spacing-xl);
  }

  .empty-icon {
    width: 80px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 50%;
  }

  .empty-icon i {
    font-size: 2rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  .empty-state h3 {
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-xl, 20px);
    font-weight: 600;
    margin: 0;
  }

  .empty-state p {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-base, 16px);
    margin: 0;
    line-height: 1.5;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .grid-container {
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: var(--spacing-sm);
    }

    .sequence-thumbnail {
      height: 140px;
    }

    .sequence-info {
      padding: var(--spacing-sm);
    }

    .empty-state {
      padding: var(--spacing-lg);
      gap: var(--spacing-md);
    }

    .empty-icon {
      width: 64px;
      height: 64px;
    }

    .empty-icon i {
      font-size: 1.5rem;
    }
  }

  @media (max-width: 480px) {
    .grid-container {
      grid-template-columns: 1fr;
      gap: var(--spacing-sm);
    }

    .sequence-thumbnail {
      height: 120px;
    }

    .grid-header {
      flex-direction: column;
      align-items: stretch;
      gap: var(--spacing-sm);
    }

    .remove-btn {
      opacity: 1;
    }

    .empty-state {
      padding: var(--spacing-md);
    }

    .empty-icon {
      width: 56px;
      height: 56px;
    }
  }

  @media (max-height: 600px) {
    .sequence-thumbnail {
      height: 100px;
    }

    .empty-state {
      gap: var(--spacing-sm);
    }

    .empty-icon {
      width: 56px;
      height: 56px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sequence-card,
    .sequence-thumbnail img,
    .remove-btn {
      transition: none;
    }

    .sequence-card:hover {
      transform: none;
    }

    .sequence-card:hover .sequence-thumbnail img {
      transform: none;
    }

    .remove-btn:hover {
      transform: none;
    }
  }
</style>
