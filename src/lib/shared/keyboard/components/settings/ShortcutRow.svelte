<!--
  ShortcutRow.svelte

  Compact row for displaying a single keyboard shortcut.
  Click to edit. Minimal visual noise, maximum scannability.
-->
<script lang="ts">
  import KeyboardKeyDisplay from "./KeyboardKeyDisplay.svelte";
  import type { ShortcutWithBinding } from "../../services/types";

  let {
    item,
    onEdit = () => {},
    onReset = () => {},
  }: {
    item: ShortcutWithBinding;
    onEdit?: (item: ShortcutWithBinding) => void;
    onReset?: (item: ShortcutWithBinding) => void;
  } = $props();

  function handleClick() {
    onEdit(item);
  }

  function handleReset(e: MouseEvent) {
    e.stopPropagation();
    onReset(item);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onEdit(item);
    }
  }
</script>

<div
  class="shortcut-row"
  class:customized={item.isCustomized}
  class:disabled={item.isDisabled}
  onclick={handleClick}
  onkeydown={handleKeydown}
  role="button"
  tabindex="0"
  title={item.shortcut.description || item.shortcut.label}
  aria-label="Edit shortcut for {item.shortcut.label}"
>
  <!-- Key combo - left aligned, fixed width -->
  <div class="key-section" class:muted={item.isDisabled}>
    <KeyboardKeyDisplay parsed={item.effectiveBinding} />
  </div>

  <!-- Label - grows to fill space -->
  <span class="label">{item.shortcut.label}</span>

  <!-- Status indicators -->
  <div class="status">
    {#if item.isCustomized}
      <button
        type="button"
        class="reset-btn"
        onclick={handleReset}
        title="Reset to default"
        aria-label="Reset to default"
      >
        <i class="fas fa-undo" aria-hidden="true"></i>
      </button>
    {/if}
    {#if item.isDisabled}
      <span class="off-badge">Off</span>
    {/if}
  </div>

  <!-- Edit indicator -->
  <i class="fas fa-pen edit-icon" aria-hidden="true"></i>
</div>

<style>
  /* Row with subtle background to group key + label */
  .shortcut-row {
    display: flex;
    align-items: center;
    gap: 16px;
    width: 100%;
    height: 44px;
    padding: 0 14px;
    background: rgba(255, 255, 255, 0.03);
    border: none;
    border-radius: 8px;
    border-left: 3px solid transparent;
    cursor: pointer;
    text-align: left;
    transition: all var(--duration-instant) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .shortcut-row:hover {
    background: rgba(255, 255, 255, 0.07);
    border-left-color: var(--theme-accent, var(--theme-accent-strong));
  }

  .shortcut-row:active {
    background: rgba(255, 255, 255, 0.09);
  }

  .shortcut-row.customized {
    border-left-color: var(--theme-accent, var(--theme-accent-strong));
  }

  .shortcut-row.customized .label {
    color: var(--theme-accent);
  }

  .shortcut-row.disabled {
    opacity: 0.45;
  }

  /* Key section - fixed width for alignment */
  .key-section {
    flex-shrink: 0;
    min-width: 90px;
    display: flex;
    justify-content: flex-start;
  }

  .key-section.muted {
    opacity: 0.4;
    filter: grayscale(1);
  }

  /* Label - connected to key */
  .label {
    flex: 1;
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--theme-text, var(--theme-text));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Status section */
  .status {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .reset-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    cursor: pointer;
    opacity: 0;
    transition: all var(--duration-instant) ease;
  }

  .shortcut-row:hover .reset-btn {
    opacity: 1;
  }

  .reset-btn:hover {
    background: color-mix(
      in srgb,
      var(--semantic-error, var(--semantic-error)) 15%,
      transparent
    );
    color: var(--semantic-error, var(--semantic-error));
  }

  .off-badge {
    font-size: var(--font-size-compact);
    font-weight: 600;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 3px;
    background: var(--theme-card-bg);
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  /* Edit icon - subtle, shows on hover */
  .edit-icon {
    flex-shrink: 0;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    opacity: 0;
    transition: opacity var(--duration-instant) ease;
  }

  .shortcut-row:hover .edit-icon {
    opacity: 1;
  }

  /* Focus state */
  .shortcut-row:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 1px;
  }

  /* Touch devices */
  @media (hover: none) {
    .edit-icon,
    .reset-btn {
      opacity: 0.6;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .shortcut-row,
    .reset-btn,
    .edit-icon {
      transition: none;
    }
  }
</style>
