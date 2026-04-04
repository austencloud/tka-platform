<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { CardSizeId } from "../../domain/card-sizes";
  import type { CardPair } from "../../services/contracts/IPrintPDFExporter";
  import type { PrintRenderOptions } from "../../services/contracts/IPrintCardRenderer";
  import { getPageLayout, CARD_SIZES } from "../../domain/card-sizes";
  import { container } from "$lib/shared/di";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";

  interface Props {
    sequences: SequenceData[];
    cardSize: CardSizeId;
    theme: string;
    isLoading: boolean;
    showGrid?: boolean;
    showTKA?: boolean;
    showWord?: boolean;
    includeStartPosition?: boolean;
    handPointsVisible?: boolean;
    onPairsReady?: (pairs: CardPair[]) => void;
    onRenderStateChange?: (state: { isRendering: boolean; progress: number; total: number }) => void;
  }

  let {
    sequences,
    cardSize,
    theme,
    isLoading,
    showGrid = true,
    showTKA = true,
    showWord = true,
    includeStartPosition = true,
    handPointsVisible = true,
    onPairsReady,
    onRenderStateChange,
  }: Props = $props();

  // Rendered card data: front and back as data URLs, plus label
  interface RenderedCard {
    frontUrl: string;
    backUrl: string;
    label: string;
  }

  let renderedCards: RenderedCard[] = $state([]);
  let renderProgress = $state(0);
  let renderTotal = $state(0);
  let isRendering = $state(false);

  let layout = $derived(getPageLayout(cardSize));
  let sizeSpec = $derived(CARD_SIZES[cardSize]);
  let cardAspect = $derived(sizeSpec.widthInches / sizeSpec.heightInches);
  let colWidthPct = $derived((sizeSpec.widthInches / 8.5) * 100);

  // Group rendered cards into sheet batches, each producing a fronts + backs page
  let sheets = $derived.by(() => {
    const result: RenderedCard[][] = [];
    for (let i = 0; i < renderedCards.length; i += layout.cardsPerPage) {
      result.push(renderedCards.slice(i, i + layout.cardsPerPage));
    }
    return result;
  });

  function buildRenderOptions(stepCount?: number): PrintRenderOptions {
    const imageComposition = getImageCompositionManager();
    return {
      showGrid,
      showTKA,
      showWord,
      showQRCode: true,
      includeStartPosition,
      startPositionLayout:
        stepCount != null
          ? imageComposition.getStartPositionLayoutForStepCount(stepCount)
          : imageComposition.startPositionLayout,
      handPointsVisible,
      theme,
      bluePropType: settingsService.settings.bluePropType as any,
      redPropType: settingsService.settings.redPropType as any,
    };
  }

  function canvasToDataUrl(canvas: HTMLCanvasElement): string {
    return canvas.toDataURL("image/png");
  }

  // Compute mirrored column for back pages (long-edge duplex flip)
  function mirroredCol(index: number, cols: number): number {
    const col = index % cols;
    return cols - 1 - col;
  }

  function rowOf(index: number, cols: number): number {
    return Math.floor(index / cols);
  }

  // Track the render generation so stale renders are discarded
  let renderGeneration = 0;

  $effect(() => {
    // Capture reactive dependencies
    const seqs = sequences;
    const _cardSize = cardSize;
    const _theme = theme;
    const _showGrid = showGrid;
    const _showTKA = showTKA;
    const _showWord = showWord;
    const _includeStartPosition = includeStartPosition;
    const _handPointsVisible = handPointsVisible;

    // Void unused captures to satisfy linter
    void _cardSize;
    void _theme;
    void _showGrid;
    void _showTKA;
    void _showWord;
    void _includeStartPosition;
    void _handPointsVisible;

    const generation = ++renderGeneration;

    if (seqs.length === 0) {
      renderedCards = [];
      renderProgress = 0;
      renderTotal = 0;
      isRendering = false;
      return;
    }

    renderAll(seqs, generation);
  });

  async function renderAll(seqs: SequenceData[], generation: number) {
    isRendering = true;
    renderTotal = seqs.length;
    renderProgress = 0;
    renderedCards = [];
    onRenderStateChange?.({ isRendering: true, progress: 0, total: seqs.length });

    const renderer = container.items.printCardRenderer;
    const pairs: CardPair[] = [];
    const cards: RenderedCard[] = [];

    for (let i = 0; i < seqs.length; i++) {
      if (generation !== renderGeneration) return; // superseded

      const seq = seqs[i]!;
      const stepCount = seq.steps?.length;
      const options = buildRenderOptions(stepCount);

      const frontCanvas = await renderer.renderFront(seq, options);
      const backCanvas = await renderer.renderBack(seq, options);

      const label = seq.word || seq.name || `Card ${i + 1}`;

      pairs.push({ front: frontCanvas, back: backCanvas, label });
      cards.push({
        frontUrl: canvasToDataUrl(frontCanvas),
        backUrl: canvasToDataUrl(backCanvas),
        label,
      });

      if (generation !== renderGeneration) return;
      renderProgress = i + 1;
      renderedCards = [...cards];
      onRenderStateChange?.({ isRendering: true, progress: i + 1, total: seqs.length });
    }

    if (generation !== renderGeneration) return;
    isRendering = false;
    onPairsReady?.(pairs);
    onRenderStateChange?.({ isRendering: false, progress: seqs.length, total: seqs.length });
  }
