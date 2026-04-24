<script lang="ts">
  import { tick } from "svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import PropAwareThumbnail from "$lib/features/browse/sequences/display/components/PropAwareThumbnail.svelte";

  interface LengthOption {
    label: string;
    value: number;
  }

  interface Props {
    sequences: SequenceData[];
    selectedIndex: number;
    selectedLength: number;
    onSelect: (index: number) => void;
    onLengthChange: (length: number) => void;
  }

  const {
    sequences,
    selectedIndex,
    selectedLength,
    onSelect,
    onLengthChange,
  }: Props = $props();

  const lengthOptions: LengthOption[] = [
    { label: "All", value: 0 },
    { label: "2", value: 2 },
    { label: "4", value: 4 },
    { label: "6", value: 6 },
    { label: "8", value: 8 },
    { label: "10", value: 10 },
    { label: "12", value: 12 },
    { label: "16", value: 16 },
  ];

  // ── Column count with Shift+Scroll zoom ────────────────────────────
  const STORAGE_KEY = "choreoCard.pickerColumns";
  const MIN_COLUMNS = 1;
  const MAX_COLUMNS = 4;
  const SCROLL_THRESHOLD = 50;

  function loadColumns(): number {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v) {
        const n = parseInt(v, 10);
        if (n >= MIN_COLUMNS && n <= MAX_COLUMNS) return n;
      }
    } catch { /* ignore */ }
    return 3;
  }

  let columnCount = $state(loadColumns());
  let cumulativeScrollDelta = 0;

  $effect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(columnCount)); } catch { /* ignore */ }
  });

  $effect(() => {
    const el = gridEl;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  });

  function handleWheel(ev: WheelEvent) {
    if (!ev.shiftKey) return;
    ev.preventDefault();

    cumulativeScrollDelta += ev.deltaY;

    if (cumulativeScrollDelta > SCROLL_THRESHOLD) {
      // Scroll down = more columns (smaller thumbnails)
      if (columnCount < MAX_COLUMNS) columnCount++;
      cumulativeScrollDelta = 0;
    } else if (cumulativeScrollDelta < -SCROLL_THRESHOLD) {
      // Scroll up = fewer columns (larger thumbnails)
      if (columnCount > MIN_COLUMNS) columnCount--;
      cumulativeScrollDelta = 0;
    }
  }

  let gridEl: HTMLDivElement | undefined = $state();

  $effect(() => {
    const idx = selectedIndex;
    if (!gridEl || idx < 0) return;
    tick().then(() => {
      const cell = gridEl!.children[idx] as HTMLElement | undefined;
      cell?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  });
</script>

<div class="picker-container">
  <div class="filter-chips" role="group" aria-label="Filter by beat length">
    {#each lengthOptions as opt (opt.value)}
      <button
        class="chip"
        class:active={selectedLength === opt.value}
        onclick={() => onLengthChange(opt.value)}
        aria-pressed={selectedLength === opt.value}
        aria-label="Filter by {opt.label === 'All' ? 'all lengths' : opt.label + ' beats'}"
      >
        {opt.label}
      </button>
    {/each}
  </div>

  <div class="column-chips" role="group" aria-label="Grid columns">
    <i class="fas fa-th" aria-hidden="true" style="font-size: 12px; opacity: 0.5; margin-right: 2px;"></i>
    {#each Array.from({ length: MAX_COLUMNS - MIN_COLUMNS + 1 }, (_, i) => i + MIN_COLUMNS) as col}
      <button
        class="chip"
        class:active={columnCount === col}
        onclick={() => { columnCount = col; }}
        aria-pressed={columnCount === col}
        aria-label="Show {col} {col === 1 ? 'column' : 'columns'}"
      >
        {col}
      </button>
    {/each}
  </div>

  {#if sequences.length === 0}
    <div class="empty-state">
      <i class="fas fa-filter" aria-hidden="true"></i>
      <p>
        {selectedLength === 0
          ? "No sequences found"
          : `No ${selectedLength}-beat sequences`}
      </p>
    </div>
  {:else}
    <div
      class="thumbnail-grid themed-scrollbar"
      bind:this={gridEl}
    >
      {#each sequences as seq, i (seq.id ?? i)}
        <div
          class="thumbnail-cell"
          class:selected={i === selectedIndex}
          style:width="calc({100 / columnCount}% - {(columnCount - 1) * 4 / columnCount}px)"
          onclick={() => onSelect(i)}
          onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(i); } }}
          role="button"
          tabindex="0"
          aria-label={`Select sequence ${seq.word ?? seq.name ?? i + 1}`}
          aria-pressed={i === selectedIndex}
        >
          <PropAwareThumbnail
            sequence={seq}
            eager={true}
            lightMode={true}
            addWord={false}
            includeStartPosition={false}
            addDifficultyLevel={false}
            addStepNumbers={false}
            showCreatorName={false}
            showNotes={false}
            showBirthday={false}
          />
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .picker-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  /* ── Filter chips ──────────────────────────────── */
  .filter-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 8px 10px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    flex-shrink: 0;
  }

  .chip {
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition:
      background 0.15s ease,
      border-color 0.15s ease,
      color 0.15s ease;
    white-space: nowrap;
    line-height: 1.4;
  }

  .chip:hover:not(.active) {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.1));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .chip.active {
    background: var(--theme-accent, #4488ff);
    border-color: var(--theme-accent, #4488ff);
    color: #ffffff;
  }

  /* ── Column selector chips ──────────────────────── */
  .column-chips {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 4px 10px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    flex-shrink: 0;
  }

  /* ── Thumbnail grid ────────────────────────────── */
  .thumbnail-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 4px;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
    align-content: start;
  }

  .thumbnail-cell {
    cursor: pointer;
    border-radius: 6px;
    transition: transform 0.15s ease;
    /* width set via inline style based on columnCount */
  }

  /* The PropAwareThumbnail uses calculateGalleryAspectRatio which assumes
     header/footer/start-position. In this picker we disable all those, so the
     rendered image is just the raw grid (landscape). Remove the mismatched
     portrait aspect-ratio and let the image's natural dimensions drive height. */
  .thumbnail-cell :global(.prop-thumbnail) {
    aspect-ratio: auto !important;
  }

  .thumbnail-cell:hover:not(.selected) {
    transform: scale(1.02);
  }

  .thumbnail-cell.selected {
    outline: 2px solid var(--theme-accent, #4488ff);
    outline-offset: 2px;
  }

  /* ── Empty state ───────────────────────────────── */
  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.45));
    font-size: var(--font-size-min, 14px);
    padding: 24px;
    text-align: center;
  }

  .empty-state i {
    font-size: 1.5rem;
    opacity: 0.5;
  }

  .empty-state p {
    margin: 0;
  }

  /* ── Reduced motion ────────────────────────────── */
  @media (prefers-reduced-motion: reduce) {
    .chip,
    .thumbnail-cell {
      transition: none;
    }
  }
</style>
