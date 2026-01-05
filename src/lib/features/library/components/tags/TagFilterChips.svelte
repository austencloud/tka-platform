<!--
  TagFilterChips.svelte

  Tag filter chips for Library sequences view.
  Features:
  - Show all available tags as selectable chips
  - Multi-select with OR logic
  - Display use count per tag
  - Clear all filter button
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { tryResolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import type { ITagManager } from "../../services/contracts/ITagManager";
  import type { LibraryTag } from "../../domain/models/Tag";
  import { libraryState } from "../../state/library-state.svelte";

  // Services
  const tagService = tryResolve<ITagManager>(TYPES.ITagManager);

  // State
  let allTags = $state<LibraryTag[]>([]);
  let isLoading = $state(true);
  let unsubscribe: (() => void) | null = null;

  // Derived: selected tag IDs from global state
  const selectedTagIds = $derived(libraryState.filters.tagIds);
  const hasActiveFilters = $derived(selectedTagIds.length > 0);

  // Sorted tags by use count (most used first)
  const sortedTags = $derived(
    [...allTags].sort((a, b) => {
      if (b.useCount !== a.useCount) return b.useCount - a.useCount;
      return a.name.localeCompare(b.name);
    })
  );

  onMount(() => {
    if (tagService) {
      // Subscribe to real-time tag updates
      unsubscribe = tagService.subscribeToTags((tags) => {
        allTags = tags;
        isLoading = false;
      });
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  });

  function handleTagClick(tagId: string) {
    libraryState.toggleTagFilter(tagId);
  }

  function handleClearAll() {
    libraryState.clearTagFilter();
  }

  function isSelected(tagId: string): boolean {
    return selectedTagIds.includes(tagId);
  }
</script>

{#if sortedTags.length > 0}
  <div class="tag-filter-container">
    <div class="tag-filter-header">
      <span class="filter-label">
        <i class="fas fa-tags" aria-hidden="true"></i>
        Tags
      </span>
      {#if hasActiveFilters}
        <button class="clear-btn" onclick={handleClearAll}>
          Clear ({selectedTagIds.length})
        </button>
      {/if}
    </div>

    <div class="tag-chips">
      {#each sortedTags as tag (tag.id)}
        <button
          class="tag-chip"
          class:selected={isSelected(tag.id)}
          style:--tag-color={tag.color || "rgba(255, 255, 255, 0.3)"}
          onclick={() => handleTagClick(tag.id)}
          title="{tag.name} ({tag.useCount} sequences)"
        >
          {#if tag.icon}
            <span class="tag-icon">{tag.icon}</span>
          {/if}
          <span class="tag-name">{tag.name}</span>
          <span class="tag-count">{tag.useCount}</span>
        </button>
      {/each}
    </div>
  </div>
{:else if isLoading}
  <div class="tag-filter-loading">
    <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
    <span>Loading tags...</span>
  </div>
{/if}

<style>
  .tag-filter-container {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .tag-filter-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-sm);
  }

  .filter-label {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .filter-label i {
    font-size: 0.75rem;
  }

  .clear-btn {
    background: none;
    border: none;
    padding: var(--spacing-xs) var(--spacing-sm);
    font-size: var(--font-size-compact);
    color: var(--theme-accent);
    cursor: pointer;
    transition: color 0.15s ease;
  }

  .clear-btn:hover {
    color: var(--theme-accent-strong);
    text-decoration: underline;
  }

  .tag-chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs);
  }

  .tag-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 999px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .tag-chip:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
    color: var(--theme-text);
  }

  .tag-chip.selected {
    background: color-mix(in srgb, var(--tag-color) 25%, transparent);
    border-color: var(--tag-color);
    color: rgba(255, 255, 255, 1);
  }

  .tag-chip.selected:hover {
    background: color-mix(in srgb, var(--tag-color) 35%, transparent);
  }

  .tag-icon {
    font-size: 0.875rem;
  }

  .tag-name {
    font-weight: 500;
  }

  .tag-count {
    padding: 1px 5px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 999px;
    font-size: 0.625rem;
    font-weight: 600;
  }

  .tag-chip.selected .tag-count {
    background: rgba(255, 255, 255, 0.2);
  }

  .tag-filter-loading {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    color: rgba(255, 255, 255, 0.75); /* WCAG AAA */
    font-size: var(--font-size-compact);
  }

  /* Responsive: Hide on very small screens if needed */
  @container (max-width: 400px) {
    .tag-chip span.tag-count {
      display: none;
    }
  }
</style>
