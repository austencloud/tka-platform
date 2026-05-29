<!--
  WriteToolbar.svelte - Top toolbar with file operations

  Controls for creating, saving, and managing acts.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import { onMount } from "svelte";

  interface Props {
    hasUnsavedChanges?: boolean;
    disabled?: boolean;
    onNewActRequested?: () => void;
    onSaveRequested?: () => void;
    onSaveAsRequested?: () => void;
  }

  let {
    hasUnsavedChanges = false,
    disabled = false,
    onNewActRequested,
    onSaveRequested,
    onSaveAsRequested,
  }: Props = $props();

  let hapticService: HapticFeedback;

  onMount(() => {
    hapticService = getHapticFeedback();
  });

  function handleNewAct() {
    if (disabled) return;
    hapticService?.trigger("selection");
    onNewActRequested?.();
  }

  function handleSave() {
    if (disabled) return;
    hapticService?.trigger("selection");
    onSaveRequested?.();
  }

  function handleSaveAs() {
    if (disabled) return;
    hapticService?.trigger("selection");
    onSaveAsRequested?.();
  }
</script>

<div class="write-toolbar" class:disabled>
  <div class="toolbar-group">
    <button
      class="toolbar-btn primary"
      {disabled}
      onclick={handleNewAct}
      aria-label="Create new act"
    >
      <i class="fas fa-file-circle-plus" aria-hidden="true"></i>
      <span class="btn-label">New Act</span>
    </button>

    <button
      class="toolbar-btn"
      class:has-changes={hasUnsavedChanges}
      {disabled}
      onclick={handleSave}
      aria-label={hasUnsavedChanges ? "Save act (unsaved changes)" : "Save act"}
    >
      <i class="fas fa-floppy-disk" aria-hidden="true"></i>
      <span class="btn-label">Save</span>
      {#if hasUnsavedChanges}
        <span class="unsaved-dot" aria-hidden="true"></span>
      {/if}
    </button>

    <button
      class="toolbar-btn"
      {disabled}
      onclick={handleSaveAs}
      aria-label="Save act with new name"
    >
      <i class="fas fa-file-export" aria-hidden="true"></i>
      <span class="btn-label">Save As</span>
    </button>
  </div>
</div>

<style>
  .write-toolbar {
    display: flex;
    align-items: center;
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-lg, 12px);
    min-height: var(--min-touch-target);
    transition: opacity var(--duration-normal) ease;
  }

  .write-toolbar.disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  .toolbar-group {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .toolbar-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-xs) var(--spacing-md);
    min-height: var(--min-touch-target);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    position: relative;
  }

  .toolbar-btn i {
    font-size: 1rem;
    opacity: 0.9;
  }

  .toolbar-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    transform: translateY(-1px);
  }

  .toolbar-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .toolbar-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .toolbar-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Primary action button (New Act) */
  .toolbar-btn.primary {
    background: var(--theme-accent, #f43f5e);
    border-color: transparent;
    color: white;
  }

  .toolbar-btn.primary:hover:not(:disabled) {
    background: color-mix(in srgb, var(--theme-accent, #f43f5e) 85%, white);
    border-color: transparent;
  }

  .toolbar-btn.primary i {
    opacity: 1;
  }

  /* Save button with unsaved changes */
  .toolbar-btn.has-changes {
    background: rgba(34, 197, 94, 0.15);
    border-color: rgba(34, 197, 94, 0.4);
  }

  .toolbar-btn.has-changes:hover:not(:disabled) {
    background: rgba(34, 197, 94, 0.25);
    border-color: rgba(34, 197, 94, 0.5);
  }

  .unsaved-dot {
    width: 8px;
    height: 8px;
    background: #22c55e;
    border-radius: 50%;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }

  /* Responsive */
  @media (max-width: 600px) {
    .write-toolbar {
      padding: var(--spacing-xs) var(--spacing-sm);
    }

    .toolbar-group {
      gap: var(--spacing-xs);
    }

    .toolbar-btn {
      padding: var(--spacing-xs) var(--spacing-sm);
    }

    .btn-label {
      display: none;
    }

    .toolbar-btn i {
      font-size: 1.1rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .toolbar-btn {
      transition: none;
    }

    .toolbar-btn:hover:not(:disabled) {
      transform: none;
    }

    .unsaved-dot {
      animation: none;
    }
  }
</style>
