<!--
  ChoreoCardTab.svelte - Page-based choreo card viewer

  Main container for browsing and filtering sequence choreography cards.
-->
<script lang="ts">

import { getCachedCatalogs, loadCatalogs as fetchCatalogs, loadCatalogSequences, loadSequencesByIds } from "$lib/features/choreo-card/services/catalog-loader";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { getBrowseLoader } from "$lib/shared/browse/getBrowseLoader";
  import { getThumbnailRenderOrchestrator } from "$lib/shared/browse/getThumbnailRenderOrchestrator";
  import { openSequenceViewer } from "$lib/shared/sequence-viewer/services/implementations/SequenceViewerNavigator";
  import { pushState, replaceState } from "$app/navigation";
  import { onMount, onDestroy } from "svelte";
  import type { PublicSequencesLoader } from "$lib/shared/browse/services/PublicSequencesLoader";
  import type { PrintPreviewPage } from "../domain/types/PageLayoutTypes";
  import { calculateDifficultyLevel as calculateSequenceDifficultyLevel } from "$lib/shared/browse/services/sequence-difficulty-calculator";
  import ChoreoCardNavigation from "./Navigation.svelte";
  import ChoreoCardFilters from "./ChoreoCardFilters.svelte";
  import ChoreoCardExport from "./ChoreoCardExport.svelte";
  import PageDisplay from "./PageDisplay.svelte";
  import type { Catalog } from "../domain/models/Catalog";
  import type { ThumbnailRenderOrchestrator } from "$lib/shared/browse/services/ThumbnailRenderOrchestrator";
  import CatalogBrowser from "./CatalogBrowser.svelte";
  import CardDesigner from "./CardDesigner.svelte";
  import ScanActivityTab from "./scan-activity/ScanActivityTab.svelte";
  import CardBackThemeLab from "./card-back/CardBackThemeLab.svelte";
  import DeckReleaserTab from "./deck-releaser/DeckReleaserTab.svelte";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import ContextMenu from "$lib/shared/components/context-menu/ContextMenu.svelte";
  import type { ContextMenuState, ContextMenuEntry } from "$lib/shared/components/context-menu/context-menu-types";
  import { buildChoreoCardContextMenuItems } from "$lib/shared/choreo-card/services/CardDesignerContextMenuBuilder";


  // Services
  let loaderService = $state<PublicSequencesLoader | null>(null);

  // Storage keys (migrated from wordCard.* to choreoCard.*)
  const STORAGE_KEY_LENGTH = "choreoCard.selectedLength";
  const STORAGE_KEY_COLUMNS = "choreoCard.columnCount";
  const STORAGE_KEY_LEVEL = "choreoCard.difficulty";
  const STORAGE_KEY_FAVORITES = "choreoCard.favorites";
  const STORAGE_KEY_GRID_MODE = "choreoCard.gridMode";
  const STORAGE_KEY_AUTHOR = "choreoCard.author";
  const STORAGE_KEY_SHOW_QR = "choreoCard.showQRCodes";
  const STORAGE_KEY_HAND_POINTS = "choreoCard.handPointsVisible";
  const STORAGE_KEY_SHOW_GRID = "choreoCard.showGrid";
  const STORAGE_KEY_SHOW_TKA = "choreoCard.showTKA";
  const STORAGE_KEY_SHOW_WORD = "choreoCard.showWord";
  const STORAGE_KEY_INCLUDE_START_POS = "choreoCard.includeStartPosition";
  const STORAGE_KEY_SELECTED_CATALOG = "choreoCard.selectedCatalogId";
  const STORAGE_KEY_TND_FAMILY = "choreoCard.tndFamily";

  // Legacy keys for migration
  const LEGACY_KEYS: Record<string, string> = {
    "wordCard.selectedLength": STORAGE_KEY_LENGTH,
    "wordCard.columnCount": STORAGE_KEY_COLUMNS,
    "wordCard.difficulty": STORAGE_KEY_LEVEL,
    "wordCard.favorites": STORAGE_KEY_FAVORITES,
    "wordCard.gridMode": STORAGE_KEY_GRID_MODE,
    "wordCard.author": STORAGE_KEY_AUTHOR,
    "wordCard.showQRCodes": STORAGE_KEY_SHOW_QR,
    "wordCard.handPointsVisible": STORAGE_KEY_HAND_POINTS,
    "wordCard.showGrid": STORAGE_KEY_SHOW_GRID,
    "wordCard.showTKA": STORAGE_KEY_SHOW_TKA,
    "wordCard.showWord": STORAGE_KEY_SHOW_WORD,
    "wordCard.includeStartPosition": STORAGE_KEY_INCLUDE_START_POS,
  };

  // Migrate legacy keys on load
  function migrateStorageKeys() {
    if (typeof window === "undefined") return;
    for (const [oldKey, newKey] of Object.entries(LEGACY_KEYS)) {
      const oldValue = localStorage.getItem(oldKey);
      if (oldValue !== null && localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, oldValue);
        localStorage.removeItem(oldKey);
      }
    }
  }

  // Load persisted state or use defaults
  function getPersistedNumber(key: string, defaultValue: number): number {
    if (typeof window === "undefined") return defaultValue;
    const stored = localStorage.getItem(key);
    return stored ? parseInt(stored, 10) : defaultValue;
  }

  function getPersistedBoolean(key: string, defaultValue: boolean): boolean {
    if (typeof window === "undefined") return defaultValue;
    const stored = localStorage.getItem(key);
    if (stored === null) return defaultValue;
    return stored === "true";
  }

  function getPersistedString(key: string): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(key);
  }

  function getPersistedNullableNumber(key: string): number | null {
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    const num = parseInt(stored, 10);
    return isNaN(num) ? null : num;
  }

  function persist(key: string, value: string | null) {
    if (typeof window === "undefined") return;
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  }

  // Run migration before reading state
  migrateStorageKeys();

  // State
  let sequences: SequenceData[] = $state([]);
  let isLoading = $state(false);
  let selectedLength = $state(getPersistedNumber(STORAGE_KEY_LENGTH, 16));
  let columnCount = $state(getPersistedNumber(STORAGE_KEY_COLUMNS, 3));
  let error = $state<string | null>(null);

  // Filter state
  let level = $state<number | null>(getPersistedNullableNumber(STORAGE_KEY_LEVEL));
  let favorites = $state<boolean>(getPersistedBoolean(STORAGE_KEY_FAVORITES, false));
  let gridMode = $state<string | null>(getPersistedString(STORAGE_KEY_GRID_MODE));
  let author = $state<string | null>(getPersistedString(STORAGE_KEY_AUTHOR));
  let showQRCodes = $state<boolean>(getPersistedBoolean(STORAGE_KEY_SHOW_QR, true));

  // Visibility state (local to choreo cards, defaults match global settings but can be overridden)
  let handPointsVisible = $state<boolean>(getPersistedBoolean(STORAGE_KEY_HAND_POINTS, true));
  let showGrid = $state<boolean>(getPersistedBoolean(STORAGE_KEY_SHOW_GRID, true));
  let showTKA = $state<boolean>(getPersistedBoolean(STORAGE_KEY_SHOW_TKA, true));
  let showWord = $state<boolean>(getPersistedBoolean(STORAGE_KEY_SHOW_WORD, true));
  let includeStartPosition = $state<boolean>(getPersistedBoolean(STORAGE_KEY_INCLUDE_START_POS, true));

  // Context menu for right-click on any choreo card thumbnail.
  // Stores the rerender callback from the specific card that was right-clicked.
  let contextMenuState: ContextMenuState = $state({ open: false });
  let activeCardRerender: (() => void) | undefined = $state(undefined);

  function openCardContextMenu(x: number, y: number, rerender: () => void) {
    activeCardRerender = rerender;
    contextMenuState = { open: true, x, y };
  }

  function closeCardContextMenu() {
    contextMenuState = { open: false };
  }

  const contextMenuItems: ContextMenuEntry[] = $derived(
    buildChoreoCardContextMenuItems({
      onRerender: activeCardRerender,
    })
  );

  // Mode state - synced with global navigation
  type ChoreoCardMode = "catalogs" | "designer" | "scan-activity" | "theme-lab" | "releaser";
  let mode = $state<ChoreoCardMode>("catalogs");

  let browseSequencesLoaded = false;

  // Sync with navigation state (sidebar tab selection)
  $effect(() => {
    const navTab = navigationState.activeTab;
    if (navTab === "catalogs" || navTab === "designer" || navTab === "scan-activity" || navTab === "theme-lab" || navTab === "releaser") {
      const newMode = navTab as ChoreoCardMode;
      if (newMode !== mode) {
        mode = newMode;
        if (newMode !== "designer" && catalogs.length === 0) {
          loadCatalogMetadata();
        }
        // Lazy-load browse sequences when user first enters a mode that needs them
        if (newMode !== "catalogs" && !browseSequencesLoaded && loaderService) {
          browseSequencesLoaded = true;
          loadSequences();
        }
      }
    }
  });

  // Catalog state — seed catalog metadata from localStorage so first render skips "Loading catalog..." spinner.
  // Cached catalogs have sequenceIds stripped (too large for localStorage) — enough to show the
  // catalog shell (name, breadcrumbs, family labels) while Firestore loads full data + sequences.
  const _initCatalogs = getCachedCatalogs();
  const _initDeckId = getPersistedString(STORAGE_KEY_SELECTED_CATALOG);
  let catalogs = $state<Catalog[]>(_initCatalogs ?? []);
  let selectedCatalogId = $state<string | null>(_initDeckId);
  let selectedTnDFamily = $state<string | null>(getPersistedString(STORAGE_KEY_TND_FAMILY));
  let catalogSequences = $state<SequenceData[]>([]);
  // Start in loading state if we have a saved catalog — sequences must come from Firestore
  let isCatalogLoading = $state(!!_initDeckId);
  let catalogErrorMessage = $state<string | null>(null);

  // In-memory cache of loaded catalog sequences so returning to a previously-visited
  // catalog is instant instead of refetching from Firestore and showing a loading skeleton.
  const catalogSequenceCache = new Map<string, SequenceData[]>();

  // ── Browser history (back/forward) for catalog navigation ──

  // Prevents re-pushing state when we're already restoring from a popstate event.
  let isRestoringFromHistory = false;

  interface CatalogNavState {
    catalogId: string | null;
    tndFamily: string | null;
  }

  function buildCurrentNavState(): CatalogNavState {
    return {
      catalogId: selectedCatalogId,
      tndFamily: selectedTnDFamily,
    };
  }

  function encodeNavHash(state: CatalogNavState): string {
    const params = new URLSearchParams();
    if (state.catalogId) params.set("catalog", state.catalogId);
    if (state.tndFamily) params.set("tndFamily", state.tndFamily);
    const str = params.toString();
    return str ? `catalog-nav:${str}` : "";
  }

  function decodeNavHash(hash: string): CatalogNavState | null {
    if (!hash.startsWith("#catalog-nav:")) return null;
    try {
      const params = new URLSearchParams(hash.slice("#catalog-nav:".length));
      return {
        catalogId: params.get("catalog"),
        tndFamily: params.get("tndFamily"),
      };
    } catch {
      return null;
    }
  }

  function pushNavState() {
    if (isRestoringFromHistory) return;
    const state = buildCurrentNavState();
    const url = new URL(window.location.href);
    const encoded = encodeNavHash(state);
    url.hash = encoded;
    pushState(url.toString(), { catalogNavId: state.catalogId, catalogNavTnDFamily: state.tndFamily });
  }

  async function restoreNavState(state: CatalogNavState) {
    isRestoringFromHistory = true;
    try {
      selectedCatalogId = state.catalogId;
      selectedTnDFamily = state.tndFamily;
      persist(STORAGE_KEY_SELECTED_CATALOG, state.catalogId);
      if (state.catalogId) {
        const cached = catalogSequenceCache.get(state.catalogId);
        if (cached) {
          catalogSequences = cached;
          isCatalogLoading = false;
        } else {
          catalogSequences = [];
          if (catalogs.length === 0) await loadCatalogMetadata();
          await handleSelectCatalogSequences(state.catalogId);
        }
      } else {
        catalogSequences = [];
      }
    } finally {
      isRestoringFromHistory = false;
    }
  }

  $effect(() => {
    function handlePopState(event: PopStateEvent) {
      const raw = event.state as Record<string, unknown> | null;
      if (raw && "catalogNavId" in raw) {
        void restoreNavState({
          catalogId: (raw.catalogNavId as string) ?? null,
          tndFamily: (raw.catalogNavTnDFamily as string) ?? null,
        });
      } else {
        void restoreNavState({ catalogId: null, tndFamily: null });
      }
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  });

  // Derive unique authors from loaded sequences
  let authors = $derived(
    [...new Set(sequences.map((s) => s.author).filter((a): a is string => Boolean(a)))].sort()
  );

  // Filtered sequences based on all filters
  let filteredSequences = $derived.by(() => {
    let result = sequences;

    // Beat length filter
    if (selectedLength !== 0) {
      result = result.filter((seq) => seq.sequenceLength === selectedLength);
    }

    // Level badge filter - uses numeric level (1-5)
    if (level !== null) {
      result = result.filter((seq) => {
        const seqLevel = seq.level ?? (seq.steps?.length > 0
          ? calculateSequenceDifficultyLevel([...seq.steps])
          : undefined);
        return seqLevel === level;
      });
    }

    // Favorites filter
    if (favorites) {
      result = result.filter((seq) => seq.isFavorite);
    }

    // Grid mode filter
    if (gridMode !== null) {
      result = result.filter((seq) => seq.gridMode === gridMode);
    }

    // Author filter
    if (author !== null) {
      result = result.filter((seq) => seq.author === author);
    }

    return result;
  });

  // Estimate sequences per page based on beat length
  // Shorter sequences = more rows fit, longer = fewer rows
  function getSequencesPerPage(stepCount: number): number {
    // 2 columns, rows depend on sequence height
    if (stepCount <= 3) return 10; // 5 rows
    if (stepCount <= 4) return 8; // 4 rows
    if (stepCount <= 8) return 6; // 3 rows
    return 6; // 3 rows for 10-16 steps (tight spacing)
  }

  // Create pages from filtered sequences (dynamic per page based on beat length)
  let pages = $derived.by((): PrintPreviewPage[] => {
    if (filteredSequences.length === 0) {
      return [{ id: "empty", sequences: [], isEmpty: true }];
    }

    // When "All" is selected, use a conservative estimate
    const sequencesPerPage =
      selectedLength === 0 ? 6 : getSequencesPerPage(selectedLength);

    const result: PrintPreviewPage[] = [];

    for (let i = 0; i < filteredSequences.length; i += sequencesPerPage) {
      result.push({
        id: `page-${Math.floor(i / sequencesPerPage) + 1}`,
        sequences: filteredSequences.slice(i, i + sequencesPerPage),
        isEmpty: false,
      });
    }

    return result;
  });

  // Status message
  let statusMessage = $derived.by(() => {
    if (isLoading) {
      return selectedLength === 0
        ? "Loading all sequences..."
        : `Loading ${selectedLength}-step sequences...`;
    }

    if (pages.length === 1 && pages[0]?.isEmpty) {
      return selectedLength === 0
        ? "No sequences found"
        : `No ${selectedLength}-step sequences`;
    }

    const pageCount = pages.length;
    const seqCount = filteredSequences.length;
    const lengthLabel =
      selectedLength === 0 ? "all lengths" : `${selectedLength}-step`;
    return `${seqCount} sequence${seqCount !== 1 ? "s" : ""} (${lengthLabel}) · ${pageCount} page${pageCount !== 1 ? "s" : ""}`;
  });

  onMount(async () => {
    loaderService = getBrowseLoader();

    // Defer browse sequence loading — only needed for designer/export modes, not catalogs
    if (mode !== "catalogs") {
      loadSequences();
    }

    const hashState = decodeNavHash(window.location.hash);
    if (hashState) {
      isRestoringFromHistory = true;
      selectedCatalogId = hashState.catalogId;
      selectedTnDFamily = hashState.tndFamily;
      persist(STORAGE_KEY_SELECTED_CATALOG, hashState.catalogId);
      isRestoringFromHistory = false;
    }

    const initialState = buildCurrentNavState();
    const url = new URL(window.location.href);
    url.hash = encodeNavHash(initialState);
    replaceState(url.toString(), { catalogNavId: initialState.catalogId, catalogNavTnDFamily: initialState.tndFamily });

    // Load catalog metadata first, then sequences for the selected catalog.
    // Cached (trimmed) catalogs are already in state for instant shell render.
    await loadCatalogMetadata();
    if (selectedCatalogId) {
      await handleSelectCatalogSequences(selectedCatalogId);
    }
  });

  onDestroy(() => {
    (getThumbnailRenderOrchestrator() as ThumbnailRenderOrchestrator)?.cancelAll();
  });

  async function loadSequences() {
    if (!loaderService) return;

    try {
      isLoading = true;
      error = null;
      sequences = await loaderService.loadSequenceMetadata();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load sequences";
      console.warn("ChoreoCard: Failed to load sequences:", err);
    } finally {
      isLoading = false;
    }
  }

  function handleLengthSelected(length: number) {
    selectedLength = length;
    persist(STORAGE_KEY_LENGTH, String(length));
  }

  function handleColumnCountChanged(count: number) {
    columnCount = count;
    persist(STORAGE_KEY_COLUMNS, String(count));
  }

  // Filter handlers
  function handleLevelChange(value: number | null) {
    level = value;
    persist(STORAGE_KEY_LEVEL, value !== null ? String(value) : null);
  }

  function handleFavoritesChange(value: boolean) {
    favorites = value;
    persist(STORAGE_KEY_FAVORITES, String(value));
  }

  function handleGridModeChange(value: string | null) {
    gridMode = value;
    persist(STORAGE_KEY_GRID_MODE, value);
  }

  function handleAuthorChange(value: string | null) {
    author = value;
    persist(STORAGE_KEY_AUTHOR, value);
  }

  function handleShowQRCodesChange(value: boolean) {
    showQRCodes = value;
    persist(STORAGE_KEY_SHOW_QR, String(value));
  }


  function handleSelectSequence(sequence: SequenceData) {
    openSequenceViewer(sequence, {
      returnPath: "/choreo-cards",
      returnLabel: "Choreo Cards",
    });
  }

  let isLoadingCatalogMetadata = $state(false);

  async function loadCatalogMetadata() {
    try {
      isLoadingCatalogMetadata = true;
      catalogErrorMessage = null;
      catalogs = await fetchCatalogs();
      if (selectedCatalogId && !catalogs.some((d) => d.id === selectedCatalogId)) {
        selectedCatalogId = null;
        catalogSequences = [];
        persist(STORAGE_KEY_SELECTED_CATALOG, null);
      }
    } catch (err) {
      console.warn("Failed to load catalogs:", err);
      catalogErrorMessage = "Failed to load catalogs. Check your connection and try again.";
    } finally {
      isLoadingCatalogMetadata = false;
    }
  }

  function handleBackToCollections() {
    (getThumbnailRenderOrchestrator() as ThumbnailRenderOrchestrator)?.cancelAll();
    selectedCatalogId = null;
    selectedTnDFamily = null;
    catalogSequences = [];
    persist(STORAGE_KEY_SELECTED_CATALOG, null);
    persist(STORAGE_KEY_TND_FAMILY, null);
    pushNavState();
  }

  function filterContinuousReversals(seqs: SequenceData[], catalog: Catalog | undefined): SequenceData[] {
    if (!catalog || catalog.reversalPattern !== "continuous") return seqs;
    return seqs.filter((seq) => !seq.steps.some((s) => s.blueReversal || s.redReversal));
  }

  async function handleSelectCatalogSequences(catalogId: string) {
    isCatalogLoading = true;
    catalogErrorMessage = null;
    try {
      const catalog = catalogs.find((d) => d.id === catalogId);
      if (catalog && catalog.totalSequences < 500) {
        catalogSequences = filterContinuousReversals(await loadCatalogSequences(catalogId), catalog);
      } else {
        catalogSequences = [];
      }
      if (catalogSequences.length > 0) {
        catalogSequenceCache.set(catalogId, catalogSequences);
      }
    } catch (err) {
      console.warn("Failed to load catalog sequences:", err);
      catalogErrorMessage = "Failed to load sequences for this catalog. Try again.";
    } finally {
      isCatalogLoading = false;
    }
  }

  async function handleSelectCatalog(catalogId: string, tndFamily?: string | null) {
    (getThumbnailRenderOrchestrator() as ThumbnailRenderOrchestrator)?.cancelAll();
    selectedCatalogId = catalogId;
    selectedTnDFamily = tndFamily ?? null;
    persist(STORAGE_KEY_SELECTED_CATALOG, catalogId);
    persist(STORAGE_KEY_TND_FAMILY, tndFamily ?? null);
    pushNavState();

    const cached = catalogSequenceCache.get(catalogId);
    if (cached) {
      catalogSequences = cached;
      isCatalogLoading = false;
      return;
    }

    catalogSequences = [];
    await handleSelectCatalogSequences(catalogId);
  }

  function handleBackToCatalogList() {
    (getThumbnailRenderOrchestrator() as ThumbnailRenderOrchestrator)?.cancelAll();
    selectedCatalogId = null;
    catalogSequences = [];
    persist(STORAGE_KEY_SELECTED_CATALOG, null);
    pushNavState();
  }

  async function handleLoadFamilySequences(familyIds: string[]) {
    const catalog = catalogs.find((d) => d.id === selectedCatalogId);
    if (!catalog || !selectedCatalogId) return;

    if (familyIds.length === 0) {
      catalogSequences = [];
      return;
    }

    isCatalogLoading = true;
    try {
      const seqIds = catalog.families
        .filter((f) => familyIds.includes(f.id))
        .flatMap((f) => [...f.sequenceIds]);
      if (seqIds.length > 0) {
        catalogSequences = filterContinuousReversals(await loadSequencesByIds(selectedCatalogId, seqIds), catalog);
      } else {
        catalogSequences = filterContinuousReversals(await loadCatalogSequences(selectedCatalogId), catalog);
      }
      if (catalogSequences.length > 0) {
        catalogSequenceCache.set(selectedCatalogId, catalogSequences);
      }
    } catch (err) {
      console.warn("Failed to load family sequences:", err);
    } finally {
      isCatalogLoading = false;
    }
  }



</script>

<div class="choreo-card-tab">
  <!-- Main content -->
  <div class="main-content">
    {#if catalogErrorMessage}
      <div class="error-banner" role="alert">
        <span>{catalogErrorMessage}</span>
        <button type="button" onclick={() => { catalogErrorMessage = null; loadCatalogMetadata(); }}>Retry</button>
      </div>
    {/if}
    {#if mode === "catalogs"}
      <main class="content-area">
        <CatalogBrowser
          {catalogs}
          {selectedCatalogId}
          {catalogSequences}
          isLoading={isCatalogLoading || (isLoadingCatalogMetadata && catalogs.length === 0)}
          {handPointsVisible}
          {showGrid}
          {showTKA}
          {showWord}
          {includeStartPosition}
          tndFamilyId={selectedTnDFamily}
          onBackToCollections={handleBackToCollections}
          onSelectCatalog={handleSelectCatalog}
          onSelectSequence={handleSelectSequence}
          onLoadFamilySequences={handleLoadFamilySequences}
          onContextMenu={openCardContextMenu}
        />
      </main>
    {:else if mode === "designer"}
      <!-- Card Designer: full-width, no sidebar -->
      <main class="content-area">
        <CardDesigner />
      </main>
    {:else if mode === "scan-activity"}
      <ScanActivityTab />
    {:else if mode === "theme-lab"}
      <main class="content-area">
        <CardBackThemeLab />
      </main>
    {:else if mode === "releaser"}
      <main class="content-area">
        <DeckReleaserTab onContextMenu={openCardContextMenu} />
      </main>
    {/if}
  </div>
</div>

<!-- Context menu for right-click on any choreo card thumbnail -->
<ContextMenu menuState={contextMenuState} items={contextMenuItems} onClose={closeCardContextMenu} />

<style>
  .choreo-card-tab {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: transparent;
  }

  .main-content {
    display: flex;
    flex: 1;
    min-height: 0;
    gap: var(--spacing-md, 16px);
    padding: var(--spacing-md, 16px);
  }

  .content-area {
    flex: 1;
    min-width: 0;
    min-height: 0;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-lg, 12px);
    overflow: auto;
  }

  .error-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-sm, 8px);
    padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
    background: var(--semantic-error-bg, rgba(239, 68, 68, 0.15));
    border: 1px solid var(--semantic-error-border, rgba(239, 68, 68, 0.4));
    border-radius: var(--border-radius-md, 8px);
    color: var(--theme-text, #fff);
    font-size: var(--font-size-sm, 14px);
  }

  .error-banner button {
    padding: 4px 12px;
    border-radius: var(--border-radius-sm, 4px);
    border: 1px solid var(--semantic-error-border, rgba(239, 68, 68, 0.5));
    background: var(--semantic-error-bg, rgba(239, 68, 68, 0.2));
    color: var(--theme-text, #fff);
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    white-space: nowrap;
  }

  .error-banner button:hover {
    background: var(--semantic-error-bg, rgba(239, 68, 68, 0.35));
  }

  /* Responsive */
  @media (max-width: 768px) {
    .main-content {
      flex-direction: column;
      gap: var(--spacing-sm);
      padding: var(--spacing-sm);
    }
  }
</style>
