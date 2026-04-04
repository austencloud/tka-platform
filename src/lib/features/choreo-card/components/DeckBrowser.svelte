<!--
  DeckBrowser.svelte — Browse and explore curated sequence decks.

  Two modes:
  - Drill-down: hierarchical collection/shape/category/turn navigation (DeckDrillDown)
  - Deck interior: filterable sequence grid with family/position chips
-->
<script lang="ts">
  import type { Deck } from "../domain/models/Deck";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import DeckInteriorFilterPanel from "./filters/DeckInteriorFilterPanel.svelte";
  import ChoreoCard from "./ChoreoCard.svelte";
  import DeckDrillDown from "./drilldown/DeckDrillDown.svelte";
  import PrintPreviewPages from "./print-preview/PrintPreviewPages.svelte";
  import PrintPreviewToolbar from "./print-preview/PrintPreviewToolbar.svelte";
  import { type CardSizeId } from "../domain/card-sizes";
  import type { IPrintPDFExporter, CardPair } from "../services/contracts/IPrintPDFExporter";
  import type { IPrintZipExporter } from "../services/contracts/IPrintZipExporter";
  import { container } from "$lib/shared/di";

  interface Props {
    decks: Deck[];
    selectedDeckId: string | null;
    deckSequences: SequenceData[];
    isLoading: boolean;
    handPointsVisible?: boolean;
    showGrid?: boolean;
    showTKA?: boolean;
    showWord?: boolean;
    includeStartPosition?: boolean;
    onBackToCollections: () => void;
    onSelectDeck: (deckId: string) => void;
    onSelectSequence: (sequence: SequenceData) => void;
    onLoadFamilySequences: (familyIds: string[]) => void;
    onContextMenu?: (x: number, y: number, rerender: () => void) => void;
  }

  let {
    decks,
    selectedDeckId,
    deckSequences,
    isLoading,
    handPointsVisible = true,
    showGrid = true,
    showTKA = true,
    showWord = true,
    includeStartPosition = true,
    onBackToCollections,
    onSelectDeck,
    onSelectSequence,
    onLoadFamilySequences,
    onContextMenu,
  }: Props = $props();

  // ── Card view mode ──────────────────────────────────────────────────────
  type ViewMode = 'grid' | 'print';
  function readViewMode(): ViewMode {
    if (typeof window === 'undefined') return 'grid';
    const stored = localStorage.getItem('choreoCard.deckViewMode');
    // Backwards compat: 'cards' was the old value, now maps to 'print'
    if (stored === 'cards' || stored === 'print') return 'print';
    return 'grid';
  }
  let viewMode = $state<ViewMode>(readViewMode());

  let cardSize = $state<CardSizeId>(
    (typeof window !== 'undefined' ? localStorage.getItem('cardPreview.cardSize') : null) as CardSizeId ?? 'poker'
  );

  let selectedTheme = $state(typeof window !== 'undefined' ? localStorage.getItem('cardPreview.theme') ?? 'nightSky' : 'nightSky');
  let isExporting = $state(false);
  let renderedPairs = $state<CardPair[]>([]);
  let isRendering = $state(false);
  let renderProgress = $state(0);
  let renderTotal = $state(0);
  let rerenderKey = $state(0);

  function setViewMode(mode: ViewMode) {
    viewMode = mode;
    if (typeof window !== 'undefined') localStorage.setItem('choreoCard.deckViewMode', mode);
  }

  function setCardSize(size: CardSizeId) {
    cardSize = size;
    if (typeof window !== 'undefined') localStorage.setItem('cardPreview.cardSize', size);
  }

  async function handleExportPDF() {
    if (renderedPairs.length === 0) return;
    isExporting = true;
    try {
      const exporter = container.items.printPDFExporter as IPrintPDFExporter;
      const deckName = selectedDeck?.name ?? "deck";
      const blob = await exporter.exportHomePrintPDF(renderedPairs, deckName, cardSize);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${deckName.replace(/[^a-zA-Z0-9]/g, "_")}_print.pdf`;
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
      const exporter = container.items.printZipExporter as IPrintZipExporter;
      const deckName = selectedDeck?.name ?? "deck";
      const blob = await exporter.exportDeckZIP(renderedPairs, deckName);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${deckName.replace(/[^a-zA-Z0-9]/g, "_")}_cards.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      isExporting = false;
    }
  }

  // Derived deck/family lookups
  let selectedDeck = $derived(decks.find((d) => d.id === selectedDeckId) ?? null);

  // ── Drill-down deck selection bridge ──
  // DeckDrillDown gives us a Deck object; parent expects a deck ID string.
  function handleDrillDownSelect(deck: Deck) {
    onSelectDeck(deck.id);
  }

  // ── Level 2: Deck Interior State ──

  let interiorFilters = $state({ familyIds: [] as string[], position: null as string | null });
  let interiorFiltersOpen = $state(false);

  const filteredSequences = $derived.by(() => {
    let seqs = deckSequences;
    if (interiorFilters.familyIds.length > 0 && selectedDeck) {
      const allowedIds = new Set(
        selectedDeck.families
          .filter((f) => interiorFilters.familyIds.includes(f.id))
          .flatMap((f) => [...f.sequenceIds]),
      );
      seqs = seqs.filter((s) => allowedIds.has(s.id));
    }
    if (interiorFilters.position) {
      seqs = seqs.filter((s) => {
        const gridPos =
          s.startPosition?.gridPosition ?? s.startPosition?.startPosition ?? "";
        return gridPos.startsWith(interiorFilters.position!);
      });
    }
    return seqs;
  });

  const isLargeDeck = $derived(selectedDeck ? selectedDeck.totalSequences >= 500 : false);

  // Group sequences for display
  interface SequenceGroup {
    label: string;
    sequences: SequenceData[];
  }

  const START_POS_LABELS: Record<string, string> = {
    alpha: "Alpha (α)",
    beta: "Beta (β)",
    gamma: "Gamma (γ)",
  };

  function groupByStartPosition(seqs: SequenceData[]): SequenceGroup[] {
    const groups: Record<string, SequenceData[]> = {};
    for (const seq of seqs) {
      const gridPos = seq.startPosition?.gridPosition ?? seq.startPosition?.startPosition ?? "";
      const group = gridPos.startsWith("alpha")
        ? "alpha"
        : gridPos.startsWith("beta")
          ? "beta"
          : gridPos.startsWith("gamma")
            ? "gamma"
            : "other";
      if (!groups[group]) groups[group] = [];
      groups[group].push(seq);
    }
    return ["alpha", "beta", "gamma"]
      .filter((g) => groups[g] && groups[g].length > 0)
      .map((g) => ({ label: START_POS_LABELS[g] ?? g, sequences: groups[g]! }));
  }

  function groupByFamily(seqs: SequenceData[], deck: Deck): SequenceGroup[] {
    const seqMap = new Map(seqs.map((s) => [s.id, s]));
    return deck.families
      .map((f) => ({
        label: f.label || f.typeCombo,
        sequences: f.sequenceIds
          .map((id) => seqMap.get(id))
          .filter((s): s is SequenceData => s !== undefined),
      }))
      .filter((g) => g.sequences.length > 0);
  }

  const sequenceGroups = $derived.by((): SequenceGroup[] => {
    if (!selectedDeck || filteredSequences.length === 0) return [];
    if (interiorFilters.familyIds.length > 0) {
      return groupByStartPosition(filteredSequences);
    }
    return groupByFamily(filteredSequences, selectedDeck);
  });

  // Reset interior filters when deck changes
  $effect(() => {
    if (selectedDeckId) {
      interiorFilters = { familyIds: [], position: null };
      interiorFiltersOpen = false;
    }
  });

  function formatCount(n: number): string {
    if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`;
    if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`;
    return n.toLocaleString();
  }
</script>

<div class="deck-browser">
  {#if selectedDeck}
    <!-- ═══ Level 2: Deck Interior ═══ -->
    <div class="level-container level-interior">
      <div class="top-bar">
        <nav class="breadcrumb" aria-label="Deck navigation">
          <button class="crumb" onclick={onBackToCollections} type="button">
            <i class="fas fa-arrow-left" aria-hidden="true" style="margin-right:6px;font-size:11px;"></i>
            Back to browser
          </button>
          <span class="crumb-sep" aria-hidden="true">›</span>
          <span class="crumb current">{selectedDeck.canonicalName || selectedDeck.name}</span>
        </nav>
        <div class="top-bar-actions">
          <!-- View mode toggle -->
          <div class="view-toggle" role="radiogroup" aria-label="View mode">
            <button
              class="action-chip"
              class:active={viewMode === 'grid'}
              onclick={() => setViewMode('grid')}
              type="button"
              role="radio"
              aria-checked={viewMode === 'grid'}
            >
              <i class="fas fa-th" aria-hidden="true"></i>
              Grid
            </button>
            <button
              class="action-chip"
              class:active={viewMode === 'print'}
              onclick={() => setViewMode('print')}
              type="button"
              role="radio"
              aria-checked={viewMode === 'print'}
            >
              <i class="fas fa-print" aria-hidden="true"></i>
              Print Preview
            </button>
          </div>

          {#if viewMode === 'print'}
            <PrintPreviewToolbar
              {cardSize}
              {selectedTheme}
              totalCards={filteredSequences.length}
              {isRendering}
              {isExporting}
              {renderProgress}
              {renderTotal}
              onCardSizeChange={setCardSize}
              onThemeChange={(id) => {
                selectedTheme = id;
                if (typeof window !== 'undefined') localStorage.setItem('cardPreview.theme', id);
              }}
              onExportPDF={handleExportPDF}
              onExportZIP={handleExportZIP}
              onRerender={() => { rerenderKey++; }}
            />
          {/if}

          <button
            class="action-chip"
            class:active={interiorFiltersOpen}
            onclick={() => { interiorFiltersOpen = !interiorFiltersOpen; }}
            type="button"
            aria-label="Toggle filters"
          >
            <i class="fas fa-filter" aria-hidden="true"></i>
            Filter
          </button>
        </div>
      </div>

      <p class="deck-meta-line">
        {formatCount(selectedDeck.totalSequences)} sequences across {selectedDeck.families.length}
        {selectedDeck.families.length === 1 ? "family" : "families"} · {selectedDeck.gridMode} grid
      </p>

      <DeckInteriorFilterPanel
        isOpen={interiorFiltersOpen}
        families={selectedDeck.families}
        selectedFamilyIds={interiorFilters.familyIds}
        activePosition={interiorFilters.position}
        onFamilyChange={(ids) => {
          interiorFilters = { ...interiorFilters, familyIds: ids };
          if (isLargeDeck && ids.length > 0) {
            onLoadFamilySequences(ids);
          }
        }}
        onPositionChange={(pos) => {
          interiorFilters = { ...interiorFilters, position: pos };
        }}
      />

      {#if isLoading}
        <div class="loading" role="status" aria-live="polite">
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          Loading sequences...
        </div>
      {:else if filteredSequences.length === 0}
        <div class="empty-state" role="status">
          <i class="fas fa-file-alt empty-icon" aria-hidden="true"></i>
          {#if isLargeDeck && interiorFilters.familyIds.length === 0}
            <p class="empty-text">
              This deck has {formatCount(selectedDeck.totalSequences)} sequences.
              Select a family to explore.
            </p>
          {:else}
            <p class="empty-text">No sequences match these filters</p>
            <button
              class="clear-filters-btn"
              onclick={() => {
                interiorFilters = { familyIds: [], position: null };
              }}
              type="button">Clear filters</button
            >
          {/if}
        </div>
      {:else}
        {#if viewMode === 'print' && filteredSequences.length > 54}
          <div class="print-filter-prompt">
            <i class="fas fa-filter" aria-hidden="true"></i>
            <p>{filteredSequences.length} sequences is too many to preview. Use the Filter button to narrow down by family or starting position (max 54 for print preview).</p>
            <button
              class="filter-prompt-btn"
              type="button"
              onclick={() => { interiorFiltersOpen = true; }}
            >
              <i class="fas fa-filter" aria-hidden="true"></i> Open Filters
            </button>
          </div>
        {:else if viewMode === 'print'}
          <PrintPreviewPages
            sequences={filteredSequences}
            {cardSize}
            theme={selectedTheme}
            {rerenderKey}
            isLoading={false}
            {handPointsVisible}
            {showGrid}
            {showTKA}
            {showWord}
            {includeStartPosition}
            onCardContextMenu={onContextMenu ? (x, y, rerender) => onContextMenu(x, y, rerender) : undefined}
            onPairsReady={(pairs) => { renderedPairs = pairs; }}
          />
        {:else}
          <div class="sequence-sections">
            {#each sequenceGroups as group (group.label)}
              <section class="seq-section">
                <h3 class="section-header">{group.label} <span class="section-count">({group.sequences.length})</span></h3>
                <div class="sequence-grid">
                  {#each group.sequences as sequence (sequence.id)}
                    <div class="playing-card">
                      <ChoreoCard
                        {sequence}
                        printMode={true}
                        {handPointsVisible}
                        {showGrid}
                        {showTKA}
                        {showWord}
                        {includeStartPosition}
                        onSelect={() => onSelectSequence(sequence)}
                        {onContextMenu}
                      />
                    </div>
                  {/each}
                </div>
              </section>
            {/each}
          </div>
        {/if}
      {/if}

    </div>

  {:else}
    <!-- ═══ Drill-Down Browser (replaces old level 0 + 1) ═══ -->
    <DeckDrillDown {decks} onSelectDeck={handleDrillDownSelect} />
  {/if}
</div>

<style>
  /* ── Print filter prompt ── */

  .print-filter-prompt {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 48px 24px;
    text-align: center;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .print-filter-prompt i {
    font-size: 32px;
    opacity: 0.4;
  }

  .print-filter-prompt p {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    max-width: 400px;
    line-height: 1.5;
  }

  .filter-prompt-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    color: var(--theme-text, #fff);
    background: var(--theme-accent, #4a9eff);
    border: none;
    border-radius: 8px;
    cursor: pointer;
  }

  /* ── Root ── */

  .deck-browser {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  }

  .deck-browser::-webkit-scrollbar { width: 8px; }
  .deck-browser::-webkit-scrollbar-track { background: var(--scrollbar-track, transparent); }
  .deck-browser::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2)); border-radius: 4px; }
  .deck-browser::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-thumb-hover, rgba(255, 255, 255, 0.35)); }

  .level-container {
    display: flex;
    flex-direction: column;
    padding: 24px 32px;
    margin: 0 auto;
    width: 100%;
    gap: 16px;
    flex: 1;
    min-height: 0;
  }

  .level-interior { max-width: 1400px; }

  /* ── Top Bar ── */

  .top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  .top-bar-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .view-toggle {
    display: flex;
    gap: 0;
  }

  .view-toggle .action-chip {
    border-radius: 0;
  }

  .view-toggle .action-chip:first-child {
    border-radius: 8px 0 0 8px;
  }

  .view-toggle .action-chip:last-child {
    border-radius: 0 8px 8px 0;
  }

  .action-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 20px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font: inherit;
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: all 0.15s ease;
    position: relative;
  }

  .action-chip:hover,
  .action-chip.active {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #fff);
  }

  /* ── Breadcrumbs ── */

  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }

  .crumb {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 8px 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font: inherit;
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease;
  }

  .crumb:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #fff);
    text-decoration: none;
  }

  .crumb:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .crumb.current {
    color: var(--theme-text, #fff);
    cursor: default;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.08);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .crumb.current:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, #fff);
  }

  .crumb-sep {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.25));
    font-size: 14px;
    padding: 0 2px;
  }

  /* ── Deck meta line ── */

  .deck-meta-line {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    margin: 0;
  }

  /* ── Deck List (Level 1) ── */

  /* ── Sequence Sections (Level 2) ── */

  .sequence-sections {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .seq-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-header {
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text, #fff);
    margin: 0;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .section-count {
    font-weight: 400;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
  }

  .sequence-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 16px;
  }

  .playing-card {
    aspect-ratio: 5 / 7;
    border-radius: 10px;
    overflow: hidden;
    box-shadow:
      0 4px 20px rgba(0, 0, 0, 0.3),
      0 1px 4px rgba(0, 0, 0, 0.15);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: #ffffff;
  }

  .playing-card :global(> button) {
    width: 100%;
    height: 100%;
    border-radius: 0;
  }

  /* ── Shared States ── */

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 48px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-sm, 14px);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 48px 24px;
    text-align: center;
  }

  .empty-icon {
    font-size: 2.5rem;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.2));
  }

  .empty-text {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    max-width: 320px;
  }

  .clear-filters-btn {
    padding: 6px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    color: var(--theme-text, #fff);
    font: inherit;
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    transition: border-color 0.15s ease;
  }

  .clear-filters-btn:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  /* ── Responsive ── */

  @media (max-width: 768px) {
    .level-container {
      padding: 16px;
    }

    .sequence-grid {
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    }
  }
</style>
