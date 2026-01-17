<script lang="ts">
  /**
   * Category Browser - Browse skewed pictographs by category
   *
   * Loads all skewed pictographs and allows filtering by category (1-4).
   * Includes pagination for manageable browsing.
   * Responds to prop type changes (Alt+number, P key).
   */

  import { onMount } from "svelte";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import { GridMode, GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import type { ILetterQueryHandler } from "$lib/shared/foundation/services/contracts/data/data-contracts";
  import { container } from "$lib/shared/di";
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";

  // Cardinal locations (for determining grid type)
  const CARDINAL = new Set([GridLocation.NORTH, GridLocation.EAST, GridLocation.SOUTH, GridLocation.WEST]);

  function isCardinal(loc: GridLocation): boolean {
    return CARDINAL.has(loc);
  }

  function formatLoc(loc: GridLocation | undefined): string {
    if (!loc) return "?";
    // Abbreviate: NORTH -> N, NORTHEAST -> NE, etc.
    return loc.replace(/NORTH/g, "N").replace(/SOUTH/g, "S").replace(/EAST/g, "E").replace(/WEST/g, "W");
  }

  function getGridType(loc: GridLocation | undefined): "C" | "I" | "?" {
    if (!loc) return "?";
    return isCardinal(loc) ? "C" : "I";
  }

  // State
  let allPictographs: PictographData[] = $state([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let selectedCategory = $state<1 | 2 | 3 | 4 | "all">("all");
  let currentPage = $state(0);
  const perPage = 24;

  // Get user's prop types from reactive settings (responds to Alt+number, P key)
  const bluePropType = $derived.by(() => {
    const settings = getSettings();
    return (settings.bluePropType ?? settings.propType ?? PropType.STAFF) as PropType;
  });

  const redPropType = $derived.by(() => {
    const settings = getSettings();
    return (settings.redPropType ?? settings.propType ?? PropType.STAFF) as PropType;
  });

  // Filtered and paginated data
  const filtered = $derived(
    selectedCategory === "all"
      ? allPictographs
      : allPictographs.filter((p) => p.category === selectedCategory)
  );

  const totalPages = $derived(Math.ceil(filtered.length / perPage));

  const paginated = $derived(
    filtered.slice(currentPage * perPage, (currentPage + 1) * perPage)
  );

  // Category counts
  const categoryCounts = $derived({
    1: allPictographs.filter((p) => p.category === 1).length,
    2: allPictographs.filter((p) => p.category === 2).length,
    3: allPictographs.filter((p) => p.category === 3).length,
    4: allPictographs.filter((p) => p.category === 4).length,
  });

  // Load data on mount
  onMount(async () => {
    try {
      const letterQueryHandler = container.items.letterQueryHandler;
      allPictographs = await letterQueryHandler.getAllPictographVariations(
        GridMode.SKEWED
      );
      isLoading = false;
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to load pictographs";
      isLoading = false;
    }
  });

  // Reset page when filter changes
  $effect(() => {
    selectedCategory;
    currentPage = 0;
  });

  function prevPage() {
    if (currentPage > 0) currentPage--;
  }

  function nextPage() {
    if (currentPage < totalPages - 1) currentPage++;
  }

  function formatPosition(p: PictographData): string {
    const start = p.startPosition?.replace(/^(\w+)(\d+)$/, "$1$2") || "?";
    const end = p.endPosition?.replace(/^(\w+)(\d+)$/, "$1$2") || "?";
    return `${start} → ${end}`;
  }

  // Track which card was just copied (for visual feedback)
  let copiedId = $state<string | null>(null);

  async function copyPictographInfo(p: PictographData) {
    const info = JSON.stringify(p, null, 2);
    await navigator.clipboard.writeText(info);
    copiedId = p.id;
    setTimeout(() => {
      if (copiedId === p.id) copiedId = null;
    }, 1500);
  }
</script>

<div class="category-browser">
  <header class="header">
    <h2>Category Browser</h2>
    <p class="description">
      Browse skewed pictographs by category. {allPictographs.length} total pictographs.
    </p>
  </header>

  {#if isLoading}
    <div class="loading">
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      Loading pictographs...
    </div>
  {:else if error}
    <div class="error" role="alert">
      <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
      <p>{error}</p>
      <button class="retry-btn" onclick={() => location.reload()}>
        <i class="fas fa-redo" aria-hidden="true"></i>
        Retry
      </button>
    </div>
  {:else}
    <!-- Category Filter -->
    <nav class="filter-chips">
      <button
        class="chip"
        class:active={selectedCategory === "all"}
        onclick={() => (selectedCategory = "all")}
      >
        All
        <span class="count">{allPictographs.length}</span>
      </button>
      <button
        class="chip cat1"
        class:active={selectedCategory === 1}
        onclick={() => (selectedCategory = 1)}
      >
        Cat 1
        <span class="label">normal→skewed</span>
        <span class="count">{categoryCounts[1]}</span>
      </button>
      <button
        class="chip cat2"
        class:active={selectedCategory === 2}
        onclick={() => (selectedCategory = 2)}
      >
        Cat 2
        <span class="label">both skew→normal</span>
        <span class="count">{categoryCounts[2]}</span>
      </button>
      <button
        class="chip cat3"
        class:active={selectedCategory === 3}
        onclick={() => (selectedCategory = 3)}
        disabled={categoryCounts[3] === 0}
      >
        Cat 3
        <span class="label">skewed→skewed</span>
        <span class="count">{categoryCounts[3]}</span>
      </button>
      <button
        class="chip cat4"
        class:active={selectedCategory === 4}
        onclick={() => (selectedCategory = 4)}
        disabled={categoryCounts[4] === 0}
      >
        Cat 4
        <span class="label">skewed→normal</span>
        <span class="count">{categoryCounts[4]}</span>
      </button>
    </nav>

    <!-- Pagination Controls -->
    <div class="pagination">
      <button
        class="page-btn"
        onclick={prevPage}
        disabled={currentPage === 0}
        aria-label="Previous page"
      >
        <i class="fas fa-chevron-left" aria-hidden="true"></i>
      </button>
      <span class="page-info">
        Page {currentPage + 1} of {totalPages}
        <span class="showing">
          (showing {currentPage * perPage + 1}-{Math.min(
            (currentPage + 1) * perPage,
            filtered.length
          )} of {filtered.length})
        </span>
      </span>
      <button
        class="page-btn"
        onclick={nextPage}
        disabled={currentPage >= totalPages - 1}
        aria-label="Next page"
      >
        <i class="fas fa-chevron-right" aria-hidden="true"></i>
      </button>
    </div>

    <!-- Pictograph Grid -->
    {#if paginated.length === 0}
      <div class="empty-state">
        <i class="fas fa-layer-group" aria-hidden="true"></i>
        <p>No pictographs in this category</p>
      </div>
    {:else}
    <div class="grid themed-scrollbar">
      {#each paginated as pictograph (pictograph.id)}
        {@const blueMotion = pictograph.motions[MotionColor.BLUE]}
        {@const redMotion = pictograph.motions[MotionColor.RED]}
        <article class="card">
          <div class="pictograph-area">
            <PictographContainer
              pictographData={pictograph}
              gridMode={GridMode.SKEWED}
              bluePropTypeOverride={bluePropType}
              redPropTypeOverride={redPropType}
            />
          </div>
          <div class="card-info">
            <div class="info-header">
              <span class="letter">{pictograph.letter}</span>
              <div class="header-actions">
                <span class="category cat{pictograph.category}">Cat {pictograph.category}</span>
                <button
                  class="copy-btn"
                  class:copied={copiedId === pictograph.id}
                  onclick={() => copyPictographInfo(pictograph)}
                  title="Copy info to clipboard"
                  aria-label="Copy pictograph info to clipboard"
                >
                  <i class="fas {copiedId === pictograph.id ? 'fa-check' : 'fa-copy'}" aria-hidden="true"></i>
                </button>
              </div>
            </div>
            <div class="position-row">
              <span class="pos-label">Pos:</span>
              <span class="position">{formatPosition(pictograph)}</span>
            </div>
            <div class="motion-details">
              <div class="motion blue">
                <span class="motion-label">Blue:</span>
                <span class="motion-type">{blueMotion?.motionType ?? "?"}</span>
                <span class="motion-locs">
                  {formatLoc(blueMotion?.startLocation)}
                  <span class="grid-type">({getGridType(blueMotion?.startLocation)})</span>
                  →
                  {formatLoc(blueMotion?.endLocation)}
                  <span class="grid-type">({getGridType(blueMotion?.endLocation)})</span>
                </span>
              </div>
              <div class="motion red">
                <span class="motion-label">Red:</span>
                <span class="motion-type">{redMotion?.motionType ?? "?"}</span>
                <span class="motion-locs">
                  {formatLoc(redMotion?.startLocation)}
                  <span class="grid-type">({getGridType(redMotion?.startLocation)})</span>
                  →
                  {formatLoc(redMotion?.endLocation)}
                  <span class="grid-type">({getGridType(redMotion?.endLocation)})</span>
                </span>
              </div>
            </div>
          </div>
        </article>
      {/each}
    </div>
    {/if}

    <!-- Bottom Pagination -->
    {#if totalPages > 1}
      <div class="pagination bottom">
        <button
          class="page-btn"
          onclick={prevPage}
          disabled={currentPage === 0}
        >
          <i class="fas fa-chevron-left" aria-hidden="true"></i>
          Previous
        </button>
        <span class="page-info">
          Page {currentPage + 1} of {totalPages}
        </span>
        <button
          class="page-btn"
          onclick={nextPage}
          disabled={currentPage >= totalPages - 1}
        >
          Next
          <i class="fas fa-chevron-right" aria-hidden="true"></i>
        </button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .category-browser {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .header {
    padding: 1rem 1.5rem;
    flex-shrink: 0;
  }

  h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--theme-text, #fff);
  }

  .description {
    margin: 0.25rem 0 0;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-secondary, #888);
  }

  .loading,
  .error {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 2rem;
    color: var(--theme-text-secondary, #888);
  }

  .error {
    flex-direction: column;
    color: var(--semantic-error, #ef4444);
  }

  .error p {
    margin: 0;
    font-size: var(--font-size-min, 14px);
  }

  .retry-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
    padding: 0.625rem 1.25rem;
    min-height: 44px;
    border: 1px solid var(--semantic-error, #ef4444);
    border-radius: 8px;
    background: transparent;
    color: var(--semantic-error, #ef4444);
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .retry-btn:hover {
    background: rgba(239, 68, 68, 0.1);
  }

  .retry-btn:focus-visible {
    outline: 2px solid var(--semantic-error, #ef4444);
    outline-offset: 2px;
  }

  .retry-btn:active {
    transform: scale(0.97);
  }

  @media (pointer: coarse) {
    .retry-btn {
      min-height: 48px;
    }
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 3rem 2rem;
    color: var(--theme-text-secondary, #888);
  }

  .empty-state i {
    font-size: 2.5rem;
    opacity: 0.4;
  }

  .empty-state p {
    margin: 0;
    font-size: var(--font-size-min, 14px);
  }

  .filter-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0 1.5rem 1rem;
    flex-shrink: 0;
  }

  .chip {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 9999px;
    background: transparent;
    color: var(--theme-text-secondary, #888);
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .chip:hover:not(:disabled) {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #fff);
  }

  .chip:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .chip.active {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-accent, #8b5cf6);
    color: var(--theme-text, #fff);
  }

  .chip.cat1.active {
    border-color: #60a5fa;
  }

  .chip.cat2.active {
    border-color: #34d399;
  }

  .chip.cat3.active {
    border-color: #fbbf24;
  }

  .chip.cat4.active {
    border-color: #f87171;
  }

  .chip .label {
    font-size: var(--font-size-compact, 12px);
    opacity: 0.6;
  }

  .chip .count {
    font-size: var(--font-size-compact, 12px);
    padding: 0.125rem 0.375rem;
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.1);
  }

  .chip:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .chip:active:not(:disabled) {
    transform: scale(0.97);
  }

  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 0 1.5rem 1rem;
    flex-shrink: 0;
  }

  .pagination.bottom {
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .page-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    min-height: 44px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    background: transparent;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  @media (pointer: coarse) {
    .page-btn {
      min-height: 48px;
      padding: 0.75rem 1rem;
    }
  }

  .page-btn:hover:not(:disabled) {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .page-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .page-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .page-btn:active:not(:disabled) {
    transform: scale(0.97);
  }

  .page-info {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-secondary, #888);
  }

  .page-info .showing {
    font-size: var(--font-size-compact, 12px);
    opacity: 0.7;
  }

  .grid {
    flex: 1;
    overflow-y: auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    grid-auto-rows: auto;
    align-content: start;
    gap: 0.75rem;
    padding: 0 1.5rem 1rem;
  }

  .card {
    display: flex;
    flex-direction: column;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 12px;
    transition: border-color var(--duration-fast) ease;
  }

  .card:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .pictograph-area {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem;
  }

  .card-info {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding: 0.5rem 0.75rem 0.75rem;
    background: rgba(0, 0, 0, 0.2);
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.05));
    font-size: var(--font-size-compact, 12px);
  }

  .info-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .letter {
    font-weight: 700;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text, #fff);
  }

  .category {
    padding: 0.125rem 0.5rem;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.1);
    color: var(--theme-text-secondary, #888);
    font-weight: 600;
  }

  .category.cat1 {
    background: rgba(96, 165, 250, 0.2);
    color: #60a5fa;
  }

  .category.cat2 {
    background: rgba(52, 211, 153, 0.2);
    color: #34d399;
  }

  .category.cat3 {
    background: rgba(251, 191, 36, 0.2);
    color: #fbbf24;
  }

  .category.cat4 {
    background: rgba(248, 113, 113, 0.2);
    color: #f87171;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .copy-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border: none;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.08);
    color: var(--theme-text-secondary, #888);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  @media (pointer: coarse) {
    .copy-btn {
      width: 2.75rem;
      height: 2.75rem;
    }
  }

  .copy-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: var(--theme-text, #fff);
  }

  .copy-btn.copied {
    background: rgba(52, 211, 153, 0.2);
    color: #34d399;
  }

  .copy-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .copy-btn:active {
    transform: scale(0.9);
  }

  .position-row {
    display: flex;
    gap: 0.5rem;
    color: var(--theme-text-secondary, #888);
  }

  .pos-label {
    font-weight: 600;
    opacity: 0.7;
  }

  .position {
    color: var(--theme-text, #fff);
  }

  .motion-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-top: 0.25rem;
    padding-top: 0.375rem;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.05));
  }

  .motion {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: var(--font-size-compact, 12px);
  }

  .motion-label {
    font-weight: 600;
    min-width: 2rem;
  }

  .motion.blue .motion-label {
    color: #60a5fa;
  }

  .motion.red .motion-label {
    color: #f87171;
  }

  .motion-type {
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.08);
    color: var(--theme-text, #fff);
    font-weight: 500;
    text-transform: lowercase;
  }

  .motion-locs {
    color: var(--theme-text-secondary, #888);
  }

  .grid-type {
    font-size: var(--font-size-compact, 12px);
    opacity: 0.6;
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .chip,
    .page-btn,
    .copy-btn,
    .retry-btn,
    .card {
      transition: none;
    }

    .chip:active:not(:disabled),
    .page-btn:active:not(:disabled),
    .copy-btn:active,
    .retry-btn:active {
      transform: none;
    }

    .loading i {
      animation: none;
    }
  }
</style>
