<!--
ShareOptionsRow - Inline share action buttons

Displays copy, download, share, and send options
in a horizontal row when share is expanded.
-->
<script lang="ts">
  interface Props {
    isCopying?: boolean;
    copySuccess?: boolean;
    canNativeShare?: boolean;
    showSendOption?: boolean;
    onCopy?: () => void;
    onDownload?: () => void;
    onNativeShare?: () => void;
    onSendToUser?: () => void;
  }

  const {
    isCopying = false,
    copySuccess = false,
    canNativeShare = false,
    showSendOption = false,
    onCopy = () => {},
    onDownload = () => {},
    onNativeShare = () => {},
    onSendToUser = () => {},
  }: Props = $props();
</script>

<div class="share-options-row">
  <button
    class="share-option-btn"
    class:success={copySuccess}
    onclick={onCopy}
    disabled={isCopying}
    aria-label="Copy image to clipboard"
  >
    {#if isCopying}
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
    {:else if copySuccess}
      <i class="fas fa-check" aria-hidden="true"></i>
    {:else}
      <i class="fas fa-copy" aria-hidden="true"></i>
    {/if}
    <span>Copy</span>
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
      aria-label="Share externally"
    >
      <i class="fas fa-share-alt" aria-hidden="true"></i>
      <span>Share</span>
    </button>
  {/if}

  {#if showSendOption}
    <button
      class="share-option-btn send-btn"
      onclick={onSendToUser}
      aria-label="Send to user"
    >
      <i class="fas fa-paper-plane" aria-hidden="true"></i>
      <span>Send</span>
    </button>
  {/if}
</div>

<style>
  .share-options-row {
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: wrap;
    padding: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    animation: slideDown var(--duration-normal) ease-out;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .share-option-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 20px;
    min-height: 48px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    border-radius: 24px;
    color: var(--theme-text, white);
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    flex: 1;
    min-width: 100px;
  }

  .share-option-btn:hover:not(:disabled) {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-accent, #6366f1);
  }

  .share-option-btn:active:not(:disabled) {
    transform: scale(0.97);
  }

  .share-option-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .share-option-btn.success {
    background: color-mix(in srgb, var(--semantic-success, #22c55e) 20%, transparent);
    border-color: var(--semantic-success, #22c55e);
    color: var(--semantic-success, #22c55e);
  }

  .share-option-btn.send-btn {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 15%, transparent);
    border-color: var(--theme-accent, #6366f1);
  }

  .share-option-btn.send-btn:hover:not(:disabled) {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 25%, transparent);
  }

  .share-option-btn i {
    font-size: 16px;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .share-options-row {
      animation: none;
    }

    .share-option-btn {
      transition: none;
    }

    .share-option-btn:active:not(:disabled) {
      transform: none;
    }
  }
</style>
