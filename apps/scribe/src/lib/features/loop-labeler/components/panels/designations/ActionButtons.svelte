<script lang="ts">
  /**
   * Action Buttons
   *
   * Freeform, Unknown, and Save & Next actions for the designations panel.
   */

  interface Props {
    isFreeform: boolean;
    canSave: boolean;
    onSetFreeform: () => void;
    onMarkUnknown: () => void;
    onSaveAndNext: () => void;
  }

  let {
    isFreeform,
    canSave,
    onSetFreeform,
    onMarkUnknown,
    onSaveAndNext,
  }: Props = $props();
</script>

<div class="action-buttons">
  <button
    class="action-btn freeform"
    class:selected={isFreeform}
    onclick={onSetFreeform}
  >
    Freeform
  </button>

  <button class="action-btn unknown" onclick={onMarkUnknown}> Unknown </button>

  <button class="action-btn save" onclick={onSaveAndNext} disabled={!canSave}>
    Save & Next
  </button>
</div>

<style>
  .action-buttons {
    display: flex;
    gap: var(--spacing-sm);
    margin-top: var(--spacing-xs);
  }

  .action-btn {
    flex: 1;
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: 8px;
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition-fast);
    min-height: var(--min-touch-target);
  }

  .action-btn.freeform {
    background: transparent;
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    color: var(--muted-foreground);
    font-weight: 500;
  }

  .action-btn.freeform:hover {
    background: var(--surface-color);
    color: var(--foreground);
  }

  .action-btn.freeform.selected {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.4);
    color: #fca5a5;
  }

  .action-btn.unknown {
    background: transparent;
    border: 1px solid rgba(234, 179, 8, 0.25);
    color: var(--muted-foreground);
    font-weight: 500;
  }

  .action-btn.unknown:hover {
    background: rgba(234, 179, 8, 0.15);
    border-color: rgba(234, 179, 8, 0.4);
    color: #eab308;
  }

  .action-btn.save {
    flex: 2;
    background: var(--gradient-primary);
    border: none;
    color: var(--foreground);
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
  }

  .action-btn.save:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(99, 102, 241, 0.5);
  }

  .action-btn.save:disabled {
    opacity: 0.3;
    cursor: not-allowed;
    box-shadow: none;
  }
</style>
