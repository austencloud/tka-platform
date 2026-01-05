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
  import SequenceAnalyticsBadge from "./SequenceAnalyticsBadge.svelte";
  import BulkActionBar from "./BulkActionBar.svelte";
  import type { LibrarySequence } from "../domain/models/LibrarySequence";

  // Visibility toggle handler
  async function handleVisibilityToggle(
    event: MouseEvent,
    sequence: LibrarySequence
  ) {
    event.stopPropagation();
    const newVisibility =
      sequence.visibility === "public" ? "private" : "public";
    await libraryState.setVisibility(sequence.id, newVisibility);
  }

  // Local UI state
  let showOnlyFavorites = $state(false);
  let searchQuery = $state("");
  let showSortMenu = $state(false);
  let showDetailDrawer = $state(false);
  let selectedSequenceId = $state<string | null>(null);

  // Search debounce timer
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Sort menu keyboard navigation
  let focusedSortIndex = $state(-1);

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

  // Sort options - includes analytics sorts unique to Library
  const sortOptions = [
    { field: "updatedAt", label: "Recently Updated" },
    { field: "createdAt", label: "Date Created" },
    { field: "name", label: "Name" },
    { field: "word", label: "Word" },
    { field: "viewCount", label: "Most Viewed", icon: "fa-eye" },
    { field: "forkCount", label: "Most Forked", icon: "fa-code-branch" },
    { field: "starCount", label: "Most Starred", icon: "fa-star" },
  ] as const;

  function handleSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    searchQuery = target.value;

    // Debounce search to avoid filtering on every keystroke
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      libraryState.setSearchQuery(searchQuery);
    }, 300);
  }

  function handleSortChange(
    field:
      | "updatedAt"
      | "createdAt"
      | "name"
      | "word"
      | "viewCount"
      | "forkCount"
      | "starCount"
  ) {
    if (libraryState.filters.sortBy === field) {
      libraryState.toggleSortDirection();
    } else {
      // Analytics sorts default to descending (highest first)
      if (
        field === "viewCount" ||
        field === "forkCount" ||
        field === "starCount"
      ) {
        libraryState.setSortDirection("desc");
      }
      libraryState.setSortBy(field);
    }
    showSortMenu = false;
    focusedSortIndex = -1;
  }

  function handleSortMenuKeydown(event: KeyboardEvent) {
    if (!showSortMenu) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusedSortIndex = Math.min(focusedSortIndex + 1, sortOptions.length - 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusedSortIndex = Math.max(focusedSortIndex - 1, 0);
        break;
      case "Enter":
        event.preventDefault();
        if (focusedSortIndex >= 0) {
          handleSortChange(sortOptions[focusedSortIndex].field);
        }
        break;
      case "Escape":
        event.preventDefault();
        showSortMenu = false;
        focusedSortIndex = -1;
        break;
    }
  }

  function openSortMenu() {
    showSortMenu = !showSortMenu;
    if (showSortMenu) {
      // Find currently selected option to focus
      const currentIndex = sortOptions.findIndex(
        (opt) => opt.field === libraryState.filters.sortBy
      );
      focusedSortIndex = currentIndex >= 0 ? currentIndex : 0;
    } else {
      focusedSortIndex = -1;
    }
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

  async function handleDrawerVisibilityChange(visibility: "public" | "private") {
    if (!selectedSequenceId) return;
    const success = await libraryState.setVisibility(selectedSequenceId, visibility);
    if (success) {
      toast.success(
        visibility === "public"
          ? "Sequence is now public"
          : "Sequence is now private"
      );
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

  async function handlePublishSelected() {
    await libraryState.setVisibilityBatch("public");
  }

  async function handleUnpublishSelected() {
    await libraryState.setVisibilityBatch("private");
  }

  // Track previous auth state to detect changes
  let prevIsAuthenticated: boolean | undefined;

  // Initialize on mount
  onMount(() => {
    prevIsAuthenticated = isAuthenticated;

    if (isAuthenticated) {
      libraryState.initialize();
    }
  });

  onDestroy(() => {
    libraryState.dispose();
    if (debounceTimer) clearTimeout(debounceTimer);
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
      <!-- Sort button -->
      <div class="sort-dropdown" onkeydown={handleSortMenuKeydown}>
        <button
          class="action-btn"
          aria-label="Sort sequences"
          aria-haspopup="listbox"
          aria-expanded={showSortMenu}
          onclick={openSortMenu}
          title="Sort sequences"
        >
          <i class="fas fa-sort-amount-down" aria-hidden="true"></i>
        </button>
        {#if showSortMenu}
          <div class="sort-menu" role="listbox" aria-label="Sort options">
            {#each sortOptions as option, index}
              <button
                class="sort-option"
                class:active={libraryState.filters.sortBy === option.field}
                class:focused={focusedSortIndex === index}
                class:analytics-sort={option.icon}
                role="option"
                aria-selected={libraryState.filters.sortBy === option.field}
                onclick={() => handleSortChange(option.field)}
              >
                {#if option.icon}
                  <i class="fas {option.icon} sort-icon" aria-hidden="true"></i>
                {/if}
                <span>{option.label}</span>
                {#if libraryState.filters.sortBy === option.field}
                  <i
                    class="fas fa-arrow-{libraryState.filters.sortDirection ===
                    'asc'
                      ? 'up'
                      : 'down'}"
                    aria-hidden="true"
                  ></i>
                {/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>

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
    <div class="sequence-count">
      {#if showOnlyFavorites}
        <span>{favoritesCount} favorite{favoritesCount !== 1 ? "s" : ""}</span>
      {:else}
        <span>{totalCount} sequence{totalCount !== 1 ? "s" : ""}</span>
      {/if}
    </div>

    {#if favoritesCount > 0}
      <button
        class="favorites-toggle"
        class:active={showOnlyFavorites}
        onclick={() => (showOnlyFavorites = !showOnlyFavorites)}
      >
        <i class="fas fa-star" aria-hidden="true"></i>
        <span>{showOnlyFavorites ? "Show All" : "Favorites"}</span>
      </button>
    {/if}
  </div>

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
    {:else}
      <div class="sequences-grid">
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
            <!-- Visibility toggle button -->
            {#if !isSelectMode}
              <button
                class="visibility-toggle"
                class:public={libSeq.visibility === "public"}
                class:private={libSeq.visibility === "private"}
                class:unlisted={libSeq.visibility === "unlisted"}
                onclick={(e) => handleVisibilityToggle(e, libSeq)}
                title={libSeq.visibility === "public"
                  ? "Public - Click to make private"
                  : "Private - Click to publish"}
                aria-label={libSeq.visibility === "public"
                  ? "Make private"
                  : "Make public"}
              >
                <i
                  class="fas fa-{libSeq.visibility === 'public'
                    ? 'globe'
                    : libSeq.visibility === 'unlisted'
                      ? 'link'
                      : 'lock'}"
                  aria-hidden="true"
                ></i>
              </button>
            {/if}
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
      tags={selectedSequence.tagIds || []}
      visibility={selectedSequence.visibility || "private"}
      viewCount={selectedSequence.viewCount || 0}
      forkCount={selectedSequence.forkCount || 0}
      starCount={selectedSequence.starCount || 0}
      isFavorite={selectedSequence.isFavorite || false}
      onNotesChange={handleNotesChange}
      onTagsChange={handleTagsChange}
      onVisibilityChange={handleDrawerVisibilityChange}
      onFavoriteToggle={handleFavoriteToggle}
      onDelete={handleDeleteSequence}
      onClose={handleCloseDetail}
    />
  {/if}

  <!-- Bulk Action Bar (sticky at bottom when selecting) -->
  {#if isSelectMode}
    <BulkActionBar
      {selectedCount}
      onPublish={handlePublishSelected}
      onUnpublish={handleUnpublishSelected}
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

  /* Sort Dropdown */
  .sort-dropdown {
    position: relative;
  }

  .sort-menu {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: var(--spacing-xs);
    background: rgba(30, 30, 40, 0.98);
    border: 1px solid var(--theme-stroke-strong);
    border-radius: var(--radius-2026-sm, 10px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    z-index: 100;
    min-width: 180px;
    overflow: hidden;
  }

  .sort-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    background: none;
    border: none;
    color: var(--theme-text-dim);
    font-size: 0.875rem;
    text-align: left;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .sort-option:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .sort-option.active {
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
    color: var(--theme-accent);
  }

  .sort-option.focused {
    background: rgba(255, 255, 255, 0.12);
    outline: 2px solid var(--theme-accent);
    outline-offset: -2px;
  }

  /* Analytics sort options (unique to Library) */
  .sort-option.analytics-sort {
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .sort-option.analytics-sort:first-of-type {
    margin-top: 4px;
    padding-top: calc(var(--spacing-sm) + 4px);
  }

  .sort-icon {
    width: 14px;
    opacity: 0.7;
  }

  .sort-option.analytics-sort .sort-icon {
    color: var(--semantic-success);
  }

  /* Filter Bar */
  .filter-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-sm) var(--spacing-md);
    background: rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    flex-shrink: 0;
  }

  .sequence-count {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim);
  }

  .favorites-toggle {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-xs) var(--spacing-md);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 999px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .favorites-toggle:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--theme-text);
  }

  .favorites-toggle.active {
    background: rgba(250, 204, 21, 0.2);
    border-color: rgba(250, 204, 21, 0.4);
    color: rgba(250, 204, 21, 1);
  }

  .favorites-toggle i {
    font-size: 0.875rem;
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

  /* Sequences Grid */
  .sequences-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
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

  /* Visibility Toggle Button */
  .visibility-toggle {
    position: absolute;
    top: var(--spacing-xs);
    left: var(--spacing-xs);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    border: 1px solid transparent;
    border-radius: 50%;
    z-index: 5;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .visibility-toggle i {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.9);
  }

  .visibility-toggle.public {
    background: color-mix(in srgb, var(--semantic-success) 30%, transparent);
    border-color: color-mix(in srgb, var(--semantic-success) 50%, transparent);
  }

  .visibility-toggle.public i {
    color: var(--semantic-success);
  }

  .visibility-toggle.private i {
    color: rgba(156, 163, 175, 0.95);
  }

  .visibility-toggle.unlisted i {
    color: rgba(96, 165, 250, 0.95);
  }

  .visibility-toggle:hover {
    transform: scale(1.1);
    background: rgba(0, 0, 0, 0.9);
  }

  .visibility-toggle.public:hover {
    background: rgba(156, 163, 175, 0.4);
    border-color: rgba(156, 163, 175, 0.6);
  }

  .visibility-toggle.public:hover i {
    color: rgba(156, 163, 175, 0.95);
  }

  .visibility-toggle.private:hover,
  .visibility-toggle.unlisted:hover {
    background: color-mix(in srgb, var(--semantic-success) 40%, transparent);
    border-color: color-mix(in srgb, var(--semantic-success) 60%, transparent);
  }

  .visibility-toggle.private:hover i,
  .visibility-toggle.unlisted:hover i {
    color: var(--semantic-success);
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

  /* Responsive adjustments */
  @container (max-width: 600px) {
    .sequences-grid {
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    }

    .favorites-toggle span {
      display: none;
    }
  }
</style>
