<script lang="ts">
  import { tick } from "svelte";
  import PropAwareThumbnail from "$lib/features/browse/sequences/display/components/PropAwareThumbnail.svelte";

  interface LengthOption {
    label: string;
    value: number;
  }

  interface Props {
    sequences: any[];
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

  let gridEl: HTMLDivElement | undefined = $state();

  // Scroll selected cell into view whenever selectedIndex changes.
  // tick() ensures the DOM reflects the latest render before we query children.
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
      >
        {opt.label}
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
    <div class="thumbnail-grid themed-scrollbar" bind:this={gridEl}>
      {#each sequences as seq, i (seq.id ?? i)}
        <button
          class="thumbnail-cell"
          class:selected={i === selectedIndex}
          onclick={() => onSelect(i)}
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
        </button>
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

  /* ── Thumbnail grid ────────────────────────────── */
  .thumbnail-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    padding: 8px;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
    align-content: start;
  }

  .thumbnail-cell {
    position: relative;
    border: none;
    background: transparent;
    padding: 0;
    cursor: pointer;
    border-radius: 6px;
    overflow: hidden;
    /* Keep the aspect ratio consistent across all grid cells */
    aspect-ratio: 3 / 4;
    display: flex;
    align-items: stretch;
    transition: transform 0.1s ease;
  }

  .thumbnail-cell:hover:not(.selected) {
    transform: scale(1.02);
  }

  .thumbnail-cell.selected {
    outline: 2px solid var(--theme-accent, #4488ff);
    outline-offset: 2px;
    border-radius: 6px;
  }

  /* PropAwareThumbnail fills the cell */
  .thumbnail-cell :global(.prop-thumbnail) {
    width: 100%;
    height: 100%;
    flex: 1;
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
