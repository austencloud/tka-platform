<script lang="ts">
  import { getAllReleases } from "$lib/features/choreo-card/services/deck-release-store";
  import { loadSequencesByIds } from "$lib/features/choreo-card/services/catalog-loader";
  import type { DeckRelease, CardFooter } from "$lib/features/choreo-card/domain/models/DeckRelease";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { CardPair } from "$lib/features/choreo-card/services/types";
  import type { CardSizeId } from "$lib/features/choreo-card/domain/card-sizes";
  import { getTnDElementByIconPath, TND_ELEMENTS, type TnDElement } from "$lib/features/choreo-card/domain/tnd-element";
  import PrintPreviewPages from "$lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte";
  import PrintPreviewToolbar from "$lib/features/choreo-card/components/print-preview/PrintPreviewToolbar.svelte";

  let releases: DeckRelease[] = $state([]);
  let selectedDeck: DeckRelease | null = $state(null);
  let sequences: SequenceData[] = $state([]);
  let footers: CardFooter[] = $state([]);
  let isLoadingReleases = $state(true);
  let tndElements: (TnDElement | undefined)[] = $state([]);
  let isLoadingSequences = $state(false);
  let loadStatus = $state("Loading released decks...");

  const THEMES = ["cosmic", "ocean", "winter", "ember", "blossom", "forest", "autumn", "rainbow"] as const;
  let selectedTheme = $state("rainbow");

  let cardSize = $state<CardSizeId>("poker");
  let renderedPairs = $state<CardPair[]>([]);
  let isRendering = $state(false);
  let renderProgress = $state(0);
  let renderTotal = $state(0);
  let isExporting = $state(false);
  let rerenderKey = $state(0);

  $effect(() => {
    getAllReleases()
      .then((r) => {
        releases = r;
        isLoadingReleases = false;
        loadStatus = `${r.length} released decks found`;
      })
      .catch((e) => {
        loadStatus = `Failed: ${e}`;
        isLoadingReleases = false;
      });
  });

  async function selectDeck(deck: DeckRelease) {
    selectedDeck = deck;
    isLoadingSequences = true;
    loadStatus = `Loading ${deck.cardCount} sequences...`;
    sequences = [];
    footers = [];

    const catalogGroups = new Map<string, { seqId: string; position: number; footer: CardFooter }[]>();
    for (const card of deck.sequences) {
      const group = catalogGroups.get(card.sourceCatalogId) ?? [];
      group.push({ seqId: card.sequenceId, position: card.position, footer: card.footer });
      catalogGroups.set(card.sourceCatalogId, group);
    }

    const positionedResults: { position: number; sequence: SequenceData; footer: CardFooter }[] = [];

    for (const [catalogId, cards] of catalogGroups) {
      loadStatus = `Fetching from ${catalogId}...`;
      const ids = cards.map(c => c.seqId);
      const seqs = await loadSequencesByIds(catalogId, ids);
      const seqMap = new Map(seqs.map(s => [s.id, s]));

      for (const card of cards) {
        const seq = seqMap.get(card.seqId);
        if (seq) {
          positionedResults.push({ position: card.position, sequence: seq, footer: card.footer });
        }
      }
    }

    positionedResults.sort((a, b) => a.position - b.position);

    const resolvedElements = positionedResults.map(r =>
      getTnDElementByIconPath(r.footer.iconPath ?? "") ?? undefined
    );
    const elementOrder = TND_ELEMENTS.map(e => e.element);
    const indexed = positionedResults.map((r, i) => ({ ...r, el: resolvedElements[i] }));
    indexed.sort((a, b) => {
      const ai = a.el ? elementOrder.indexOf(a.el.element) : 999;
      const bi = b.el ? elementOrder.indexOf(b.el.element) : 999;
      return ai !== bi ? ai - bi : a.position - b.position;
    });

    sequences = indexed.map(r => r.sequence);
    footers = indexed.map(r => r.footer);
    tndElements = indexed.map(r => r.el);
    isLoadingSequences = false;
    loadStatus = `Loaded ${sequences.length} sequences (grouped by element). Rendering cards...`;
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
      const deckName = `Deck_${String(selectedDeck!.deckNumber).padStart(3, "0")}`;
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
      const deckName = `Deck_${String(selectedDeck!.deckNumber).padStart(3, "0")}`;
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

<svelte:head>
  <title>Print Deck</title>
</svelte:head>

<div class="page">
  {#if !selectedDeck}
    <div class="picker">
      <h1>Print a Released Deck</h1>
      <p class="status">{loadStatus}</p>

      {#if isLoadingReleases}
        <div class="loading">Loading...</div>
      {:else}
        <div class="deck-list">
          {#each releases as deck (deck.deckNumber)}
            <button
              type="button"
              class="deck-card"
              onclick={() => selectDeck(deck)}
            >
              <span class="deck-num">#{String(deck.deckNumber).padStart(3, "0")}</span>
              <span class="deck-notes">{deck.notes}</span>
              <span class="deck-meta">{deck.cardCount} cards</span>
              <span class="deck-date">{new Date(deck.createdAt).toLocaleDateString()}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {:else}
    <div class="print-view">
      <div class="print-header">
        <button type="button" class="back-btn" onclick={() => { selectedDeck = null; sequences = []; renderedPairs = []; }}>
          <i class="fas fa-arrow-left" aria-hidden="true"></i>
          Back
        </button>
        <div class="deck-info">
          <h2>Deck #{String(selectedDeck.deckNumber).padStart(3, "0")} — {selectedDeck.notes}</h2>
          <span class="deck-meta-inline">{selectedDeck.cardCount} cards</span>
        </div>
        <div class="theme-picker">
          {#each THEMES as t (t)}
            <button
              type="button"
              class="theme-chip"
              class:active={selectedTheme === t}
              onclick={() => { selectedTheme = t; rerenderKey++; }}
            >{t}</button>
          {/each}
        </div>
      </div>

      {#if isLoadingSequences}
        <div class="loading">{loadStatus}</div>
      {:else if sequences.length > 0}
        <PrintPreviewToolbar
          {cardSize}
          totalCards={sequences.length}
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
            theme={selectedTheme}
            {rerenderKey}
            {footers}
            {tndElements}
            isLoading={false}
            showGrid={true}
            showTKA={true}
            showWord={true}
            includeStartPosition={true}
            handPointsVisible={true}
            deckMode={true}
            displayMode="sheets"
            deckId={String(selectedDeck.deckNumber).padStart(3, "0")}
            deckName={`LOOP Deck #${selectedDeck.deckNumber}`}
            onPairsReady={handlePairsReady}
            onRenderStateChange={handleRenderState}
          />
        </div>
      {:else}
        <div class="loading">No sequences loaded</div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .page {
    width: 100vw;
    height: 100vh;
    background: #0f1117;
    color: #e0e0e0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-family: system-ui, -apple-system, sans-serif;
  }

  .picker {
    padding: 40px;
    max-width: 800px;
    margin: 0 auto;
    width: 100%;
  }

  .picker h1 {
    font-size: 24px;
    font-weight: 700;
    color: #fff;
    margin: 0 0 8px;
  }

  .status {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.4);
    margin-bottom: 24px;
  }

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 14px;
  }

  .deck-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .deck-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 20px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    color: #e0e0e0;
    font: inherit;
    cursor: pointer;
    transition: all 0.15s;
    text-align: left;
  }

  .deck-card:hover {
    background: rgba(139, 92, 246, 0.1);
    border-color: rgba(139, 92, 246, 0.3);
  }

  .deck-num {
    font-family: 'JetBrains Mono', monospace;
    font-size: 18px;
    font-weight: 700;
    color: var(--theme-accent, #a78bfa);
    min-width: 60px;
  }

  .deck-notes {
    flex: 1;
    font-size: 15px;
    font-weight: 500;
    color: #fff;
  }

  .deck-meta {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
    font-variant-numeric: tabular-nums;
  }

  .deck-date {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.3);
  }

  .print-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .print-header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    min-height: 44px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: #e0e0e0;
    font: inherit;
    font-size: 14px;
    cursor: pointer;
  }

  .back-btn:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .deck-info h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: #fff;
  }

  .deck-meta-inline {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
  }

  .preview-area {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 16px;
  }

  .theme-picker {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    margin-left: auto;
  }

  .theme-chip {
    padding: 6px 12px;
    min-height: 36px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.5);
    font: inherit;
    font-size: 12px;
    text-transform: capitalize;
    cursor: pointer;
    transition: all 0.15s;
  }

  .theme-chip:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }

  .theme-chip.active {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.5);
    color: #a78bfa;
    font-weight: 600;
  }
</style>
