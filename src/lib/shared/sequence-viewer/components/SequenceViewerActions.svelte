<!--
  SequenceViewerActions.svelte - Action buttons for the Sequence Viewer

  @deprecated LEGACY COMPONENT - Used by deprecated SequenceViewer.
  New action patterns should be integrated into SequenceViewerDrawerHost.

  Legacy description (for reference):
  Handles the action buttons with their various states.
-->
<script lang="ts">
  const {
    isAuthenticated = false,
    isSaving = false,
    isSavedToLibrary = false,
    isFavorite = false,
    saveError = null,
    onAction,
  } = $props<{
    isAuthenticated?: boolean;
    isSaving?: boolean;
    isSavedToLibrary?: boolean;
    isFavorite?: boolean;
    saveError?: string | null;
    onAction: (action: string) => void;
  }>();
</script>

<section class="actions-section">
  <button
    type="button"
    class="action-button primary"
    onclick={() => onAction("open-in-create")}
  >
    <i class="fas fa-pen-to-square" aria-hidden="true"></i>
    Open in Create
  </button>

  {#if isAuthenticated}
    <button
      type="button"
      class="action-button"
      class:success={isSavedToLibrary}
      onclick={() => onAction("save")}
      disabled={isSaving}
    >
      {#if isSaving}
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        Saving...
      {:else if isSavedToLibrary}
        <i class="fas fa-check" aria-hidden="true"></i>
        Saved
      {:else}
        <i class="fas fa-bookmark" aria-hidden="true"></i>
        Save to Library
      {/if}
    </button>
  {/if}

  <button type="button" class="action-button" onclick={() => onAction("share")}>
    <i class="fas fa-share-alt" aria-hidden="true"></i>
    Share
  </button>

  {#if isAuthenticated}
    <button
      type="button"
      class="action-button"
      class:active={isFavorite}
      onclick={() => onAction("favorite")}
    >
      <i class={isFavorite ? "fas fa-heart" : "far fa-heart"} aria-hidden="true"
      ></i>
      Favorite
    </button>
  {/if}
</section>

{#if saveError}
  <div class="save-error">
    <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
    {saveError}
  </div>
{/if}

<style>
  .actions-section {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    justify-content: center;
    padding-bottom: 24px;
    flex-shrink: 0; /* Prevent from being squeezed */
  }

  .action-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    min-height: var(--min-touch-target);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text, white);
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal);
  }

  .action-button:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .action-button.primary {
    background: var(--theme-accent, #6366f1);
    border: none;
    color: white;
  }

  .action-button.primary:hover {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 85%, white);
  }

  .action-button.active {
    color: var(--semantic-error);
  }

  .action-button.success {
    background: rgba(16, 185, 129, 0.2);
    border-color: rgba(16, 185, 129, 0.4);
    color: var(--semantic-success);
  }

  .action-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .action-button:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .save-error {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    color: var(--semantic-error);
    font-size: var(--font-size-sm);
  }
</style>
