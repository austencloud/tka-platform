<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { CardFooter, DeckReleaseCard } from "../../domain/models/DeckRelease";
  import type { CardPair } from "../../services/types";
  import PrintPreviewPages from "../print-preview/PrintPreviewPages.svelte";
  import PrintPreviewToolbar from "../print-preview/PrintPreviewToolbar.svelte";
  import CardInspectModal from "../CardInspectModal.svelte";
  import type { CardSizeId } from "../../domain/card-sizes";

  interface Props {
    cards: DeckReleaseCard[];
    sequences: SequenceData[];
    theme: string;
    nextDeckNumber: number;
    onSwapCard: (index: number) => void;
    onRedraw: () => void;
    onRelease: () => void;
    onBack: () => void;
    isReleasing: boolean;
    readOnly?: boolean;
    footers?: CardFooter[];
  }

  let {
    cards,
    sequences,
    theme,
    nextDeckNumber,
    onSwapCard,
    onRedraw,
    onRelease,
    onBack,
    isReleasing,
    readOnly = false,
    footers,
  }: Props = $props();

  let cardSize = $state<CardSizeId>("poker");
  let renderedPairs = $state<CardPair[]>([]);
  let isRendering = $state(false);
  let renderProgress = $state(0);
  let renderTotal = $state(0);
  let isExporting = $state(false);
  let rerenderKey = $state(0);

  let inspectedSequence = $state<SequenceData | null>(null);
  let inspectedFrontImageUrl = $state<string | null>(null);

  const distribution = $derived.by(() => {
    const dist: Record<number, number> = {};
    for (const c of cards) {
      dist[c.stepCount] = (dist[c.stepCount] ?? 0) + 1;
    }
    return Object.entries(dist)
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([step, count]) => ({ step: Number(step), count }));
  });

  function handleCardClick(sequence: SequenceData, frontImageUrl?: string) {
    inspectedFrontImageUrl = frontImageUrl ?? null;
    inspectedSequence = sequence;
  }

  function handleSwapInspected() {
    if (!inspectedSequence) return;
    const idx = sequences.findIndex(s => s.id === inspectedSequence!.id);
    if (idx >= 0) {
      onSwapCard(idx);
      inspectedSequence = null;
      inspectedFrontImageUrl = null;
    }
  }

  function handlePairsReady(pairs: CardPair[]) {
    renderedPairs = pairs;
  }

  function handleRenderState(state: { isRendering: boolean; progress: number; total: number }) {
    isRendering = state.isRendering;
    renderProgress = state.progress;
    renderTotal = state.total;
  }

  async function handleExportPDF() {
    if (renderedPairs.length === 0) return;
    isExporting = true;
    try {
      const { exportHomePrintPDF } = await import("$lib/features/choreo-card/services/print-pdf-exporter");
      const deckName = `Deck_${String(nextDeckNumber).padStart(3, "0")}`;
      const blob = await exportHomePrintPDF(renderedPairs, deckName, cardSize);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${deckName}_print.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      isExporting = false;
    }
  }

  async function handleExportZIP() {
    if (renderedPairs.length === 0) return;
    isExporting = true;
    try {
      const { exportDeckZIP } = await import("$lib/features/choreo-card/services/print-zip-exporter");
      const deckName = `Deck_${String(nextDeckNumber).padStart(3, "0")}`;
      const blob = await exportDeckZIP(renderedPairs, deckName);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${deckName}_cards.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      isExporting = false;
    }
  }
</script>

