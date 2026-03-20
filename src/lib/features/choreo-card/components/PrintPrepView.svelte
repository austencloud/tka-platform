<!--
  PrintPrepView.svelte - MPC Print Preparation

  Renders all cards in a loaded deck at MakePlayingCards.com specifications
  (822x1122px at 300 DPI with bleed) and exports as alternating front/back PDF.
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { Deck, DeckFamily } from "../domain/models/Deck";
  import type { IPrintCardRenderer, PrintRenderOptions } from "../services/contracts/IPrintCardRenderer";
  import type { IPrintPDFExporter, CardPair } from "../services/contracts/IPrintPDFExporter";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";

  interface Props {
    deck: Deck | null;
    deckSequences: SequenceData[];
    onSwitchToDecks: () => void;
  }

  let { deck, deckSequences, onSwitchToDecks }: Props = $props();

  // State
  let includeInfoCards = $state(loadBool("printPrep.includeInfoCards", true));
  let renderedPairs = $state<Array<{ front: HTMLCanvasElement; back: HTMLCanvasElement; label: string; familyId: string }>>([]);
  let infoCardPair = $state<{ front: HTMLCanvasElement; back: HTMLCanvasElement } | null>(null);
  let isRendering = $state(false);
  let renderProgress = $state(0);
  let renderTotal = $state(0);
  let isExporting = $state(false);
  let exportProgress = $state(0);
  let exportTotal = $state(0);

  // Services
  let printRenderer: IPrintCardRenderer | null = $state(null);
  let pdfExporter: IPrintPDFExporter | null = $state(null);

  // Build a map from sequenceId to familyId for grouping
  const sequenceFamilyMap = $derived.by(() => {
    if (!deck) return new Map<string, string>();
    const map = new Map<string, string>();
    for (const family of deck.families) {
      for (const seqId of family.sequenceIds) {
        map.set(seqId, family.id);
      }
    }
    return map;
  });

  // Group rendered pairs by family for display
  const pairsByFamily = $derived.by(() => {
    if (!deck) return [];
    const groups: Array<{ family: DeckFamily; pairs: typeof renderedPairs }> = [];
    for (const family of deck.families) {
      const familyPairs = renderedPairs.filter((p) => p.familyId === family.id);
      if (familyPairs.length > 0) {
        groups.push({ family, pairs: familyPairs });
      }
    }
    return groups;
  });

  const totalCards = $derived(renderedPairs.length + (includeInfoCards && infoCardPair ? 1 : 0));

  function loadBool(key: string, defaultVal: boolean): boolean {
    if (typeof window === "undefined") return defaultVal;
    const stored = localStorage.getItem(key);
    return stored === null ? defaultVal : stored === "true";
  }

  function persistBool(key: string, value: boolean) {
    if (typeof window !== "undefined") localStorage.setItem(key, String(value));
  }

  function toggleInfoCards() {
    includeInfoCards = !includeInfoCards;
    persistBool("printPrep.includeInfoCards", includeInfoCards);
  }

  onMount(() => {
    printRenderer = container.items.printCardRenderer as IPrintCardRenderer;
    pdfExporter = container.items.printPDFExporter as IPrintPDFExporter;
  });

  // Re-render when deck changes
  $effect(() => {
    if (deck && deckSequences.length > 0 && printRenderer) {
      renderAllCards();
    }
  });

  async function renderAllCards() {
    if (!printRenderer || !deck) return;

    isRendering = true;
    renderedPairs = [];
    renderProgress = 0;

    // Build ordered list of sequences matching deck family order
    const orderedSequences: Array<{ seq: SequenceData; familyId: string }> = [];
    for (const family of deck.families) {
      for (const seqId of family.sequenceIds) {
        const seq = deckSequences.find((s) => s.id === seqId);
        if (seq) orderedSequences.push({ seq, familyId: family.id });
      }
    }

    renderTotal = orderedSequences.length;

    const options: PrintRenderOptions = {
      showGrid: true,
      showTKA: true,
      showWord: true,
      includeStartPosition: true,
      handPointsVisible: true,
    };

    // Render info cards (once, cached)
    try {
      const infoFront = await printRenderer.renderInfoCardFront();
      const infoBack = await printRenderer.renderInfoCardBack();
      infoCardPair = { front: infoFront, back: infoBack };
    } catch (err) {
      console.error("Failed to render info cards:", err);
    }

    // Render sequence cards progressively
    for (let i = 0; i < orderedSequences.length; i++) {
      const { seq, familyId } = orderedSequences[i]!;
      try {
        const front = await printRenderer.renderFront(seq, options);
        const back = await printRenderer.renderBack(seq, options);
        renderedPairs = [...renderedPairs, {
          front,
          back,
          label: seq.word ?? seq.name ?? `Card ${i + 1}`,
          familyId,
        }];
      } catch (err) {
        console.error(`Failed to render card ${i}:`, err);
      }
      renderProgress = i + 1;
    }

    isRendering = false;
  }

  async function exportPDF() {
    if (!pdfExporter || !deck) return;

    isExporting = true;
    exportProgress = 0;

    // Build ordered pair list
    const pairs: CardPair[] = [];

    // Info cards first (if enabled)
    if (includeInfoCards && infoCardPair) {
      pairs.push({
        front: infoCardPair.front,
        back: infoCardPair.back,
        label: "How to Read a Choreo Card",
      });
    }

    // Sequence cards
    for (const pair of renderedPairs) {
      pairs.push({ front: pair.front, back: pair.back, label: pair.label });
    }

    exportTotal = pairs.length;

    try {
      const blob = await pdfExporter.exportDeckPDF(
        pairs,
        deck.name,
        (current, total) => {
          exportProgress = current;
          exportTotal = total;
        }
      );

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${deck.name.replace(/\s+/g, "_")}_MPC.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export PDF:", err);
    }

    isExporting = false;
  }
