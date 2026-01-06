<!--
  SequencesView.svelte - Sequences Library View

  Displays user's saved sequences with optional favorites filter.
  Library = sequences YOU created/saved.

  Features:
  - Real-time Firestore sync
  - Search, sort, and filter by tags
  - Favorites toggle
  - Selection mode for batch operations
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { libraryState } from "../state/library-state.svelte";
  import { authState } from "$lib/shared/auth/state/authState.svelte.ts";
  import SequenceCard from "../../discover/gallery/display/components/SequenceCard/SequenceCard.svelte";
  import ShareHubDrawer from "$lib/shared/share-hub/components/ShareHubDrawer.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import TagFilterChips from "./tags/TagFilterChips.svelte";
  import LibraryHeader from "./LibraryHeader.svelte";
  import LibraryViewPresets, {
    type LibraryPreset,
  } from "./LibraryViewPresets.svelte";
  import LibrarySectionHeader from "./LibrarySectionHeader.svelte";
  import SequenceAnalyticsBadge from "./SequenceAnalyticsBadge.svelte";
  import BulkActionBar from "./BulkActionBar.svelte";
  import type { LibrarySequence } from "../domain/models/LibrarySequence";
  import type {
    LibrarySortField,
    LibrarySortDirection,
  } from "../state/library-state.svelte";
  import {
    groupSequencesIntoSections,
    type GroupByMethod,
    type LibrarySection,
  } from "../utils/section-grouper";

  // Local UI state
  let showOnlyFavorites = $state(false);
  let searchQuery = $state("");
  let showDetailDrawer = $state(false);
  let selectedSequenceId = $state<string | null>(null);
  let currentPreset = $state<LibraryPreset>("all");
  let groupBy = $state<GroupByMethod>("none");
  let expandedSections = $state<Set<string>>(new Set());

  // Search debounce timer
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Grid responsive sizing
  let gridRef = $state<HTMLElement | null>(null);
  let containerWidth = $state(0);
  let resizeObserver: ResizeObserver | null = null;

  // Dynamic column count based on container width (matches Gallery)
  const columnCount = $derived.by(() => {
    if (containerWidth === 0) return 3; // Default while measuring
    if (containerWidth >= 1600) return 6;
    if (containerWidth >= 1200) return 5;
    if (containerWidth >= 800) return 4;
    if (containerWidth >= 481) return 3;
    return 2;
  });

  // Derived from library state
  const isLoading = $derived(libraryState.isLoading);
  const error = $derived(libraryState.error);
  const isSelectMode = $derived(libraryState.isSelectMode);
  const selectedCount = $derived(libraryState.selectedCount);
  const isAuthenticated = $derived(!!authState.effectiveUserId);

  // Filtered sequences
  const displayedSequences = $derived(() => {
    let sequences = libraryState.filteredSequences;
    if (showOnlyFavorites) {
      return sequences.filter((s) => s.isFavorite);
    }
    return sequences;
  });

  // Stats
  const totalCount = $derived(libraryState.sequences.length);
  const favoritesCount = $derived(
    libraryState.sequences.filter((s) => s.isFavorite).length
  );
  const hasForkedSequences = $derived(
    libraryState.sequences.some((s) => s.source === "forked")
  );

  // Sections for grouped display
  const sections = $derived.by(() => {
    if (groupBy === "none") return [];
    return groupSequencesIntoSections(displayedSequences(), groupBy);
  });

  function handleSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    searchQuery = target.value;

    // Debounce search to avoid filtering on every keystroke
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      libraryState.setSearchQuery(searchQuery);
    }, 300);
  }

  // Sort controls callback
  function handleSortChange(field: LibrarySortField, direction: LibrarySortDirection) {
    libraryState.setSortBy(field);
    libraryState.setSortDirection(direction);
  }

  // View preset callback
  function handlePresetChange(
    preset: LibraryPreset,
    config: {
      sortBy?: LibrarySortField;
      sortDirection?: LibrarySortDirection;
      source?: "created" | "forked" | "all";
      favoritesOnly?: boolean;
    }
  ) {
    currentPreset = preset;

    // Apply preset configuration
    if (config.sortBy) {
      libraryState.setSortBy(config.sortBy);
    }
    if (config.sortDirection) {
      libraryState.setSortDirection(config.sortDirection);
    }
    if (config.source !== undefined) {
      libraryState.setSourceFilter(config.source);
    }
    if (config.favoritesOnly !== undefined) {
      showOnlyFavorites = config.favoritesOnly;
    } else {
      showOnlyFavorites = false;
    }
  }

  // Section grouping
  function setGroupBy(method: GroupByMethod) {
    groupBy = method;
    // Expand first section by default when switching to grouped view
    if (method !== "none") {
      expandedSections = new Set();
    }
  }

  function toggleSection(sectionId: string) {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    expandedSections = newExpanded;
  }

  function isSectionExpanded(sectionId: string): boolean {
    return expandedSections.has(sectionId);
  }

  // Selection handlers
  function enterSelectMode() {
    libraryState.enterSelectMode();
  }

  function exitSelectMode() {
    libraryState.exitSelectMode();
  }

  function handleSelectAll() {
    libraryState.selectAll();
  }

  function handleCardClick(sequence: SequenceData) {
    if (isSelectMode) {
      libraryState.toggleSelection(sequence.id ?? "");
    } else {
      // Open detail drawer
      selectedSequenceId = sequence.id ?? null;
      showDetailDrawer = true;
    }
  }

  function handleCloseDetail() {
    showDetailDrawer = false;
    selectedSequenceId = null;
  }

  // Get the selected sequence for the detail drawer
  const selectedSequence = $derived(
    selectedSequenceId ? libraryState.getSequenceById(selectedSequenceId) : null
  );

  // === SHARE HUB DRAWER CALLBACKS ===

  async function handleNotesChange(notes: string) {
    if (!selectedSequenceId) return;
    try {
      await libraryState.updateNotes(selectedSequenceId, notes);
      toast.success("Notes saved");
    } catch (error) {
      console.error("Failed to save notes:", error);
      toast.error("Failed to save notes");
    }
  }

  async function handleTagsChange(tags: string[]) {
    if (!selectedSequenceId) return;
    try {
      await libraryState.updateTags(selectedSequenceId, tags);
      toast.success("Tags updated");
    } catch (error) {
      console.error("Failed to update tags:", error);
      toast.error("Failed to update tags");
    }
  }

  async function handleFavoriteToggle() {
    if (!selectedSequenceId) return;
    await libraryState.toggleFavorite(selectedSequenceId);
  }

  async function handleDeleteSequence() {
    if (!selectedSequenceId) return;
    const success = await libraryState.deleteSequence(selectedSequenceId);
    if (success) {
      toast.success("Sequence deleted");
      handleCloseDetail();
    } else {
      toast.error("Failed to delete sequence");
    }
  }

  // Batch actions
  async function handleDeleteSelected() {
    if (selectedCount === 0) return;

    const confirmed = confirm(
      `Delete ${selectedCount} sequence${selectedCount > 1 ? "s" : ""}? This cannot be undone.`
    );

    if (confirmed) {
      await libraryState.deleteSelected();
    }
  }

  // Track previous auth state to detect changes
  let prevIsAuthenticated: boolean | undefined;

  // Initialize on mount
  onMount(() => {
    prevIsAuthenticated = isAuthenticated;

    if (isAuthenticated) {
      libraryState.initialize();
    }

    // Set up ResizeObserver for responsive grid columns
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width;
        if (newWidth > 0) {
          containerWidth = newWidth;
        }
      }
    });

    // Initial width measurement when grid becomes available
    const measureInitialWidth = () => {
      if (gridRef) {
        resizeObserver?.observe(gridRef);
        // Use RAF for accurate initial measurement
        requestAnimationFrame(() => {
          const width = gridRef?.getBoundingClientRect().width ?? 0;
          if (width > 0) {
            containerWidth = width;
          }
        });
      }
    };

    // If grid is already available, measure immediately
    if (gridRef) {
      measureInitialWidth();
    }
  });

  // Set up observer when gridRef becomes available
  $effect(() => {
    if (gridRef && resizeObserver) {
      resizeObserver.observe(gridRef);
      const width = gridRef.getBoundingClientRect().width;
      if (width > 0) {
        containerWidth = width;
      }
    }
  });

  onDestroy(() => {
    libraryState.dispose();
    if (debounceTimer) clearTimeout(debounceTimer);
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
  });

  // Re-initialize only when auth state CHANGES (not on every render)
  $effect(() => {
    const currentAuth = isAuthenticated;
    // Skip if this is the initial run (handled by onMount)
    if (prevIsAuthenticated === undefined) {
      return;
    }
    // Only act if auth state actually changed
    if (currentAuth !== prevIsAuthenticated) {
      prevIsAuthenticated = currentAuth;
      if (currentAuth) {
        libraryState.initialize();
      } else {
        libraryState.reset();
      }
    }
  });
