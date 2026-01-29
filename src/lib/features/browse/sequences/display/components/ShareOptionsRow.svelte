<script lang="ts">
  /**
   * ShareOptionsRow
   *
   * Row of share action buttons: Copy, Download, Native Share
   * Appears when user clicks the Share button in SequenceDetailContent
   */

  interface Props {
    isCopying: boolean;
    copySuccess: boolean;
    canNativeShare: boolean;
    onCopy: () => void;
    onDownload: () => void;
    onNativeShare: () => void;
  }

  const {
    isCopying,
    copySuccess,
    canNativeShare,
    onCopy,
    onDownload,
    onNativeShare,
  } = $props<Props>();
</script>

<div class="share-options-row">
  <button
    class="share-option-btn"
    disabled={isCopying}
    onclick={onCopy}
    aria-label="Copy image to clipboard"
  >
    {#if isCopying}
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      <span>Copying...</span>
    {:else if copySuccess}
      <i class="fas fa-check" aria-hidden="true"></i>
      <span>Copied!</span>
    {:else}
      <i class="fas fa-copy" aria-hidden="true"></i>
      <span>Copy</span>
    {/if}
  </button>

  <button
    class="share-option-btn"
    onclick={onDownload}
    aria-label="Download image"
  >
    <i class="fas fa-download" aria-hidden="true"></i>
    <span>Download</span>
  </button>

  {#if canNativeShare}
    <button
      class="share-option-btn"
      onclick={onNativeShare}
      aria-label="Share via system"
    >
      <i class="fas fa-share" aria-hidden="true"></i>
      <span>Share</span>
    </button>
  {/if}
</div>

<style>
  .share-options-row {
    display: flex;
    gap: 8px;
    padding: 8px 0;
    justify-content: center;
  }

  .share-option-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text, white);
    font-size: 14px;
    cursor: pointer;
    transition: all var(--duration-normal, 0.2s) ease;
  }

  .share-option-btn:hover:not(:disabled) {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .share-option-btn:active:not(:disabled) {
    transform: scale(0.97);
  }

  .share-option-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .share-option-btn i {
    font-size: 16px;
  }

  @media (prefers-reduced-motion: reduce) {
    .share-option-btn {
      transition: none;
    }
    .share-option-btn:active:not(:disabled) {
      transform: none;
    }
  }
</style>
