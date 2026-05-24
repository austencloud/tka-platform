<!--
  DeckBrowser.svelte - Browse and explore curated sequence decks.

  Two modes:
  - Browse: full-width filter bar + grouped grid of all decks
  - Deck interior: filterable sequence grid with family/position chips
-->
<script lang="ts">

import { exportDeckZIP } from "$lib/features/choreo-card/services/print-zip-exporter";
  import type { Deck } from "../domain/models/Deck";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import DeckInteriorFilterPanel from "./filters/DeckInteriorFilterPanel.svelte";
  import CardInspectModal from "./CardInspectModal.svelte";
  import DeckBrowseFilterBar from "./DeckBrowseFilterBar.svelte";
  import DeckBrowseGrid from "./DeckBrowseGrid.svelte";
  import MotionTypePills from "./MotionTypePills.svelte";
  import { createDeckBrowseState } from "../state/deck-browse-state.svelte";
  import { setBrowseContext } from "../context/deck-browse-context";
  import PrintPreviewPages from "./print-preview/PrintPreviewPages.svelte";
  import PrintPreviewToolbar from "./print-preview/PrintPreviewToolbar.svelte";
  import { type CardSizeId } from "../domain/card-sizes";
  import type { CardPair } from "../services/types";
  import { BREAKPOINTS } from "$lib/shared/device/domain/constants/device-constants";
  import {
    resolveVtgFamilyId as resolveVtgFamily,
    computeTkaDesignation as computeTkaLabel,
    computeVtgDesignation as computeVtgLabel,
    computeDeckLeftLabel as computeLeftLabel,
  } from "../domain/deck-vtg-labels";
  import { calculateVTG } from "$lib/shared/pictograph/shared/domain/utils/vtg-calculator";
  import { GridMode, GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { Letter } from "$lib/shared/foundation/domain/models/Letter";

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
    onSelectDeck: (deckId: string, vtgFamily?: string | null) => void;
    onSelectSequence: (sequence: SequenceData) => void;
    onLoadFamilySequences: (familyIds: string[]) => void;
    onContextMenu?: (x: number, y: number, rerender: () => void) => void;
    /** VTG family ID from drilldown context (e.g. "split-same") for footer labels */
    vtgFamilyId?: string | null;
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
    vtgFamilyId,
  }: Props = $props();

  // ── Desktop detection ───────────────────────────────────────────────────
  let isDesktop = $state(false);

  $effect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(`(min-width: ${BREAKPOINTS.DESKTOP}px)`);
    isDesktop = mq.matches;
    const handler = (e: MediaQueryListEvent) => { isDesktop = e.matches; };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  });

  const browseState = createDeckBrowseState(() => decks);
  setBrowseContext(browseState);

  let scrollContainer: HTMLDivElement | null = $state(null);

  function handleBrowseDeckSelect(deck: Deck) {
    onSelectDeck(deck.id, null);
  }

  function handleBrowseScroll() {
    if (scrollContainer && !selectedDeckId) {
      browseState.setScrollY(scrollContainer.scrollTop);
    }
  }

  $effect(() => {
    if (scrollContainer && !selectedDeckId && browseState.scrollY > 0) {
      requestAnimationFrame(() => {
        scrollContainer?.scrollTo(0, browseState.scrollY);
      });
    }
  });

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

  let selectedTheme = $state(typeof window !== 'undefined' ? localStorage.getItem('cardPreview.theme') ?? 'cosmic' : 'cosmic');
  let isExporting = $state(false);
  let renderedPairs = $state<CardPair[]>([]);
  let isRendering = $state(false);
  let renderProgress = $state(0);
  let renderTotal = $state(0);
  let rerenderKey = $state(0);
  let inspectedSequence = $state<SequenceData | null>(null);
  let inspectedFrontImageUrl = $state<string | null>(null);
  let inspectedRerender = $state<(() => Promise<string | null>) | null>(null);

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
      // Lazy-load print-pdf-exporter - it pulls pdf-lib (~400KB + CSP-violating
      // runtime codegen). Only loaded when the user actually exports.
      const { exportHomePrintPDF } = await import(
        "$lib/features/choreo-card/services/print-pdf-exporter"
      );
      const deckName = selectedDeck?.name ?? "deck";
      const blob = await exportHomePrintPDF(renderedPairs, deckName, cardSize);
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
      const deckName = selectedDeck?.name ?? "deck";
      const blob = await exportDeckZIP(renderedPairs, deckName);
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

  // VTG category abbreviation lookup
  const VTG_ABBREVIATIONS: Record<string, string> = {
    "split-same": "SS", "tog-same": "TS",
    "split-opp": "SO", "tog-opp": "TO",
    "quarter-same": "QS", "quarter-opp": "QO",
  };

  // VTG turn value → ratio string (0 turns = "1:1", 1 turn = "3:1", etc.)
  const TURNS_TO_RATIO: Record<number, string> = {
    0: "1:1", 0.5: "2:1", 1: "3:1", 1.5: "4:1", 2: "5:1", 2.5: "6:1", 3: "7:1",
  };

  // Derived deck/family lookups
  let selectedDeck = $derived(decks.find((d) => d.id === selectedDeckId) ?? null);

  // All known VTG family keys for scanning deck data
  const VTG_FAMILY_KEYS = Object.keys(VTG_ABBREVIATIONS);

  // Resolve VTG family ID from drilldown context, localStorage, or deck data
  const resolvedVtgFamilyId = $derived.by(() => {
    // 1. Drilldown context (set during navigation)
    if (vtgFamilyId) return vtgFamilyId;
    // 2. Deck's loopType matches a VTG family directly
    if (selectedDeck && VTG_ABBREVIATIONS[selectedDeck.loopType]) return selectedDeck.loopType;
    // 3. For VTG decks, infer from family IDs (e.g. family.id contains "quarter-same")
    if (selectedDeck?.collection === "VTG") {
      for (const key of VTG_FAMILY_KEYS) {
        if (selectedDeck.families.some((f) => f.id.toLowerCase().includes(key))) {
          return key;
        }
      }
    }
    return undefined;
  });

  // Human-readable VTG family names for breadcrumbs
  const VTG_FAMILY_LABELS: Record<string, string> = {
    "split-same": "Split-Same", "tog-same": "Tog-Same",
    "split-opp": "Split-Opp", "tog-opp": "Tog-Opp",
    "quarter-same": "Quarter-Same", "quarter-opp": "Quarter-Opp",
  };

  // Format turn pattern for TKA display: "uniform-0t" → "0T", "uniform-1t" → "1T"
  function formatTurnForTKA(turn: string): string {
    const m = turn.match(/^uniform[- ](\d+)t$/i);
    if (m) return `${m[1]}T`;
    // Already clean (e.g. "0T", "1:1") - capitalize
    return turn.replace(/^(\d+)t$/i, "$1T");
  }

  // TKA designation: mechanical properties from deck fields
  // e.g. "Halved Rotated 0T Continuous Diamond"
  const tkaDesignation = $derived.by(() => {
    if (!selectedDeck) return "";
    const parts: string[] = [];
    if (selectedDeck.sliceType) parts.push(capitalize(selectedDeck.sliceType));
    // VTG decks are always rotated LOOPs - use that when loopType is missing
    const loopType = selectedDeck.loopType || (selectedDeck.collection === "VTG" ? "rotated" : "");
    if (loopType) parts.push(capitalize(loopType));
    if (selectedDeck.stepCount) parts.push(`${selectedDeck.stepCount}-Step`);
    if (selectedDeck.turnPattern) parts.push(formatTurnForTKA(selectedDeck.turnPattern));
    if (selectedDeck.reversalPattern) parts.push(capitalize(selectedDeck.reversalPattern));
    if (selectedDeck.gridMode) parts.push(capitalize(selectedDeck.gridMode));
    return parts.join(" ") || selectedDeck.canonicalName || selectedDeck.name;
  });

  // VTG designation: family name + ratio
  // e.g. "VTG Tog-Same 1:1"
  const vtgDesignation = $derived.by(() => {
    if (!selectedDeck || !resolvedVtgFamilyId) return "";
    const label = VTG_FAMILY_LABELS[resolvedVtgFamilyId] ?? resolvedVtgFamilyId;
    const turn = selectedDeck.turnPattern;
    if (turn) {
      const uniformMatch = turn.match(/^uniform[- ](\d+)t$/i);
      if (uniformMatch) {
        const turns = parseInt(uniformMatch[1] ?? "0", 10);
        const ratio = TURNS_TO_RATIO[turns];
        if (ratio) return `VTG ${label} ${ratio}`;
      }
      if (/^\d+:\d+$/.test(turn)) return `VTG ${label} ${turn}`;
    }
    return `VTG ${label}`;
  });

  function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // VTG deck label for card footer (e.g. "QS 1:1")
  // Icon replaces the "VTG" prefix - just abbreviation + ratio
  const deckLeftLabel = $derived.by(() => {
    if (!selectedDeck || !resolvedVtgFamilyId) return undefined;
    const abbr = VTG_ABBREVIATIONS[resolvedVtgFamilyId];
    if (!abbr) return undefined;
    // Parse turn pattern into VTG ratio format
    const turn = selectedDeck.turnPattern;
    if (turn) {
      // Already in ratio format (e.g. "1:1")
      if (/^\d+:\d+$/.test(turn)) return `${abbr} ${turn}`;
      // VTG uniform format (e.g. "uniform-0t" = 0 turns → ratio "1:1")
      const uniformMatch = turn.match(/^uniform[- ](\d+)t$/i);
      if (uniformMatch) {
        const turns = parseInt(uniformMatch[1] ?? "0", 10);
        const ratio = TURNS_TO_RATIO[turns] ?? `${turns}t`;
        return `${abbr} ${ratio}`;
      }
    }
    return abbr;
  });

  /**
   * Per-sequence VTG label for deck cards. Calculates the actual VTG mode
   * for each sequence's first step so cards show their correct family
   * (e.g. "TS 1:1") instead of the uniform deck-level label.
   */
  function getSequenceLeftLabel(seq: SequenceData): string | undefined {
    if (!resolvedVtgFamilyId) return undefined; // Only for VTG decks

    // Get first step's letter and start position
    const firstStep = seq.steps?.[0];
    if (!firstStep?.letter || !firstStep?.startPosition) return deckLeftLabel ?? undefined;

    // Get grid mode from sequence or deck
    const gm = (seq.gridMode ?? selectedDeck?.gridMode) === "box" ? GridMode.BOX : GridMode.DIAMOND;

    // Calculate VTG for this specific sequence
    const result = calculateVTG(firstStep.letter as Letter, gm, firstStep.startPosition as GridPosition);
    if (!result.vtgMode) return deckLeftLabel ?? undefined;

    // VTGMode enum values are already the abbreviations ("SS", "SO", etc.)
    const abbr = result.vtgMode;

    // Append ratio from deck turn pattern
    const turn = selectedDeck?.turnPattern;
    if (turn) {
      if (/^\d+:\d+$/.test(turn)) return `${abbr} ${turn}`;
      const uniformMatch = turn.match(/^uniform[- ](\d+)t$/i);
      if (uniformMatch) {
        const turns = parseInt(uniformMatch[1] ?? "0", 10);
        const ratio = TURNS_TO_RATIO[turns] ?? `${turns}t`;
        return `${abbr} ${ratio}`;
      }
    }
    return abbr;
  }

  // ── Level 2: Deck Interior State ──

  let interiorFilters = $state({ familyIds: [] as string[], position: null as string | null });
  let interiorFiltersOpen = $state(false);
  let selectedTypeCombo = $state<TypeComboGroup | null>(null);

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

  interface TypeComboGroup {
    typeCombo: string;
    displayLabel: string;
    familyIds: string[];
    count: number;
  }

  const typeComboGroups = $derived.by((): TypeComboGroup[] => {
    if (!selectedDeck || !isLargeDeck) return [];

    const groups = new Map<string, TypeComboGroup>();

    for (const family of selectedDeck.families) {
      const key = family.typeCombo || family.label;
      const existing = groups.get(key);
      if (existing) {
        existing.familyIds.push(family.id);
        existing.count += family.sequenceIds.length;
      } else {
        groups.set(key, {
          typeCombo: key,
          displayLabel: family.label || family.typeCombo,
          familyIds: [family.id],
          count: family.sequenceIds.length,
        });
      }
    }

    return [...groups.values()].sort((a, b) => b.count - a.count);
  });

  function resetToPicker() {
    selectedTypeCombo = null;
    interiorFilters = { familyIds: [], position: null };
    interiorFiltersOpen = false;
    if (selectedDeckId) saveTypeCombo(selectedDeckId, null);
    if (isLargeDeck) onLoadFamilySequences([]);
  }

  // Persist type combo selection per deck
  function saveTypeCombo(deckId: string, combo: TypeComboGroup | null) {
    if (typeof window === 'undefined') return;
    if (combo) {
      localStorage.setItem(`choreoCard.typeCombo.${deckId}`, combo.typeCombo);
    } else {
      localStorage.removeItem(`choreoCard.typeCombo.${deckId}`);
    }
  }

  function loadSavedTypeCombo(deckId: string): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(`choreoCard.typeCombo.${deckId}`);
  }

  // Reset interior filters when deck changes, but restore saved type combo
  $effect(() => {
    if (selectedDeckId) {
      interiorFiltersOpen = false;

      const savedKey = loadSavedTypeCombo(selectedDeckId);
      if (savedKey && typeComboGroups.length > 0) {
        const match = typeComboGroups.find(g => g.typeCombo === savedKey);
        if (match) {
          selectedTypeCombo = match;
          interiorFilters = { familyIds: match.familyIds, position: null };
          onLoadFamilySequences(match.familyIds);
          return;
        }
      }

      selectedTypeCombo = null;
      interiorFilters = { familyIds: [], position: null };
    }
  });

  function formatCount(n: number): string {
    if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`;
    if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`;
    return n.toLocaleString();
  }
