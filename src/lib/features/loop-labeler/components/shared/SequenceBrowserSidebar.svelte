<script lang="ts">
  /**
   * Sequence Browser Sidebar
   *
   * Persistent sidebar for browsing and jumping between sequences.
   * Shows on wide screens, hidden on narrow screens.
   */
  import type { SequenceEntry } from "../../domain/models/sequence-models";
  import type { LabeledSequence } from "../../domain/models/label-models";
  import FontAwesomeIcon from "$lib/shared/foundation/ui/FontAwesomeIcon.svelte";
  import TKAWordGlyph from "$lib/features/choreo-card/components/TKAWordGlyph.svelte";
  import { formatDesignation } from "../../services/label-formatter";

  interface Props {
    sequences: SequenceEntry[];
    labels: Map<string, LabeledSequence>;
    currentSequenceId: string | null;
    filterMode: "all" | "needsVerification" | "verified";
    onSelectSequence: (id: string) => void;
    onFilterChange: (mode: "all" | "needsVerification" | "verified") => void;
  }

  let {
    sequences,
    labels,
    currentSequenceId,
    filterMode,
    onSelectSequence,
    onFilterChange,
  }: Props = $props();

  // Filter sequences based on current filter mode
  const filteredSequences = $derived.by(() => {
    return sequences.filter((seq) => {
      const label = labels.get(seq.word);

      if (filterMode === "all") {
        return true;
      } else if (filterMode === "needsVerification") {
        return label?.needsVerification === true;
      } else {
        return label && !label.needsVerification;
      }
    });
  });

  // Get status for a sequence
  function getStatus(seq: SequenceEntry): {
    type: "verified" | "needsVerification" | "unlabeled";
    icon: string;
    color: string;
  } {
    const label = labels.get(seq.word);

    if (!label) {
      return { type: "unlabeled", icon: "circle", color: "var(--muted-foreground)" };
    }

    if (label.needsVerification) {
      return {
        type: "needsVerification",
        icon: "circle-exclamation",
        color: "var(--semantic-warning)",
      };
    }

    return {
      type: "verified",
      icon: "circle-check",
      color: "var(--semantic-success)",
    };
  }

  // Get designation label
  function getDesignationLabel(seq: SequenceEntry): string {
    const label = labels.get(seq.word);
    if (!label) return "";

    if (label.isFreeform) return "Freeform";

    if (label.sections && label.sections.length > 0) {
      return `${label.sections.length} section${label.sections.length > 1 ? "s" : ""}`;
    }

    if (label.designations && label.designations.length > 0) {
      const first = label.designations[0];
      return first ? formatDesignation(first) : "Labeled";
    }

    return "";
  }
</script>

