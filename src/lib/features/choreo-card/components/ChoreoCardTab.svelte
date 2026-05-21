<!--
  ChoreoCardTab.svelte - Page-based choreo card viewer

  Main container for browsing and filtering sequence choreography cards.
-->
<script lang="ts">

import { getCachedDecks, loadDecks as deckLoaderLoadDecks, loadDeckSequences, loadSequencesByIds } from "$lib/features/choreo-card/services/deck-loader";
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
  import type { Deck } from "../domain/models/Deck";
  import type { ThumbnailRenderOrchestrator } from "$lib/shared/browse/services/ThumbnailRenderOrchestrator";
  import DeckBrowser from "./DeckBrowser.svelte";
  import CardDesigner from "./CardDesigner.svelte";
  import ScanActivityTab from "./scan-activity/ScanActivityTab.svelte";
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
  const STORAGE_KEY_SELECTED_DECK = "choreoCard.selectedDeckId";
  const STORAGE_KEY_VTG_FAMILY = "choreoCard.vtgFamily";

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
  type ChoreoCardMode = "decks" | "designer" | "scan-activity";
  let mode = $state<ChoreoCardMode>("decks");

  let browseSequencesLoaded = false;

  // Sync with navigation state (sidebar tab selection)
  $effect(() => {
    const navTab = navigationState.activeTab;
    if (navTab === "decks" || navTab === "designer" || navTab === "scan-activity") {
      const newMode = navTab as ChoreoCardMode;
      if (newMode !== mode) {
        mode = newMode;
        if (newMode !== "designer" && decks.length === 0) {
          loadDecks();
        }
        // Lazy-load browse sequences when user first enters a mode that needs them
        if (newMode !== "decks" && !browseSequencesLoaded && loaderService) {
          browseSequencesLoaded = true;
          loadSequences();
        }
      }
    }
  });

  // Deck state — seed deck metadata from localStorage so first render skips "Loading deck..." spinner.
  // Cached decks have sequenceIds stripped (too large for localStorage) — enough to show the
  // deck shell (name, breadcrumbs, family labels) while Firestore loads full data + sequences.
  const _initDecks = getCachedDecks();
  const _initDeckId = getPersistedString(STORAGE_KEY_SELECTED_DECK);
  let decks = $state<Deck[]>(_initDecks ?? []);
  let selectedDeckId = $state<string | null>(_initDeckId);
  let selectedVtgFamily = $state<string | null>(getPersistedString(STORAGE_KEY_VTG_FAMILY));
  let deckSequences = $state<SequenceData[]>([]);
  // Start in loading state if we have a saved deck — sequences must come from Firestore
  let isDeckLoading = $state(!!_initDeckId);
  let deckErrorMessage = $state<string | null>(null);

  // In-memory cache of loaded deck sequences so returning to a previously-visited
  // deck is instant instead of refetching from Firestore and showing a loading skeleton.
  const deckSequenceCache = new Map<string, SequenceData[]>();

  // ── Browser history (back/forward) for deck navigation ──

  // Prevents re-pushing state when we're already restoring from a popstate event.
  let isRestoringFromHistory = false;

  interface DeckNavState {
    deckId: string | null;
    vtgFamily: string | null;
  }

  function buildCurrentNavState(): DeckNavState {
    return {
      deckId: selectedDeckId,
      vtgFamily: selectedVtgFamily,
    };
  }

  function encodeNavHash(state: DeckNavState): string {
    const params = new URLSearchParams();
    if (state.deckId) params.set("deck", state.deckId);
    if (state.vtgFamily) params.set("vtgFamily", state.vtgFamily);
    const str = params.toString();
    return str ? `deck-nav:${str}` : "";
  }

  function decodeNavHash(hash: string): DeckNavState | null {
    if (!hash.startsWith("#deck-nav:")) return null;
    try {
      const params = new URLSearchParams(hash.slice("#deck-nav:".length));
      return {
        deckId: params.get("deck"),
        vtgFamily: params.get("vtgFamily"),
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
    pushState(url.toString(), { deckNavId: state.deckId, deckNavVtgFamily: state.vtgFamily });
  }

  async function restoreNavState(state: DeckNavState) {
    isRestoringFromHistory = true;
    try {
      selectedDeckId = state.deckId;
      selectedVtgFamily = state.vtgFamily;
      persist(STORAGE_KEY_SELECTED_DECK, state.deckId);
      if (state.deckId) {
        const cached = deckSequenceCache.get(state.deckId);
        if (cached) {
          deckSequences = cached;
          isDeckLoading = false;
        } else {
          deckSequences = [];
          if (decks.length === 0) await loadDecks();
          await handleSelectDeckSequences(state.deckId);
        }
      } else {
        deckSequences = [];
      }
    } finally {
      isRestoringFromHistory = false;
    }
  }

  $effect(() => {
    function handlePopState(event: PopStateEvent) {
      const raw = event.state as Record<string, unknown> | null;
      if (raw && "deckNavId" in raw) {
        void restoreNavState({
          deckId: (raw.deckNavId as string) ?? null,
          vtgFamily: (raw.deckNavVtgFamily as string) ?? null,
        });
      } else {
        void restoreNavState({ deckId: null, vtgFamily: null });
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

    // Defer browse sequence loading — only needed for designer/export modes, not decks
    if (mode !== "decks") {
      loadSequences();
    }

    const hashState = decodeNavHash(window.location.hash);
    if (hashState) {
      isRestoringFromHistory = true;
      selectedDeckId = hashState.deckId;
      selectedVtgFamily = hashState.vtgFamily;
      persist(STORAGE_KEY_SELECTED_DECK, hashState.deckId);
      isRestoringFromHistory = false;
    }

    const initialState = buildCurrentNavState();
    const url = new URL(window.location.href);
    url.hash = encodeNavHash(initialState);
    replaceState(url.toString(), { deckNavId: initialState.deckId, deckNavVtgFamily: initialState.vtgFamily });

    // Load deck metadata first, then sequences for the selected deck.
    // Cached (trimmed) decks are already in state for instant shell render.
    await loadDecks();
    if (selectedDeckId) {
      await handleSelectDeckSequences(selectedDeckId);
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

  let isLoadingDeckMetadata = $state(false);

  async function loadDecks() {
    try {
      isLoadingDeckMetadata = true;
      deckErrorMessage = null;
      decks = await deckLoaderLoadDecks();
      if (selectedDeckId && !decks.some((d) => d.id === selectedDeckId)) {
        selectedDeckId = null;
        deckSequences = [];
        persist(STORAGE_KEY_SELECTED_DECK, null);
      }
    } catch (err) {
      console.warn("Failed to load decks:", err);
      deckErrorMessage = "Failed to load decks. Check your connection and try again.";
    } finally {
      isLoadingDeckMetadata = false;
    }
  }

  function handleBackToCollections() {
    (getThumbnailRenderOrchestrator() as ThumbnailRenderOrchestrator)?.cancelAll();
    selectedDeckId = null;
    selectedVtgFamily = null;
    deckSequences = [];
    persist(STORAGE_KEY_SELECTED_DECK, null);
    persist(STORAGE_KEY_VTG_FAMILY, null);
    pushNavState();
  }

  function filterContinuousReversals(seqs: SequenceData[], deck: Deck | undefined): SequenceData[] {
    if (!deck || deck.reversalPattern !== "continuous") return seqs;
    return seqs.filter((seq) => !seq.steps.some((s) => s.blueReversal || s.redReversal));
  }

  async function handleSelectDeckSequences(deckId: string) {
    isDeckLoading = true;
    deckErrorMessage = null;
    try {
      const deck = decks.find((d) => d.id === deckId);
      if (deck && deck.totalSequences < 500) {
        deckSequences = filterContinuousReversals(await loadDeckSequences(deckId), deck);
      } else {
        deckSequences = [];
      }
      if (deckSequences.length > 0) {
        deckSequenceCache.set(deckId, deckSequences);
      }
    } catch (err) {
      console.warn("Failed to load deck sequences:", err);
      deckErrorMessage = "Failed to load sequences for this deck. Try again.";
    } finally {
      isDeckLoading = false;
    }
  }

  async function handleSelectDeck(deckId: string, vtgFamily?: string | null) {
    (getThumbnailRenderOrchestrator() as ThumbnailRenderOrchestrator)?.cancelAll();
    selectedDeckId = deckId;
    selectedVtgFamily = vtgFamily ?? null;
    persist(STORAGE_KEY_SELECTED_DECK, deckId);
    persist(STORAGE_KEY_VTG_FAMILY, vtgFamily ?? null);
    pushNavState();

    const cached = deckSequenceCache.get(deckId);
    if (cached) {
      deckSequences = cached;
      isDeckLoading = false;
      return;
    }

    deckSequences = [];
    await handleSelectDeckSequences(deckId);
  }

  function handleBackToDeckList() {
    (getThumbnailRenderOrchestrator() as ThumbnailRenderOrchestrator)?.cancelAll();
    selectedDeckId = null;
    deckSequences = [];
    persist(STORAGE_KEY_SELECTED_DECK, null);
    pushNavState();
  }

  async function handleLoadFamilySequences(familyIds: string[]) {
    const deck = decks.find((d) => d.id === selectedDeckId);
    if (!deck || !selectedDeckId) return;

    if (familyIds.length === 0) {
      deckSequences = [];
      return;
    }

    isDeckLoading = true;
    try {
      const seqIds = deck.families
        .filter((f) => familyIds.includes(f.id))
        .flatMap((f) => [...f.sequenceIds]);
      if (seqIds.length > 0) {
        deckSequences = filterContinuousReversals(await loadSequencesByIds(selectedDeckId, seqIds), deck);
      } else {
        deckSequences = filterContinuousReversals(await loadDeckSequences(selectedDeckId), deck);
      }
      if (deckSequences.length > 0) {
        deckSequenceCache.set(selectedDeckId, deckSequences);
      }
    } catch (err) {
      console.warn("Failed to load family sequences:", err);
    } finally {
      isDeckLoading = false;
    }
  }



</script>

<div class="choreo-card-tab">
  <!-- Main content -->
  <div class="main-content">
    {#if deckErrorMessage}
      <div class="error-banner" role="alert">
        <span>{deckErrorMessage}</span>
        <button type="button" onclick={() => { deckErrorMessage = null; loadDecks(); }}>Retry</button>
      </div>
    {/if}
    {#if mode === "decks"}
      <main class="content-area">
        <DeckBrowser
          {decks}
          {selectedDeckId}
          {deckSequences}
          isLoading={isDeckLoading || (isLoadingDeckMetadata && decks.length === 0)}
          {handPointsVisible}
          {showGrid}
          {showTKA}
          {showWord}
          {includeStartPosition}
          vtgFamilyId={selectedVtgFamily}
          onBackToCollections={handleBackToCollections}
          onSelectDeck={handleSelectDeck}
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
