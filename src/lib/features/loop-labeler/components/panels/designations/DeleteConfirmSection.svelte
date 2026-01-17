<script lang="ts">
  /**
   * Delete Confirm Section
   *
   * Two-step delete confirmation for sequences.
   */
  import FontAwesomeIcon from "$lib/shared/foundation/ui/FontAwesomeIcon.svelte";

  interface Props {
    sequenceWord: string;
    onDeleteSequence: () => Promise<void>;
  }

  let { sequenceWord, onDeleteSequence }: Props = $props();

  let showDeleteConfirm = $state(false);
  let isDeleting = $state(false);

  async function handleDeleteSequence() {
    isDeleting = true;
    try {
      await onDeleteSequence();
      showDeleteConfirm = false;
    } finally {
      isDeleting = false;
    }
  }
</script>

<div class="delete-section">
  {#if showDeleteConfirm}
    <div class="delete-confirm">
      <span class="delete-warning">
        <FontAwesomeIcon icon="triangle-exclamation" size="0.9em" />
        Delete "{sequenceWord}" from database?
      </span>
      <div class="delete-actions">
        <button
          class="delete-cancel-btn"
          onclick={() => (showDeleteConfirm = false)}
          disabled={isDeleting}
        >
          Cancel
        </button>
        <button
          class="delete-confirm-btn"
          onclick={handleDeleteSequence}
          disabled={isDeleting}
        >
          {#if isDeleting}
            <span class="spinner-icon">
              <FontAwesomeIcon icon="spinner" size="0.9em" />
            </span>
            Deleting...
          {:else}
            <FontAwesomeIcon icon="trash" size="0.9em" />
            Delete
          {/if}
        </button>
      </div>
    </div>
  {:else}
    <button
      class="action-btn delete"
      onclick={() => (showDeleteConfirm = true)}
    >
      <FontAwesomeIcon icon="trash" size="0.9em" />
      Delete Sequence
    </button>
  {/if}
</div>

<style>
  .delete-section {
    margin-top: var(--spacing-md);
    padding-top: var(--spacing-md);
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .delete-confirm {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
  }

  .delete-warning {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    color: var(--semantic-error);
    font-size: var(--font-size-sm);
    font-weight: 500;
  }

  .delete-actions {
    display: flex;
    gap: var(--spacing-sm);
    justify-content: flex-end;
  }

  .delete-cancel-btn {
    padding: 6px 12px;
    background: transparent;
    border: 1px solid var(--theme-stroke, var(--theme-stroke-strong));
    border-radius: 6px;
    color: var(--muted-foreground);
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .delete-cancel-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
    color: var(--foreground);
  }

  .delete-cancel-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .delete-confirm-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid rgba(239, 68, 68, 0.5);
    border-radius: 6px;
    color: var(--semantic-error);
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .delete-confirm-btn:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.3);
    border-color: rgba(239, 68, 68, 0.7);
  }

  .delete-confirm-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .action-btn.delete {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: 8px;
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition-fast);
    min-height: var(--min-touch-target);
    background: transparent;
    border: 1px solid rgba(239, 68, 68, 0.25);
    color: var(--muted-foreground);
  }

  .action-btn.delete:hover {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.5);
    color: var(--semantic-error);
  }

  .spinner-icon {
    display: inline-flex;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .spinner-icon {
      animation: none;
    }
  }
</style>
