<!--
  ChoreoCardTab.svelte - Page-based choreo card viewer

  Main container for browsing and filtering sequence choreography cards.
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";
  import type { IExploreLoader } from "../../explore/sequences/display/services/contracts/IExploreLoader";
  import type { PrintPreviewPage } from "../domain/types/PageLayoutTypes";
  import { SequenceDifficultyCalculator } from "../../explore/sequences/display/services/implementations/SequenceDifficultyCalculator";
  import ChoreoCardNavigation from "./Navigation.svelte";
  import ChoreoCardFilters from "./ChoreoCardFilters.svelte";
  import ChoreoCardVisibility from "./ChoreoCardVisibility.svelte";
  import ChoreoCardExport from "./ChoreoCardExport.svelte";
  import PageDisplay from "./PageDisplay.svelte";

  // Difficulty calculator for dynamic level calculation
  const difficultyCalculator = new SequenceDifficultyCalculator();

  // Services
  let loaderService = $state<IExploreLoader | null>(null);

  // Storage keys (migrated from wordCard.* to choreoCard.*)
  const STORAGE_KEY_LENGTH = "choreoCard.selectedLength";
  const STORAGE_KEY_COLUMNS = "choreoCard.columnCount";
  const STORAGE_KEY_DIFFICULTY = "choreoCard.difficulty";
  const STORAGE_KEY_FAVORITES = "choreoCard.favorites";
  const STORAGE_KEY_GRID_MODE = "choreoCard.gridMode";
  const STORAGE_KEY_AUTHOR = "choreoCard.author";
  const STORAGE_KEY_SHOW_QR = "choreoCard.showQRCodes";
  const STORAGE_KEY_HAND_POINTS = "choreoCard.handPointsVisible";
  const STORAGE_KEY_SHOW_GRID = "choreoCard.showGrid";
  const STORAGE_KEY_SHOW_TKA = "choreoCard.showTKA";
  const STORAGE_KEY_SHOW_WORD = "choreoCard.showWord";
  const STORAGE_KEY_INCLUDE_START_POS = "choreoCard.includeStartPosition";

  // Legacy keys for migration
  const LEGACY_KEYS: Record<string, string> = {
    "wordCard.selectedLength": STORAGE_KEY_LENGTH,
    "wordCard.columnCount": STORAGE_KEY_COLUMNS,
    "wordCard.difficulty": STORAGE_KEY_DIFFICULTY,
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

  // Run migration before reading state
  migrateStorageKeys();

  // State
  let sequences: SequenceData[] = $state([]);
  let isLoading = $state(false);
  let selectedLength = $state(getPersistedNumber(STORAGE_KEY_LENGTH, 16));
  let columnCount = $state(getPersistedNumber(STORAGE_KEY_COLUMNS, 3));
  let error = $state<string | null>(null);

  // Filter state
  let difficulty = $state<number | null>(getPersistedNullableNumber(STORAGE_KEY_DIFFICULTY));
  let favorites = $state<boolean>(getPersistedBoolean(STORAGE_KEY_FAVORITES, false));
  let gridMode = $state<string | null>(getPersistedString(STORAGE_KEY_GRID_MODE));
  let author = $state<string | null>(getPersistedString(STORAGE_KEY_AUTHOR));
  let showQRCodes = $state<boolean>(getPersistedBoolean(STORAGE_KEY_SHOW_QR, false));

  // Visibility state (local to choreo cards, defaults match global settings but can be overridden)
  let handPointsVisible = $state<boolean>(getPersistedBoolean(STORAGE_KEY_HAND_POINTS, true));
  let showGrid = $state<boolean>(getPersistedBoolean(STORAGE_KEY_SHOW_GRID, true));
  let showTKA = $state<boolean>(getPersistedBoolean(STORAGE_KEY_SHOW_TKA, true));
  let showWord = $state<boolean>(getPersistedBoolean(STORAGE_KEY_SHOW_WORD, true));
  let includeStartPosition = $state<boolean>(getPersistedBoolean(STORAGE_KEY_INCLUDE_START_POS, true));

  // Derive unique authors from loaded sequences
  let authors = $derived(
    [...new Set(sequences.map((s) => s.author).filter((a): a is string => Boolean(a)))].sort()
  );

  // Persist filter changes
  $effect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_LENGTH, String(selectedLength));
    }
  });

  $effect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_COLUMNS, String(columnCount));
    }
  });

  $effect(() => {
    if (typeof window !== "undefined") {
      if (difficulty !== null) {
        localStorage.setItem(STORAGE_KEY_DIFFICULTY, String(difficulty));
      } else {
        localStorage.removeItem(STORAGE_KEY_DIFFICULTY);
      }
    }
  });

  $effect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_FAVORITES, String(favorites));
    }
  });

  $effect(() => {
    if (typeof window !== "undefined") {
      if (gridMode !== null) {
        localStorage.setItem(STORAGE_KEY_GRID_MODE, gridMode);
      } else {
        localStorage.removeItem(STORAGE_KEY_GRID_MODE);
      }
    }
  });

  $effect(() => {
    if (typeof window !== "undefined") {
      if (author !== null) {
        localStorage.setItem(STORAGE_KEY_AUTHOR, author);
      } else {
        localStorage.removeItem(STORAGE_KEY_AUTHOR);
      }
    }
  });

  $effect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_SHOW_QR, String(showQRCodes));
    }
  });

  // Persist visibility settings
  $effect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_HAND_POINTS, String(handPointsVisible));
    }
  });

  $effect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_SHOW_GRID, String(showGrid));
    }
  });

  $effect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_SHOW_TKA, String(showTKA));
    }
  });

  $effect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_SHOW_WORD, String(showWord));
    }
  });

  $effect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_INCLUDE_START_POS, String(includeStartPosition));
    }
  });

  // Filtered sequences based on all filters
  let filteredSequences = $derived.by(() => {
    let result = sequences;

    // Beat length filter
    if (selectedLength !== 0) {
      result = result.filter((seq) => seq.sequenceLength === selectedLength);
    }

    // Difficulty filter - calculate level dynamically from steps if not stored
    if (difficulty !== null) {
      result = result.filter((seq) => {
        // Use stored level if available, otherwise calculate from steps
        const level = seq.level ?? (seq.steps?.length > 0
          ? difficultyCalculator.calculateDifficultyLevel([...seq.steps])
          : 1);
        return level === difficulty;
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
    loaderService = container.items.exploreLoader;
    await loadSequences();
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
  }

  function handleColumnCountChanged(count: number) {
    columnCount = count;
  }

  // Filter handlers
  function handleDifficultyChange(value: number | null) {
    difficulty = value;
  }

  function handleFavoritesChange(value: boolean) {
    favorites = value;
  }

  function handleGridModeChange(value: string | null) {
    gridMode = value;
  }

  function handleAuthorChange(value: string | null) {
    author = value;
  }

  function handleShowQRCodesChange(value: boolean) {
    showQRCodes = value;
  }

  // Visibility handlers
  function handleHandPointsChange(value: boolean) {
    handPointsVisible = value;
  }

  function handleShowGridChange(value: boolean) {
    showGrid = value;
  }

  function handleShowTKAChange(value: boolean) {
    showTKA = value;
  }

  function handleShowWordChange(value: boolean) {
    showWord = value;
  }

  function handleIncludeStartPositionChange(value: boolean) {
    includeStartPosition = value;
  }
</script>

<div class="choreo-card-tab">
  <!-- Header -->
  <header class="tab-header">
    <div class="header-content">
      <div class="title-row">
        <i class="fas fa-id-card" aria-hidden="true"></i>
        <h1 class="title">Choreo Cards</h1>
      </div>
      <p class="status" role="status" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </p>
    </div>
  </header>

  <!-- Main content -->
  <div class="main-content">
    <!-- Navigation Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-content">
        <ChoreoCardNavigation
          {selectedLength}
          {columnCount}
          onLengthSelected={handleLengthSelected}
          onColumnCountChanged={handleColumnCountChanged}
        />
        <div class="filter-divider"></div>
        <ChoreoCardFilters
          {difficulty}
          {favorites}
          {gridMode}
          {author}
          {authors}
          {showQRCodes}
          onDifficultyChange={handleDifficultyChange}
          onFavoritesChange={handleFavoritesChange}
          onGridModeChange={handleGridModeChange}
          onAuthorChange={handleAuthorChange}
          onShowQRCodesChange={handleShowQRCodesChange}
        />
        <div class="filter-divider"></div>
        <ChoreoCardVisibility
          {handPointsVisible}
          {showGrid}
          {showTKA}
          {showWord}
          {includeStartPosition}
          onHandPointsChange={handleHandPointsChange}
          onShowGridChange={handleShowGridChange}
          onShowTKAChange={handleShowTKAChange}
          onShowWordChange={handleShowWordChange}
          onIncludeStartPositionChange={handleIncludeStartPositionChange}
        />
        <div class="filter-divider"></div>
        <ChoreoCardExport
          sequences={filteredSequences}
          currentPageSequences={filteredSequences}
          {showGrid}
          {showTKA}
          showWord={showWord}
          {includeStartPosition}
        />
      </div>
    </aside>

    <!-- Page Display -->
    <main class="content-area">
      <PageDisplay
        {pages}
        {isLoading}
        {error}
        {columnCount}
        {showQRCodes}
        {handPointsVisible}
        {showGrid}
        {showTKA}
        {showWord}
        {includeStartPosition}
        onRetry={loadSequences}
      />
    </main>
  </div>
</div>

<style>
  .choreo-card-tab {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: transparent;
  }

  /* Header */
  .tab-header {
    flex-shrink: 0;
    padding: var(--spacing-md);
    padding-bottom: 0;
  }

  .header-content {
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-lg, 12px);
    padding: var(--spacing-lg) var(--spacing-xl);
  }

  .title-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-xs);
  }

  .title-row > i {
    color: var(--theme-accent, #f43f5e);
    font-size: 1.25rem;
  }

  .title {
    margin: 0;
    font-size: var(--font-size-xl, 20px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
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
    .tab-header {
      padding: var(--spacing-sm);
      padding-bottom: 0;
    }

    .header-content {
      padding: var(--spacing-md) var(--spacing-lg);
    }

    .title-row i {
      font-size: 1rem;
    }

    .title {
      font-size: var(--font-size-lg, 18px);
    }

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
