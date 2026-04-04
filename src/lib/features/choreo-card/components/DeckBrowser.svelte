<!--
  DeckBrowser.svelte — Browse and explore curated sequence decks.

  Three levels:
  0. Collection picker: full-width hero cards for LOOPs, VTG, etc.
  1. Collection page: filterable deck list with DeckRow components
  2. Deck interior: filterable sequence grid with family/position chips
-->
<script lang="ts">
  import type { Deck, DeckFamily } from "../domain/models/Deck";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { DIFFICULTY_LEVELS } from "$lib/shared/config/difficulty-styles";
  import { DeckSortMethod, sortDecks, getDeckSectionKey, DECK_SORT_LABELS, DECK_SORT_ICONS } from "../domain/deck-sort";
  import DeckRow from "./DeckRow.svelte";
  import DeckListFilterPanel from "./filters/DeckListFilterPanel.svelte";
  import DeckInteriorFilterPanel from "./filters/DeckInteriorFilterPanel.svelte";
  import ChoreoCard from "./ChoreoCard.svelte";
  import VtgCollectionView from "./VtgCollectionView.svelte";
  import VtgFamilyDrillDown from "./VtgFamilyDrillDown.svelte";
  import LoopCollectionView from "./LoopCollectionView.svelte";
  import PrintPreviewPages from "./print-preview/PrintPreviewPages.svelte";
  import PrintPreviewToolbar from "./print-preview/PrintPreviewToolbar.svelte";
  import { type CardSizeId } from "../domain/card-sizes";
  import type { IPrintPDFExporter, CardPair } from "../services/contracts/IPrintPDFExporter";
  import type { IPrintZipExporter } from "../services/contracts/IPrintZipExporter";
  import { container } from "$lib/shared/di";

  interface Props {
    decks: Deck[];
    selectedDeckId: string | null;
    selectedCollection: string | null;
    selectedVtgFamily: string | null;
    vtgActiveView: "family" | "ratio" | "reversal";
    deckSequences: SequenceData[];
    isLoading: boolean;
    handPointsVisible?: boolean;
    showGrid?: boolean;
    showTKA?: boolean;
    showWord?: boolean;
    includeStartPosition?: boolean;
    onSelectCollection: (collectionId: string) => void;
    onBackToCollections: () => void;
    onSelectDeck: (deckId: string) => void;
    onBackToDeckList: () => void;
    onSelectVtgFamily: (familyId: string | null) => void;
    onVtgViewChange: (view: "family" | "ratio" | "reversal") => void;
    onSelectSequence: (sequence: SequenceData) => void;
    onLoadFamilySequences: (familyIds: string[]) => void;
    onContextMenu?: (x: number, y: number, rerender: () => void) => void;
  }

  let {
    decks,
    selectedDeckId,
    selectedCollection,
    selectedVtgFamily,
    vtgActiveView,
    deckSequences,
    isLoading,
    handPointsVisible = true,
    showGrid = true,
    showTKA = true,
    showWord = true,
    includeStartPosition = true,
    onSelectCollection,
    onBackToCollections,
    onSelectDeck,
    onBackToDeckList,
    onSelectVtgFamily,
    onVtgViewChange,
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

  // When there's only one deck in a collection, skip the list view
  $effect(() => {
    if (selectedCollection && !selectedDeckId && !isLoading) {
      const colDecks = getDecksForCollection(selectedCollection);
      if (colDecks.length === 1) {
        onSelectDeck(colDecks[0]!.id);
      }
    }
  });

  // ── Collections (Level 0) ──

  interface CollectionInfo {
    id: string;
    label: string;
    icon: string;
    color: string;
    description: string;
  }

  const COLLECTION_REGISTRY: Record<string, CollectionInfo> = {
    LOOPs: {
      id: "LOOPs",
      label: "LOOPs",
      icon: "rotate",
      color: "#36c3ff",
      description: "Repeating patterns sorted by length, speed, and reversal style",
    },
    VTG: {
      id: "VTG",
      label: "VTG",
      icon: "fire",
      color: "#ff9800",
      description: "The 6 fundamental two-hand movement families and their variations",
    },
  };

  const COLLECTION_ORDER = ["LOOPs", "VTG"];

  function getCollections(): {
    info: CollectionInfo;
    deckCount: number;
    cardCount: number;
    levelRange: string;
  }[] {
    const buckets = new Map<string, Deck[]>();
    for (const deck of decks) {
      const col = deck.collection ?? "Other";
      if (!buckets.has(col)) buckets.set(col, []);
      buckets.get(col)!.push(deck);
    }

    const result = [];
    for (const colName of COLLECTION_ORDER) {
      if (buckets.has(colName)) {
        const colDecks = buckets.get(colName)!;
        const levels = colDecks.map((d) => d.level);
        const minL = Math.min(...levels);
        const maxL = Math.max(...levels);
        result.push({
          info: COLLECTION_REGISTRY[colName] ?? {
            id: colName,
            label: colName,
            icon: "layer-group",
            color: "#6366f1",
            description: "",
          },
          deckCount: colDecks.length,
          cardCount: colDecks.reduce((sum, d) => sum + d.totalSequences, 0),
          levelRange: minL === maxL ? `L${minL}` : `L${minL}-L${maxL}`,
        });
      }
    }
    // "Other" catch-all
    const otherDecks = [...buckets.entries()]
      .filter(([k]) => !COLLECTION_ORDER.includes(k))
      .flatMap(([, v]) => v);
    if (otherDecks.length > 0) {
      const levels = otherDecks.map((d) => d.level);
      const minL = Math.min(...levels);
      const maxL = Math.max(...levels);
      result.push({
        info: {
          id: "Other",
          label: "Other",
          icon: "layer-group",
          color: "#6366f1",
          description: "",
        },
        deckCount: otherDecks.length,
        cardCount: otherDecks.reduce((sum, d) => sum + d.totalSequences, 0),
        levelRange: minL === maxL ? `L${minL}` : `L${minL}-L${maxL}`,
      });
    }
    return result;
  }

  function getDecksForCollection(colId: string): Deck[] {
    return decks.filter((d) => (d.collection ?? "Other") === colId);
  }

  function getCollectionVisuals(colId: string): { icon: string; color: string } {
    const info = COLLECTION_REGISTRY[colId];
    if (info) return { icon: info.icon, color: info.color };
    return { icon: "layer-group", color: "#6366f1" };
  }

  // ── VTG family navigation ──
  const isVtgCollectionView = $derived(
    selectedCollection === "VTG" && !selectedDeckId && !selectedVtgFamily,
  );

  // ── Level 1: Deck List State ──

  let deckListFilters = $state({ level: null as number | null, gridMode: null as string | null });
  let deckSortMethod = $state(DeckSortMethod.NAME);
  let deckFiltersOpen = $state(false);
  let sortOpen = $state(false);

  const filteredDecks = $derived.by(() => {
    if (!selectedCollection) return [];
    let result = getDecksForCollection(selectedCollection);
    if (deckListFilters.level !== null) {
      result = result.filter((d) => d.level === deckListFilters.level);
    }
    if (deckListFilters.gridMode !== null) {
      result = result.filter((d) => d.gridMode === deckListFilters.gridMode);
    }
    return sortDecks(result, deckSortMethod);
  });

  const hasActiveFilters = $derived(
    deckListFilters.level !== null || deckListFilters.gridMode !== null,
  );

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

  function handleSortClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest(".sort-wrapper")) {
      sortOpen = false;
    }
  }

  $effect(() => {
    if (!sortOpen) return;
    document.addEventListener("click", handleSortClickOutside, true);
    return () => document.removeEventListener("click", handleSortClickOutside, true);
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
          <button class="crumb" onclick={onBackToCollections} type="button">Collections</button>
          <span class="crumb-sep" aria-hidden="true">›</span>
          <button class="crumb" onclick={onBackToDeckList} type="button"
            >{COLLECTION_REGISTRY[selectedDeck.collection ?? ""]?.label ?? "Decks"}</button
          >
          <span class="crumb-sep" aria-hidden="true">›</span>
          <span class="crumb current">{selectedDeck.name}</span>
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
        {#if viewMode === 'print'}
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

  {:else if selectedCollection === "VTG" && selectedVtgFamily}
    <!-- ═══ Level 1.5: VTG Family Drill-Down ═══ -->
    <div class="level-container level-deck-list">
      <VtgFamilyDrillDown
        familyId={selectedVtgFamily}
        decks={getDecksForCollection("VTG")}
        {handPointsVisible}
        {showGrid}
        {showTKA}
        {showWord}
        {includeStartPosition}
        {onSelectSequence}
        {onContextMenu}
        onBack={() => onSelectVtgFamily(null)}
      />
    </div>

  {:else if selectedCollection && isVtgCollectionView}
    <!-- ═══ Level 1: VTG Collection View (Family/Ratio cards) ═══ -->
    <div class="level-container level-deck-list">
      <div class="top-bar">
        <nav class="breadcrumb" aria-label="Deck navigation">
          <button class="crumb" onclick={onBackToCollections} type="button">Collections</button>
          <span class="crumb-sep" aria-hidden="true">›</span>
          <span class="crumb current">VTG</span>
        </nav>
      </div>

      {#if isLoading}
        <div class="loading" role="status" aria-live="polite">
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          Loading decks...
        </div>
      {:else}
        <VtgCollectionView
          decks={getDecksForCollection("VTG")}
          {onSelectDeck}
          onSelectFamily={(familyId) => onSelectVtgFamily(familyId)}
          initialView={vtgActiveView}
          onViewChange={(view) => onVtgViewChange(view)}
        />
      {/if}
    </div>

  {:else if selectedCollection === 'LOOPs'}
    <!-- ═══ Level 1: LOOPs Collection View ═══ -->
    <div class="level-container level-deck-list">
      <div class="top-bar">
        <nav class="breadcrumb" aria-label="Deck navigation">
          <button class="crumb" onclick={onBackToCollections} type="button">Collections</button>
          <span class="crumb-sep" aria-hidden="true">›</span>
          <span class="crumb current">LOOPs</span>
        </nav>
      </div>

      {#if isLoading}
        <div class="loading" role="status" aria-live="polite">
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          Loading decks...
        </div>
      {:else}
        <LoopCollectionView
          decks={filteredDecks}
          onSelectDeck={(deck) => onSelectDeck(deck.id)}
        />
      {/if}
    </div>

  {:else if selectedCollection}
    <!-- ═══ Level 1: Collection Page (Deck List) ═══ -->
    <div class="level-container level-deck-list">
      <div class="top-bar">
        <nav class="breadcrumb" aria-label="Deck navigation">
          <button class="crumb" onclick={onBackToCollections} type="button">Collections</button>
          <span class="crumb-sep" aria-hidden="true">›</span>
          <span class="crumb current"
            >{COLLECTION_REGISTRY[selectedCollection]?.label ?? selectedCollection}</span
          >
        </nav>
        <div class="top-bar-actions">
          <button
            class="action-chip"
            class:active={deckFiltersOpen}
            onclick={() => { deckFiltersOpen = !deckFiltersOpen; }}
            type="button"
            aria-label="Toggle filters"
          >
            <i class="fas fa-filter" aria-hidden="true"></i>
            Filter
            {#if hasActiveFilters}
              <span class="filter-badge" aria-hidden="true"></span>
            {/if}
          </button>
          <div class="sort-wrapper">
            <button
              class="action-chip"
              class:active={sortOpen}
              onclick={() => { sortOpen = !sortOpen; }}
              type="button"
              aria-label="Sort decks"
            >
              <i class="fas {DECK_SORT_ICONS[deckSortMethod]}" aria-hidden="true"></i>
              {DECK_SORT_LABELS[deckSortMethod]}
            </button>
            {#if sortOpen}
              <div class="sort-popover" role="listbox" aria-label="Sort by">
                {#each Object.values(DeckSortMethod) as method}
                  <button
                    class="sort-option"
                    class:selected={deckSortMethod === method}
                    onclick={() => { deckSortMethod = method; sortOpen = false; }}
                    role="option"
                    aria-selected={deckSortMethod === method}
                    type="button"
                  >
                    <i class="fas {DECK_SORT_ICONS[method]}" aria-hidden="true"></i>
                    <span>{DECK_SORT_LABELS[method]}</span>
                    {#if deckSortMethod === method}
                      <i class="fas fa-check" aria-hidden="true"></i>
                    {/if}
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </div>

      <DeckListFilterPanel
        isOpen={deckFiltersOpen}
        activeLevel={deckListFilters.level}
        activeGridMode={deckListFilters.gridMode}
        onLevelChange={(level) => { deckListFilters = { ...deckListFilters, level }; }}
        onGridModeChange={(gridMode) => { deckListFilters = { ...deckListFilters, gridMode }; }}
      />

      {#if isLoading}
        <div class="loading" role="status" aria-live="polite">
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          Loading decks...
        </div>
      {:else if filteredDecks.length === 0}
        <div class="empty-state" role="status">
          <i class="fas fa-layer-group empty-icon" aria-hidden="true"></i>
          <p class="empty-text">No decks match these filters</p>
          {#if hasActiveFilters}
            <button
              class="clear-filters-btn"
              onclick={() => { deckListFilters = { level: null, gridMode: null }; }}
              type="button">Clear filters</button
            >
          {/if}
        </div>
      {:else}
        {@const visuals = getCollectionVisuals(selectedCollection)}
        <div class="deck-list">
          {#each filteredDecks as deck (deck.id)}
            <DeckRow
              {deck}
              accentColor={visuals.color}
              accentIcon={visuals.icon}
              onSelect={onSelectDeck}
            />
          {/each}
        </div>
      {/if}
    </div>

  {:else}
    <!-- ═══ Level 0: Collection Picker ═══ -->
    <div class="level-container level-collections">
      {#if isLoading}
        <div class="loading" role="status" aria-live="polite">
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          Loading decks...
        </div>
      {:else if decks.length === 0}
        <div class="empty-state" role="status">
          <i class="fas fa-layer-group empty-icon" aria-hidden="true"></i>
          <p class="empty-text">No decks available</p>
        </div>
      {:else}
        {@const collections = getCollections()}
        <div class="collections-landing">
          <div class="landing-header">
            <h2 class="landing-title">Decks</h2>
            <p class="landing-subtitle">Movement patterns organized into practice-ready collections</p>
          </div>
          <div class="collection-stack">
            {#each collections as col (col.info.id)}
              <button
                class="collection-hero"
                onclick={() => onSelectCollection(col.info.id)}
                type="button"
                aria-label="Browse {col.info.label}"
                style="--accent: {col.info.color}"
              >
                <div class="hero-accent-edge"></div>
                <div class="hero-content">
                  <div class="hero-icon-wrap">
                    <i class="fas fa-{col.info.icon}" aria-hidden="true"></i>
                  </div>
                  <div class="hero-text">
                    <h3 class="hero-name">{col.info.label}</h3>
                    <p class="hero-desc">{col.info.description}</p>
                    <span class="hero-stat">{col.deckCount} {col.deckCount === 1 ? "deck" : "decks"}</span>
                  </div>
                  <div class="hero-arrow">
                    <i class="fas fa-chevron-right" aria-hidden="true"></i>
                  </div>
                </div>
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
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

  .level-collections,
  .level-deck-list,
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

  .cards-view-container {
    flex: 1;
    overflow-y: auto;
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

  .filter-badge {
    position: absolute;
    top: -2px;
    right: -2px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--theme-accent, #6366f1);
  }

  /* ── Sort Popover ── */

  .sort-wrapper {
    position: relative;
  }

  .sort-popover {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 100;
    display: flex;
    flex-direction: column;
    min-width: 160px;
    padding: 4px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .sort-option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: none;
    border: none;
    color: var(--theme-text, #fff);
    font: inherit;
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    border-radius: 4px;
    text-align: left;
    width: 100%;
  }

  .sort-option:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .sort-option.selected {
    background: rgba(99, 102, 241, 0.15);
  }

  .sort-option .fa-check {
    margin-left: auto;
    font-size: 12px;
    color: var(--theme-accent, #6366f1);
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

  .deck-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

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

  /* ── Collection Picker (Level 0) ── */

  .collections-landing {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    max-width: 640px;
    margin: 0 auto;
    width: 100%;
    gap: 32px;
  }

  .landing-header {
    text-align: center;
  }

  .landing-title {
    font-size: 28px;
    font-weight: 700;
    color: var(--theme-text, #ffffff);
    margin: 0 0 8px;
    letter-spacing: -0.01em;
  }

  .landing-subtitle {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    margin: 0;
    line-height: 1.5;
  }

  .collection-stack {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
  }

  .collection-hero {
    position: relative;
    display: flex;
    align-items: stretch;
    padding: 0;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 16px;
    cursor: pointer;
    color: var(--theme-text, #fff);
    font: inherit;
    text-align: left;
    overflow: hidden;
    transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
  }

  .collection-hero:hover {
    border-color: color-mix(in srgb, var(--accent) 50%, transparent);
    transform: translateY(-3px);
    box-shadow: 0 8px 24px color-mix(in srgb, var(--accent) 15%, transparent);
  }

  .collection-hero:hover .hero-arrow {
    color: var(--accent);
    transform: translateX(3px);
  }

  .collection-hero:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .collection-hero { transition: none; }
    .collection-hero:hover { transform: none; }
  }

  .hero-accent-edge {
    width: 5px;
    flex-shrink: 0;
    background: linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--accent) 30%, transparent));
  }

  .hero-content {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 28px 24px;
    flex: 1;
    min-width: 0;
  }

  .hero-icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    border-radius: 14px;
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    color: var(--accent);
    font-size: 1.5rem;
    flex-shrink: 0;
  }

  .hero-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }

  .hero-name {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 0.01em;
  }

  .hero-desc {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    line-height: 1.4;
  }

  .hero-stat {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    margin-top: 4px;
  }

  .hero-arrow {
    display: flex;
    align-items: center;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.2));
    font-size: 14px;
    flex-shrink: 0;
    padding-right: 4px;
    transition: color 0.15s ease, transform 0.15s ease;
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

    .hero-content {
      padding: 20px 16px;
      gap: 14px;
    }

    .sequence-grid {
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    }
  }
</style>
