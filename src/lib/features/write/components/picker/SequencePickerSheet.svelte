<script lang="ts">
  /**
   * SequencePickerSheet
   *
   * A modal that lets the user pick several of their saved sequences and hands
   * back an ORDERED list of ids. The order matters: the first tile you tap
   * becomes the first row of the choreo sheet, the second tap the second row,
   * and so on. That's why selection is tracked as an array, not a Set.
   *
   * Self-contained: props in, callback out. The choreo-sheet builder opens it
   * (`open`), seeds any prior choices (`initialSelectedIds` so reopening keeps
   * the order), and receives the ordered ids via `onConfirm`. It loads the
   * user's library itself, but callers can inject `sequences` directly (the test
   * harness / a builder that already has them) to skip the Firestore round-trip.
   *
   * Reuses the shared pieces rather than re-rolling them:
   * - PictographContainer renders each tile's first-step thumbnail (same pattern
   *   as personal-museum/SequencePicker + MultiSelectPositionPicker).
   * - Each tile is a <button aria-pressed> toggle-indicator (no checkboxes).
   * - getLibraryRepository().getSequences() is the list source.
   */
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import { getLibraryRepository } from "$lib/shared/library/get-library-repository";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import type { LibrarySequence } from "$lib/shared/library/domain/models/library-sequence";

  interface Props {
    /** Whether the modal is shown. The parent owns this; we never flip it. */
    open: boolean;
    /** Ids already chosen, in order — pre-selects + preserves order on reopen. */
    initialSelectedIds?: readonly string[];
    /** Confirm: the chosen ids in selection (row) order. */
    onConfirm: (orderedIds: string[]) => void;
    /** Cancel / dismiss without changing the builder's selection. */
    onCancel: () => void;
    /** Optional injected rows (test harness / builder). When omitted we load
     *  the user's library on open. */
    sequences?: readonly LibrarySequence[];
    /** Header label. */
    title?: string;
  }

  let {
    open,
    initialSelectedIds = [],
    onConfirm,
    onCancel,
    sequences,
    title = "Pick sequences",
  }: Props = $props();

  // The ordered selection. The index here IS the row order the builder receives;
  // removing a tile closes the gap so the remaining numbers stay 1..n.
  let selectedOrder = $state<string[]>([]);

  // Rows loaded from the user's library (only used when `sequences` is absent).
  let loadedSequences = $state<LibrarySequence[]>([]);
  let isLoading = $state(false);
  let loadError = $state<string | null>(null);
  let searchQuery = $state("");

  // Injected rows win; otherwise show whatever we loaded.
  const allSequences = $derived(sequences ?? loadedSequences);

  // Re-seed selection + (re)load the library on the closed→open edge only. A
  // plain latch (not $state) keeps this from re-firing on every render while
  // the sheet stays open.
  let wasOpen = false;
  $effect(() => {
    if (open && !wasOpen) {
      wasOpen = true;
      selectedOrder = [...initialSelectedIds];
      searchQuery = "";
      if (!sequences) void loadLibrary();
    } else if (!open && wasOpen) {
      wasOpen = false;
    }
  });

  async function loadLibrary() {
    isLoading = true;
    loadError = null;
    try {
      loadedSequences = await getLibraryRepository().getSequences({
        sortBy: "updatedAt",
        sortDirection: "desc",
      });
    } catch (err) {
      loadError = "Couldn't load your library. Try again.";
      console.error("[SequencePickerSheet] Failed to load sequences:", err);
    } finally {
      isLoading = false;
    }
  }

  // Client-side search over the same fields the library repo searches on.
  const visibleSequences = $derived.by(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allSequences;
    return allSequences.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.word?.toLowerCase().includes(q) ||
        s.displayName?.toLowerCase().includes(q),
    );
  });

  // 1-based position in the selection (0 = not selected). Drives the order badge
  // and aria-pressed.
  function selectionIndex(id: string): number {
    return selectedOrder.indexOf(id) + 1;
  }

  function toggle(id: string) {
    selectedOrder = selectedOrder.includes(id)
      ? selectedOrder.filter((sid) => sid !== id)
      : [...selectedOrder, id];
  }

  // Steps carry the per-step pictograph; the first one stands in as the tile
  // thumbnail (cast mirrors the museum picker — StepData is PictographData-shaped
  // for rendering).
  function firstStep(seq: LibrarySequence): PictographData | null {
    return (seq.steps?.[0] as PictographData | undefined) ?? null;
  }

  function nameFor(seq: LibrarySequence): string {
    return seq.displayName || seq.word || seq.name || seq.id;
  }

  function confirm() {
    onConfirm([...selectedOrder]);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    }
  }
</script>

<svelte:window onkeydowncapture={open ? handleKeyDown : undefined} />

