<!--
SearchExplorePanel.svelte

AI-powered search panel for the Explore module.
Allows natural language queries to find sequences, users, and collections.
-->
<script lang="ts">
  interface SearchResult {
    id: string;
    type: "sequence" | "user" | "collection";
    title: string;
    description: string;
    metadata?: any;
    relevance: number;
  }

  let searchQuery = $state("");
  let isSearching = $state(false);
  let searchResults = $state<SearchResult[]>([]);
  let hasSearched = $state(false);
  let searchFilter = $state<"all" | "gallery" | "community" | "collections">(
    "all"
  );

  // Suggested searches for inspiration
  const suggestedSearches = [
    "beginner-friendly sequences",
    "complex transitions",
    "alpha position starts",
    "sequences by FlowMaster",
    "popular collections",
    "3-beat sequences",
  ];

  // Filtered results based on type filter
  const filteredResults = $derived.by(() => {
    if (searchFilter === "all") return searchResults;
    // Map plural filter names to singular types
    const typeMap: Record<string, SearchResult["type"]> = {
      gallery: "sequence",
      community: "user",
      collections: "collection",
    };
    const targetType = typeMap[searchFilter] || searchFilter;
    return searchResults.filter((result) => result.type === targetType);
  });

  async function handleSearch() {
    if (!searchQuery.trim()) return;

    isSearching = true;
    hasSearched = true;

    // TODO: Implement actual AI-powered search
    // This would integrate with a backend search service or AI model
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Mock search results
    searchResults = [
      {
        id: "1",
        type: "sequence",
        title: "Basic Flow Sequence",
        description: "A simple sequence perfect for beginners",
        relevance: 0.95,
      },
      {
        id: "2",
        type: "user",
        title: "FlowMaster",
        description: "Expert flow artist with 42 sequences",
        relevance: 0.87,
      },
      {
        id: "3",
        type: "collection",
        title: "Beginner Fundamentals",
        description: "Essential sequences for learning the basics",
        relevance: 0.82,
      },
    ];

    isSearching = false;
  }

  function handleSuggestedSearch(suggestion: string) {
    searchQuery = suggestion;
    handleSearch();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      handleSearch();
    }
  }

  function handleResultClick(result: SearchResult) {
    // TODO: Navigate to appropriate detail view based on result type
  }

  function getResultIcon(type: SearchResult["type"]): string {
    switch (type) {
      case "sequence":
        return "fa-list";
      case "user":
        return "fa-user";
      case "collection":
        return "fa-folder";
    }
  }

  function getResultTypeLabel(type: SearchResult["type"]): string {
    return type.charAt(0).toUpperCase() + type.slice(1);
  }
</script>

