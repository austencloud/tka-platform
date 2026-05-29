<script lang="ts">
  import CardSizeToggle from "../card-preview/CardSizeToggle.svelte";
  import type { CardSizeId } from "../../domain/card-sizes";

  interface Props {
    cardSize: CardSizeId;
    totalCards: number;
    isRendering: boolean;
    renderProgress: number;
    renderTotal: number;
    onCardSizeChange: (size: CardSizeId) => void;
    onRerender?: () => void;
    onPrint: () => void;
  }

  let {
    cardSize,
    totalCards,
    isRendering,
    renderProgress,
    renderTotal,
    onCardSizeChange,
    onRerender,
    onPrint,
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

  <button
    class="print-btn"
    disabled={isRendering || totalCards === 0}
    onclick={onPrint}
    title={totalCards === 0 ? "Load a deck first" : `Print ${totalCards} cards`}
  >
    <i class="fas fa-print" aria-hidden="true"></i>
    <span>Print This Deck</span>
  </button>
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
    flex: 1;
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
