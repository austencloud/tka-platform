<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { IPrintCardRenderer, PrintRenderOptions } from "../../services/contracts/IPrintCardRenderer";
  import type { DeckFamily } from "../../domain/models/Deck";
  import { getPageLayout, type CardSizeId } from "../../domain/card-sizes";
  import { container } from "$lib/shared/di";

  interface Props {
    sequences: SequenceData[];
    families: readonly DeckFamily[];
    selectedFamilyIds: string[];
    cardSize: CardSizeId;
    renderOptions: PrintRenderOptions;
    isLoading: boolean;
    isLargeDeck: boolean;
    onCardClick: (index: number) => void;
    onRenderProgress: (current: number, total: number) => void;
  }

  let {
    sequences,
    families,
    selectedFamilyIds,
    cardSize,
    renderOptions,
    isLoading,
    isLargeDeck,
    onCardClick,
    onRenderProgress,
  }: Props = $props();

  const renderer = container.items.printCardRenderer as IPrintCardRenderer;

  let layout = $derived(getPageLayout(cardSize));
  let aspectRatio = $derived(8.5 / 11);

  // Rendered card images (data URLs for memory efficiency)
  let cardImages = $state<Map<string, string>>(new Map());
  let isRendering = $state(false);

  // Abort pattern: generation counter to cancel stale renders
  let renderGeneration = 0;

  // Group sequences into pages
  let pages = $derived.by(() => {
    const result: SequenceData[][] = [];
    for (let i = 0; i < sequences.length; i += layout.cardsPerPage) {
      result.push(sequences.slice(i, i + layout.cardsPerPage));
    }
    return result;
  });

  // Render cards when sequences or options change
  $effect(() => {
    if (sequences.length === 0) {
      cardImages = new Map();
      return;
    }
    const gen = ++renderGeneration;
    renderCards(gen);
  });

  async function renderCards(generation: number) {
    isRendering = true;
    const newImages = new Map<string, string>();
    const total = sequences.length;

    for (let i = 0; i < sequences.length; i++) {
      if (generation !== renderGeneration) return;

      const seq = sequences[i]!;
      try {
        const canvas = await renderer.renderFront(seq, renderOptions);
        newImages.set(seq.id, canvas.toDataURL('image/png'));
      } catch {
        // Skip failed renders
      }
      onRenderProgress(i + 1, total);

      // Update progressively every 10 cards
      if (i % 10 === 9 || i === sequences.length - 1) {
        if (generation !== renderGeneration) return;
        cardImages = new Map(newImages);
      }
    }

    if (generation === renderGeneration) {
      cardImages = newImages;
      isRendering = false;
    }
  }
</script>

<div class="page-layout-container">
  {#if isLoading}
    <div class="loading-state">Loading sequences...</div>
  {:else if isLargeDeck && selectedFamilyIds.length === 0}
    <div class="empty-state">Select a family to preview cards</div>
  {:else if sequences.length === 0}
    <div class="empty-state">No sequences match current filters</div>
  {:else}
    {#if isRendering}
      <div class="render-progress">
        Rendering cards... {Math.round((cardImages.size / sequences.length) * 100)}%
      </div>
    {/if}

    <div class="pages-scroll">
      {#each pages as page, pageIndex}
        <div
          class="page"
          style:aspect-ratio={aspectRatio}
        >
          <div
            class="page-grid"
            style:grid-template-columns="repeat({layout.cols}, 1fr)"
            style:grid-template-rows="repeat({layout.rows}, 1fr)"
            style:padding="{(layout.marginYPt / 792) * 100}% {(layout.marginXPt / 612) * 100}%"
          >
            {#each page as seq, cardIndex}
              {@const globalIndex = pageIndex * layout.cardsPerPage + cardIndex}
              <button
                class="card-slot"
                onclick={() => onCardClick(globalIndex)}
                aria-label="View {seq.word ?? 'sequence'} card"
              >
                {#if cardImages.has(seq.id)}
                  <img
                    src={cardImages.get(seq.id)}
                    alt={seq.word ?? 'Sequence card'}
                    class="card-image"
                    loading="lazy"
                  />
                {:else}
                  <div class="card-placeholder">
                    <span>{seq.word ?? '...'}</span>
                  </div>
                {/if}
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .page-layout-container {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .pages-scroll {
    display: flex;
    flex-direction: column;
    gap: 24px;
    align-items: center;
  }

  .page {
    background: #ffffff;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    width: 100%;
    max-width: 680px;
    container-type: inline-size;
  }

  .page-grid {
    display: grid;
    gap: 2px;
    width: 100%;
    height: 100%;
  }

  .card-slot {
    background: none;
    border: 1px dashed rgba(0, 0, 0, 0.1);
    border-radius: 4px;
    cursor: pointer;
    padding: 0;
    overflow: hidden;
    transition: box-shadow 0.15s;
  }

  .card-slot:hover {
    box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.5);
  }

  .card-image {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .card-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.05);
    color: rgba(0, 0, 0, 0.3);
    font-size: 12px;
  }

  .loading-state,
  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 300px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
  }

  .render-progress {
    text-align: center;
    padding: 8px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }
</style>
