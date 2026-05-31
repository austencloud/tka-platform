<script lang="ts">
  import CardSizeToggle from "../card-preview/CardSizeToggle.svelte";
  import CopiesSelect from "./CopiesSelect.svelte";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import type { CardSizeId } from "../../domain/card-sizes";

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
  }: Props = $props();

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

  @media (max-width: 767px) {
    .toolbar {
      flex-wrap: wrap;
      row-gap: 8px;
    }
  }
</style>
