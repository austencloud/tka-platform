<!--
  PageDisplay.svelte - Print-preview page display

  Shows sequences as they would appear on printed pages (letter size).
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import { onMount, onDestroy } from "svelte";
  import type { PrintPreviewPage } from "../domain/types/PageLayoutTypes";
  import ChoreoCard from "./ChoreoCard.svelte";

  interface Props {
    pages: PrintPreviewPage[];
    isLoading: boolean;
    error: string | null;
    columnCount?: number;
    showQRCodes?: boolean;
    // Visibility settings for thumbnails
    handPointsVisible?: boolean;
    showGrid?: boolean;
    showTKA?: boolean;
    showWord?: boolean;
    includeStartPosition?: boolean;
    onRetry: () => void;
    onColumnCountChanged?: (count: number) => void;
    onSelectSequence?: (sequence: SequenceData) => void;
    onContextMenu?: (x: number, y: number, rerender: () => void) => void;
  }

  const MIN_COLUMNS = 1;
  const MAX_COLUMNS = 4;
  const SCROLL_THRESHOLD = 50;

  let {
    pages,
    isLoading,
    error,
    columnCount = 1,
    showQRCodes = true,
    handPointsVisible = true,
    showGrid = true,
    showTKA = true,
    showWord = true,
    includeStartPosition = true,
    onRetry,
    onColumnCountChanged,
    onSelectSequence,
    onContextMenu,
  }: Props = $props();

  let hapticService: HapticFeedback;
  let cumulativeScrollDelta = 0;
  let pageDisplayEl: HTMLDivElement;

  onMount(() => {
    hapticService = getHapticFeedback();
    // Must use { passive: false } so preventDefault() works on wheel events
    pageDisplayEl?.addEventListener("wheel", handleWheel, { passive: false });
  });

  onDestroy(() => {
    pageDisplayEl?.removeEventListener("wheel", handleWheel);
  });

  function handleWheel(ev: WheelEvent) {
    if (!ev.shiftKey || !onColumnCountChanged) return;

    // Prevent horizontal scroll that Shift+wheel normally triggers
    ev.preventDefault();

    cumulativeScrollDelta += ev.deltaY;

    if (cumulativeScrollDelta > SCROLL_THRESHOLD) {
      // Scroll down = more columns (smaller pages)
      const next = Math.min(MAX_COLUMNS, columnCount + 1);
      if (next !== columnCount) {
        onColumnCountChanged(next);
        hapticService?.trigger("selection");
      }
      cumulativeScrollDelta = 0;
    } else if (cumulativeScrollDelta < -SCROLL_THRESHOLD) {
      // Scroll up = fewer columns (larger pages)
      const next = Math.max(MIN_COLUMNS, columnCount - 1);
      if (next !== columnCount) {
        onColumnCountChanged(next);
        hapticService?.trigger("selection");
      }
      cumulativeScrollDelta = 0;
    }
  }

  function handleRetry() {
    hapticService?.trigger("selection");
    onRetry();
  }
</script>

<div class="page-display" style:--column-count={columnCount} bind:this={pageDisplayEl}>
  {#if isLoading}
    <div class="state-container" role="status" aria-live="polite" aria-busy="true">
      <ProgressRing percent={-1} size={32} strokeWidth={3} />
      <h3 class="state-title">Loading sequences...</h3>
      <p class="state-message">Preparing print preview</p>
    </div>
  {:else if error}
    <div class="state-container" role="alert" aria-live="assertive">
      <div class="state-icon error" aria-hidden="true">
        <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
      </div>
      <h3 class="state-title">Error Loading Sequences</h3>
      <p class="state-message">{error}</p>
      <button class="retry-btn" onclick={handleRetry} type="button" aria-label="Retry loading sequences">
        <i class="fas fa-redo" aria-hidden="true"></i>
        <span>Try Again</span>
      </button>
    </div>
  {:else if pages.length === 1 && pages[0]?.isEmpty}
    <div class="state-container" role="status" aria-live="polite">
      <div class="state-icon empty" aria-hidden="true">
        <i class="fas fa-file-alt" aria-hidden="true"></i>
      </div>
      <h3 class="state-title">No Sequences Found</h3>
      <p class="state-message">No sequences match your current filter</p>
    </div>
  {:else}
    <!-- Print Preview Pages -->
    <div class="pages-container">
      {#each pages as page (page.id)}
        <div class="page" data-page-id={page.id}>
          <div class="page-content">
            <div class="sequence-grid">
              {#each page.sequences as sequence (sequence.id)}
                <ChoreoCard
                  {sequence}
                  printMode
                  {showQRCodes}
                  {handPointsVisible}
                  {showGrid}
                  {showTKA}
                  {showWord}
                  {includeStartPosition}
                  onSelect={onSelectSequence}
                  {onContextMenu}
                />
              {/each}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .page-display {
    height: 100%;
    overflow-y: auto;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  }

  .page-display::-webkit-scrollbar {
    width: 8px;
  }

  .page-display::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
  }

  .page-display::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 4px;
  }

  /* State Containers */
  .state-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: var(--spacing-xl);
    text-align: center;
  }

  .state-icon {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    margin-bottom: var(--spacing-lg);
    font-size: 1.5rem;
  }

  .state-icon.error {
    background: var(--semantic-error-bg, rgba(239, 68, 68, 0.15));
    color: var(--semantic-error, #ef4444);
  }

  .state-icon.empty {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  .state-title {
    margin: 0 0 var(--spacing-xs) 0;
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .state-message {
    margin: 0 0 var(--spacing-lg) 0;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .retry-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    min-height: var(--min-touch-target);
    padding: var(--spacing-sm) var(--spacing-xl);
    background: var(--theme-accent, #f43f5e);
    border: none;
    border-radius: var(--border-radius-md, 8px);
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .retry-btn:hover {
    filter: brightness(1.1);
  }

  .retry-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #f43f5e);
    outline-offset: 2px;
  }

  /* Pages Container - uses CSS custom property for columns */
  .pages-container {
    display: grid;
    grid-template-columns: repeat(var(--column-count, 3), 1fr);
    gap: var(--spacing-lg, 16px);
    padding: var(--spacing-lg, 16px);
    align-items: start;
  }

  /* Individual Page - Print preview (white paper) */
  .page {
    width: 100%;
    aspect-ratio: 8.5 / 11; /* Letter size ratio */
    background: var(--print-bg, #ffffff);
    border-radius: var(--border-radius-md, 8px);
    box-shadow: var(--shadow-card, 0 4px 20px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.2));
    overflow: hidden;
  }

  .page-content {
    padding: 1.5%; /* Tight margins for 3 rows */
    height: 100%;
    box-sizing: border-box;
  }

  /* Sequence Grid - 2 columns, evenly distributed rows */
  .sequence-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    grid-auto-rows: 1fr; /* Equal height rows */
    gap: 1%;
    height: 100%;
    align-content: stretch; /* Fill available space evenly */
  }

  /* Responsive */
  @media (max-width: 768px) {
    .pages-container {
      padding: var(--spacing-md, 12px);
      gap: var(--spacing-md, 12px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .retry-btn {
      transition: none;
    }
  }
</style>
