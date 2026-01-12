<!--
DetailHeader - Header row for sequence detail panel

Displays:
- Title
- Copy for Claude button
- Collapse button (when expanded)
- Close button
-->
<script lang="ts">
  interface Props {
    title?: string;
    isExpanded?: boolean;
    isCopying?: boolean;
    justCopied?: boolean;
    onCopyForClaude?: () => void;
    onCollapse?: () => void;
    onClose?: () => void;
  }

  const {
    title = "Sequence Details",
    isExpanded = false,
    isCopying = false,
    justCopied = false,
    onCopyForClaude = () => {},
    onCollapse = () => {},
    onClose = () => {},
  }: Props = $props();
</script>

<header class="detail-header">
  <span class="header-title">{title}</span>
  <div class="header-buttons">
    <!-- Copy for Claude Code button -->
    <button
      class="header-btn copy-btn"
      class:copied={justCopied}
      class:loading={isCopying}
      onclick={onCopyForClaude}
      disabled={isCopying}
      aria-label="Copy for Claude Code"
      title="Copy sequence data for AI analysis"
    >
      {#if isCopying}
        <svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"></circle>
        </svg>
      {:else if justCopied}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      {:else}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="4 17 10 11 4 5"></polyline>
          <line x1="12" y1="19" x2="20" y2="19"></line>
        </svg>
      {/if}
    </button>

    {#if isExpanded}
      <button
        class="collapse-button"
        onclick={onCollapse}
        aria-label="Collapse panel"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <polyline points="11 17 6 12 11 7"></polyline>
          <polyline points="18 17 13 12 18 7"></polyline>
        </svg>
      </button>
    {/if}
    <button class="close-button" onclick={onClose} aria-label="Close">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  </div>
</header>

<style>
  .detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: clamp(8px, 2cqi, 12px);
    border-bottom: 1px solid var(--theme-stroke, var(--theme-stroke));
    flex-shrink: 0;
  }

  .header-title {
    font-size: clamp(14px, 4cqi, 18px);
    font-weight: 600;
    color: color-mix(in srgb, var(--theme-text, white) 90%, transparent);
  }

  .header-buttons {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* Collapse button - shrinks panel back to normal width */
  .collapse-button {
    width: var(--touch-target-min);
    height: var(--touch-target-min);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-accent, #3b82f6);
    border: 1px solid var(--theme-accent, #3b82f6);
    border-radius: 50%;
    color: white;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .collapse-button svg {
    width: var(--icon-size-md);
    height: var(--icon-size-md);
  }

  .collapse-button:hover {
    background: color-mix(in srgb, var(--theme-accent, #3b82f6) 85%, black);
    border-color: color-mix(in srgb, var(--theme-accent, #3b82f6) 85%, black);
    transform: scale(1.05);
  }

  .collapse-button:active {
    transform: scale(0.95);
  }

  /* Close button */
  .close-button {
    width: var(--touch-target-min);
    height: var(--touch-target-min);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke, var(--theme-stroke-strong));
    border-radius: 50%;
    color: var(--theme-text-dim);
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .close-button svg {
    width: var(--icon-size-md);
    height: var(--icon-size-md);
  }

  .close-button:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text, white);
  }

  .close-button:active {
    transform: scale(0.95);
  }

  /* Header button base style */
  .header-btn {
    width: var(--touch-target-min);
    height: var(--touch-target-min);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke, var(--theme-stroke-strong));
    border-radius: 50%;
    color: var(--theme-text-dim);
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .header-btn svg {
    width: var(--icon-size-md);
    height: var(--icon-size-md);
  }

  .header-btn:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text, white);
  }

  .header-btn:active {
    transform: scale(0.95);
  }

  /* Copy button - terminal/code icon style */
  .copy-btn:hover {
    border-color: var(--semantic-info, #3b82f6);
    color: var(--semantic-info, #3b82f6);
  }

  .copy-btn.copied {
    background: var(--semantic-success, #22c55e);
    border-color: var(--semantic-success, #22c55e);
    color: white;
  }

  .copy-btn.loading {
    border-color: var(--semantic-info, #3b82f6);
    color: var(--semantic-info, #3b82f6);
    cursor: wait;
  }

  .copy-btn .spinner {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .close-button,
    .collapse-button,
    .header-btn {
      transition: none;
      animation: none;
    }

    .close-button:active,
    .collapse-button:active,
    .header-btn:active {
      transform: none;
    }
  }
</style>
