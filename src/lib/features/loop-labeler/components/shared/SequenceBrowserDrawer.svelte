<!--
  Sequence Browser Drawer

  Uses the existing Drawer infrastructure to browse and jump to any sequence.
  Shows thumbnail previews with label status indicators.
  Uses shared design tokens from app.css.
-->
<script lang="ts">
  import type { SequenceEntry } from "$lib/shared/loop-labeler/domain/sequence-models";
  import type { LabeledSequence } from "../../domain/models/label-models";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import DrawerHeader from "$lib/shared/foundation/ui/DrawerHeader.svelte";
  import FontAwesomeIcon from "$lib/shared/foundation/ui/FontAwesomeIcon.svelte";
  import TKAWordGlyph from "$lib/shared/choreo-card/components/TKAWordGlyph.svelte";

  type FilterMode = "all" | "unlabeled" | "labeled" | "unknown";

  interface Props {
    isOpen: boolean;
    sequences: SequenceEntry[];
    labels: Map<string, LabeledSequence>;
    currentSequenceId: string | null;
    onClose: () => void;
    onSelectSequence: (sequenceId: string) => void;
  }

  let {
    isOpen = $bindable(),
    sequences,
    labels,
    currentSequenceId,
    onClose,
    onSelectSequence,
  }: Props = $props();

  // Local filter state
  let localFilter = $state<FilterMode>("all");
  let searchQuery = $state("");

  // Filter sequences
  const filteredSequences = $derived(() => {
    let result = sequences;

    // Apply status filter
    if (localFilter === "labeled") {
      result = result.filter((s) => labels.has(s.word));
    } else if (localFilter === "unlabeled") {
      result = result.filter((s) => !labels.has(s.word));
    } else if (localFilter === "unknown") {
      result = result.filter((s) => {
        const label = labels.get(s.word);
        return label?.isUnknown === true;
      });
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((s) => s.word.toLowerCase().includes(query));
    }

    return result;
  });

  // Get label status for a sequence
  function getLabelStatus(
    seq: SequenceEntry
  ): "labeled" | "unlabeled" | "unknown" {
    const label = labels.get(seq.word);
    if (!label) return "unlabeled";
    if (label.isUnknown) return "unknown";
    return "labeled";
  }

  // Get thumbnail URL for a sequence
  function getThumbnailUrl(seq: SequenceEntry): string | null {
    if (seq.thumbnails && seq.thumbnails.length > 0) {
      return seq.thumbnails[0] ?? null;
    }
    return null;
  }

  function handleSelect(seq: SequenceEntry) {
    onSelectSequence(seq.id);
    isOpen = false;
  }

  function handleClose() {
    onClose();
  }
</script>

<Drawer
  bind:isOpen
  placement="right"
  closeOnBackdrop={true}
  closeOnEscape={true}
  onclose={handleClose}
  class="sequence-browser-drawer"