</script>

<div class="print-prep">
  {#if !deck}
    <div class="empty-state">
      <div class="empty-icon">
        <i class="fas fa-print" aria-hidden="true"></i>
      </div>
      <h2 class="empty-title">No deck loaded</h2>
      <p class="empty-description">
        Select a deck in the Decks tab, then return here to prepare it for printing.
      </p>
      <button class="go-to-decks" onclick={onSwitchToDecks}>
        <i class="fas fa-layer-group" aria-hidden="true"></i>
        Go to Decks
      </button>
    </div>
  {:else}
    <!-- Header -->
    <div class="prep-header">
      <div class="header-left">
        <h2 class="deck-name">{deck.name}</h2>
        <span class="card-count">
          {totalCards} card{totalCards !== 1 ? "s" : ""}
          {#if includeInfoCards && infoCardPair}
            <span class="info-note">(incl. rules card)</span>
          {/if}
        </span>
      </div>
      <div class="header-controls">
        <label class="toggle-label">
          <input
            type="checkbox"
            checked={includeInfoCards}
            onchange={toggleInfoCards}
          />
          <span>Rules card</span>
        </label>
        <button
          class="export-btn"
          onclick={exportPDF}
          disabled={isRendering || isExporting || renderedPairs.length === 0}
        >
          {#if isExporting}
            <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
            PDF {exportProgress}/{exportTotal}
          {:else}
            <i class="fas fa-file-pdf" aria-hidden="true"></i>
            Export PDF
          {/if}
        </button>
      </div>
    </div>

    <!-- Progress bar during rendering -->
    {#if isRendering}
      <div class="progress-bar">
        <div class="progress-fill" style="width: {renderTotal > 0 ? (renderProgress / renderTotal) * 100 : 0}%"></div>
        <span class="progress-text">Rendering card {renderProgress} of {renderTotal}...</span>
      </div>
    {/if}

    <!-- Card preview grid -->
    <div class="prep-body themed-scrollbar">
      <!-- Info card pair -->
      {#if includeInfoCards && infoCardPair}
        <div class="family-section">
          <h3 class="family-label">Rules Card</h3>
          <div class="pair-grid">
            <div class="card-pair">
              <div class="card-preview">
                <img
                  class="preview-img"
                  src={infoCardPair.front.toDataURL("image/png")}
                  alt="Rules card front"
                />
                <span class="face-label">Front</span>
              </div>
              <div class="card-preview">
                <img
                  class="preview-img"
                  src={infoCardPair.back.toDataURL("image/png")}
                  alt="Rules card back"
                />
                <span class="face-label">Back</span>
              </div>
            </div>
          </div>
        </div>
      {/if}

      <!-- Sequence card pairs by family -->
      {#each pairsByFamily as group}
        <div class="family-section">
          <h3 class="family-label">{group.family.label}</h3>
          <div class="pair-grid">
            {#each group.pairs as pair}
              <div class="card-pair">
                <div class="card-preview">
                  <img
                    class="preview-img"
                    src={pair.front.toDataURL("image/png")}
                    alt="{pair.label} front"
                    loading="lazy"
                  />
                  <span class="face-label">Front</span>
                </div>
                <div class="card-preview">
                  <img
                    class="preview-img"
                    src={pair.back.toDataURL("image/png")}
                    alt="{pair.label} back"
                    loading="lazy"
                  />
                  <span class="face-label">Back</span>
                </div>
                <span class="pair-label">{pair.label}</span>
              </div>
            {/each}
          </div>
        </div>
      {/each}

      {#if !isRendering && renderedPairs.length === 0}
        <div class="empty-state">
          <p class="empty-description">No cards rendered yet.</p>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .print-prep {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  /* Empty state */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 12px;
    padding: 32px;
    text-align: center;
  }

  .empty-icon {
    font-size: 48px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
    margin-bottom: 8px;
  }

  .empty-title {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .empty-description {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    max-width: 360px;
  }

  .go-to-decks {
    margin-top: 8px;
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    background: var(--theme-accent, #6366f1);
    color: #ffffff;
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
  }

  .go-to-decks:hover {
    filter: brightness(1.1);
  }

  .go-to-decks:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* Header */
  .prep-header {
    flex-shrink: 0;
    padding: 12px 20px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  .header-left {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }

  .deck-name {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .card-count {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .info-note {
    font-size: var(--font-size-compact, 12px);
    opacity: 0.7;
  }

  .header-controls {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .toggle-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    cursor: pointer;
  }

  .toggle-label input {
    accent-color: var(--theme-accent, #6366f1);
  }

  .export-btn {
    padding: 8px 16px;
    border: none;
    border-radius: 8px;
    background: #059669;
    color: #ffffff;
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
  }

  .export-btn:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .export-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .export-btn:focus-visible {
    outline: 2px solid #059669;
    outline-offset: 2px;
  }

  /* Progress bar */
  .progress-bar {
    position: relative;
    height: 28px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    flex-shrink: 0;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #059669, #34d399);
    transition: width 0.2s ease-out;
  }

  .progress-text {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text, #ffffff);
  }

  /* Card preview grid */
  .prep-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
  }

  .family-section {
    margin-bottom: 24px;
  }

  .family-label {
    margin: 0 0 12px;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .pair-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }

  .card-pair {
    display: flex;
    flex-direction: row;
    gap: 8px;
    align-items: start;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    padding: 8px;
    position: relative;
  }

  .card-preview {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .preview-img {
    width: 100%;
    aspect-ratio: 822 / 1122;
    object-fit: contain;
    border-radius: 4px;
    background: #1a1a2e;
  }

  .face-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .pair-label {
    position: absolute;
    bottom: -6px;
    left: 50%;
    transform: translateX(-50%);
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    white-space: nowrap;
  }

  @media (max-width: 768px) {
    .prep-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }

    .pair-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .progress-fill {
      transition: none;
    }

    .go-to-decks,
    .export-btn {
      transition: none;
    }
  }
</style>
