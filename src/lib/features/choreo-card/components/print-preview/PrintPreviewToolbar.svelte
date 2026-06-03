<script lang="ts">
  import CardSizeToggle from "../card-preview/CardSizeToggle.svelte";
  import CopiesSelect from "./CopiesSelect.svelte";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import { getPageLayout, type CardSizeId } from "../../domain/card-sizes";

  interface Props {
    cardSize: CardSizeId;
    totalCards: number;
    isRendering: boolean;
    renderProgress: number;
    renderTotal: number;
    onCardSizeChange: (size: CardSizeId) => void;
    onRerender?: () => void;
    /** Copies per card for the print layout. Omit to hide the control. */
    copies?: number;
    onCopiesChange?: (n: number) => void;
    /** Deck-aware suggested copy counts (minimal empty space). */
    copiesPresets?: number[];
    /** Per-count waste readout for chip badges. */
    copiesAnnotate?: (n: number) => { blanks: number; perfect: boolean } | null;
    /** One-color-per-sheet grouping. Off = normal sequential fill (no blanks
     *  between colors). Omit both to hide the toggle. */
    groupByElement?: boolean;
    onGroupByElementChange?: (on: boolean) => void;
    /** Cluster same-letter cards together (AAABBBCCC). Independent of color —
     *  both on = letters cluster within each color. Omit both to hide. */
    groupByLetter?: boolean;
    onGroupByLetterChange?: (on: boolean) => void;
    /** Open the print dialog. Omit to hide the Print button (Deck Releaser prints via its sidebar). */
    onPrint?: () => void;
  }

  let {
    cardSize,
    totalCards,
    isRendering,
    renderProgress,
    renderTotal,
    onCardSizeChange,
    onRerender,
    copies,
    onCopiesChange,
    copiesPresets,
    copiesAnnotate,
    groupByElement,
    onGroupByElementChange,
    groupByLetter,
    onGroupByLetterChange,
    onPrint,
  }: Props = $props();

  // The "one card per page" count for the current size (9 poker / 6 tarot) —
  // marks the primary copies chip.
  const perPage = $derived(getPageLayout(cardSize).cardsPerPage);

  const progressText = $derived(
    renderTotal > 0
      ? `Rendering ${renderProgress} / ${renderTotal}...`
      : "Rendering..."
  );
</script>

<div class="toolbar" role="toolbar" aria-label="Print preview controls">
  <div class="toolbar-left">
    <CardSizeToggle selected={cardSize} onchange={onCardSizeChange} />
  </div>

  <div class="toolbar-right">
    {#if copies != null && onCopiesChange}
      <span class="copies-label">Copies</span>
      <CopiesSelect
        value={copies}
        onchange={onCopiesChange}
        presets={copiesPresets}
        annotate={copiesAnnotate}
        {perPage}
      />
    {/if}

    {#if groupByElement != null && onGroupByElementChange}
      <FilterChipBase
        mode="toggle"
        size="sm"
        icon="fas fa-palette"
        label="Group by color"
        active={groupByElement}
        chipColor="#10b981"
        onclick={() => onGroupByElementChange(!groupByElement)}
      />
    {/if}

    {#if groupByLetter != null && onGroupByLetterChange}
      <FilterChipBase
        mode="toggle"
        size="sm"
        icon="fas fa-font"
        label="Group by letter"
        active={groupByLetter}
        chipColor="#a78bfa"
        onclick={() => onGroupByLetterChange(!groupByLetter)}
      />
    {/if}

    {#if onRerender}
      <button
        class="icon-btn"
        class:spinning={isRendering}
        onclick={onRerender}
        aria-label={isRendering ? "Restart render" : "Re-render all cards"}
        title={isRendering ? "Restart render (cancels current)" : "Re-render all cards"}
      >
        <i class="fas fa-sync-alt" aria-hidden="true"></i>
      </button>
    {/if}

    {#if isRendering}
      <span class="progress-text" aria-live="polite" aria-atomic="true">
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        {progressText}
      </span>
    {/if}
  </div>

  {#if onPrint}
    <button
      class="print-btn"
      disabled={isRendering || totalCards === 0}
      onclick={onPrint}
      title={totalCards === 0 ? "Load a deck first" : `Print ${totalCards} cards`}
    >
      <i class="fas fa-print" aria-hidden="true"></i>
      <span>Print This Deck</span>
    </button>
  {/if}
</div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .copies-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    margin-left: 4px;
  }

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: 13px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .icon-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.06);
    color: var(--theme-text, #fff);
  }

  .icon-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .icon-btn.spinning i {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .progress-text {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    white-space: nowrap;
  }

  .print-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 22px;
    min-height: 44px;
    font-size: 15px;
    font-weight: 600;
    font-family: inherit;
    color: #fff;
    background: linear-gradient(135deg, #7c3aed, #6d28d9);
    border: none;
    border-radius: 10px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s;
  }

  .print-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #8b5cf6, #7c3aed);
    box-shadow: 0 2px 12px rgba(124, 58, 237, 0.3);
  }

  .print-btn:active:not(:disabled) {
    transform: scale(0.98);
  }

  .print-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  @media (max-width: 767px) {
    .toolbar {
      flex-wrap: wrap;
      row-gap: 8px;
    }

    .print-btn {
      width: 100%;
      justify-content: center;
    }
  }
</style>