</script>

<div class="pages-container">
  {#if isLoading}
    <div class="state-message" role="status" aria-live="polite">
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      Loading sequences...
    </div>
  {:else if sequences.length === 0}
    <div class="state-message" role="status">
      <p>No sequences to preview</p>
    </div>
  {:else}
    {#if isRendering}
      <div class="progress-bar-container" role="progressbar" aria-valuenow={renderProgress} aria-valuemin={0} aria-valuemax={renderTotal}>
        <div class="progress-bar-fill" style:width="{(renderProgress / renderTotal) * 100}%"></div>
        <span class="progress-label">Rendering {renderProgress} / {renderTotal}</span>
      </div>
    {/if}

    <div class="pages-scroll">
      {#each sheets as sheet, sheetIndex (sheetIndex)}
        <!-- Fronts page -->
        <span class="page-label">Fronts — Sheet {sheetIndex + 1}</span>
        <div class="page">
          <div
            class="page-grid"
            style:grid-template-columns="repeat({layout.cols}, {colWidthPct}%)"
          >
            {#each sheet as card, cardIndex (cardIndex)}
              <div class="card-cell" style:aspect-ratio="{cardAspect}">
                <img src={card.frontUrl} alt="{card.label} front" />
              </div>
            {/each}
          </div>
        </div>

        <!-- Backs page (columns mirrored for duplex) -->
        <span class="page-label">Backs — Sheet {sheetIndex + 1}</span>
        <div class="page">
          <div
            class="page-grid"
            style:grid-template-columns="repeat({layout.cols}, {colWidthPct}%)"
          >
            {#each sheet as card, cardIndex (cardIndex)}
              <div
                class="card-cell"
                style:aspect-ratio="{cardAspect}"
                style:grid-column="{mirroredCol(cardIndex, layout.cols) + 1}"
                style:grid-row="{rowOf(cardIndex, layout.cols) + 1}"
              >
                <img src={card.backUrl} alt="{card.label} back" />
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .pages-container {
    display: flex;
    flex-direction: column;
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
    padding: 8px;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .page-grid {
    display: grid;
    gap: 4px;
    width: 100%;
    align-content: center;
    justify-content: center;
  }

  .card-cell {
    overflow: hidden;
    border-radius: 4px;
    background: #f0f0f0;
  }

  .card-cell img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }

  .page-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-align: center;
    margin-top: 8px;
  }

  .progress-bar-container {
    position: sticky;
    top: 0;
    z-index: 1;
    width: 100%;
    max-width: 800px;
    height: 28px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 4px;
    margin: 0 auto 16px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .progress-bar-fill {
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    background: rgba(100, 180, 255, 0.3);
    transition: width 0.2s ease;
  }

  .progress-label {
    position: relative;
    z-index: 1;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text, #ffffff);
  }

  .state-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    height: 300px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
  }
</style>
