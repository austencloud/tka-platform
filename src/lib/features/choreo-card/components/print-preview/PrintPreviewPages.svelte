<script lang="ts">

import { getPrintCardRenderer } from "$lib/features/choreo-card/getPrintCardRenderer";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { CardFooter } from "../../domain/models/DeckRelease";
  import type { CardSizeId } from "../../domain/card-sizes";
  import type { CardPair } from "../../services/types";
  import type { PrintRenderOptions } from "../../services/types";
  import type { ElementalTheme } from "../../domain/elemental-theme";
  import { getPageLayout, CARD_SIZES } from "../../domain/card-sizes";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
  import { getCatalogLayoutPolicy } from "../../domain/catalog-layout-policy";
  import { cardCache, type RenderedCard, type CachedCard } from "./print-preview-cache";
  import { deckCardBlobCache, blobToDataUrl, canvasToBlob } from "../../services/DeckCardBlobCache";

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
    elementTheme?: ElementalTheme;
    /** Per-card footer data, index-aligned with sequences */
    footers?: CardFooter[];
    /** Use deck layout policy instead of user composition settings */
    deckMode?: boolean;
    /** Bump to force a full re-render of all cards */
    rerenderKey?: number;
    /** Right-click context menu on a card cell: (x, y, rerender callback for that card, sequence) */
    onCardContextMenu?: (x: number, y: number, rerender: () => void, sequence: SequenceData) => void;
    /** Left-click a card to inspect it (includes the pre-rendered front image URL and a rerender callback) */
    onCardClick?: (sequence: SequenceData, frontImageUrl?: string, rerender?: () => Promise<string | null>) => void;
    onPairsReady?: (pairs: CardPair[]) => void;
    onRenderStateChange?: (state: { isRendering: boolean; progress: number; total: number }) => void;
    /** "sheets" = print-ready pages with fronts+backs, "grid" = flowing card grid (fronts only) */
    displayMode?: "sheets" | "grid";
    /** Deck ID for QR attribution tracking */
    deckId?: string;
    /** Deck name for QR attribution tracking */
    deckName?: string;
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
    elementTheme,
    footers,
    deckMode = false,
    rerenderKey = 0,
    onCardContextMenu,
    onCardClick,
    onPairsReady,
    onRenderStateChange,
    displayMode = "sheets",
    deckId,
    deckName,
  }: Props = $props();

  let lastSeenRerenderKey = rerenderKey;
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

  function buildRenderOptions(stepCount?: number, footer?: CardFooter): PrintRenderOptions {
    const imageComposition = getImageCompositionManager();
    return {
      showGrid,
      showTKA,
      showWord,
      showQRCode: true,
      includeStartPosition,
      startPositionLayout:
        deckMode && stepCount != null
          ? getCatalogLayoutPolicy(stepCount)
          : stepCount != null
            ? imageComposition.getStartPositionLayoutForStepCount(stepCount)
            : imageComposition.startPositionLayout,
      handPointsVisible,
      showMandala: true,
      theme,
      elementTheme,
      bluePropType: settingsService.settings.bluePropType,
      redPropType: settingsService.settings.redPropType,
      leftLabel: footer?.left,
      rightLabel: footer?.right,
      notes: footer?.center,
      iconPath: footer?.iconPath,
      bleedPx: 36,
      deckId,
      deckName,
    };
  }

  function canvasToDataUrl(canvas: HTMLCanvasElement): string {
    return canvas.toDataURL("image/png");
  }

  function buildCacheKey(seq: SequenceData, stepCount: number | undefined, index: number): string {
    const seqId = seq.id ?? seq.word ?? seq.name ?? "";
    const footer = footers?.[index];
    const layout = deckMode && stepCount != null
      ? getCatalogLayoutPolicy(stepCount)
      : "row";
    const optsPart = [
      cardSize, theme, showGrid, showTKA, showWord,
      includeStartPosition, handPointsVisible,
      elementTheme?.familyId ?? "none",
      settingsService.settings.bluePropType,
      settingsService.settings.redPropType,
      settingsService.settings.backgroundType ?? "",
      stepCount,
      footer?.left ?? "",
      footer?.center ?? "",
      footer?.right ?? "",
      layout,
      "v5",
    ].join("|");
    return `${seqId}::${optsPart}`;
  }

  function seqFooter(index: number): CardFooter | undefined {
    return footers?.[index];
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
    const _rerenderKey = rerenderKey;
    const _bgType = settingsService.settings.backgroundType;

    // Void unused captures to satisfy linter
    void _cardSize;
    void _theme;
    void _showGrid;
    void _showTKA;
    void _showWord;
    void _includeStartPosition;
    void _handPointsVisible;
    void _rerenderKey;
    void _bgType;

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
    if (rerenderKey !== lastSeenRerenderKey) {
      cardCache.clear();
      deckCardBlobCache.clear().catch(() => {});
      lastSeenRerenderKey = rerenderKey;
    }

    renderTotal = seqs.length;

    // Phase 1: Hydrate in-memory cache from IndexedDB for any misses
    const missKeys: string[] = [];
    for (let idx = 0; idx < seqs.length; idx++) {
      const seq = seqs[idx]!;
      const key = buildCacheKey(seq, seq.steps?.length, idx);
      if (!cardCache.has(key)) missKeys.push(key);
    }

    if (missKeys.length > 0) {
      const idbHits = await deckCardBlobCache.getMultiple(missKeys);
      if (generation !== renderGeneration) return;

      for (const [key, entry] of idbHits) {
        const frontUrl = await blobToDataUrl(entry.frontBlob);
        const backUrl = await blobToDataUrl(entry.backBlob);
        cardCache.set(key, {
          rendered: { frontUrl, backUrl, label: entry.label },
          pair: null,
        });
      }
      if (generation !== renderGeneration) return;
    }

    // Phase 2: Fast path if every card is now in memory (from either tier)
    const allCached = seqs.every((seq, idx) => {
      return cardCache.has(buildCacheKey(seq, seq.steps?.length, idx));
    });

    if (allCached) {
      const cards: RenderedCard[] = [];
      for (let idx = 0; idx < seqs.length; idx++) {
        const seq = seqs[idx]!;
        const cached = cardCache.get(buildCacheKey(seq, seq.steps?.length, idx))!;
        cards.push(cached.rendered);
      }
      renderedCards = cards;
      renderProgress = seqs.length;
      isRendering = false;
      onRenderStateChange?.({ isRendering: false, progress: seqs.length, total: seqs.length });

      rebuildPairs(seqs, generation).then(pairs => {
        if (pairs && generation === renderGeneration) onPairsReady?.(pairs);
      }).catch(err => console.error("[PrintPreview] rebuildPairs failed:", err));
      return;
    }

    // Phase 3: Render uncached cards progressively
    isRendering = true;
    renderProgress = 0;
    renderedCards = [];
    onRenderStateChange?.({ isRendering: true, progress: 0, total: seqs.length });

    const renderer = getPrintCardRenderer();
    const pairs: CardPair[] = [];
    const cards: RenderedCard[] = [];

    for (let i = 0; i < seqs.length; i++) {
      if (generation !== renderGeneration) return;

      const seq = seqs[i]!;
      const stepCount = seq.steps?.length;
      const footer = seqFooter(i);
      const cacheKey = buildCacheKey(seq, stepCount, i);
      const cached = cardCache.get(cacheKey);

      if (cached) {
        cards.push(cached.rendered);
        if (cached.pair) {
          pairs.push(cached.pair);
        } else {
          const pair = await reconstructPair(cached.rendered);
          cached.pair = pair;
          pairs.push(pair);
        }
      } else {
        const options = buildRenderOptions(stepCount, footer);
        const frontCanvas = await renderer.renderFront(seq, options);
        const backCanvas = await renderer.renderBack(seq, options);

        const label = seq.word || seq.name || `Card ${i + 1}`;
        const card: RenderedCard = {
          frontUrl: canvasToDataUrl(frontCanvas),
          backUrl: canvasToDataUrl(backCanvas),
          label,
        };
        const pair: CardPair = { front: frontCanvas, back: backCanvas, label };

        pairs.push(pair);
        cards.push(card);
        cardCache.set(cacheKey, { rendered: card, pair });

        Promise.all([canvasToBlob(frontCanvas), canvasToBlob(backCanvas)])
          .then(([fb, bb]) => deckCardBlobCache.set(cacheKey, fb, bb, label))
          .catch(() => {});
      }

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

  async function rebuildPairs(seqs: SequenceData[], generation: number): Promise<CardPair[] | null> {
    const pairs: CardPair[] = [];
    for (let idx = 0; idx < seqs.length; idx++) {
      const seq = seqs[idx]!;
      if (generation !== renderGeneration) return null;
      const cached = cardCache.get(buildCacheKey(seq, seq.steps?.length, idx));
      if (!cached) return null;
      if (cached.pair) {
        pairs.push(cached.pair);
      } else {
        const pair = await reconstructPair(cached.rendered);
        cached.pair = pair;
        pairs.push(pair);
      }
    }
    return pairs;
  }

  async function reconstructPair(rendered: RenderedCard): Promise<CardPair> {
    const [front, back] = await Promise.all([
      dataUrlToCanvas(rendered.frontUrl),
      dataUrlToCanvas(rendered.backUrl),
    ]);
    return { front, back, label: rendered.label };
  }

  function dataUrlToCanvas(dataUrl: string): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d")!.drawImage(img, 0, 0);
        resolve(canvas);
      };
      img.onerror = () => reject(new Error("Failed to load image from data URL"));
      img.src = dataUrl;
    });
  }

  async function rerenderCard(index: number): Promise<string | null> {
    const seq = sequences[index];
    if (!seq) return null;

    const renderer = getPrintCardRenderer();
    const stepCount = seq.steps?.length;
    const footer = seqFooter(index);
    const options = buildRenderOptions(stepCount, footer);

    const cacheKey = buildCacheKey(seq, stepCount, index);
    cardCache.delete(cacheKey);
    deckCardBlobCache.delete(cacheKey).catch(() => {});

    const frontCanvas = await renderer.renderFront(seq, options);
    const backCanvas = await renderer.renderBack(seq, options);

    const label = seq.word || seq.name || `Card ${index + 1}`;
    const card: RenderedCard = {
      frontUrl: canvasToDataUrl(frontCanvas),
      backUrl: canvasToDataUrl(backCanvas),
      label,
    };

    cardCache.set(cacheKey, {
      rendered: card,
      pair: { front: frontCanvas, back: backCanvas, label },
    });

    Promise.all([canvasToBlob(frontCanvas), canvasToBlob(backCanvas)])
      .then(([fb, bb]) => deckCardBlobCache.set(cacheKey, fb, bb, label))
      .catch(() => {});

    renderedCards = renderedCards.map((c, i) => i === index ? card : c);
    return card.frontUrl;
  }

  function handleCardContextMenu(event: MouseEvent, cardIndex: number) {
    if (!onCardContextMenu) return;
    const seq = sequences[cardIndex];
    if (!seq) return;
    event.preventDefault();
    onCardContextMenu(
      event.clientX,
      event.clientY,
      () => rerenderCard(cardIndex),
      seq
    );
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

    {#if displayMode === "grid"}
      <div class="card-grid-scroll">
        {#each renderedCards as card, idx (idx)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="card-cell"
            class:clickable={!!onCardClick}
            style:aspect-ratio="{cardAspect}"
            role="button"
            tabindex="0"
            onclick={() => { const seq = sequences[idx]; if (seq) onCardClick?.(seq, card.frontUrl, () => rerenderCard(idx)); }}
            onkeydown={(e) => {
              if (!onCardClick) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const seq = sequences[idx];
                if (seq) onCardClick(seq, card.frontUrl, () => rerenderCard(idx));
              }
            }}
            oncontextmenu={(e) => handleCardContextMenu(e, idx)}
          >
            <img src={card.frontUrl} alt="{card.label} front" />
          </div>
        {/each}
      </div>
    {:else}
      <div class="pages-scroll">
        {#each sheets as sheet, sheetIndex (sheetIndex)}
          <!-- Fronts page -->
          <span class="page-label">Fronts - Sheet {sheetIndex + 1}</span>
          <div class="page">
            <div
              class="page-grid"
              style:grid-template-columns="repeat({layout.cols}, {colWidthPct}%)"
            >
              {#each sheet as card, cardIndex (cardIndex)}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="card-cell"
                  class:clickable={!!onCardClick}
                  style:aspect-ratio="{cardAspect}"
                  role="button"
                  tabindex="0"
                  onclick={() => {
                    const idx = sheetIndex * layout.cardsPerPage + cardIndex;
                    const seq = sequences[idx];
                    if (seq) onCardClick?.(seq, card.frontUrl, () => rerenderCard(idx));
                  }}
                  onkeydown={(e) => {
                    if (!onCardClick) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      const idx = sheetIndex * layout.cardsPerPage + cardIndex;
                      const seq = sequences[idx];
                      if (seq) onCardClick(seq, card.frontUrl, () => rerenderCard(idx));
                    }
                  }}
                  oncontextmenu={(e) => handleCardContextMenu(e, sheetIndex * layout.cardsPerPage + cardIndex)}
                >
                  <img src={card.frontUrl} alt="{card.label} front" />
                </div>
              {/each}
            </div>
          </div>

          <!-- Backs page (columns mirrored for duplex) -->
          <span class="page-label">Backs - Sheet {sheetIndex + 1}</span>
          <div class="page">
            <div
              class="page-grid"
              style:grid-template-columns="repeat({layout.cols}, {colWidthPct}%)"
            >
              {#each sheet as card, cardIndex (cardIndex)}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="card-cell"
                  class:clickable={!!onCardClick}
                  style:aspect-ratio="{cardAspect}"
                  style:grid-column="{mirroredCol(cardIndex, layout.cols) + 1}"
                  style:grid-row="{rowOf(cardIndex, layout.cols) + 1}"
                  role="button"
                  tabindex="0"
                  onclick={() => {
                    const idx = sheetIndex * layout.cardsPerPage + cardIndex;
                    const seq = sequences[idx];
                    if (seq) onCardClick?.(seq, card.frontUrl, () => rerenderCard(idx));
                  }}
                  onkeydown={(e) => {
                    if (!onCardClick) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      const idx = sheetIndex * layout.cardsPerPage + cardIndex;
                      const seq = sequences[idx];
                      if (seq) onCardClick(seq, card.frontUrl, () => rerenderCard(idx));
                    }
                  }}
                  oncontextmenu={(e) => handleCardContextMenu(e, sheetIndex * layout.cardsPerPage + cardIndex)}
                >
                  <img src={card.backUrl} alt="{card.label} back" />
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {/if}
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

  .card-grid-scroll {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 16px;
    padding-bottom: 24px;
  }

  .pages-scroll {
    display: flex;
    flex-direction: column;
    gap: 24px;
    align-items: center;
    padding-bottom: 24px;
  }

  .page {
    background: var(--print-bg, #ffffff);
    border-radius: 4px;
    box-shadow: var(--shadow-card, 0 2px 8px rgba(0, 0, 0, 0.3));
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
    border-radius: 0;
    background: #ffffff;
  }

  .card-cell.clickable {
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .card-cell.clickable:hover {
    transform: scale(1.02);
    box-shadow: var(--shadow-card, 0 4px 20px rgba(0, 0, 0, 0.3));
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
    background: var(--theme-accent-bg, rgba(100, 180, 255, 0.3));
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