</script>

<div class="sequences-view">
  <!-- Library Identity Header -->
  {#if isAuthenticated && !isLoading}
    <LibraryHeader
      sequences={libraryState.sequences}
      onOrganize={() => (isSelectMode ? exitSelectMode() : enterSelectMode())}
      isOrganizing={isSelectMode}
    />
  {/if}

  <!-- Search & Actions Bar -->
  <div class="header-bar">
    <!-- Search -->
    <div class="search-container">
      <i class="fas fa-search search-icon" aria-hidden="true"></i>
      <input
        type="text"
        placeholder="Search sequences..."
        value={searchQuery}
        oninput={handleSearchInput}
        class="search-input"
      />
      {#if searchQuery}
        <button
          class="clear-search"
          aria-label="Clear search"
          onclick={() => {
            searchQuery = "";
            libraryState.setSearchQuery("");
          }}
        >
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      {/if}
    </div>

    <!-- Actions -->
    <div class="header-actions">
      <!-- Select mode toggle -->
      {#if !isSelectMode}
        <button
          class="action-btn"
          aria-label="Select sequences"
          onclick={enterSelectMode}
          title="Select"
        >
          <i class="fas fa-check-square" aria-hidden="true"></i>
        </button>
      {:else}
        <button
          class="action-btn active"
          aria-label="Exit selection mode"
          onclick={exitSelectMode}
          title="Done"
        >
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      {/if}
    </div>
  </div>

  <!-- Filter Bar -->
  <div class="filter-bar">
    <div class="filter-bar-left">
      <div class="sequence-count">
        {#if showOnlyFavorites}
          <span>{favoritesCount} favorite{favoritesCount !== 1 ? "s" : ""}</span>
        {:else}
          <span>{totalCount} sequence{totalCount !== 1 ? "s" : ""}</span>
        {/if}
      </div>

    </div>
  </div>

  <!-- Control Chips Bar -->
  <div class="controls-bar">
    <!-- Group By chips -->
    <div class="control-group">
      <span class="control-label">Group:</span>
      <div class="control-chips">
        <button
          class="control-chip"
          class:active={groupBy === "none"}
          onclick={() => (groupBy = "none")}
        >
          None
        </button>
        <button
          class="control-chip"
          class:active={groupBy === "date"}
          onclick={() => (groupBy = "date")}
        >
          <i class="fas fa-calendar" aria-hidden="true"></i>
          Date
        </button>
        <button
          class="control-chip"
          class:active={groupBy === "letter"}
          onclick={() => (groupBy = "letter")}
        >
          <i class="fas fa-font" aria-hidden="true"></i>
          Letter
        </button>
        <button
          class="control-chip"
          class:active={groupBy === "length"}
          onclick={() => (groupBy = "length")}
        >
          <i class="fas fa-ruler" aria-hidden="true"></i>
          Length
        </button>
      </div>
    </div>

    <!-- Sort chips -->
    <div class="control-group">
      <span class="control-label">Sort:</span>
      <div class="control-chips">
        <button
          class="control-chip"
          class:active={libraryState.filters.sortBy === "updatedAt"}
          onclick={() => handleSortChange("updatedAt", "desc")}
        >
          <i class="fas fa-clock" aria-hidden="true"></i>
          Updated
        </button>
        <button
          class="control-chip"
          class:active={libraryState.filters.sortBy === "createdAt"}
          onclick={() => handleSortChange("createdAt", "desc")}
        >
          <i class="fas fa-calendar-plus" aria-hidden="true"></i>
          Created
        </button>
        <button
          class="control-chip"
          class:active={libraryState.filters.sortBy === "word"}
          onclick={() => handleSortChange("word", "asc")}
        >
          <i class="fas fa-spell-check" aria-hidden="true"></i>
          TKA
        </button>
        <button
          class="control-chip"
          class:active={libraryState.filters.sortBy === "viewCount"}
          onclick={() => handleSortChange("viewCount", "desc")}
        >
          <i class="fas fa-eye" aria-hidden="true"></i>
          Views
        </button>
      </div>
      <!-- Direction toggle -->
      <button
        class="direction-chip"
        onclick={() => libraryState.toggleSortDirection()}
        aria-label={libraryState.filters.sortDirection === "asc" ? "Ascending" : "Descending"}
      >
        {#if libraryState.filters.sortDirection === "asc"}
          <i class="fas fa-arrow-up" aria-hidden="true"></i>
        {:else}
          <i class="fas fa-arrow-down" aria-hidden="true"></i>
        {/if}
      </button>
    </div>
  </div>

  <!-- View Presets -->
  <LibraryViewPresets
    {currentPreset}
    onPresetChange={handlePresetChange}
    {hasForkedSequences}
  />

  <!-- Tag Filter Chips -->
  <TagFilterChips />

  <!-- Selection indicator in header area (minimal) -->
  {#if isSelectMode}
    <div class="selection-hint">
      <i class="fas fa-info-circle" aria-hidden="true"></i>
      <span>Tap sequences to select them</span>
    </div>
  {/if}

  <!-- Content Area -->
  <div class="content-area" class:selecting={isSelectMode}>
    {#if !isAuthenticated}
      <div class="auth-required">
        <i class="fas fa-lock" aria-hidden="true"></i>
        <h3>Sign In Required</h3>
        <p>Please sign in to access your library.</p>
      </div>
    {:else if isLoading}
      <div
        class="loading-state"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div class="spinner" aria-hidden="true"></div>
        <p>Loading your library...</p>
      </div>
    {:else if error}
      <div class="error-state" role="alert" aria-live="assertive">
        <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
        <h3>Error Loading Sequences</h3>
        <p>{error}</p>
        <button
          class="retry-button"
          onclick={() => libraryState.loadSequences()}
        >
          <i class="fas fa-redo" aria-hidden="true"></i>
          Retry
        </button>
      </div>
    {:else if displayedSequences().length === 0}
      <div class="empty-state">
        <i class="fas fa-folder-open" aria-hidden="true"></i>
        <h3>
          {#if searchQuery}
            No Results Found
          {:else if showOnlyFavorites}
            No Favorites Yet
          {:else}
            Library is Empty
          {/if}
        </h3>
        <p>
          {#if searchQuery}
            Try a different search term.
          {:else if showOnlyFavorites}
            Star sequences to add them to your favorites.
          {:else}
            Create your first sequence in the Create module!
          {/if}
        </p>
      </div>
    {:else if groupBy !== "none" && sections.length > 0}
      <!-- Sectioned View -->
      <div class="sections-container" bind:this={gridRef}>
        {#each sections as section (section.id)}
          <div class="section">
            <LibrarySectionHeader
              title={section.title}
              count={section.count}
              isExpanded={isSectionExpanded(section.id)}
              onToggle={() => toggleSection(section.id)}
            />
            {#if isSectionExpanded(section.id)}
              <div
                class="sequences-grid"
                style:grid-template-columns="repeat({columnCount}, 1fr)"
              >
                {#each section.sequences as sequence (sequence.id)}
                  {@const libSeq = sequence as LibrarySequence}
                  <div class="library-card-wrapper">
                    <SequenceCard
                      {sequence}
                      onPrimaryAction={handleCardClick}
                      selected={libraryState.isSelected(sequence.id)}
                    />
                    <div class="analytics-overlay">
                      <SequenceAnalyticsBadge
                        viewCount={libSeq.viewCount}
                        forkCount={libSeq.forkCount}
                        starCount={libSeq.starCount}
                      />
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {:else}
      <!-- Flat Grid View -->
      <div
        class="sequences-grid"
        bind:this={gridRef}
        style:grid-template-columns="repeat({columnCount}, 1fr)"
      >
        {#each displayedSequences() as sequence (sequence.id)}
          {@const libSeq = sequence as LibrarySequence}
          <div class="library-card-wrapper">
            <SequenceCard
              {sequence}
              onPrimaryAction={handleCardClick}
              selected={libraryState.isSelected(sequence.id)}
            />
            <!-- Analytics overlay - unique to Library -->
            <div class="analytics-overlay">
              <SequenceAnalyticsBadge
                viewCount={libSeq.viewCount}
                forkCount={libSeq.forkCount}
                starCount={libSeq.starCount}
              />
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Unified Sequence Viewer Drawer -->
  {#if selectedSequence}
    <ShareHubDrawer
      bind:isOpen={showDetailDrawer}
      sequence={selectedSequence}
      mode="library"
      notes={selectedSequence.notes || ""}
      tags={[...(selectedSequence.tagIds || [])]}
      viewCount={selectedSequence.viewCount || 0}
      forkCount={selectedSequence.forkCount || 0}
      starCount={selectedSequence.starCount || 0}
      isFavorite={selectedSequence.isFavorite || false}
      onNotesChange={handleNotesChange}
      onTagsChange={handleTagsChange}
      onFavoriteToggle={handleFavoriteToggle}
      onDelete={handleDeleteSequence}
      onClose={handleCloseDetail}
    />
  {/if}

  <!-- Bulk Action Bar (sticky at bottom when selecting) -->
  {#if isSelectMode}
    <BulkActionBar
      {selectedCount}
      onDelete={handleDeleteSelected}
      onSelectAll={handleSelectAll}
      onClearSelection={() => libraryState.clearSelection()}
      onExit={exitSelectMode}
    />
  {/if}
</div>

<style>
  .sequences-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    overflow: hidden;
  }

  /* Header Bar */
  .header-bar {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
    background: rgba(255, 255, 255, 0.03);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .search-container {
    flex: 1;
    position: relative;
    max-width: 400px;
  }

  .search-icon {
    position: absolute;
    left: var(--spacing-sm);
    top: 50%;
    transform: translateY(-50%);
    color: rgba(255, 255, 255, 0.75); /* WCAG AAA */
    font-size: 0.875rem;
  }

  .search-input {
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    padding-left: calc(var(--spacing-sm) + 1.5rem);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-2026-sm, 10px);
    color: var(--theme-text);
    font-size: 0.875rem;
  }

  .search-input::placeholder {
    color: rgba(255, 255, 255, 0.75); /* WCAG AAA */
  }

  .search-input:focus {
    outline: none;
    border-color: var(--theme-accent);
    background: var(--theme-card-bg);
  }

  .clear-search {
    position: absolute;
    right: var(--spacing-sm);
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.75); /* WCAG AAA */
    cursor: pointer;
    padding: var(--spacing-xs);
  }

  .clear-search:hover {
    color: rgba(255, 255, 255, 0.7);
  }

  .header-actions {
    display: flex;
    gap: var(--spacing-xs);
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-2026-sm, 10px);
    color: var(--theme-text-dim);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .action-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--theme-text);
  }

  .action-btn.active {
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 40%, transparent);
    color: var(--theme-accent);
  }

  /* Filter Bar */
  .filter-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-md);
    padding: var(--spacing-sm) var(--spacing-md);
    background: rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  .filter-bar-left {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
  }

  .sequence-count {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim);
  }

  /* Controls Bar */
  .controls-bar {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-md);
    padding: var(--spacing-sm) var(--spacing-md);
    background: rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .control-group {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  .control-label {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim);
    margin-right: 4px;
  }

  .control-chips {
    display: flex;
    gap: 4px;
  }

  .control-chip {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 999px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .control-chip:hover {
    background: color-mix(in srgb, var(--theme-accent) 10%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 25%, transparent);
    color: var(--theme-text);
  }

  .control-chip.active {
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 50%, transparent);
    color: var(--theme-accent);
  }

  .control-chip i {
    font-size: 0.7rem;
  }

  .direction-chip {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 999px;
    color: var(--theme-accent);
    cursor: pointer;
    transition: all 0.15s ease;
    margin-left: 4px;
  }

  .direction-chip:hover {
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 40%, transparent);
  }

  .direction-chip i {
    font-size: 0.8rem;
  }

  /* Mobile: stack controls */
  @media (max-width: 600px) {
    .controls-bar {
      flex-direction: column;
      gap: var(--spacing-sm);
    }

    .control-group {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    .control-chips {
      flex: 1;
      overflow-x: auto;
      padding-bottom: 2px;
    }

    .control-chip span {
      display: none;
    }
  }

  /* Sections Container */
  .sections-container {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  .section {
    display: flex;
    flex-direction: column;
  }

  /* Content Area */
  .content-area {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: var(--spacing-lg);
  }

  /* Add padding for sticky BulkActionBar when selecting */
  .content-area.selecting {
    padding-bottom: calc(
      var(--spacing-lg) + 100px + env(safe-area-inset-bottom, 0px)
    );
  }

  /* Loading State */
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--theme-text-dim);
  }

  .spinner {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border: 3px solid var(--theme-stroke);
    border-top-color: var(--theme-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: var(--spacing-md);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Auth Required State */
  .auth-required {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    color: var(--theme-text-dim);
    padding: var(--spacing-xl);
  }

  .auth-required i {
    font-size: 4rem;
    margin-bottom: var(--spacing-lg);
    opacity: 0.5;
  }

  .auth-required h3 {
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: var(--spacing-md);
    color: var(--theme-text);
  }

  /* Empty State */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    color: var(--theme-text-dim);
    padding: var(--spacing-xl);
  }

  .empty-state i {
    font-size: 4rem;
    margin-bottom: var(--spacing-lg);
    opacity: 0.5;
  }

  .empty-state h3 {
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: var(--spacing-md);
    color: var(--theme-text);
  }

  .empty-state p {
    font-size: 1rem;
    line-height: 1.6;
    max-width: 400px;
  }

  /* Error State */
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    color: var(--theme-text-dim);
    padding: var(--spacing-xl);
  }

  .error-state i {
    font-size: 4rem;
    margin-bottom: var(--spacing-lg);
    color: rgba(239, 68, 68, 0.7);
  }

  .error-state h3 {
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: var(--spacing-md);
    color: var(--theme-text);
  }

  .error-state p {
    font-size: 1rem;
    margin-bottom: var(--spacing-lg);
    max-width: 400px;
  }

  .retry-button {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm) var(--spacing-lg);
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent) 40%, transparent);
    border-radius: var(--radius-2026-sm, 10px);
    color: var(--theme-text);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .retry-button:hover {
    background: color-mix(in srgb, var(--theme-accent) 30%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 50%, transparent);
  }

  /* Sequences Grid - columns set dynamically via style binding */
  .sequences-grid {
    display: grid;
    /* Fallback for SSR/initial render - overridden by style:grid-template-columns */
    grid-template-columns: repeat(3, 1fr);
    gap: var(--spacing-md);
  }

  /* Library Card Wrapper - positions analytics overlay */
  .library-card-wrapper {
    position: relative;
  }

  .analytics-overlay {
    position: absolute;
    bottom: var(--spacing-xs);
    left: var(--spacing-xs);
    z-index: 5;
    pointer-events: none;
  }

  /* Selection Hint */
  .selection-hint {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm) var(--spacing-md);
    background: color-mix(in srgb, var(--theme-accent) 10%, transparent);
    border-bottom: 1px solid color-mix(in srgb, var(--theme-accent) 20%, transparent);
    color: var(--theme-accent);
    font-size: var(--font-size-sm, 14px);
  }

  .selection-hint i {
    font-size: 0.875rem;
  }

</style>