{#if open}
  <div
    class="picker-backdrop"
    role="presentation"
    onclick={(e) => {
      if (e.target === e.currentTarget) onCancel();
    }}
  >
    <section class="picker-sheet" aria-label={title}>
      <header class="sheet-head">
        <div class="head-text">
          <h2>{title}</h2>
          <p>Tap to add. The order you tap becomes the row order.</p>
        </div>
        <button class="close" type="button" aria-label="Close" onclick={onCancel}>
          <i class="fas fa-xmark" aria-hidden="true"></i>
        </button>
      </header>

      <div class="search-row">
        <i class="fas fa-magnifying-glass" aria-hidden="true"></i>
        <input
          class="search-input"
          type="search"
          placeholder="Search your sequences"
          bind:value={searchQuery}
          aria-label="Search your sequences"
        />
      </div>

      <div class="picker-scroll">
        {#if isLoading}
          <p class="picker-status">Loading your sequences…</p>
        {:else if loadError}
          <p class="picker-status">{loadError}</p>
        {:else if visibleSequences.length === 0}
          <p class="picker-status">
            {searchQuery
              ? "No sequences match that search."
              : "No sequences in your library yet."}
          </p>
        {:else}
          <ul class="picker-grid">
            {#each visibleSequences as seq (seq.id)}
              {@const order = selectionIndex(seq.id)}
              <li>
                <button
                  class="pick"
                  class:selected={order > 0}
                  type="button"
                  aria-pressed={order > 0}
                  aria-label={order > 0
                    ? `Remove ${nameFor(seq)} (position ${order})`
                    : `Add ${nameFor(seq)}`}
                  onclick={() => toggle(seq.id)}
                >
                  <span class="thumb">
                    {#if firstStep(seq)}
                      <PictographContainer pictographData={firstStep(seq)} disableTransitions />
                    {/if}
                    {#if order > 0}
                      <span class="order-badge" aria-hidden="true">{order}</span>
                    {/if}
                  </span>
                  <span class="pick-name">{nameFor(seq)}</span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <footer class="sheet-foot">
        <button class="foot-btn ghost" type="button" onclick={onCancel}>Cancel</button>
        <button
          class="foot-btn primary"
          type="button"
          disabled={selectedOrder.length === 0}
          onclick={confirm}
        >
          {selectedOrder.length === 0 ? "Add sequences" : `Add ${selectedOrder.length}`}
        </button>
      </footer>
    </section>
  </div>
{/if}

<style>
  .picker-backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal, 1000);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: var(--theme-overlay-scrim, rgba(0, 0, 0, 0.55));
    backdrop-filter: blur(2px);
  }

  .picker-sheet {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: min(44rem, 100%);
    max-height: min(86vh, 44rem);
    padding: 1.25rem;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    color: var(--theme-text, #f2efe6);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 16px;
    container-type: inline-size;
    overflow: hidden;
  }

  .sheet-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .sheet-head h2 {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
  }
  .sheet-head p {
    margin: 0.25rem 0 0;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(242, 239, 230, 0.7));
  }

  .close {
    flex: none;
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 50%;
    color: inherit;
    cursor: pointer;
  }

  .search-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0 0.85rem;
    min-height: var(--min-touch-target, 44px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 12px;
    color: var(--theme-text-dim, rgba(242, 239, 230, 0.7));
  }
  .search-input {
    flex: 1 1 auto;
    min-width: 0;
    background: transparent;
    border: none;
    color: var(--theme-text, #f2efe6);
    font-size: var(--font-size-min, 14px);
  }
  .search-input:focus {
    outline: none;
  }

  .picker-scroll {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
  }

  .picker-status {
    margin: 0;
    padding: 1.5rem 0;
    text-align: center;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(242, 239, 230, 0.7));
  }

  .picker-grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
    gap: 0.75rem;
  }

  .pick {
    width: 100%;
    min-height: var(--min-touch-target, 44px);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    padding: 0.6rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    color: inherit;
    cursor: pointer;
    transition:
      border-color 150ms ease,
      background 150ms ease;
  }
  .pick:focus-visible {
    outline: 2px solid var(--theme-accent, #f59e0b);
    outline-offset: 2px;
  }
  @media (hover: hover) {
    .pick:hover {
      border-color: color-mix(in srgb, var(--theme-accent, #f59e0b) 45%, transparent);
    }
  }
  .pick.selected {
    border-color: var(--theme-accent, #f59e0b);
    background: color-mix(in srgb, var(--theme-accent, #f59e0b) 14%, transparent);
  }

  .thumb {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.25);
    border-radius: 8px;
    overflow: hidden;
  }

  /* The order number. Absolutely placed so it never reflows the tile, and
     tabular-nums so 1 → 12 doesn't jitter its width. */
  .order-badge {
    position: absolute;
    top: 0.3rem;
    left: 0.3rem;
    min-width: 1.4rem;
    height: 1.4rem;
    padding: 0 0.3rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-accent, #f59e0b);
    color: var(--theme-on-accent, #1a1205);
    border-radius: 100px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .pick-name {
    width: 100%;
    text-align: center;
    font-size: var(--font-size-compact, 12px);
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sheet-foot {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .foot-btn {
    min-height: var(--min-touch-target, 44px);
    padding: 0 1.1rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
  }
  /* Cancel pinned left; the primary grows leftward into free space, so neither
     button shifts the other (no layout shift). */
  .foot-btn.ghost {
    margin-right: auto;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    color: inherit;
  }
  .foot-btn.primary {
    min-width: 9rem;
    background: var(--theme-accent, #f59e0b);
    border: 1px solid var(--theme-accent, #f59e0b);
    color: var(--theme-on-accent, #1a1205);
  }
  .foot-btn.primary:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .close:focus-visible,
  .foot-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #f59e0b);
    outline-offset: 2px;
  }
  @media (hover: hover) {
    .close:hover,
    .foot-btn.ghost:hover {
      border-color: color-mix(in srgb, var(--theme-accent, #f59e0b) 45%, transparent);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .pick {
      transition: none;
    }
  }
</style>
