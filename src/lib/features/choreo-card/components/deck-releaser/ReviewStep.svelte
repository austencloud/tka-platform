<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { CardFooter, DeckReleaseCard } from "../../domain/models/DeckRelease";
  import type { CardPair } from "../../services/types";
  import type { PrintPDFMode } from "../../services/print-pdf-exporter";
  import { getTnDElementByIconPath, TND_ELEMENTS } from "../../domain/tnd-element";
  import PrintPreviewPages from "../print-preview/PrintPreviewPages.svelte";
  import PrintPreviewToolbar from "../print-preview/PrintPreviewToolbar.svelte";
  import PrintDialog from "../print-preview/PrintDialog.svelte";
  import CardInspectModal from "../CardInspectModal.svelte";
  import type { CardSizeId } from "../../domain/card-sizes";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

  interface Props {
    cards: DeckReleaseCard[];
    sequences: SequenceData[];
    theme: string;
    bluePropType?: PropType;
    redPropType?: PropType;
    nextDeckNumber: number;
    deckName?: string;
    onSwapCard: (index: number) => void;
    onRedraw: () => void;
    onRelease: () => void;
    onBack: () => void;
    /** Provided when viewing a released deck: commit an inline name edit. */
    onRename?: (name: string) => void;
    isReleasing: boolean;
    readOnly?: boolean;
    footers?: CardFooter[];
    onContextMenu?: (x: number, y: number, rerender: () => void) => void;
    brokenLoopCount?: number;
  }

  let {
    cards,
    sequences,
    theme,
    bluePropType,
    redPropType,
    nextDeckNumber,
    deckName = "",
    onSwapCard,
    onRedraw,
    onRelease,
    onBack,
    onRename,
    isReleasing,
    readOnly = false,
    footers,
    onContextMenu,
    brokenLoopCount = 0,
  }: Props = $props();

  const deckNumberLabel = $derived(`Deck #${String(nextDeckNumber).padStart(3, "0")}`);
  let nameDraft = $state(deckName);
  $effect(() => { nameDraft = deckName; });

  function commitName() {
    const t = nameDraft.trim();
    if (t && t !== deckName) {
      onRename?.(t);
    } else {
      nameDraft = deckName;
    }
  }

  function handleNameKey(e: KeyboardEvent) {
    if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
    else if (e.key === "Escape") { nameDraft = deckName; (e.currentTarget as HTMLInputElement).blur(); }
  }

  let cardSize = $state<CardSizeId>("poker");
  let renderedPairs = $state<CardPair[]>([]);
  let isRendering = $state(false);
  let renderProgress = $state(0);
  let renderTotal = $state(0);
  const elementSorted = $derived.by(() => {
    const rawElements = (footers ?? []).map((f) => getTnDElementByIconPath(f.iconPath ?? "") ?? undefined);
    const elementOrder = TND_ELEMENTS.map((e) => e.element);
    const indexed = sequences.map((seq, i) => ({
      seq,
      footer: footers?.[i],
      el: rawElements[i],
      origIndex: i,
    }));
    indexed.sort((a, b) => {
      const ai = a.el ? elementOrder.indexOf(a.el.element) : 999;
      const bi = b.el ? elementOrder.indexOf(b.el.element) : 999;
      return ai !== bi ? ai - bi : a.origIndex - b.origIndex;
    });
    return {
      sequences: indexed.map((r) => r.seq),
      footers: indexed.map((r) => r.footer!).filter(Boolean),
      tndElements: indexed.map((r) => r.el),
    };
  });
  const sortedSequences = $derived(elementSorted.sequences);
  const sortedFooters = $derived(elementSorted.footers);
  const tndElements = $derived(elementSorted.tndElements);

  let showPrintDialog = $state(false);
  let isExporting = $state(false);
  let exportProgress = $state(0);
  let exportTotal = $state(0);
  let exportError = $state("");
  let rerenderKey = $state(0);

  let inspectedSequence = $state<SequenceData | null>(null);
  let inspectedFrontImageUrl = $state<string | null>(null);
  let inspectedRerender = $state<(() => Promise<string | null>) | null>(null);

  const distribution = $derived.by(() => {
    const dist: Record<number, number> = {};
    for (const c of cards) {
      dist[c.stepCount] = (dist[c.stepCount] ?? 0) + 1;
    }
    return Object.entries(dist)
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([step, count]) => ({ step: Number(step), count }));
  });

  // One clean line: a single step length collapses to "4-step"; a mix lists
  // each length with its count.
  const stepSummary = $derived(
    distribution.length === 1
      ? `${distribution[0]!.step}-step`
      : distribution.map((d) => `${d.step}-step ×${d.count}`).join("  ·  "),
  );

  function handleCardClick(sequence: SequenceData, frontImageUrl?: string, rerender?: () => Promise<string | null>) {
    inspectedFrontImageUrl = frontImageUrl ?? null;
    inspectedRerender = rerender ?? null;
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

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleExportPDF(mode: PrintPDFMode = 'combined') {
    if (renderedPairs.length === 0) return;
    isExporting = true;
    exportError = "";
    exportProgress = 0;
    exportTotal = 0;
    try {
      const { exportHomePrintPDF } = await import("$lib/features/choreo-card/services/print-pdf-exporter");
      const deckName = `Deck_${String(nextDeckNumber).padStart(3, "0")}`;
      const suffix = mode === "fronts" ? "_fronts" : mode === "backs" ? "_backs" : "_print";
      const blob = await exportHomePrintPDF(renderedPairs, deckName, cardSize, (current, total) => {
        exportProgress = current;
        exportTotal = total;
      }, mode);
      triggerDownload(blob, `${deckName}${suffix}.pdf`);
    } catch (e) {
      exportError = `PDF export failed: ${e instanceof Error ? e.message : e}`;
    } finally {
      isExporting = false;
      exportProgress = 0;
      exportTotal = 0;
    }
  }

  async function handleExportZIP() {
    if (renderedPairs.length === 0) return;
    isExporting = true;
    exportError = "";
    exportProgress = 0;
    exportTotal = 0;
    try {
      const { exportDeckZIP } = await import("$lib/features/choreo-card/services/print-zip-exporter");
      const deckName = `Deck_${String(nextDeckNumber).padStart(3, "0")}`;
      const blob = await exportDeckZIP(renderedPairs, deckName, (current, total) => {
        exportProgress = current;
        exportTotal = total;
      });
      triggerDownload(blob, `${deckName}_cards.zip`);
    } catch (e) {
      exportError = `ZIP export failed: ${e instanceof Error ? e.message : e}`;
    } finally {
      isExporting = false;
      exportProgress = 0;
      exportTotal = 0;
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
      {#if onRename}
        <input
          class="deck-name-input"
          type="text"
          bind:value={nameDraft}
          onblur={commitName}
          onkeydown={handleNameKey}
          maxlength="60"
          aria-label="Deck name (click to edit)"
          title="Click to rename"
        />
      {:else}
        <h2 class="deck-number">{deckName || deckNumberLabel}</h2>
      {/if}
      <div class="deck-meta">
        <span class="meta-cards">{cards.length} cards</span>
        {#if stepSummary}
          <span class="meta-sep" aria-hidden="true">·</span>
          <span class="meta-steps">{stepSummary}</span>
        {/if}
        {#if brokenLoopCount > 0}
          <span class="meta-sep" aria-hidden="true">·</span>
          <span class="meta-broken" title="These cards' turns don't return the prop to its start orientation. Redraw to reroll.">
            <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
            {brokenLoopCount} break loop
          </span>
        {/if}
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
    {renderProgress}
    {renderTotal}
    onCardSizeChange={(s) => { cardSize = s; }}
    onRerender={() => { rerenderKey++; }}
    onPrint={() => { showPrintDialog = true; }}
  />

  <div class="preview-area">
    <PrintPreviewPages
      sequences={sortedSequences}
      {cardSize}
      {theme}
      {bluePropType}
      {redPropType}
      {rerenderKey}
      footers={sortedFooters}
      {tndElements}
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
    onContextMenu={onContextMenu ? (x, y, _rerender) => {
      onContextMenu(x, y, () => {
        if (inspectedRerender) {
          inspectedRerender().then(newUrl => {
            if (newUrl) inspectedFrontImageUrl = newUrl;
          });
        }
      });
    } : undefined}
    onClose={() => { inspectedSequence = null; inspectedFrontImageUrl = null; inspectedRerender = null; }}
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

{#if showPrintDialog}
  <PrintDialog
    title="Print Deck #{String(nextDeckNumber).padStart(3, '0')}"
    subtitle="Pre-release preview"
    cardCount={cards.length}
    {tndElements}
    {cardSize}
    {theme}
    {isExporting}
    exportProgress={exportProgress}
    exportTotal={exportTotal}
    exportError={exportError}
    onExportPDF={handleExportPDF}
    onExportZIP={handleExportZIP}
    onCardSizeChange={(s) => { cardSize = s; }}
    onClose={() => { if (!isExporting) showPrintDialog = false; }}
  />
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
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .deck-number {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: var(--theme-text, #fff);
    text-align: center;
  }

  .deck-name-input {
    display: block;
    width: 100%;
    max-width: 460px;
    margin: 0;
    padding: 4px 12px;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.01em;
    text-align: center;
    color: var(--theme-text, #fff);
    background: transparent;
    border: 1px solid transparent;
    border-radius: 10px;
    cursor: text;
    transition: background 0.15s, border-color 0.15s;
  }

  .deck-name-input:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: var(--theme-stroke, rgba(255, 255, 255, 0.12));
  }

  .deck-name-input:focus {
    outline: none;
    background: rgba(255, 255, 255, 0.06);
    border-color: var(--theme-accent, #8b5cf6);
  }

  .deck-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 13px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .meta-cards {
    font-weight: 700;
    color: var(--theme-text, rgba(255, 255, 255, 0.92));
  }

  .meta-sep {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
  }

  .meta-steps {
    font-weight: 600;
  }

  .meta-broken {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-weight: 600;
    color: #fbbf24;
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
