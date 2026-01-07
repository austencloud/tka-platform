<!--
  WordCardFilters.svelte - Additional filters for word cards

  Difficulty, favorites, grid mode, and author filters.
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { resolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import { onMount } from "svelte";

  interface Props {
    favorites: boolean;
    gridMode: string | null;
    author: string | null;
    authors: string[];
    onFavoritesChange: (value: boolean) => void;
    onGridModeChange: (value: string | null) => void;
    onAuthorChange: (value: string | null) => void;
  }

  let {
    favorites,
    gridMode,
    author,
    authors,
    onFavoritesChange,
    onGridModeChange,
    onAuthorChange,
  }: Props = $props();

  let hapticService: IHapticFeedback;

  onMount(() => {
    hapticService = resolve<IHapticFeedback>(TYPES.IHapticFeedback);
  });

  const gridModeOptions = [
    { value: null, label: "All" },
    { value: "diamond", label: "Diamond" },
    { value: "box", label: "Box" },
  ];

  function handleFavoritesClick() {
    hapticService?.trigger("selection");
    onFavoritesChange(!favorites);
  }

  function handleGridModeClick(value: string | null) {
    hapticService?.trigger("selection");
    onGridModeChange(value);
  }

  function handleAuthorChange(event: Event) {
    hapticService?.trigger("selection");
    const target = event.target as HTMLSelectElement;
    onAuthorChange(target.value === "" ? null : target.value);
  }
</script>

<div class="filters">
  <!-- Favorites Toggle -->
  <section class="section">
    <button
      class="favorites-toggle"
      class:active={favorites}
      onclick={handleFavoritesClick}
      aria-pressed={favorites}
      type="button"
    >
      <i class="fas fa-heart" aria-hidden="true"></i>
      <span>Favorites Only</span>
    </button>
  </section>

  <!-- Grid Mode -->
  <section class="section">
    <h3 class="section-title">
      <i class="fas fa-th" aria-hidden="true"></i>
      <span>Grid Mode</span>
    </h3>
    <div class="filter-grid">
      {#each gridModeOptions as option (option.value)}
        <button
          class="filter-btn"
          class:selected={gridMode === option.value}
          onclick={() => handleGridModeClick(option.value)}
          aria-pressed={gridMode === option.value}
          type="button"
        >
          {option.label}
        </button>
      {/each}
    </div>
  </section>

  <!-- Author Dropdown (only if multiple authors) -->
  {#if authors.length > 1}
    <section class="section">
      <h3 class="section-title">
        <i class="fas fa-user" aria-hidden="true"></i>
        <span>Author</span>
      </h3>
      <select
        class="author-select"
        value={author ?? ""}
        onchange={handleAuthorChange}
        aria-label="Filter by author"
      >
        <option value="">All Authors</option>
        {#each authors as a (a)}
          <option value={a}>{a}</option>
        {/each}
      </select>
    </section>
  {/if}
</div>

<style>
  .filters {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    margin: 0;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .section-title i {
    font-size: 0.7rem;
    opacity: 0.7;
  }

  .filter-grid {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs);
  }

  .filter-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 48px;
    min-height: 48px;
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .filter-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .filter-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .filter-btn.selected {
    background: var(--theme-accent, #f43f5e);
    border-color: var(--theme-accent, #f43f5e);
    color: #ffffff;
  }

  /* Favorites Toggle */
  .favorites-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    width: 100%;
    min-height: 48px;
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .favorites-toggle:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .favorites-toggle:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .favorites-toggle.active {
    background: var(--semantic-error, #ef4444);
    border-color: var(--semantic-error, #ef4444);
    color: #ffffff;
  }

  .favorites-toggle i {
    font-size: 0.9rem;
  }

  /* Author Dropdown */
  .author-select {
    width: 100%;
    min-height: 48px;
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .author-select:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .author-select:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .author-select option {
    background: var(--theme-panel-bg, #1a1a2e);
    color: var(--theme-text, #ffffff);
  }

  /* Responsive */
  @media (max-width: 768px) {
    .filters {
      flex-direction: row;
      gap: var(--spacing-md);
    }

    .section {
      flex-shrink: 0;
    }

    .filter-grid {
      flex-wrap: nowrap;
    }

    .filter-btn {
      font-size: var(--font-size-compact, 12px);
    }

    .favorites-toggle {
      width: auto;
      font-size: var(--font-size-compact, 12px);
    }

    .author-select {
      width: auto;
      min-width: 120px;
      font-size: var(--font-size-compact, 12px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .filter-btn,
    .favorites-toggle,
    .author-select {
      transition: none;
    }
  }
</style>
