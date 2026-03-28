<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { DeckFamily } from "../../domain/models/Deck";
  import { getPageLayout, CARD_SIZES, type CardSizeId } from "../../domain/card-sizes";
  import ChoreoCard from "../ChoreoCard.svelte";

  interface Props {
    sequences: SequenceData[];
    families: readonly DeckFamily[];
    selectedFamilyIds: string[];
    cardSize: CardSizeId;
    isLoading: boolean;
    isLargeDeck: boolean;
    handPointsVisible?: boolean;
    showGrid?: boolean;
    showTKA?: boolean;
    showWord?: boolean;
    includeStartPosition?: boolean;
    /** Function to derive custom footer notes per sequence (e.g. VTG description) */
    getCustomNotes?: (sequence: SequenceData) => string | undefined;
    onSelectSequence?: (sequence: SequenceData) => void;
    onContextMenu?: (x: number, y: number, rerender: () => void) => void;
  }

  let {
    sequences,
    families,
    selectedFamilyIds,
    cardSize,
    isLoading,
    isLargeDeck,
    handPointsVisible = true,
    showGrid = true,
    showTKA = true,
    showWord = true,
    includeStartPosition = true,
    getCustomNotes,
    onSelectSequence,
    onContextMenu,
  }: Props = $props();

  let layout = $derived(getPageLayout(cardSize));
  let sizeSpec = $derived(CARD_SIZES[cardSize]);

  // Card aspect ratio from actual physical dimensions
  let cardAspect = $derived(sizeSpec.widthInches / sizeSpec.heightInches);

  // Column width as percentage of page — matches physical proportions
  // Page is 8.5" wide, each card is widthInches, with margins
  let colWidthPct = $derived(
    (sizeSpec.widthInches / 8.5) * 100
  );

  // Group sequences into pages
  let pages = $derived.by(() => {
    const result: SequenceData[][] = [];
    for (let i = 0; i < sequences.length; i += layout.cardsPerPage) {
      result.push(sequences.slice(i, i + layout.cardsPerPage));
    }
    return result;
  });

  // Detect orientation per sequence (same logic as VtgFamilyDrillDown)
  function detectOrientation(node: HTMLElement) {
    const check = () => {
      const img = node.querySelector("img") as HTMLImageElement | null;
      if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
        const aspect = img.naturalWidth / img.naturalHeight;
        if (aspect > 1.3) {
          node.classList.add("landscape");
        } else {
          node.classList.remove("landscape");
        }
      }
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(node, { childList: true, subtree: true });
    node.addEventListener("load", check, true);
    return {
      destroy() {
        observer.disconnect();
        node.removeEventListener("load", check, true);
      },
    };
  }
</script>

<div class="page-layout-container">
  {#if isLoading}
    <div class="state-message" role="status" aria-live="polite">
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      Loading sequences...
    </div>
  {:else if isLargeDeck && selectedFamilyIds.length === 0}
    <div class="state-message" role="status">
      <i class="fas fa-layer-group" aria-hidden="true"></i>
      <p>Select a family to preview cards</p>
    </div>
  {:else if sequences.length === 0}
    <div class="state-message" role="status">
      <p>No sequences match current filters</p>
    </div>
  {:else}
    <div class="pages-scroll">
      {#each pages as page, pageIndex (pageIndex)}
        <div class="page">
          <div
            class="page-grid"
            style:grid-template-columns="repeat({layout.cols}, {colWidthPct}%)"
          >
            {#each page as seq (seq.id)}
              <div class="card-slot" style:aspect-ratio="{cardAspect}" use:detectOrientation>
                <ChoreoCard
                  sequence={seq}
                  printMode={true}
                  {handPointsVisible}
                  {showGrid}
                  {showTKA}
                  {showWord}
                  {includeStartPosition}
                  customNotesText={getCustomNotes?.(seq)}
                  onSelect={onSelectSequence ? () => onSelectSequence(seq) : undefined}
                  {onContextMenu}
                />
              </div>
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
    padding-bottom: 24px;
  }

  .page {
    background: #ffffff;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    width: 100%;
    max-width: 800px;
    aspect-ratio: 8.5 / 11;
    padding: 3%;
    box-sizing: border-box;
  }

  .page-grid {
    display: grid;
    gap: 4px;
    width: 100%;
    height: 100%;
    align-content: start;
    justify-content: start;
  }

  .card-slot {
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    border: 1px solid rgba(0, 0, 0, 0.08);
    background: #ffffff;
  }

  .card-slot.landscape {
    aspect-ratio: 7 / 5;
  }

  .card-slot :global(> button) {
    width: 100%;
    height: 100%;
    border-radius: 0;
  }

  .state-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    height: 300px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
  }
</style>
