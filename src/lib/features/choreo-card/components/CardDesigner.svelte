<!--
  CardDesigner.svelte - Side-by-side front/back card preview

  Shows a choreo card's front and back at matched dimensions.
  Includes prev/next navigation and a sequence picker dropdown.
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import ChoreoCard from "./ChoreoCard.svelte";
  import CardBack from "./CardBack.svelte";

  interface Props {
    sequences: SequenceData[];
    isLoading: boolean;
    handPointsVisible?: boolean;
    showGrid?: boolean;
    showTKA?: boolean;
    showWord?: boolean;
    includeStartPosition?: boolean;
  }

  let {
    sequences,
    isLoading,
    handPointsVisible = true,
    showGrid = true,
    showTKA = true,
    showWord = true,
    includeStartPosition = true,
  }: Props = $props();

  let currentIndex = $state(0);

  const currentSequence = $derived(
    sequences.length > 0 ? sequences[currentIndex] : null
  );

  const displayLabel = $derived(
    currentSequence
      ? `${currentIndex + 1} / ${sequences.length}`
      : "No sequences"
  );

  function handlePrev() {
    if (currentIndex > 0) currentIndex--;
  }

  function handleNext() {
    if (currentIndex < sequences.length - 1) currentIndex++;
  }

  function handlePickerChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    currentIndex = parseInt(target.value, 10);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      handlePrev();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      handleNext();
    }
  }

  // Reset index when sequences change
  $effect(() => {
    if (currentIndex >= sequences.length) {
      currentIndex = Math.max(0, sequences.length - 1);
    }
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="card-designer" onkeydown={handleKeyDown} tabindex="0" role="application" aria-label="Card designer - use arrow keys to navigate">
  {#if isLoading}
    <div class="loading-state">
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      <span>Loading sequences...</span>
    </div>
  {:else if !currentSequence}
    <div class="empty-state">
      <i class="fas fa-id-card" aria-hidden="true"></i>
      <p>No sequences to display</p>
    </div>
  {:else}
    <!-- Navigation bar -->
    <div class="nav-bar">
      <button
        class="nav-btn"
        onclick={handlePrev}
        disabled={currentIndex === 0}
        aria-label="Previous card"
        type="button"
      >
        <i class="fas fa-chevron-left" aria-hidden="true"></i>
      </button>

      <div class="nav-center">
        <select
          class="sequence-picker"
          value={currentIndex}
          onchange={handlePickerChange}
          aria-label="Select a sequence"
        >
          {#each sequences as seq, i}
            <option value={i}>
              {seq.name || seq.word || `Sequence ${i + 1}`}
            </option>
          {/each}
        </select>
        <span class="nav-count">{displayLabel}</span>
      </div>

      <button
        class="nav-btn"
        onclick={handleNext}
        disabled={currentIndex === sequences.length - 1}
        aria-label="Next card"
        type="button"
      >
        <i class="fas fa-chevron-right" aria-hidden="true"></i>
      </button>
    </div>

    <!-- Side-by-side card preview -->
    <div class="card-preview">
      <div class="card-column">
        <div class="card-label">Front</div>
        <div class="card-frame">
          <ChoreoCard
            sequence={currentSequence}
            printMode={true}
            showQRCodes={true}
            {handPointsVisible}
            {showGrid}
            {showTKA}
            {showWord}
            {includeStartPosition}
          />
        </div>
      </div>

      <div class="card-column">
        <div class="card-label">Back</div>
        <div class="card-frame">
          <CardBack sequence={currentSequence} />
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .card-designer {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: var(--spacing-md, 12px);
    outline: none;
  }

  .card-designer:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: -2px;
    border-radius: var(--border-radius-lg, 12px);
  }

  /* Navigation bar */
  .nav-bar {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
    padding-bottom: var(--spacing-md, 12px);
    flex-shrink: 0;
  }

  .nav-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-sm, 6px);
    background: transparent;
    color: var(--theme-text, #ffffff);
    cursor: pointer;
    flex-shrink: 0;
  }

  .nav-btn:hover:not(:disabled) {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .nav-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .nav-center {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
    min-width: 0;
  }

  .sequence-picker {
    flex: 1;
    min-width: 0;
    padding: 6px var(--spacing-sm, 8px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-sm, 6px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
  }

  .sequence-picker:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 1px;
  }

  .nav-count {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* Card preview area */
  .card-preview {
    flex: 1;
    display: flex;
    gap: var(--spacing-xl, 24px);
    min-height: 0;
    align-items: flex-start;
    justify-content: center;
    overflow: auto;
    padding: var(--spacing-md, 12px) 0;
  }

  .card-column {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs, 4px);
    flex-shrink: 0;
  }

  .card-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    text-transform: uppercase;
    letter-spacing: 1px;
    text-align: center;
    flex-shrink: 0;
  }

  .card-frame {
    border-radius: 4px;
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  /* Front card: let it size naturally from the thumbnail */
  .card-frame.front {
    max-height: 65vh;
  }

  /* Back card: match the front card's exact dimensions */
  .card-frame.back {
    width: var(--front-card-width);
    height: var(--front-card-height);
  }

  /* States */
  .loading-state,
  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm, 8px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .loading-state i,
  .empty-state i {
    font-size: 2rem;
    opacity: 0.5;
  }

  .empty-state p {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
  }

  /* Responsive */
  @media (max-width: 768px) {
    .card-preview {
      flex-direction: column;
      align-items: center;
    }

    .card-frame {
      max-height: 45vh;
      width: 100%;
      max-width: 300px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .loading-state i {
      animation: none;
    }
  }
</style>
