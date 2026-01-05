<!--
  BulkActionBar.svelte - Sticky Bulk Actions for Library

  Shows when items are selected in the Library.
  Sticky at bottom for easy access on mobile.

  Actions:
  - Change Visibility (Public/Private)
  - Add Tags
  - Delete
-->
<script lang="ts">
  import { fly } from "svelte/transition";

  interface Props {
    selectedCount: number;
    onPublish: () => void;
    onUnpublish: () => void;
    onDelete: () => void;
    onSelectAll: () => void;
    onClearSelection: () => void;
    onExit: () => void;
  }

  let {
    selectedCount,
    onPublish,
    onUnpublish,
    onDelete,
    onSelectAll,
    onClearSelection,
    onExit,
  }: Props = $props();

  const hasSelection = $derived(selectedCount > 0);
</script>

<div class="bulk-action-bar" transition:fly={{ y: 100, duration: 200 }}>
  <div class="bar-content">
    <!-- Left: Selection info -->
    <div class="selection-info">
      <div class="count-badge">
        <span class="count">{selectedCount}</span>
        <span class="label">selected</span>
      </div>
      <div class="selection-controls">
        <button class="link-btn" onclick={onSelectAll}>
          Select All
        </button>
        <span class="divider">·</span>
        <button class="link-btn" onclick={onClearSelection}>
          Clear
        </button>
      </div>
    </div>

    <!-- Center: Actions -->
    <div class="action-buttons">
      <button
        class="action-btn publish"
        onclick={onPublish}
        disabled={!hasSelection}
        title="Make selected sequences public"
      >
        <i class="fas fa-globe" aria-hidden="true"></i>
        <span class="btn-label">Public</span>
      </button>

      <button
        class="action-btn unpublish"
        onclick={onUnpublish}
        disabled={!hasSelection}
        title="Make selected sequences private"
      >
        <i class="fas fa-lock" aria-hidden="true"></i>
        <span class="btn-label">Private</span>
      </button>

      <button
        class="action-btn delete"
        onclick={onDelete}
        disabled={!hasSelection}
        title="Delete selected sequences"
      >
        <i class="fas fa-trash" aria-hidden="true"></i>
        <span class="btn-label">Delete</span>
      </button>
    </div>

    <!-- Right: Done button -->
    <button class="done-btn" onclick={onExit}>
      <i class="fas fa-check" aria-hidden="true"></i>
      <span>Done</span>
    </button>
  </div>
</div>

<style>
  .bulk-action-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 100;
    padding: var(--spacing-md);
    padding-bottom: calc(var(--spacing-md) + env(safe-area-inset-bottom, 0px));
    background: linear-gradient(
      180deg,
      rgba(18, 18, 28, 0.95) 0%,
      rgba(18, 18, 28, 0.98) 100%
    );
    border-top: 1px solid color-mix(in srgb, var(--theme-accent) 30%, transparent);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .bar-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-md);
    max-width: 1200px;
    margin: 0 auto;
  }

  /* Selection Info */
  .selection-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .count-badge {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .count {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--theme-accent);
    font-variant-numeric: tabular-nums;
  }

  .count-badge .label {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim);
  }

  .selection-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .link-btn {
    background: none;
    border: none;
    padding: 0;
    color: var(--theme-accent);
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .link-btn:hover {
    opacity: 0.8;
    text-decoration: underline;
  }

  .divider {
    color: var(--theme-text-dim);
    opacity: 0.5;
  }

  /* Action Buttons */
  .action-buttons {
    display: flex;
    gap: var(--spacing-sm);
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-2026-sm, 10px);
    color: var(--theme-text);
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    min-height: var(--min-touch-target);
  }

  .action-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
  }

  .action-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .action-btn.publish:hover:not(:disabled) {
    background: color-mix(in srgb, var(--semantic-success) 20%, transparent);
    border-color: color-mix(in srgb, var(--semantic-success) 40%, transparent);
    color: var(--semantic-success);
  }

  .action-btn.unpublish:hover:not(:disabled) {
    background: rgba(156, 163, 175, 0.2);
    border-color: rgba(156, 163, 175, 0.4);
  }

  .action-btn.delete:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.4);
    color: rgba(239, 68, 68, 0.95);
  }

  /* Done Button */
  .done-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    background: var(--theme-accent);
    border: none;
    border-radius: var(--radius-2026-sm, 10px);
    color: white;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    min-height: var(--min-touch-target);
  }

  .done-btn:hover {
    background: var(--theme-accent-strong);
  }

  /* Mobile Adjustments */
  @media (max-width: 600px) {
    .bar-content {
      flex-wrap: wrap;
      gap: var(--spacing-sm);
    }

    .selection-info {
      flex-direction: row;
      align-items: center;
      gap: var(--spacing-md);
    }

    .action-buttons {
      order: 3;
      width: 100%;
      justify-content: center;
    }

    .btn-label {
      display: none;
    }

    .action-btn {
      padding: 10px 14px;
    }

    .done-btn span {
      display: none;
    }

    .done-btn {
      padding: 10px 14px;
    }
  }
</style>
