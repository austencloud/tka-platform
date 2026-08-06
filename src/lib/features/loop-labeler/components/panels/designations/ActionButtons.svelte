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

  <button
    data-save-shortcut
    class="action-btn save"
    onclick={onSaveAndNext}
    disabled={!canSave}
  >
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
    background: color-mix(in srgb, var(--semantic-error) 15%, transparent);
    border-color: color-mix(in srgb, var(--semantic-error) 40%, transparent);
    color: color-mix(in srgb, var(--semantic-error) 65%, white);
  }

  .action-btn.unknown {
    background: transparent;
    border: 1px solid color-mix(in srgb, var(--semantic-warning) 25%, transparent);
    color: var(--muted-foreground);
    font-weight: 500;
  }

  .action-btn.unknown:hover {
    background: color-mix(in srgb, var(--semantic-warning) 15%, transparent);
    border-color: color-mix(in srgb, var(--semantic-warning) 40%, transparent);
    color: var(--semantic-warning);
  }

  .action-btn.save {
    flex: 2;
    background: var(--gradient-primary);
    border: none;
    color: var(--foreground);
    box-shadow: 0 2px 8px color-mix(in srgb, var(--primary-color) 30%, transparent);
  }

  .action-btn.save:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px color-mix(in srgb, var(--primary-color) 50%, transparent);
  }

  .action-btn.save:disabled {
    opacity: 0.3;
    cursor: not-allowed;
    box-shadow: none;
  }
</style>
