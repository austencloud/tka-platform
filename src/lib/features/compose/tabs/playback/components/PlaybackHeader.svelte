<!--
  PlaybackHeader.svelte

  Header bar for playback overlay with mode info, actions, and close button.
-->
<script lang="ts">
  import type { ComposeMode } from "../../../shared/state/compose-module-state.svelte";

  let {
    currentMode,
    onSave,
    onShare,
    onClose,
  }: {
    currentMode: ComposeMode;
    onSave: () => void;
    onShare: () => void;
    onClose: () => void;
  } = $props();

  // Format mode name for display
  const modeLabel = $derived(() => {
    const labels: Record<ComposeMode, string> = {
      single: "Single",
      tunnel: "Tunnel",
      mirror: "Mirror",
      grid: "Grid",
      "side-by-side": "Side by Side",
    };
    return labels[currentMode] || "Single";
  });
</script>

<header class="playback-header">
  <div class="header-left">
    <div class="mode-indicator">
      <i class="fas fa-layer-group" aria-hidden="true"></i>
      <span class="mode-label">{modeLabel()} Mode</span>
    </div>
  </div>

  <div class="header-center">
    <button
      class="action-btn save-btn"
      onclick={onSave}
      aria-label="Save composition"
    >
      <i class="fas fa-save" aria-hidden="true"></i>
      <span class="btn-label">Save</span>
    </button>

    <button
      class="action-btn share-btn"
      onclick={onShare}
      aria-label="Share composition"
    >
      <i class="fas fa-share-alt" aria-hidden="true"></i>
      <span class="btn-label">Share</span>
    </button>
  </div>

  <div class="header-right">
    <button class="close-btn" onclick={onClose} aria-label="Close playback">
      <i class="fas fa-times" aria-hidden="true"></i>
    </button>
  </div>
</header>

<style>
  .playback-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.875rem 1.25rem;
    background: rgba(0, 0, 0, 0.6);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    position: sticky;
    top: 0;
    z-index: 20;
  }

  .header-left,
  .header-center,
  .header-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .header-left {
    flex: 1;
    justify-content: flex-start;
  }

  .header-center {
    flex: 0 0 auto;
    justify-content: center;
  }

  .header-right {
    flex: 1;
    justify-content: flex-end;
  }

  /* Mode indicator (non-interactive) */
  .mode-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.875rem;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    color: var(--theme-text-dim);
    font-size: 0.85rem;
  }

  .mode-indicator i {
    color: rgba(236, 72, 153, 0.8);
  }

  .mode-label {
    font-weight: 500;
  }

  /* Action buttons */
  .action-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.875rem;
    border-radius: 8px;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    border: 1px solid transparent;
  }

  .save-btn {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.3);
    color: rgba(167, 139, 250, 1);
  }

  .save-btn:hover {
    background: rgba(139, 92, 246, 0.3);
    border-color: rgba(139, 92, 246, 0.5);
    color: rgba(196, 181, 253, 1);
  }

  .share-btn {
    background: rgba(6, 182, 212, 0.2);
    border-color: rgba(6, 182, 212, 0.3);
    color: rgba(34, 211, 238, 1);
  }

  .share-btn:hover {
    background: rgba(6, 182, 212, 0.3);
    border-color: rgba(6, 182, 212, 0.5);
    color: rgba(103, 232, 249, 1);
  }

  .action-btn:active {
    transform: scale(0.98);
  }

  /* Close button */
  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target); /* WCAG AAA touch target */
    height: var(--min-touch-target);
    border-radius: 10px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    color: var(--theme-text-dim);
    font-size: 1.1rem;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .close-btn:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.4);
    color: rgba(252, 165, 165, 1);
  }

  .close-btn:active {
    transform: scale(0.95);
  }

  /* Mobile - compact layout */
  @media (max-width: 768px) {
    .playback-header {
      padding: 0.625rem 0.875rem;
    }

    .mode-indicator {
      padding: 0.375rem 0.625rem;
      font-size: 0.75rem;
    }

    .action-btn {
      padding: 0.375rem 0.625rem;
      font-size: 0.75rem;
    }

    .btn-label {
      display: none;
    }

    .action-btn {
      width: var(--min-touch-target); /* WCAG AAA touch target */
      height: var(--min-touch-target);
      justify-content: center;
      padding: 0;
    }

    .close-btn {
      width: var(--min-touch-target); /* WCAG AAA touch target */
      height: var(--min-touch-target);
      font-size: 1rem;
    }
  }

  /* Extra small mobile */
  @media (max-width: 480px) {
    .mode-label {
      display: none;
    }

    .mode-indicator {
      width: 36px;
      height: 36px;
      justify-content: center;
      padding: 0;
    }
  }
</style>
