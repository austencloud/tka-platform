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

  interface Props {
    decks: Deck[];
    selectedDeckId: string | null;
    selectedCollection: string | null;
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
    onSelectSequence: (sequence: SequenceData) => void;
    onLoadFamilySequences: (familyIds: string[]) => void;
    onContextMenu?: (x: number, y: number, rerender: () => void) => void;
  }

  let {
    decks,
    selectedDeckId,
    selectedCollection,
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
    onSelectSequence,
    onLoadFamilySequences,
    onContextMenu,
  }: Props = $props();

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
      description: "Circular sequences that repeat through rotation",
    },
    VTG: {
      id: "VTG",
      label: "VTG",
      icon: "fire",
      color: "#ff9800",
      description: "Vulcan Tech Goss motion categories at each ratio",
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
                    />
                  </div>
                {/each}
              </div>
            </section>
          {/each}
        </div>
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
      <div class="top-bar">
        <nav class="breadcrumb" aria-label="Deck navigation">
          <span class="crumb current">Collections</span>
        </nav>
      </div>

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
        <div class="collection-stack">
          {#each collections as col (col.info.id)}
            <button
              class="collection-hero"
              onclick={() => onSelectCollection(col.info.id)}
              type="button"
              aria-label="Browse {col.info.label}"
              style="--accent: {col.info.color}"
            >
              <div class="hero-icon-wrap">
                <i class="fas fa-{col.info.icon}" aria-hidden="true"></i>
              </div>
              <div class="hero-body">
                <h3 class="hero-name">{col.info.label}</h3>
                <p class="hero-desc">{col.info.description}</p>
              </div>
              <div class="hero-stats">
                <span class="hero-stat"><span class="hero-stat-value">{col.deckCount}</span> {col.deckCount === 1 ? "deck" : "decks"}</span>
                <span class="hero-stat"><span class="hero-stat-value">{formatCount(col.cardCount)}</span> cards</span>
              </div>
              <div class="hero-accent-line"></div>
            </button>
          {/each}
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

  .collection-stack {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
    max-width: 700px;
    margin: 0 auto;
    width: 100%;
  }

  .collection-hero {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 16px;
    aspect-ratio: 1;
    padding: 32px 24px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    color: var(--theme-text, #ffffff);
    cursor: pointer;
    font: inherit;
    text-align: left;
    overflow: hidden;
    transition: border-color 0.15s ease;
  }

  .collection-hero:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .collection-hero:hover .hero-accent-line {
    height: 2px;
    opacity: 0.9;
  }

  .collection-hero:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .hero-icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    border: 1.5px solid color-mix(in srgb, var(--accent) 25%, transparent);
    color: var(--accent);
    font-size: 2rem;
  }

  .hero-body {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .hero-name {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  .hero-desc {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .hero-stats {
    display: flex;
    align-items: center;
    gap: 20px;
    flex-shrink: 0;
  }

  .hero-stat {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
  }

  .hero-stat-value {
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--accent);
  }

  .hero-accent-line {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--accent), transparent);
    opacity: 0.5;
    transition: height 0.2s ease, opacity 0.2s ease;
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

    .collection-stack {
      grid-template-columns: 1fr;
    }

    .collection-hero {
      padding: 20px;
    }

    .sequence-grid {
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    }
  }
</style>