>
  <div class="drawer-content">
    <DrawerHeader title="Browse Sequences" onClose={() => (isOpen = false)} />

    <!-- Search -->
    <div class="drawer-search">
      <FontAwesomeIcon icon="search" size="0.9em" />
      <input
        type="text"
        placeholder="Search sequences..."
        bind:value={searchQuery}
      />
      {#if searchQuery}
        <button class="clear-search" onclick={() => (searchQuery = "")} aria-label="Clear search">
          <FontAwesomeIcon icon="xmark" size="0.8em" />
        </button>
      {/if}
    </div>

    <!-- Filter chips -->
    <div class="drawer-filters">
      <button
        class="filter-chip"
        class:active={localFilter === "all"}
        onclick={() => (localFilter = "all")}
      >
        All ({sequences.length})
      </button>
      <button
        class="filter-chip"
        class:active={localFilter === "unlabeled"}
        onclick={() => (localFilter = "unlabeled")}
      >
        Unlabeled
      </button>
      <button
        class="filter-chip"
        class:active={localFilter === "labeled"}
        onclick={() => (localFilter = "labeled")}
      >
        Labeled
      </button>
      <button
        class="filter-chip"
        class:active={localFilter === "unknown"}
        onclick={() => (localFilter = "unknown")}
      >
        Unknown
      </button>
    </div>

    <!-- Sequence count -->
    <div class="sequence-count">
      {filteredSequences().length} sequences
    </div>

    <!-- Sequence grid with thumbnails -->
    <div class="sequence-grid">
      {#each filteredSequences() as seq (seq.id)}
        {@const status = getLabelStatus(seq)}
        {@const thumbnail = getThumbnailUrl(seq)}
        <button
          class="sequence-card"
          class:current={seq.id === currentSequenceId}
          class:labeled={status === "labeled"}
          class:unknown={status === "unknown"}
          onclick={() => handleSelect(seq)}
        >
          <!-- Thumbnail -->
          <div class="card-thumbnail">
            {#if thumbnail}
              <img src={thumbnail} alt={seq.word} loading="lazy" />
            {:else}
              <div class="thumbnail-placeholder">
                <span>{seq.word.slice(0, 2)}</span>
              </div>
            {/if}
            <!-- Status badge overlay -->
            <div
              class="status-badge"
              class:labeled={status === "labeled"}
              class:unknown={status === "unknown"}
            >
              {#if status === "labeled"}
                <FontAwesomeIcon icon="check" size="0.7em" />
              {:else if status === "unknown"}
                ?
              {/if}
            </div>
          </div>
          <!-- Card footer -->
          <div class="card-footer">
            <span class="card-word"><TKAWordGlyph word={seq.word} height={11} darkMode /></span>
            <span class="card-meta">{seq.sequenceLength}b</span>
          </div>
        </button>
      {/each}
    </div>
  </div>
</Drawer>

<style>
  .drawer-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--background);
  }

  .drawer-search {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    margin: var(--spacing-md) var(--spacing-xl);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--surface-color);
    border: 1px solid var(--theme-stroke, var(--theme-stroke-strong));
    border-radius: 8px;
    color: var(--muted);
    flex-shrink: 0;
  }

  .drawer-search:focus-within {
    border-color: var(--primary-color);
  }

  .drawer-search input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--foreground);
    font-size: var(--font-size-sm);
  }

  .drawer-search input::placeholder {
    color: var(--muted);
  }

  .clear-search {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    background: transparent;
    border: none;
    color: var(--muted);
    cursor: pointer;
    border-radius: 4px;
  }

  .clear-search:hover {
    color: var(--foreground);
  }

  .drawer-filters {
    display: flex;
    gap: 4px;
    padding: 0 var(--spacing-xl);
    margin-bottom: var(--spacing-md);
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  .filter-chip {
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--surface-color);
    border: 1px solid var(--theme-stroke, var(--theme-stroke-strong));
    border-radius: 9999px;
    color: var(--muted-foreground);
    cursor: pointer;
    font-size: var(--font-size-xs);
    transition: var(--transition-fast);
  }

  .filter-chip:hover {
    background: var(--surface-hover);
  }

  .filter-chip.active {
    background: color-mix(in srgb, var(--primary-color) 25%, transparent);
    border-color: var(--primary-color);
    color: var(--foreground);
  }

  .sequence-count {
    padding: 0 var(--spacing-xl);
    margin-bottom: var(--spacing-sm);
    font-size: var(--font-size-xs);
    color: var(--muted);
    flex-shrink: 0;
  }

  .sequence-grid {
    flex: 1;
    overflow-y: auto;
    padding: 0 var(--spacing-md) var(--spacing-md);
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-auto-rows: min-content;
    gap: var(--spacing-sm);
    align-items: start;
  }

  .sequence-grid::-webkit-scrollbar {
    width: 6px;
  }

  .sequence-grid::-webkit-scrollbar-track {
    background: transparent;
  }

  .sequence-grid::-webkit-scrollbar-thumb {
    background: var(--theme-stroke);
    border-radius: 3px;
  }

  .sequence-card {
    display: flex;
    flex-direction: column;
    background: var(--surface-color);
    border: 1px solid transparent;
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    transition: var(--transition-fast);
    padding: 0;
    min-width: 0;
  }

  .sequence-card:hover {
    background: var(--surface-hover);
    border-color: var(--theme-stroke, var(--theme-stroke-strong));
  }

  .sequence-card.current {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 1px var(--primary-color);
  }

  .card-thumbnail {
    position: relative;
    background: var(--surface-dark);
  }

  .card-thumbnail img {
    width: 100%;
    height: auto;
    display: block;
  }

  .thumbnail-placeholder {
    width: 100%;
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--primary-color) 20%, transparent),
      color-mix(in srgb, var(--feature-edit) 20%, transparent)
    );
    color: var(--muted);
    font-size: 1.5rem;
    font-weight: 600;
  }

  .status-badge {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-compact);
    font-weight: 600;
    background: var(--theme-stroke);
    color: var(--muted);
    backdrop-filter: none;
  }

  .status-badge.labeled {
    background: color-mix(in srgb, var(--semantic-success) 30%, transparent);
    color: var(--semantic-success);
  }

  .status-badge.unknown {
    background: color-mix(in srgb, var(--semantic-warning) 30%, transparent);
    color: var(--semantic-warning);
  }

  .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--theme-card-bg);
  }

  .card-word {
    font-size: var(--font-size-xs);
    font-weight: 500;
    color: var(--foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-meta {
    font-size: var(--font-size-compact);
    color: var(--muted);
    flex-shrink: 0;
  }
</style>
