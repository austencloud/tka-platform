<!--
  CatalogBrowser.svelte - Browse and explore curated sequence catalogs.

  Two modes:
  - Browse: full-width filter bar + grouped grid of all catalogs
  - Catalog interior: filterable sequence grid with family/position chips
-->
<script lang="ts">

import { exportDeckZIP } from "$lib/features/choreo-card/services/print-zip-exporter";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import type { Catalog } from "../domain/models/Catalog";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import CatalogInteriorFilterPanel from "./filters/CatalogInteriorFilterPanel.svelte";
  import CardInspectModal from "./CardInspectModal.svelte";
  import CatalogBrowseFilterBar from "./CatalogBrowseFilterBar.svelte";
  import CatalogBrowseGrid from "./CatalogBrowseGrid.svelte";
  import TnDFamilyDrillDown from "./TnDFamilyDrillDown.svelte";
  import MotionTypePills from "./MotionTypePills.svelte";
  import { createCatalogBrowseState } from "../state/catalog-browse-state.svelte";
  import { setBrowseContext } from "../context/catalog-browse-context";
  import PrintPreviewPages from "./print-preview/PrintPreviewPages.svelte";
  import PrintPreviewToolbar from "./print-preview/PrintPreviewToolbar.svelte";
  import PrintDialog from "./print-preview/PrintDialog.svelte";
  import type { PrintPDFMode } from "../services/print-pdf-exporter";
  import { type CardSizeId } from "../domain/card-sizes";
  import type { CardPair } from "../services/types";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import type { CardFooter } from "../domain/models/DeckRelease";
  import {
    resolveTnDFamilyId as resolveTnDFamily,
    computeTkaDesignation as computeTkaLabel,
    computeTnDDesignation as computeTnDLabel,
    ABBR_TO_FAMILY_ID,
    parseDeckTurnRatio,
    computeTnDCardFooter,
  } from "../domain/catalog-tnd-labels";
  import { getTnDElement } from "../domain/tnd-element";
  import { calculateTnD } from "$lib/shared/pictograph/shared/domain/utils/tnd-calculator";
  import { GridMode, GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
  import { seedReversalPattern, type SeedProgress } from "../services/reversal-seed-service";
  import type { ResolvedReversalPattern } from "../domain/reversal-transform";

  interface Props {
    catalogs: Catalog[];
    selectedCatalogId: string | null;
    catalogSequences: SequenceData[];
    isLoading: boolean;
    includeStartPosition?: boolean;
    onBackToCollections: () => void;
    onSelectCatalog: (catalogId: string, tndFamily?: string | null) => void;
    onSelectSequence: (sequence: SequenceData) => void;
    onLoadFamilySequences: (familyIds: string[]) => void;
    onContextMenu?: (x: number, y: number, rerender: () => void) => void;
    /** TnD family ID from drilldown context (e.g. "split-same") for footer labels */
    tndFamilyId?: string | null;
  }

  let {
    catalogs,
    selectedCatalogId,
    catalogSequences,
    isLoading,
    includeStartPosition = true,
    onBackToCollections,
    onSelectCatalog,
    onSelectSequence,
    onLoadFamilySequences,
    onContextMenu,
    tndFamilyId: tndFamilyId,
  }: Props = $props();

  const browseState = createCatalogBrowseState(() => catalogs);
  setBrowseContext(browseState);

  let scrollContainer: HTMLDivElement | null = $state(null);
  let activeTnDFamilyId = $state<string | null>(null);
  const tndCatalogs = $derived(catalogs.filter(c => c.collection === 'TnD'));

  // ── Reversal pattern (By Family) ─────────────────────────────────────────
  let activeReversal = $state<ResolvedReversalPattern | null>(null);
  let isSeeding = $state(false);
  let seedProgress = $state<SeedProgress>({ written: 0, total: 0 });
  let seedError = $state("");

  const tndMaterializedCatalogs = $derived(
    tndCatalogs.filter((c) => c.asymmetric !== true),
  );
  let seedingFamilyId = $state<string | null>(null);

  const activeFamilySequenceTotal = $derived(
    browseState.filteredCatalogs
      .filter((c) => c.asymmetric !== true)
      .reduce(
        (sum, c) =>
          sum +
          TND_FAMILY_KEYS.reduce(
            (s, key) => s + ((c.families ?? []).find((f) => f.id === key)?.sequenceIds.length ?? 0),
            0,
          ),
        0,
      ),
  );

  const needsSeed = $derived(
    activeReversal?.isCleanLoop === true &&
      activeReversal.id !== "continuous" &&
      activeFamilySequenceTotal === 0,
  );

  function handlePatternChange(resolved: ResolvedReversalPattern) {
    activeReversal = resolved;
    seedError = "";
    if (!resolved.isCleanLoop) return;
    browseState.setReversalPattern(resolved.id);
  }

  async function handleSelectFamily(familyId: string) {
    if (needsSeed && activeReversal && !isSeeding) {
      isSeeding = true;
      seedingFamilyId = familyId;
      seedError = "";
      try {
        await seedReversalPattern(tndMaterializedCatalogs, activeReversal, (p) => { seedProgress = p; });
        const { loadCatalogs } = await import("../services/catalog-loader");
        await loadCatalogs();
        toast.success("Pattern seeded.");
      } catch (err) {
        seedError = `Seed failed: ${err instanceof Error ? err.message : err}`;
        toast.error("Seeding failed.");
        isSeeding = false;
        seedingFamilyId = null;
        seedProgress = { written: 0, total: 0 };
        return;
      }
      isSeeding = false;
      seedingFamilyId = null;
      seedProgress = { written: 0, total: 0 };
    }
    activeTnDFamilyId = familyId;
  }

  function handleBrowseCatalogSelect(catalog: Catalog) {
    onSelectCatalog(catalog.id, null);
  }

  function handleBrowseScroll() {
    if (scrollContainer && !selectedCatalogId) {
      browseState.setScrollY(scrollContainer.scrollTop);
    }
  }

  $effect(() => {
    if (scrollContainer && !selectedCatalogId && browseState.scrollY > 0) {
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

  let selectedTheme = $derived(settingsService.settings.backgroundType ?? 'cosmic');
  let showPrintDialog = $state(false);
  let isExporting = $state(false);
  let exportProgress = $state(0);
  let exportTotal = $state(0);
  let exportError = $state("");
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
      const { exportHomePrintPDF } = await import(
        "$lib/features/choreo-card/services/print-pdf-exporter"
      );
      const catalogName = selectedCatalog?.name ?? "catalog";
      const safeName = catalogName.replace(/[^a-zA-Z0-9]/g, "_");
      const suffix = mode === "fronts" ? "_fronts" : mode === "backs" ? "_backs" : "_print";
      const blob = await exportHomePrintPDF(renderedPairs, catalogName, cardSize, (current, total) => {
        exportProgress = current;
        exportTotal = total;
      }, mode);
      triggerDownload(blob, `${safeName}${suffix}.pdf`);
    } catch (err) {
      exportError = `PDF export failed: ${err instanceof Error ? err.message : err}`;
      toast.error("PDF export failed. Try re-rendering cards first.");
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
      const catalogName = selectedCatalog?.name ?? "catalog";
      const safeName = catalogName.replace(/[^a-zA-Z0-9]/g, "_");
      const blob = await exportDeckZIP(renderedPairs, catalogName, (current, total) => {
        exportProgress = current;
        exportTotal = total;
      });
      triggerDownload(blob, `${safeName}_cards.zip`);
    } catch (err) {
      exportError = `ZIP export failed: ${err instanceof Error ? err.message : err}`;
      toast.error("ZIP export failed. Try re-rendering cards first.");
    } finally {
      isExporting = false;
      exportProgress = 0;
      exportTotal = 0;
    }
  }

  // TnD category abbreviation lookup
  const TND_ABBREVIATIONS: Record<string, string> = {
    "split-same": "SS", "tog-same": "TS",
    "split-opp": "SO", "tog-opp": "TO",
    "quarter-same": "QS", "quarter-opp": "QO",
  };

  // TnD turn value → ratio string (0 turns = "1:1", 1 turn = "3:1", etc.)
  const TURNS_TO_RATIO: Record<number, string> = {
    0: "1:1", 0.5: "2:1", 1: "3:1", 1.5: "4:1", 2: "5:1", 2.5: "6:1", 3: "7:1",
  };

  // Derived catalog/family lookups
  let selectedCatalog = $derived(catalogs.find((d) => d.id === selectedCatalogId) ?? null);

  // All known TnD family keys for scanning catalog data
  const TND_FAMILY_KEYS = Object.keys(TND_ABBREVIATIONS);

  // Resolve TnD family ID from drilldown context, localStorage, or catalog data
  const resolvedTnDFamilyId = $derived.by(() => {
    // 1. Drilldown context (set during navigation)
    if (tndFamilyId) return tndFamilyId;
    // 2. Catalog's loopType matches a TnD family directly
    if (selectedCatalog && TND_ABBREVIATIONS[selectedCatalog.loopType]) return selectedCatalog.loopType;
    // 3. For TnD catalogs, infer from family IDs (e.g. family.id contains "quarter-same")
    if (selectedCatalog?.collection === "TnD") {
      for (const key of TND_FAMILY_KEYS) {
        if (selectedCatalog.families.some((f) => f.id.toLowerCase().includes(key))) {
          return key;
        }
      }
    }
    return undefined;
  });

  const tndElement = $derived(resolvedTnDFamilyId ? getTnDElement(resolvedTnDFamilyId) : null);

  // Human-readable TnD family names for breadcrumbs
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

  // TKA designation: mechanical properties from catalog fields
  // e.g. "Halved Rotated 0T Continuous Diamond"
  const tkaDesignation = $derived.by(() => {
    if (!selectedCatalog) return "";
    const parts: string[] = [];
    if (selectedCatalog.sliceType) parts.push(capitalize(selectedCatalog.sliceType));
    // TnD catalogs are always rotated LOOPs - use that when loopType is missing
    const loopType = selectedCatalog.loopType || (selectedCatalog.collection === "TnD" ? "rotated" : "");
    if (loopType) parts.push(capitalize(loopType));
    if (selectedCatalog.stepCount) parts.push(`${selectedCatalog.stepCount}-Step`);
    if (selectedCatalog.turnPattern) parts.push(formatTurnForTKA(selectedCatalog.turnPattern));
    if (selectedCatalog.reversalPattern) parts.push(capitalize(selectedCatalog.reversalPattern));
    if (selectedCatalog.gridMode) parts.push(capitalize(selectedCatalog.gridMode));
    return parts.join(" ") || selectedCatalog.canonicalName || selectedCatalog.name;
  });

  // TnD turn-pair title for breadcrumb — uses blue/red turn terminology
  const tndTurnTitle = $derived.by(() => {
    if (!selectedCatalog || selectedCatalog.collection !== "TnD") return "";
    const turn = selectedCatalog.turnPattern;
    if (!turn) return "TnD Motions";
    const uniformMatch = turn.match(/^uniform[- ](\d+(?:\.\d+)?)t$/i);
    if (uniformMatch) return `TnD ${uniformMatch[1]}T (Symmetric)`;
    const pipeMatch = turn.match(/^(\d+(?:\.\d+)?)\|(\d+(?:\.\d+)?)$/);
    if (pipeMatch) return `TnD Blue ${pipeMatch[1]} | Red ${pipeMatch[2]}`;
    return `TnD ${turn}`;
  });

  // TnD designation: family name + ratio — only shown when a single family is relevant
  const tndDesignation = $derived.by(() => {
    if (!selectedCatalog || !resolvedTnDFamilyId) return "";
    // Don't show single-family badge when catalog has all 6 families
    if (selectedCatalog.families.length >= 6) return "";
    const label = VTG_FAMILY_LABELS[resolvedTnDFamilyId] ?? resolvedTnDFamilyId;
    const turn = selectedCatalog.turnPattern;
    if (turn) {
      const uniformMatch = turn.match(/^uniform[- ](\d+)t$/i);
      if (uniformMatch) {
        const turns = parseInt(uniformMatch[1] ?? "0", 10);
        const ratio = TURNS_TO_RATIO[turns];
        if (ratio) return `TnD ${label} ${ratio}`;
      }
      if (/^\d+:\d+$/.test(turn)) return `TnD ${label} ${turn}`;
    }
    return `TnD ${label}`;
  });

  function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }


  function resolveSequenceTnDFooter(seq: SequenceData): CardFooter | undefined {
    if (!resolvedTnDFamilyId || !selectedCatalog) return undefined;
    const turnRatio = parseDeckTurnRatio(selectedCatalog.turnPattern);

    const firstStep = seq.steps?.[0];
    if (!firstStep?.letter || !firstStep?.startPosition) {
      return computeTnDCardFooter(resolvedTnDFamilyId, turnRatio);
    }

    const gm = (seq.gridMode ?? selectedCatalog.gridMode) === "box" ? GridMode.BOX : GridMode.DIAMOND;
    const result = calculateTnD(firstStep.letter as Letter, gm, firstStep.startPosition as GridPosition);
    if (!result.tndMode) {
      return computeTnDCardFooter(resolvedTnDFamilyId, turnRatio);
    }

    const familyId = ABBR_TO_FAMILY_ID[result.tndMode] ?? resolvedTnDFamilyId;
    return computeTnDCardFooter(familyId, turnRatio);
  }

  // ── Level 2: Catalog Interior State ──

  let interiorFilters = $state({ familyIds: [] as string[], position: null as string | null });
  let interiorFiltersOpen = $state(false);
  let selectedTypeCombo = $state<TypeComboGroup | null>(null);

  const filteredSequences = $derived.by(() => {
    let seqs = catalogSequences;
    if (interiorFilters.familyIds.length > 0 && selectedCatalog) {
      const allowedIds = new Set(
        selectedCatalog.families
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

  const isLargeCatalog = $derived(selectedCatalog ? selectedCatalog.totalSequences >= 500 : false);

  const sequenceFooters = $derived<CardFooter[]>(
    filteredSequences.map(seq => resolveSequenceTnDFooter(seq) ?? { center: "The Kinetic Alphabet" })
  );

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

  function groupByFamily(seqs: SequenceData[], catalog: Catalog): SequenceGroup[] {
    const seqMap = new Map(seqs.map((s) => [s.id, s]));
    return catalog.families
      .map((f) => ({
        label: f.label || f.typeCombo,
        sequences: f.sequenceIds
          .map((id) => seqMap.get(id))
          .filter((s): s is SequenceData => s !== undefined),
      }))
      .filter((g) => g.sequences.length > 0);
  }

  const sequenceGroups = $derived.by((): SequenceGroup[] => {
    if (!selectedCatalog || filteredSequences.length === 0) return [];
    if (interiorFilters.familyIds.length > 0) {
      return groupByStartPosition(filteredSequences);
    }
    return groupByFamily(filteredSequences, selectedCatalog);
  });

  interface TypeComboGroup {
    typeCombo: string;
    displayLabel: string;
    familyIds: string[];
    count: number;
  }

  const typeComboGroups = $derived.by((): TypeComboGroup[] => {
    if (!selectedCatalog || !isLargeCatalog) return [];

    const groups = new Map<string, TypeComboGroup>();

    for (const family of selectedCatalog.families) {
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
    if (selectedCatalogId) saveTypeCombo(selectedCatalogId, null);
    if (isLargeCatalog) onLoadFamilySequences([]);
  }

  // Persist type combo selection per catalog
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

  // Reset interior filters when catalog changes, but restore saved type combo
  $effect(() => {
    if (selectedCatalogId) {
      interiorFiltersOpen = false;

      const savedKey = loadSavedTypeCombo(selectedCatalogId);
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

<div class="catalog-browser" bind:this={scrollContainer} onscroll={handleBrowseScroll}>
  {#if selectedCatalog}
    <div class="level-container level-interior">
      <div class="top-bar">
        <nav class="breadcrumb" aria-label="Catalog navigation">
          <button
            class="crumb"
            type="button"
            aria-label={isLargeCatalog && selectedTypeCombo ? 'Back to type combos' : 'Back to browser'}
            onclick={() => {
              if (isLargeCatalog && selectedTypeCombo) {
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
          {#if isLargeCatalog && selectedTypeCombo}
            <button class="crumb" type="button" onclick={resetToPicker} aria-label="Back to type combos">
              {selectedCatalog?.collection === 'TnD' && tndTurnTitle ? tndTurnTitle : tkaDesignation}
            </button>
            <span class="crumb-sep" aria-hidden="true">›</span>
            <span class="crumb current">
              <MotionTypePills label={selectedTypeCombo.displayLabel} fontSize="13px" />
            </span>
          {:else}
            <span class="crumb current">{selectedCatalog?.collection === 'TnD' && tndTurnTitle ? tndTurnTitle : tkaDesignation}</span>
          {/if}
          {#if tndDesignation}
            <span class="crumb-sep" aria-hidden="true">·</span>
            <span class="crumb tnd-label">{tndDesignation}</span>
          {/if}
        </nav>
      </div>
      {@render deckInterior()}
    </div>
  {:else if activeTnDFamilyId}
    <div class="level-container level-interior">
      <TnDFamilyDrillDown
        familyId={activeTnDFamilyId}
        catalogs={browseState.filteredCatalogs}
        {includeStartPosition}
        onSelectSequence={onSelectSequence}
        onContextMenu={onContextMenu}
        onBack={() => { activeTnDFamilyId = null; }}
      />
    </div>
  {:else if isLoading || catalogs.length === 0}
    <div class="skeleton-grid catalog-skeleton" role="status" aria-live="polite" aria-label="Loading catalogs">
      {#each { length: 8 } as _}
        <div class="skeleton-card catalog-card-skeleton"></div>
      {/each}
    </div>
  {:else}
    <CatalogBrowseFilterBar state={browseState} />
    <CatalogBrowseGrid
      groupedCatalogs={browseState.groupedCatalogs}
      collection={browseState.collection}
      tndViewMode={browseState.tndViewMode}
      allTnDCatalogs={browseState.collection === 'TnD' ? browseState.filteredCatalogs : []}
      onSelectCatalog={handleBrowseCatalogSelect}
      onSelectFamily={handleSelectFamily}
      activePatternId={activeReversal?.id ?? null}
      onPatternChange={handlePatternChange}
      {needsSeed}
      {isSeeding}
      {seedingFamilyId}
      {seedProgress}
    />
  {/if}
</div>

<!-- Shared catalog interior content used by both desktop and mobile -->
{#snippet deckInterior()}
  {#if selectedCatalog}
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
            {renderProgress}
            {renderTotal}
            onCardSizeChange={setCardSize}
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

      <p class="catalog-meta-line">
        {formatCount(selectedCatalog.totalSequences)} sequences across {selectedCatalog.families.length}
        {selectedCatalog.families.length === 1 ? "family" : "families"}{selectedCatalog.collection !== 'TnD' ? ` · ${selectedCatalog.gridMode} grid` : ''}
      </p>

      <CatalogInteriorFilterPanel
        isOpen={interiorFiltersOpen}
        families={selectedCatalog.families}
        selectedFamilyIds={interiorFilters.familyIds}
        activePosition={interiorFilters.position}
        onFamilyChange={(ids) => {
          interiorFilters = { ...interiorFilters, familyIds: ids };
          if (isLargeCatalog && ids.length > 0) {
            onLoadFamilySequences(ids);
          }
        }}
        onPositionChange={(pos) => {
          interiorFilters = { ...interiorFilters, position: pos };
        }}
      />

      {#if isLoading}
        <div class="skeleton-grid" role="status" aria-live="polite" aria-label="Loading sequences">
          {#each { length: Math.min(selectedCatalog?.totalSequences ?? 12, 12) } as _}
            <div class="skeleton-card"></div>
          {/each}
        </div>
      {:else if filteredSequences.length === 0}
        {#if isLargeCatalog && interiorFilters.familyIds.length === 0 && typeComboGroups.length > 0}
          <div class="type-combo-picker">
            <p class="picker-heading">
              {formatCount(selectedCatalog.totalSequences)} sequences across {typeComboGroups.length}
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
                    if (selectedCatalogId) saveTypeCombo(selectedCatalogId, group);
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
                if (isLargeCatalog) {
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
            tndElement={tndElement ?? undefined}
            {rerenderKey}
            isLoading={false}
            {includeStartPosition}
            deckMode={true}
            footers={sequenceFooters}
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
            tndElement={tndElement ?? undefined}
            {rerenderKey}
            isLoading={false}
            {includeStartPosition}
            deckMode={true}
            displayMode="grid"
            footers={sequenceFooters}
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

{#if showPrintDialog && selectedCatalog}
  <PrintDialog
    title="Print {selectedCatalog.name}"
    subtitle="{filteredSequences.length} sequences"
    cardCount={filteredSequences.length}
    {cardSize}
    theme={selectedTheme}
    {isExporting}
    exportProgress={exportProgress}
    exportTotal={exportTotal}
    exportError={exportError}
    onExportPDF={handleExportPDF}
    onExportZIP={handleExportZIP}
    onCardSizeChange={setCardSize}
    onClose={() => { if (!isExporting) showPrintDialog = false; }}
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

  .catalog-browser {
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

  .catalog-browser::-webkit-scrollbar { width: 8px; }
  .catalog-browser::-webkit-scrollbar-track { background: var(--scrollbar-track, transparent); }
  .catalog-browser::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2)); border-radius: 4px; }
  .catalog-browser::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-thumb-hover, rgba(255, 255, 255, 0.35)); }

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

  .crumb.tnd-label {
    color: var(--theme-accent, #b763cd);
    cursor: default;
    font-weight: 500;
    background: var(--tnd-accent-bg, rgba(183, 99, 205, 0.1));
    border-color: var(--tnd-accent-border, rgba(183, 99, 205, 0.25));
  }

  /* ── Catalog meta line ── */

  .catalog-meta-line {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    margin: 0;
  }

  /* ── Catalog List (Level 1) ── */

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

  .catalog-skeleton {
    padding: var(--spacing-lg, 16px);
  }

  .catalog-card-skeleton {
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

  /* ── Reversal seed empty-state ── */
</style>