</script>

<div class="deck-browser" bind:this={scrollContainer} onscroll={handleBrowseScroll}>
  {#if selectedDeck}
    <div class="level-container level-interior">
      <div class="top-bar">
        <nav class="breadcrumb" aria-label="Deck navigation">
          <button
            class="crumb"
            type="button"
            aria-label={isLargeDeck && selectedTypeCombo ? 'Back to type combos' : 'Back to browser'}
            onclick={() => {
              if (isLargeDeck && selectedTypeCombo) {
                resetToPicker();
              } else {
                onBackToCollections();
              }
            }}
          >
            <i class="fas fa-arrow-left" aria-hidden="true" style="margin-right:6px;font-size:12px;"></i>
            Back
          </button>
          <span class="crumb-sep" aria-hidden="true">›</span>
          {#if isLargeDeck && selectedTypeCombo}
            <button class="crumb" type="button" onclick={resetToPicker} aria-label="Back to type combos">
              {tkaDesignation}
            </button>
            <span class="crumb-sep" aria-hidden="true">›</span>
            <span class="crumb current">
              <MotionTypePills label={selectedTypeCombo.displayLabel} fontSize="13px" />
            </span>
          {:else}
            <span class="crumb current">{tkaDesignation}</span>
          {/if}
          {#if vtgDesignation}
            <span class="crumb-sep" aria-hidden="true">·</span>
            <span class="crumb vtg-label">{vtgDesignation}</span>
          {/if}
        </nav>
      </div>
      {@render deckInterior()}
    </div>
  {:else if isLoading || decks.length === 0}
    <div class="skeleton-grid deck-skeleton" role="status" aria-live="polite" aria-label="Loading decks">
      {#each { length: 8 } as _}
        <div class="skeleton-card deck-card-skeleton"></div>
      {/each}
    </div>
  {:else}
    <DeckBrowseFilterBar state={browseState} />
    <DeckBrowseGrid
      groupedDecks={browseState.groupedDecks}
      collection={browseState.collection}
      onSelectDeck={handleBrowseDeckSelect}
    />
  {/if}
</div>

<!-- Shared deck interior content used by both desktop and mobile -->
{#snippet deckInterior()}
  {#if selectedDeck}
    <div class="interior-content">
      <div class="top-bar-actions">
        <div class="view-toggle" role="radiogroup" aria-label="View mode">
          <button
            class="action-chip"
            class:active={viewMode === 'grid'}
            onclick={() => setViewMode('grid')}
            type="button"
            role="radio"
            aria-checked={viewMode === 'grid'}
            aria-label="Grid view"
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
            aria-label="Print view"
          >
            <i class="fas fa-print" aria-hidden="true"></i>
            Print Preview
          </button>
        </div>

        {#if viewMode === 'print'}
          <PrintPreviewToolbar
            {cardSize}
            totalCards={filteredSequences.length}
            {isRendering}
            {isExporting}
            {renderProgress}
            {renderTotal}
            onCardSizeChange={setCardSize}
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
        <div class="skeleton-grid" role="status" aria-live="polite" aria-label="Loading sequences">
          {#each { length: Math.min(selectedDeck?.totalSequences ?? 12, 12) } as _}
            <div class="skeleton-card"></div>
          {/each}
        </div>
      {:else if filteredSequences.length === 0}
        {#if isLargeDeck && interiorFilters.familyIds.length === 0 && typeComboGroups.length > 0}
          <div class="type-combo-picker">
            <p class="picker-heading">
              {formatCount(selectedDeck.totalSequences)} sequences across {typeComboGroups.length}
              type {typeComboGroups.length === 1 ? 'combo' : 'combos'}
            </p>
            <div class="picker-grid">
              {#each typeComboGroups as group (group.typeCombo)}
                <button
                  class="picker-card"
                  type="button"
                  aria-label="Load {group.displayLabel} sequences"
                  onclick={() => {
                    selectedTypeCombo = group;
                    interiorFilters = { ...interiorFilters, familyIds: group.familyIds };
                    onLoadFamilySequences(group.familyIds);
                    if (selectedDeckId) saveTypeCombo(selectedDeckId, group);
                  }}
                >
                  <span class="picker-label"><MotionTypePills label={group.displayLabel} fontSize="12px" /></span>
                  {#if group.count > 0}
                    <span class="picker-count">{group.count}</span>
                  {/if}
                </button>
              {/each}
            </div>
          </div>
        {:else}
          <div class="empty-state" role="status">
            <i class="fas fa-file-alt empty-icon" aria-hidden="true"></i>
            <p class="empty-text">No sequences match these filters</p>
            <button
              class="clear-filters-btn"
              onclick={() => {
                if (isLargeDeck) {
                  resetToPicker();
                } else {
                  interiorFilters = { familyIds: [], position: null };
                }
              }}
              type="button"
              aria-label="Clear filters">Clear filters</button
            >
          </div>
        {/if}
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
            deckMode={true}
            leftLabel={deckLeftLabel}
            getLeftLabel={resolvedVtgFamilyId ? getSequenceLeftLabel : undefined}
            onCardContextMenu={onContextMenu ? (x, y, rerender) => onContextMenu(x, y, rerender) : undefined}
            onCardClick={(seq, frontUrl, rerender) => {
              inspectedFrontImageUrl = frontUrl ?? null;
              inspectedRerender = rerender ?? null;
              inspectedSequence = seq;
            }}
            onPairsReady={(pairs) => { renderedPairs = pairs; }}
          />
        {:else}
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
            deckMode={true}
            displayMode="grid"
            leftLabel={deckLeftLabel}
            getLeftLabel={resolvedVtgFamilyId ? getSequenceLeftLabel : undefined}
            onCardContextMenu={onContextMenu ? (x, y, rerender) => onContextMenu(x, y, rerender) : undefined}
            onCardClick={(seq, frontUrl, rerender) => {
              inspectedFrontImageUrl = frontUrl ?? null;
              inspectedRerender = rerender ?? null;
              inspectedSequence = seq;
            }}
            onPairsReady={(pairs) => { renderedPairs = pairs; }}
          />
        {/if}
      {/if}
    </div>
  {/if}
{/snippet}

{#if inspectedSequence}
  <CardInspectModal
    sequence={inspectedSequence}
    {handPointsVisible}
    {showGrid}
    {showTKA}
    {showWord}
    {includeStartPosition}
    onContextMenu={onContextMenu ? (x, y, _rerender) => {
      onContextMenu(x, y, () => {
        if (inspectedRerender) {
          inspectedRerender().then(newUrl => {
            if (newUrl) inspectedFrontImageUrl = newUrl;
          });
        }
      });
    } : undefined}
    frontImageUrl={inspectedFrontImageUrl}
    onClose={() => { inspectedSequence = null; inspectedFrontImageUrl = null; inspectedRerender = null; }}
  />
{/if}

<style>
  /* ── Type-combo / Print subgroup picker ── */

  .type-combo-picker {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 32px 24px;
  }

  .picker-heading {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    text-align: center;
  }

  .picker-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 10px;
  }

  .picker-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text, #fff);
    font: inherit;
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease;
  }

  .picker-card:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
  }

  .picker-label {
    font-weight: 500;
  }

  .picker-count {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
  }

  /* ── Root ── */

  .deck-browser {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  }

  .interior-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
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
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
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

  .crumb.vtg-label {
    color: var(--theme-accent, #b763cd);
    cursor: default;
    font-weight: 500;
    background: var(--vtg-accent-bg, rgba(183, 99, 205, 0.1));
    border-color: var(--vtg-accent-border, rgba(183, 99, 205, 0.25));
  }

  /* ── Deck meta line ── */

  .deck-meta-line {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    margin: 0;
  }

  /* ── Deck List (Level 1) ── */

  /* ── Sequence Sections (Level 2) ── */


  /* ── Shared States ── */

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

  }

  .deck-skeleton {
    padding: var(--spacing-lg, 16px);
  }

  .deck-card-skeleton {
    aspect-ratio: 3 / 2;
  }

  .skeleton-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: var(--spacing-lg, 16px);
    padding: var(--spacing-md, 16px) 0;
  }

  .skeleton-card {
    aspect-ratio: 5 / 7;
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
    animation: skeleton-pulse 1.5s ease-in-out infinite;
  }

  @keyframes skeleton-pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.8; }
  }

  @media (prefers-reduced-motion: reduce) {
    .skeleton-card { animation: none; opacity: 0.6; }
  }
</style>
