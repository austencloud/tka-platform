<!--
  SelectionToolbar - Sticky bar shown during batch selection mode.
  Shows selected count with "Tag", "Clear", and "Exit" actions.
-->
<script lang="ts">
  interface Props {
    selectedCount: number;
    totalCount: number;
    onTag: () => void;
    onSelectAll: () => void;
    onClearSelection: () => void;
    onExitSelection: () => void;
  }

  let {
    selectedCount,
    totalCount,
    onTag,
    onSelectAll,
    onClearSelection,
    onExitSelection,
  }: Props = $props();

  const allSelected = $derived(selectedCount === totalCount && totalCount > 0);
</script>

<div class="selection-toolbar" role="toolbar" aria-label="Batch selection actions">
  <div class="toolbar-left">
    <span class="selected-count">
      {selectedCount} selected
    </span>
    <button
      class="toolbar-btn select-all-btn"
      onclick={allSelected ? onClearSelection : onSelectAll}
    >
      {allSelected ? "Deselect all" : "Select all"}
    </button>
  </div>

  <div class="toolbar-right">
    <button
      class="toolbar-btn tag-btn"
      onclick={onTag}
      disabled={selectedCount === 0}
    >
      <i class="fas fa-tags"></i>
      Tag
    </button>
    <button class="toolbar-btn clear-btn" onclick={onClearSelection} disabled={selectedCount === 0}>
      Clear
    </button>
    <button class="toolbar-btn exit-btn" onclick={onExitSelection}>
      Exit
    </button>
  </div>
</div>

<style>
  .selection-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 16px;
    background: color-mix(in srgb, var(--theme-accent, #3b82f6) 15%, var(--theme-panel-bg, rgba(18, 18, 28, 0.98)));
    border: 1px solid color-mix(in srgb, var(--theme-accent, #3b82f6) 30%, transparent);
    border-radius: 10px;
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .toolbar-left,
  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .selected-count {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, #fff);
    white-space: nowrap;
  }

  .toolbar-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 6px 14px;
    min-height: 36px;
    border-radius: 8px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #fff);
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) var(--ease-out, ease-out);
    white-space: nowrap;
  }

  .toolbar-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .toolbar-btn:active:not(:disabled) {
    transform: scale(var(--active-scale, 0.98));
  }

  .toolbar-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .toolbar-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #3b82f6);
    outline-offset: 2px;
  }

  .tag-btn {
    background: var(--theme-accent, #3b82f6);
    border-color: var(--theme-accent, #3b82f6);
    color: #fff;
  }

  .tag-btn:hover:not(:disabled) {
    background: color-mix(in srgb, var(--theme-accent, #3b82f6) 85%, white);
    border-color: color-mix(in srgb, var(--theme-accent, #3b82f6) 85%, white);
  }

  .exit-btn {
    border-color: rgba(255, 255, 255, 0.15);
  }

  @media (max-width: 480px) {
    .selection-toolbar {
      flex-wrap: wrap;
      padding: 8px 12px;
    }

    .select-all-btn {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .toolbar-btn {
      transition: none;
    }
    .toolbar-btn:active:not(:disabled) {
      transform: none;
    }
  }
</style>
