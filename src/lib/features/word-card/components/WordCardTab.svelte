<!--
  WordCardTab.svelte - Page-based word card viewer

  Main container for browsing and filtering sequence word cards.
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { getContainerInstance } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import { onMount } from "svelte";
  import type { IDiscoverLoader } from "../../discover/sequences/display/services/contracts/IDiscoverLoader";
  import type { PrintPreviewPage } from "../domain/types/PageLayoutTypes";
  import WordCardNavigation from "./Navigation.svelte";
  import WordCardFilters from "./WordCardFilters.svelte";
  import PageDisplay from "./PageDisplay.svelte";

  // Services
  let loaderService = $state<IDiscoverLoader | null>(null);

  // Storage keys
  const STORAGE_KEY_LENGTH = "wordCard.selectedLength";
  const STORAGE_KEY_COLUMNS = "wordCard.columnCount";
  const STORAGE_KEY_DIFFICULTY = "wordCard.difficulty";
  const STORAGE_KEY_FAVORITES = "wordCard.favorites";
  const STORAGE_KEY_GRID_MODE = "wordCard.gridMode";
  const STORAGE_KEY_AUTHOR = "wordCard.author";

  // Load persisted state or use defaults
  function getPersistedNumber(key: string, defaultValue: number): number {
    if (typeof window === "undefined") return defaultValue;
    const stored = localStorage.getItem(key);
    return stored ? parseInt(stored, 10) : defaultValue;
  }

  function getPersistedBoolean(key: string, defaultValue: boolean): boolean {
    if (typeof window === "undefined") return defaultValue;
    const stored = localStorage.getItem(key);
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

  // Filtered sequences based on all filters
  let filteredSequences = $derived.by(() => {
    let result = sequences;

    // Beat length filter
    if (selectedLength !== 0) {
      result = result.filter((seq) => seq.sequenceLength === selectedLength);
    }

    // Difficulty filter (uses calculated 'level' field: 1=beginner, 2=intermediate, 3=advanced)
    if (difficulty !== null) {
      result = result.filter((seq) => seq.level === difficulty);
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
  function getSequencesPerPage(beatCount: number): number {
    // 2 columns, rows depend on sequence height
    if (beatCount <= 3) return 10; // 5 rows
    if (beatCount <= 4) return 8; // 4 rows
    if (beatCount <= 8) return 6; // 3 rows
    return 6; // 3 rows for 10-16 beats (tight spacing)
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
    const container = await getContainerInstance();
    loaderService = container.get<IDiscoverLoader>(TYPES.IDiscoverLoader);
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
      console.error("WordCard: Failed to load sequences:", err);
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
</script>

<div class="word-card-tab">
  <!-- Header -->
  <header class="tab-header">
    <div class="header-content">
      <div class="title-row">
        <i class="fas fa-id-card" aria-hidden="true"></i>
        <h1 class="title">Word Cards</h1>
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
        <WordCardNavigation
          {selectedLength}
          {columnCount}
          onLengthSelected={handleLengthSelected}
          onColumnCountChanged={handleColumnCountChanged}
        />
        <div class="filter-divider"></div>
        <WordCardFilters
          {difficulty}
          {favorites}
          {gridMode}
          {author}
          {authors}
          onDifficultyChange={handleDifficultyChange}
          onFavoritesChange={handleFavoritesChange}
          onGridModeChange={handleGridModeChange}
          onAuthorChange={handleAuthorChange}
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
        onRetry={loadSequences}
      />
    </main>
  </div>
</div>

<style>
  .word-card-tab {
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
    background: transparent;
  }

  .sidebar-content::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
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
