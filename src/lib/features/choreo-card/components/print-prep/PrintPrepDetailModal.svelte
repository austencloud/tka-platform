<!--
  PrintPrepDetailModal.svelte - Click-to-zoom detail view

  Shows a full-size card pair with prev/next navigation.
  Rendered as a fixed overlay on top of the print prep grid.
-->
<script lang="ts">
  interface DetailPair {
    frontSrc: string;
    backSrc: string;
    label: string;
  }

  interface Props {
    detailPair: DetailPair;
    detailIndex: number;
    totalCount: number;
    onClose: () => void;
    onPrev: () => void;
    onNext: () => void;
  }

  let {
    detailPair,
    detailIndex,
    totalCount,
    onClose,
    onPrev,
    onNext,
  }: Props = $props();
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="detail-backdrop" onclick={onClose}>
  <div class="detail-modal" onclick={(e) => e.stopPropagation()}>
    <div class="detail-header">
      <span class="detail-title">{detailPair.label}</span>
      <span class="detail-nav-info">
        {detailIndex + 1} / {totalCount}
      </span>
      <button class="detail-close" onclick={onClose} aria-label="Close">
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>
    <div class="detail-cards">
      <div class="detail-card">
        <img src={detailPair.frontSrc} alt="{detailPair.label} front" />
        <span class="detail-face-label">Front</span>
      </div>
      <div class="detail-card">
        <img src={detailPair.backSrc} alt="{detailPair.label} back" />
        <span class="detail-face-label">Back</span>
      </div>
    </div>
    <div class="detail-footer">
      <button class="detail-nav-btn" onclick={onPrev} disabled={detailIndex === 0}>
        <i class="fas fa-chevron-left" aria-hidden="true"></i> Prev
      </button>
      <button class="detail-nav-btn" onclick={onNext} disabled={detailIndex === totalCount - 1}>
        Next <i class="fas fa-chevron-right" aria-hidden="true"></i>
      </button>
    </div>
  </div>
</div>

<style>
  .detail-backdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .detail-modal {
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    padding: 16px;
    max-width: 90vw;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .detail-header {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .detail-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    flex: 1;
  }

  .detail-nav-info {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .detail-close {
    width: 36px;
    height: 36px;
    border: none;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
  }

  .detail-close:hover {
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, #ffffff);
  }

  .detail-cards {
    display: flex;
    gap: 16px;
    justify-content: center;
    overflow: hidden;
  }

  .detail-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .detail-card img {
    max-height: 70vh;
    width: auto;
    border-radius: 6px;
    object-fit: contain;
  }

  .detail-face-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .detail-footer {
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }

  .detail-nav-btn {
    padding: 8px 16px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 36px;
  }

  .detail-nav-btn:hover:not(:disabled) {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    color: var(--theme-text, #ffffff);
  }

  .detail-nav-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
</style>