<div class="search-explore-panel">
  <!-- Search header -->
  <div class="search-header">
    <h2 class="search-title">
      <i class="fas fa-search" aria-hidden="true"></i>
      Intelligent Search
    </h2>
    <p class="search-subtitle">
      Use natural language to find sequences, users, and collections
    </p>
  </div>

  <!-- Search input -->
  <div
    class="search-input-container"
    role="search"
    aria-label="Search sequences, users, and collections"
  >
    <i class="fas fa-search search-icon" aria-hidden="true"></i>
    <input
      type="text"
      class="search-input"
      placeholder="Try 'beginner sequences' or 'sequences with alpha start'..."
      bind:value={searchQuery}
      onkeydown={handleKeydown}
    />
    <button
      class="search-button"
      onclick={handleSearch}
      disabled={!searchQuery.trim() || isSearching}
    >
      {#if isSearching}
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      {:else}
        <i class="fas fa-arrow-right" aria-hidden="true"></i>
      {/if}
    </button>
  </div>

  <!-- Filter tabs -->
  {#if hasSearched}
    <div class="result-filters">
      <button
        class="filter-tab"
        class:active={searchFilter === "all"}
        onclick={() => (searchFilter = "all")}
      >
        All ({searchResults.length})
      </button>
      <button
        class="filter-tab"
        class:active={searchFilter === "gallery"}
        onclick={() => (searchFilter = "gallery")}
      >
        Gallery ({searchResults.filter((r) => r.type === "sequence").length})
      </button>
      <button
        class="filter-tab"
        class:active={searchFilter === "community"}
        onclick={() => (searchFilter = "community")}
      >
        Community ({searchResults.filter((r) => r.type === "user").length})
      </button>
      <button
        class="filter-tab"
        class:active={searchFilter === "collections"}
        onclick={() => (searchFilter = "collections")}
      >
        Collections ({searchResults.filter((r) => r.type === "collection")
          .length})
      </button>
    </div>
  {/if}

  <!-- Screen reader status announcement -->
  <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
    {#if isSearching}
      Searching...
    {:else if hasSearched && filteredResults.length > 0}
      {filteredResults.length} result{filteredResults.length === 1 ? "" : "s"} found
    {:else if hasSearched && filteredResults.length === 0}
      No results found
    {/if}
  </div>

  <!-- Content area -->
  <div class="search-content">
    {#if !hasSearched}
      <!-- Suggested searches -->
      <div class="suggestions-container">
        <h3 class="suggestions-title">Try searching for:</h3>
        <div class="suggestions-grid">
          {#each suggestedSearches as suggestion}
            <button
              class="suggestion-chip"
              onclick={() => handleSuggestedSearch(suggestion)}
            >
              <i class="fas fa-lightbulb" aria-hidden="true"></i>
              {suggestion}
            </button>
          {/each}
        </div>

        <!-- AI feature callout -->
        <div class="ai-callout">
          <i class="fas fa-brain" aria-hidden="true"></i>
          <div class="callout-content">
            <strong>Powered by AI</strong>
            <p>
              Our intelligent search understands natural language and context to
              help you find exactly what you're looking for.
            </p>
          </div>
        </div>
      </div>
    {:else if isSearching}
      <!-- Loading state -->
      <div
        class="loading-state"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        <p>Searching...</p>
      </div>
    {:else if filteredResults.length === 0}
      <!-- No results -->
      <div class="empty-state">
        <i class="fas fa-search" aria-hidden="true"></i>
        <h3>No results found</h3>
        <p>
          Try adjusting your search query or browse suggested searches above
        </p>
      </div>
    {:else}
      <!-- Search results -->
      <div class="results-list">
        {#each filteredResults as result (result.id)}
          <button class="result-item" onclick={() => handleResultClick(result)}>
            <div class="result-icon">
              <i class="fas {getResultIcon(result.type)}" aria-hidden="true"
              ></i>
            </div>
            <div class="result-content">
              <div class="result-header">
                <h4 class="result-title">{result.title}</h4>
                <span class="result-type"
                  >{getResultTypeLabel(result.type)}</span
                >
              </div>
              <p class="result-description">{result.description}</p>
              <div class="result-relevance">
                <div class="relevance-bar">
                  <div
                    class="relevance-fill"
                    style="width: {result.relevance * 100}%"
                  ></div>
                </div>
                <span class="relevance-text"
                  >{Math.round(result.relevance * 100)}% match</span
                >
              </div>
            </div>
            <i class="fas fa-chevron-right result-arrow" aria-hidden="true"></i>
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  /* Screen reader only - visually hidden but accessible */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .search-explore-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    padding: 20px;
    gap: 20px;
  }

  /* Header */
  .search-header {
    text-align: center;
  }

  .search-title {
    margin: 0;
    font-size: var(--font-size-2xl);
    font-weight: 600;
    color: var(--theme-text, white);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }

  .search-subtitle {
    margin: 8px 0 0 0;
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  /* Search input */
  .search-input-container {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: 800px;
    margin: 0 auto;
    width: 100%;
  }

  .search-icon {
    position: absolute;
    left: 16px;
    color: var(--theme-text-dim);
    pointer-events: none;
  }

  .search-input {
    flex: 1;
    padding: 14px 16px 14px 50px;
    background: var(--theme-card-bg);
    border: 2px solid var(--theme-stroke);
    border-radius: 12px;
    color: var(--theme-text);
    font-size: var(--font-size-sm);
    transition: all var(--duration-normal) ease;
  }

  .search-input:focus {
    outline: none;
    background: var(--theme-card-hover-bg);
    border-color: color-mix(in srgb, var(--semantic-info) 50%, transparent);
    box-shadow: 0 0 0 4px
      color-mix(in srgb, var(--semantic-info) 10%, transparent);
  }

  .search-input::placeholder {
    color: var(--theme-text-dim);
  }

  .search-button {
    min-width: var(--min-touch-target);
    min-height: var(--min-touch-target);
    padding: 14px 20px;
    background: color-mix(in srgb, var(--semantic-info) 20%, transparent);
    border: 2px solid color-mix(in srgb, var(--semantic-info) 40%, transparent);
    border-radius: 12px;
    color: var(--semantic-info);
    font-size: var(--font-size-base);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .search-button:hover:not(:disabled) {
    background: color-mix(in srgb, var(--semantic-info) 30%, transparent);
    border-color: color-mix(in srgb, var(--semantic-info) 60%, transparent);
    transform: translateX(2px);
  }

  .search-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Result filters */
  .result-filters {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    scrollbar-width: none;
    padding: 4px 0;
  }

  .result-filters::-webkit-scrollbar {
    display: none;
  }

  .filter-tab {
    min-height: var(--min-touch-target);
    padding: 12px 18px;
    background: var(--theme-panel-bg);
    border: var(--theme-stroke);
    border-radius: 24px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    white-space: nowrap;
  }

  .filter-tab:hover {
    background: var(--theme-panel-elevated-bg);
    color: var(--theme-text);
  }

  .filter-tab.active {
    background: color-mix(in srgb, var(--semantic-info) 20%, transparent);
    border-color: color-mix(in srgb, var(--semantic-info) 40%, transparent);
    color: var(--theme-text, white);
  }

  /* Content area */
  .search-content {
    flex: 1;
    overflow-y: auto;
    padding: 4px;
  }

  /* Suggestions */
  .suggestions-container {
    max-width: 800px;
    margin: 0 auto;
  }

  .suggestions-title {
    margin: 0 0 16px 0;
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--theme-text-dim);
  }

  .suggestions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
    margin-bottom: 32px;
  }

  .suggestion-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: var(--min-touch-target);
    padding: 12px 16px;
    background: var(--theme-card-bg);
    border: var(--theme-stroke);
    border-radius: 10px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm);
    text-align: left;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .suggestion-chip:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    transform: translateY(-2px);
  }

  .suggestion-chip i {
    color: var(--semantic-warning);
  }

  /* AI callout */
  .ai-callout {
    display: flex;
    gap: 16px;
    padding: 20px;
    background: linear-gradient(
      135deg,
      rgba(123, 31, 162, 0.15),
      rgba(0, 123, 255, 0.15)
    );
    border: 1px solid rgba(123, 31, 162, 0.3);
    border-radius: 12px;
  }

  .ai-callout i {
    font-size: var(--font-size-3xl);
    color: rgba(186, 104, 200, 0.8);
  }

  .callout-content strong {
    display: block;
    margin-bottom: 4px;
    font-size: var(--font-size-base);
    color: var(--theme-text, white);
  }

  .callout-content p {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim, var(--theme-text-dim));
    line-height: 1.5;
  }

  /* Loading and empty states */
  .loading-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 60px 20px;
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .loading-state i,
  .empty-state i {
    font-size: var(--font-size-3xl);
  }

  .empty-state h3 {
    margin: 0;
    font-size: var(--font-size-xl);
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .empty-state p {
    margin: 0;
    font-size: var(--font-size-sm);
    text-align: center;
  }

  /* Results list */
  .results-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .result-item {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    background: var(--theme-card-bg);
    border: var(--theme-stroke);
    border-radius: 12px;
    text-align: left;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .result-item:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    transform: translateX(4px);
  }

  .result-icon {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-hover-bg, var(--theme-card-bg));
    border-radius: 10px;
    font-size: var(--font-size-xl);
    color: var(--theme-text-dim, var(--theme-text-dim));
    flex-shrink: 0;
  }

  .result-content {
    flex: 1;
    min-width: 0;
  }

  .result-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 6px;
  }

  .result-title {
    margin: 0;
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .result-type {
    padding: 3px 8px;
    background: var(--theme-card-hover-bg);
    border-radius: 4px;
    font-size: var(--font-size-compact);
    font-weight: 500;
    color: var(--theme-text-dim, var(--theme-text-dim));
    text-transform: uppercase;
  }

  .result-description {
    margin: 0 0 8px 0;
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .result-relevance {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .relevance-bar {
    flex: 1;
    height: 4px;
    background: var(--theme-stroke);
    border-radius: 2px;
    overflow: hidden;
  }

  .relevance-fill {
    height: 100%;
    background: linear-gradient(
      90deg,
      var(--semantic-success),
      var(--semantic-info)
    );
    transition: width var(--duration-emphasis) ease;
  }

  .relevance-text {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim, var(--theme-text-dim));
    white-space: nowrap;
  }

  .result-arrow {
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm);
    flex-shrink: 0;
  }

  /* Responsive design */
  @media (max-width: 480px) {
    .search-explore-panel {
      padding: 16px;
      gap: 16px;
    }

    .search-title {
      font-size: var(--font-size-xl);
    }

    .search-subtitle {
      font-size: var(--font-size-compact);
    }

    .search-input {
      font-size: var(--font-size-sm);
      padding: 12px 12px 12px 50px;
      min-height: var(--min-touch-target);
    }

    .search-button {
      min-width: var(--min-touch-target);
      min-height: var(--min-touch-target);
      padding: 12px 16px;
    }

    .suggestions-grid {
      grid-template-columns: 1fr;
    }

    .result-item {
      padding: 12px;
      gap: 12px;
      min-height: var(--min-touch-target);
    }

    /* Visual size reduced but icon is not the touch target - result-item is */
    .result-icon {
      width: 40px;
      height: 40px;
      font-size: var(--font-size-lg);
    }
  }
</style>