<div class="review-step">
  <div class="review-header">
    <button type="button" class="back-btn" onclick={onBack}>
      <i class="fas fa-arrow-left" aria-hidden="true"></i>
      {readOnly ? "Back to Composer" : "Back"}
    </button>

    <div class="deck-info">
      <h2 class="deck-number">Deck #{String(nextDeckNumber).padStart(3, "0")}</h2>
      <div class="distribution">
        {#each distribution as d (d.step)}
          <span class="dist-chip">{d.step}-step: {d.count}</span>
        {/each}
        <span class="dist-total">{cards.length} cards</span>
      </div>
    </div>

    {#if !readOnly}
      <div class="action-buttons">
        <button type="button" class="redraw-btn" onclick={onRedraw} disabled={isReleasing}>
          <i class="fas fa-dice" aria-hidden="true"></i>
          Redraw
        </button>
        <button type="button" class="release-btn" onclick={onRelease} disabled={isReleasing || isRendering}>
          {#if isReleasing}
            <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
            Releasing...
          {:else}
            <i class="fas fa-stamp" aria-hidden="true"></i>
            Release Deck #{String(nextDeckNumber).padStart(3, "0")}
          {/if}
        </button>
      </div>
    {/if}
  </div>

  <PrintPreviewToolbar
    {cardSize}
    totalCards={cards.length}
    {isRendering}
    {isExporting}
    {renderProgress}
    {renderTotal}
    onCardSizeChange={(s) => { cardSize = s; }}
    onExportPDF={handleExportPDF}
    onExportZIP={handleExportZIP}
    onRerender={() => { rerenderKey++; }}
  />

  <div class="preview-area">
    <PrintPreviewPages
      {sequences}
      {cardSize}
      {theme}
      {rerenderKey}
      {footers}
      isLoading={false}
      showGrid={true}
      showTKA={true}
      showWord={true}
      includeStartPosition={true}
      handPointsVisible={true}
      deckMode={true}
      displayMode="sheets"
      deckId={String(nextDeckNumber).padStart(3, "0")}
      deckName={`LOOP Deck #${nextDeckNumber}`}
      onCardClick={handleCardClick}
      onPairsReady={handlePairsReady}
      onRenderStateChange={handleRenderState}
    />
  </div>
</div>

{#if inspectedSequence}
  <CardInspectModal
    sequence={inspectedSequence}
    frontImageUrl={inspectedFrontImageUrl}
    handPointsVisible={true}
    showGrid={true}
    showTKA={true}
    showWord={true}
    includeStartPosition={true}
    onClose={() => { inspectedSequence = null; inspectedFrontImageUrl = null; }}
  >
    {#snippet extraActions()}
      {#if !readOnly}
        <button class="copy-btn swap-btn" onclick={handleSwapInspected} aria-label="Swap card">
          <i class="fas fa-random"></i> Swap Card
        </button>
      {/if}
    {/snippet}
  </CardInspectModal>
{/if}

<style>
  .review-step {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .review-header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-wrap: wrap;
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    min-height: 44px;
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text, #fff);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .back-btn:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .deck-info {
    flex: 1;
    min-width: 0;
  }

  .deck-number {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: var(--theme-text, #fff);
  }

  .distribution {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 4px;
  }

  .dist-chip {
    padding: 2px 8px;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    color: var(--theme-accent, #a78bfa);
  }

  .dist-total {
    padding: 2px 8px;
    font-size: 11px;
    font-weight: 600;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .action-buttons {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  .redraw-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 8px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 8px;
    color: var(--theme-text, #fff);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .redraw-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
  }

  .redraw-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .release-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 8px 20px;
    background: #10b981;
    border: none;
    border-radius: 8px;
    color: #fff;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s;
  }

  .release-btn:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .release-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .preview-area {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 16px;
  }

  .swap-btn {
    background: rgba(139, 92, 246, 0.15);
    border-color: rgba(139, 92, 246, 0.3);
    color: var(--theme-accent, #a78bfa);
  }

  .swap-btn:hover {
    background: rgba(139, 92, 246, 0.25);
    border-color: rgba(139, 92, 246, 0.5);
    color: #fff;
  }

  @media (max-width: 768px) {
    .review-header {
      flex-direction: column;
      align-items: stretch;
    }

    .action-buttons {
      justify-content: stretch;
    }

    .action-buttons button {
      flex: 1;
    }
  }
</style>
