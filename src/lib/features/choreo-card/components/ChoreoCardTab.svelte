<!--
  ChoreoCardTab.svelte - Page-based choreo card viewer

  Main container for browsing and filtering sequence choreography cards.
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { container } from "$lib/shared/di";
  import { openSequenceViewer } from "$lib/shared/sequence-viewer/services/implementations/SequenceViewerNavigator";
  import { onMount } from "svelte";
  import type { IBrowseLoader } from "../../browse/sequences/display/services/contracts/IBrowseLoader";
  import type { PrintPreviewPage } from "../domain/types/PageLayoutTypes";
  import { SequenceDifficultyCalculator } from "../../browse/sequences/display/services/implementations/SequenceDifficultyCalculator";
  import ChoreoCardNavigation from "./Navigation.svelte";
  import ChoreoCardFilters from "./ChoreoCardFilters.svelte";
  import ChoreoCardExport from "./ChoreoCardExport.svelte";
  import PageDisplay from "./PageDisplay.svelte";
  import type { Deck } from "../domain/models/Deck";
  import type { IDeckLoader } from "../services/contracts/IDeckLoader";
  import DeckBrowser from "./DeckBrowser.svelte";
  import CardDesigner from "./CardDesigner.svelte";
  import CardPreviewTab from "./card-preview/CardPreviewTab.svelte";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import ContextMenu from "$lib/shared/components/context-menu/ContextMenu.svelte";
  import type { ContextMenuState, ContextMenuEntry } from "$lib/shared/components/context-menu/context-menu-types";
  import { buildChoreoCardContextMenuItems } from "./context-menu/CardDesignerContextMenuBuilder";
  import CardSettingsModal from "./CardSettingsModal.svelte";

  // Level calculator for dynamic level badge calculation
  const levelCalculator = new SequenceDifficultyCalculator();

  // Services
  let loaderService = $state<IBrowseLoader | null>(null);

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
  const STORAGE_KEY_SELECTED_COLLECTION = "choreoCard.selectedCollection";

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
  let cardSettingsOpen = $state(false);

  function openCardContextMenu(x: number, y: number, rerender: () => void) {
    activeCardRerender = rerender;
    contextMenuState = { open: true, x, y };
  }

  function closeCardContextMenu() {
    contextMenuState = { open: false };
  }

  const contextMenuItems: ContextMenuEntry[] = $derived(
    buildChoreoCardContextMenuItems({
      onOpenSettings: () => {
        closeCardContextMenu();
        cardSettingsOpen = true;
      },
      onRerender: activeCardRerender,
    })
  );

  // Mode state - synced with global navigation
  type ChoreoCardMode = "card-preview" | "decks" | "designer";
  let mode = $state<ChoreoCardMode>("card-preview");

  // Sync with navigation state (sidebar tab selection)
  $effect(() => {
    const navTab = navigationState.activeTab;
    if (navTab === "card-preview" || navTab === "decks" || navTab === "designer") {
      const newMode = navTab as ChoreoCardMode;
      if (newMode !== mode) {
        mode = newMode;
        if (newMode !== "designer" && decks.length === 0) {
          loadDecks();
        }
      }
    }
  });

  // Deck state
  let decks = $state<Deck[]>([]);
  let selectedDeckId = $state<string | null>(getPersistedString(STORAGE_KEY_SELECTED_DECK));
  let selectedCollection = $state<string | null>(getPersistedString(STORAGE_KEY_SELECTED_COLLECTION));
  let selectedVtgFamily = $state<string | null>(null);
  let vtgActiveView = $state<"family" | "ratio" | "reversal">("family");
  let deckSequences = $state<SequenceData[]>([]);
  let isDeckLoading = $state(false);

  // ── Browser history (back/forward) for deck navigation ──

  // Prevents re-pushing state when we're already restoring from a popstate event.
  let isRestoringFromHistory = false;

  interface DeckNavState {
    collection: string | null;
    deckId: string | null;
    vtgFamily: string | null;
    vtgView: "family" | "ratio" | "reversal";
  }

  function buildCurrentNavState(): DeckNavState {
    return {
      collection: selectedCollection,
      deckId: selectedDeckId,
      vtgFamily: selectedVtgFamily,
      vtgView: vtgActiveView,
    };
  }

  function encodeNavHash(state: DeckNavState): string {
    const params = new URLSearchParams();
    if (state.collection) params.set("col", state.collection);
    if (state.deckId) params.set("deck", state.deckId);
    if (state.vtgFamily) params.set("vtgFamily", state.vtgFamily);
    if (state.vtgView !== "family") params.set("vtgView", state.vtgView);
    const str = params.toString();
    return str ? `deck-nav:${str}` : "";
  }

  function decodeNavHash(hash: string): DeckNavState | null {
    if (!hash.startsWith("#deck-nav:")) return null;
    try {
      const params = new URLSearchParams(hash.slice("#deck-nav:".length));
      return {
        collection: params.get("col"),
        deckId: params.get("deck"),
        vtgFamily: params.get("vtgFamily"),
        vtgView: (params.get("vtgView") as "family" | "ratio" | "reversal") || "family",
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
    history.pushState(state, "", url.toString());
  }

  async function restoreNavState(state: DeckNavState) {
    isRestoringFromHistory = true;
    try {
      // Restore collection & deck
      selectedCollection = state.collection;
      selectedDeckId = state.deckId;
      selectedVtgFamily = state.vtgFamily;
      vtgActiveView = state.vtgView;
      deckSequences = [];

      persist(STORAGE_KEY_SELECTED_COLLECTION, state.collection);
      persist(STORAGE_KEY_SELECTED_DECK, state.deckId);

      // If a deck was selected, load its sequences
      if (state.deckId) {
        if (decks.length === 0) await loadDecks();
        await handleSelectDeckSequences(state.deckId);
      } else if (state.collection && decks.length === 0) {
        await loadDecks();
      }
    } finally {
      isRestoringFromHistory = false;
    }
  }

  $effect(() => {
    function handlePopState(event: PopStateEvent) {
      const state = event.state as DeckNavState | null;
      if (state && "collection" in state) {
        void restoreNavState(state);
      } else {
        // No state object (e.g. initial page load entry) — go to root
        void restoreNavState({ collection: null, deckId: null, vtgFamily: null, vtgView: "family" });
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
          ? levelCalculator.calculateDifficultyLevel([...seq.steps])
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
        : `Loading ${selectedLength}-beat sequences...`;
    }

    if (pages.length === 1 && pages[0]?.isEmpty) {
      return selectedLength === 0
        ? "No sequences found"
        : `No ${selectedLength}-beat sequences`;
    }

    const pageCount = pages.length;
    const seqCount = filteredSequences.length;
    const lengthLabel =
      selectedLength === 0 ? "all lengths" : `${selectedLength}-beat`;
    return `${seqCount} sequence${seqCount !== 1 ? "s" : ""} (${lengthLabel}) · ${pageCount} page${pageCount !== 1 ? "s" : ""}`;
  });

  onMount(async () => {
    loaderService = container.items.browseLoader;
    await loadSequences();

    // Check if the URL hash encodes a saved nav state (e.g. from a page refresh).
    // If so, it takes priority over localStorage so the user lands back where they were.
    const hashState = decodeNavHash(window.location.hash);
    if (hashState) {
      isRestoringFromHistory = true;
      selectedCollection = hashState.collection;
      selectedDeckId = hashState.deckId;
      selectedVtgFamily = hashState.vtgFamily;
      vtgActiveView = hashState.vtgView;
      persist(STORAGE_KEY_SELECTED_COLLECTION, hashState.collection);
      persist(STORAGE_KEY_SELECTED_DECK, hashState.deckId);
      isRestoringFromHistory = false;
    }

    // Seed the history stack with the current state so popstate works on first Back.
    // replaceState (not pushState) keeps the current URL entry intact.
    const initialState = buildCurrentNavState();
    const url = new URL(window.location.href);
    url.hash = encodeNavHash(initialState);
    history.replaceState(initialState, "", url.toString());

    // Load decks if needed to restore UI
    if (selectedDeckId || selectedCollection) {
      if (decks.length === 0) {
        await loadDecks();
      }
      if (selectedDeckId) {
        await handleSelectDeckSequences(selectedDeckId);
      }
    }
  });

  async function loadSequences() {
    if (!loaderService) return;

    try {
      isLoading = true;
      error = null;
      sequences = await loaderService.loadSequenceMetadata();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load sequences";
      console.error("ChoreoCard: Failed to load sequences:", err);
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

  async function loadDecks() {
    const deckLoader = container.items.deckLoader as IDeckLoader;
    try {
      isDeckLoading = true;
      decks = await deckLoader.loadDecks();
    } catch (err) {
      console.error("Failed to load decks:", err);
    } finally {
      isDeckLoading = false;
    }
  }

  function handleSelectCollection(collectionId: string) {
    selectedCollection = collectionId;
    persist(STORAGE_KEY_SELECTED_COLLECTION, collectionId);
    pushNavState();
  }

  function handleBackToCollections() {
    selectedCollection = null;
    selectedDeckId = null;
    selectedVtgFamily = null;
    vtgActiveView = "family";
    deckSequences = [];
    persist(STORAGE_KEY_SELECTED_COLLECTION, null);
    persist(STORAGE_KEY_SELECTED_DECK, null);
    pushNavState();
  }

  // Loads sequences for a deck without touching selectedDeckId or nav state.
  // Used both by handleSelectDeck and restoreNavState.
  async function handleSelectDeckSequences(deckId: string) {
    const deckLoader = container.items.deckLoader as IDeckLoader;
    const deck = decks.find((d) => d.id === deckId);
    if (!deck) return;

    isDeckLoading = true;
    try {
      if (deck.totalSequences < 500) {
        deckSequences = await deckLoader.loadDeckSequences(deckId);
      } else {
        // Large deck: load first family only
        const firstFamily = deck.families[0];
        if (firstFamily) {
          deckSequences = await deckLoader.loadSequencesByIds(deckId, [...firstFamily.sequenceIds]);
        }
      }
    } catch (err) {
      console.error("Failed to load deck sequences:", err);
    } finally {
      isDeckLoading = false;
    }
  }

  async function handleSelectDeck(deckId: string) {
    selectedDeckId = deckId;
    deckSequences = [];
    persist(STORAGE_KEY_SELECTED_DECK, deckId);
    pushNavState();
    await handleSelectDeckSequences(deckId);
  }

  function handleBackToDeckList() {
    selectedDeckId = null;
    deckSequences = [];
    persist(STORAGE_KEY_SELECTED_DECK, null);
    pushNavState();
  }

  function handleSelectVtgFamily(familyId: string | null) {
    selectedVtgFamily = familyId;
    pushNavState();
  }

  function handleVtgViewChange(view: "family" | "ratio" | "reversal") {
    vtgActiveView = view;
    // View changes within VTG don't push new history entries to avoid polluting
    // the back stack with every tab switch. We only push on structural navigation.
  }

  async function handleLoadFamilySequences(familyIds: string[]) {
    const deck = decks.find((d) => d.id === selectedDeckId);
    if (!deck || !selectedDeckId) return;

    const deckLoader = container.items.deckLoader as IDeckLoader;
    isDeckLoading = true;
    try {
      const seqIds = deck.families
        .filter((f) => familyIds.includes(f.id))
        .flatMap((f) => [...f.sequenceIds]);
      deckSequences = await deckLoader.loadSequencesByIds(selectedDeckId, seqIds);
    } catch (err) {
      console.error("Failed to load family sequences:", err);
    } finally {
      isDeckLoading = false;
    }
  }



</script>

<div class="choreo-card-tab">
  <!-- Main content -->
  <div class="main-content">
    {#if mode === "card-preview"}
      <main class="content-area">
        <CardPreviewTab {decks} />
      </main>
    {:else if mode === "decks"}
      <main class="content-area">
        <DeckBrowser
          {decks}
          {selectedDeckId}
          {selectedCollection}
          {selectedVtgFamily}
          {vtgActiveView}
          {deckSequences}
          isLoading={isDeckLoading}
          {handPointsVisible}
          {showGrid}
          {showTKA}
          {showWord}
          {includeStartPosition}
          onSelectCollection={handleSelectCollection}
          onBackToCollections={handleBackToCollections}
          onSelectDeck={handleSelectDeck}
          onBackToDeckList={handleBackToDeckList}
          onSelectVtgFamily={handleSelectVtgFamily}
          onVtgViewChange={handleVtgViewChange}
          onSelectSequence={handleSelectSequence}
          onLoadFamilySequences={handleLoadFamilySequences}
          onContextMenu={openCardContextMenu}
        />
      </main>
    {:else if mode === "designer"}
      <!-- Card Designer: full-width, no sidebar -->
      <main class="content-area">
        <CardDesigner {sequences} {isLoading} />
      </main>
    {/if}
  </div>
</div>

<!-- Context menu for right-click on any choreo card thumbnail -->
<ContextMenu menuState={contextMenuState} items={contextMenuItems} onClose={closeCardContextMenu} />
<CardSettingsModal bind:open={cardSettingsOpen} sequence={filteredSequences[0] ?? null} />

<style>
  .choreo-card-tab {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: transparent;
  }

  /* Status bar */
  .status-bar {
    flex-shrink: 0;
    padding: var(--spacing-sm) var(--spacing-md);
  }

  .status {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  /* Main Content */
  .main-content {
    flex: 1;
    display: flex;
    min-height: 0;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
  }

  .sidebar {
    width: 280px;
    flex-shrink: 0;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-lg, 12px);
    overflow: hidden;
  }

  .sidebar-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
    padding: var(--spacing-md);
    gap: var(--spacing-md);
  }

  .sidebar-content::-webkit-scrollbar {
    width: 6px;
  }

  .sidebar-content::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
  }

  .sidebar-content::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 3px;
  }

  .filter-divider {
    height: 1px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    margin: var(--spacing-xs) 0;
  }

  .content-area {
    flex: 1;
    min-width: 0;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-lg, 12px);
    overflow: hidden;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .status {
      font-size: var(--font-size-compact, 12px);
    }

    .main-content {
      flex-direction: column;
      gap: var(--spacing-sm);
      padding: var(--spacing-sm);
    }

    .sidebar {
      width: 100%;
      max-height: 200px;
    }

    .sidebar-content {
      flex-direction: row;
      overflow-x: auto;
      overflow-y: hidden;
      padding: var(--spacing-sm);
      gap: var(--spacing-sm);
    }

    .filter-divider {
      width: 1px;
      height: auto;
      min-height: 40px;
      margin: 0 var(--spacing-xs);
    }
  }
</style>
