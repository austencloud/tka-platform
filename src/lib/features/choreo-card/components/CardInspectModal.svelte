<!--
  CardInspectModal — Full-screen modal showing card front and back side by side.
  Click a card in print preview to open this modal for detailed inspection.
  Supports flipping between front and back views.
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import ChoreoCard from "./ChoreoCard.svelte";
  import CardBack from "./card-back/CardBack.svelte";

  interface Props {
    sequence: SequenceData;
    handPointsVisible?: boolean;
    showGrid?: boolean;
    showTKA?: boolean;
    showWord?: boolean;
    includeStartPosition?: boolean;
    onClose: () => void;
  }

  let {
    sequence,
    handPointsVisible = true,
    showGrid = true,
    showTKA = true,
    showWord = true,
    includeStartPosition = true,
    onClose,
  }: Props = $props();

  type ViewMode = 'side-by-side' | 'front' | 'back';
  let viewMode = $state<ViewMode>('side-by-side');

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowLeft') viewMode = 'front';
    if (e.key === 'ArrowRight') viewMode = 'back';
    if (e.key === ' ') {
      e.preventDefault();
      viewMode = viewMode === 'side-by-side' ? 'front' : viewMode === 'front' ? 'back' : 'side-by-side';
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('modal-backdrop')) {
      onClose();
    }
  }

  const word = $derived(sequence.word ?? sequence.name ?? '');
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-backdrop" onclick={handleBackdropClick}>
  <div class="modal-container">
    <!-- Header -->
    <div class="modal-header">
      <h2 class="modal-title">{word}</h2>
      <div class="view-toggles">
        <button
          class="view-btn" class:active={viewMode === 'side-by-side'}
          onclick={() => viewMode = 'side-by-side'}
        >Side by Side</button>
        <button
          class="view-btn" class:active={viewMode === 'front'}
          onclick={() => viewMode = 'front'}
        >Front</button>
        <button
          class="view-btn" class:active={viewMode === 'back'}
          onclick={() => viewMode = 'back'}
        >Back</button>
      </div>
      <button class="close-btn" onclick={onClose} aria-label="Close">
        <i class="fas fa-times"></i>
      </button>
    </div>

    <!-- Cards -->
    <div class="cards-area" class:single={viewMode !== 'side-by-side'}>
      {#if viewMode === 'side-by-side' || viewMode === 'front'}
        <div class="card-frame" class:enlarged={viewMode === 'front'}>
          <div class="card-label">Front</div>
          <div class="card-render">
            <ChoreoCard
              {sequence}
              printMode={true}
              cardMode={true}
              {handPointsVisible}
              {showGrid}
              {showTKA}
              {showWord}
              {includeStartPosition}
            />
          </div>
        </div>
      {/if}

      {#if viewMode === 'side-by-side' || viewMode === 'back'}
        <div class="card-frame" class:enlarged={viewMode === 'back'}>
          <div class="card-label">Back</div>
          <div class="card-render">
            <CardBack {sequence} />
          </div>
        </div>
      {/if}
    </div>

    <!-- Keyboard hints -->
    <div class="hints">
      <span><kbd>Esc</kbd> close</span>
      <span><kbd>Space</kbd> cycle views</span>
      <span><kbd>&larr;</kbd> front</span>
      <span><kbd>&rarr;</kbd> back</span>
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 200ms ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .modal-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
    max-width: 95vw;
    max-height: 95vh;
  }

  /* Header */
  .modal-header {
    display: flex;
    align-items: center;
    gap: 20px;
    width: 100%;
    justify-content: center;
  }

  .modal-title {
    font-size: 24px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.8);
    letter-spacing: 1px;
    margin: 0;
  }

  .view-toggles {
    display: flex;
    gap: 0;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 3px;
  }

  .view-btn {
    padding: 6px 16px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: rgba(255, 255, 255, 0.4);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: inherit;
  }

  .view-btn:hover {
    color: rgba(255, 255, 255, 0.7);
  }

  .view-btn.active {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }

  .close-btn {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.5);
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
  }

  /* Cards area */
  .cards-area {
    display: flex;
    gap: 32px;
    align-items: center;
    justify-content: center;
  }

  .cards-area.single {
    gap: 0;
  }

  .card-frame {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .card-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: rgba(255, 255, 255, 0.2);
  }

  .card-render {
    width: 300px;
    height: 420px;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2);
    transition: all 0.25s ease;
  }

  .enlarged .card-render {
    width: 400px;
    height: 560px;
  }

  /* Keyboard hints */
  .hints {
    display: flex;
    gap: 16px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.15);
  }

  .hints kbd {
    display: inline-block;
    padding: 1px 5px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    font-family: inherit;
    font-size: 10px;
    color: rgba(255, 255, 255, 0.3);
    margin-right: 4px;
  }

  @media (max-width: 768px) {
    .cards-area {
      flex-direction: column;
      gap: 16px;
    }

    .card-render {
      width: 250px;
      height: 350px;
    }

    .enlarged .card-render {
      width: 300px;
      height: 420px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .modal-backdrop { animation: none; }
    .card-render { transition: none; }
  }
</style>