<aside class="sequence-browser-sidebar">
  <div class="sidebar-header">
    <h2 class="sidebar-title">Sequences</h2>
    <span class="sequence-count">{filteredSequences.length}</span>
  </div>

  <div class="filter-tabs">
    <button
      class="filter-tab"
      class:active={filterMode === "needsVerification"}
      onclick={() => onFilterChange("needsVerification")}
    >
      <FontAwesomeIcon icon="circle-exclamation" size="0.85em" />
      Needs Review
    </button>
    <button
      class="filter-tab"
      class:active={filterMode === "verified"}
      onclick={() => onFilterChange("verified")}
    >
      <FontAwesomeIcon icon="circle-check" size="0.85em" />
      Verified
    </button>
  </div>

  <div class="sequence-list">
    {#each filteredSequences as seq}
      {@const status = getStatus(seq)}
      {@const designation = getDesignationLabel(seq)}
      {@const isCurrent = seq.id === currentSequenceId}
      <button
        class="sequence-item"
        class:current={isCurrent}
        onclick={() => onSelectSequence(seq.id)}
      >
        <div class="thumbnail-container">
          {#if seq.thumbnails?.[0]}
            <img
              src={seq.thumbnails[0]}
              alt={seq.word}
              class="sequence-thumbnail"
            />
          {:else}
            <div class="thumbnail-placeholder">
              <FontAwesomeIcon icon="image" size="2em" color="var(--muted)" />
            </div>
          {/if}
        </div>
        <div class="sequence-details">
          <div class="sequence-item-header">
            <span class="sequence-word"><TKAWordGlyph word={seq.word} height={13} darkMode /></span>
            <FontAwesomeIcon
              icon={status.icon}
              size="0.85em"
              color={status.color}
            />
          </div>
          <div class="sequence-info-row">
            {#if designation}
              <div class="sequence-designation">{designation}</div>
            {/if}
            <div class="sequence-meta">
              {seq.sequenceLength} steps · {seq.gridMode?.toUpperCase() ||
                "DIAMOND"}
            </div>
          </div>
        </div>
      </button>
    {/each}

    {#if filteredSequences.length === 0}
      <div class="empty-list">
        <FontAwesomeIcon icon="inbox" size="2em" color="var(--muted)" />
        <p>No sequences in this view</p>
      </div>
    {/if}
  </div>
</aside>

<style>
  .sequence-browser-sidebar {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--surface-glass);
    border-right: 1px solid var(--theme-stroke);
    overflow: hidden;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-lg);
    border-bottom: 1px solid var(--theme-stroke);
  }

  .sidebar-title {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 700;
  }

  .sequence-count {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 28px;
    height: 28px;
    padding: 0 var(--spacing-xs);
    background: color-mix(in srgb, var(--primary-color) 20%, transparent);
    border-radius: 6px;
    font-size: var(--font-size-xs);
    font-weight: 700;
    color: color-mix(in srgb, var(--primary-color) 65%, white);
  }

  .filter-tabs {
    display: flex;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--surface-dark);
    border-bottom: 1px solid var(--theme-stroke);
  }

  .filter-tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-xs) var(--spacing-sm);
    background: transparent;
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 6px;
    color: var(--muted-foreground);
    font-size: var(--font-size-xs);
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .filter-tab:hover {
    background: var(--surface-color);
    color: var(--foreground);
  }

  .filter-tab.active {
    background: color-mix(in srgb, var(--primary-color) 20%, transparent);
    border-color: color-mix(in srgb, var(--primary-color) 40%, transparent);
    color: var(--foreground);
  }

  .sequence-list {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-md);
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    grid-auto-rows: min-content;
    gap: var(--spacing-md);
    align-content: start;
  }

  .sequence-list::-webkit-scrollbar {
    width: 6px;
  }

  .sequence-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .sequence-list::-webkit-scrollbar-thumb {
    background: var(--theme-stroke);
    border-radius: 3px;
  }

  .sequence-list::-webkit-scrollbar-thumb:hover {
    background: var(--theme-stroke-strong);
  }

  .sequence-item {
    display: flex;
    flex-direction: column;
    width: 100%;
    padding: 0;
    background: var(--surface-color);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    text-align: left;
    cursor: pointer;
    transition: var(--transition-fast);
    overflow: hidden;
  }

  .thumbnail-container {
    width: 100%;
    aspect-ratio: 1;
    background: var(--surface-inset-deep);
    border-bottom: 1px solid var(--theme-stroke);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .sequence-thumbnail {
    width: 100%;
    height: 100%;
    object-fit: contain;
    padding: var(--spacing-sm);
  }

  .thumbnail-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  .sequence-details {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: var(--spacing-sm);
  }

  .sequence-info-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .sequence-item:hover {
    background: var(--surface-hover);
    border-color: color-mix(in srgb, var(--primary-color) 30%, transparent);
    box-shadow: 0 2px 8px color-mix(in srgb, var(--primary-color) 20%, transparent);
  }

  .sequence-item.current {
    background: color-mix(in srgb, var(--primary-color) 15%, transparent);
    border-color: color-mix(in srgb, var(--primary-color) 50%, transparent);
    box-shadow: 0 2px 8px color-mix(in srgb, var(--primary-color) 30%, transparent);
  }

  .sequence-item-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .sequence-word {
    font-size: var(--font-size-sm);
    font-weight: 700;
    color: var(--foreground);
  }

  .sequence-designation {
    font-size: var(--font-size-xs);
    color: var(--muted-foreground);
    font-weight: 500;
  }

  .sequence-meta {
    font-size: var(--font-size-xs);
    color: var(--muted);
  }

  .empty-list {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-xl);
    color: var(--muted);
  }

  .empty-list p {
    margin: 0;
    font-size: var(--font-size-sm);
  }
</style>
