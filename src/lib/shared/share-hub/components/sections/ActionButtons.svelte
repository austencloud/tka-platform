<!--
  ActionButtons.svelte - Context-Aware Action Buttons

  Unified action buttons shown based on mode:
  - Discover (others): Fork, Star
  - Discover (owned) & Library: Favorite, Edit, Delete
-->
<script lang="ts">
  import type { ShareHubMode } from "../ShareHubDrawer.svelte";

  interface Props {
    mode: ShareHubMode;
    isOwned: boolean;
    isFavorite?: boolean;
    isStarred?: boolean;
    onFavoriteToggle?: () => void;
    onFork?: () => void;
    onStar?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
  }

  let {
    mode = "create",
    isOwned = true,
    isFavorite = false,
    isStarred = false,
    onFavoriteToggle,
    onFork,
    onStar,
    onEdit,
    onDelete,
  }: Props = $props();

  // Derive which buttons to show based on mode and ownership
  const showFork = $derived(mode === "discover" && !isOwned && onFork);
  const showStar = $derived(mode === "discover" && !isOwned && onStar);
  const showFavorite = $derived(
    (mode === "library" || (mode === "discover" && isOwned)) && onFavoriteToggle
  );
  const showEdit = $derived(
    (mode === "library" || (mode === "discover" && isOwned)) && onEdit
  );
  const showDelete = $derived(mode === "library" && onDelete);

  const hasActions = $derived(
    showFork || showStar || showFavorite || showEdit || showDelete
  );

  // Delete confirmation state
  let showDeleteConfirm = $state(false);

  function handleDeleteClick() {
    showDeleteConfirm = true;
  }

  function handleCancelDelete() {
    showDeleteConfirm = false;
  }

  function handleConfirmDelete() {
    onDelete?.();
    showDeleteConfirm = false;
  }
</script>

{#if hasActions}
  <div class="action-buttons-section">
    {#if showDeleteConfirm}
      <!-- Delete Confirmation -->
      <div class="delete-confirm">
        <p>Delete this sequence? This cannot be undone.</p>
        <div class="confirm-actions">
          <button class="btn btn-secondary" onclick={handleCancelDelete}>
            Cancel
          </button>
          <button class="btn btn-danger" onclick={handleConfirmDelete}>
            Delete
          </button>
        </div>
      </div>
    {:else}
      <!-- Primary Actions Row -->
      <div class="actions-row primary">
        {#if showFork}
          <button class="action-btn fork" onclick={() => onFork?.()}>
            <i class="fas fa-code-branch" aria-hidden="true"></i>
            <span>Fork</span>
          </button>
        {/if}

        {#if showStar}
          <button
            class="action-btn star"
            class:active={isStarred}
            onclick={() => onStar?.()}
          >
            <i class="fas fa-star" aria-hidden="true"></i>
            <span>{isStarred ? "Starred" : "Star"}</span>
          </button>
        {/if}

        {#if showFavorite}
          <button
            class="action-btn favorite"
            class:active={isFavorite}
            onclick={() => onFavoriteToggle?.()}
          >
            <i class="fas fa-heart" aria-hidden="true"></i>
            <span>{isFavorite ? "Favorited" : "Favorite"}</span>
          </button>
        {/if}

        {#if showEdit}
          <button class="action-btn edit" onclick={() => onEdit?.()}>
            <i class="fas fa-edit" aria-hidden="true"></i>
            <span>Edit</span>
          </button>
        {/if}
      </div>

      <!-- Danger Zone (Delete) -->
      {#if showDelete}
        <div class="danger-zone">
          <button class="delete-btn" onclick={handleDeleteClick}>
            <i class="fas fa-trash" aria-hidden="true"></i>
            Delete Sequence
          </button>
        </div>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .action-buttons-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .actions-row {
    display: flex;
    gap: 12px;
  }

  .action-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-2026-sm, 10px);
    color: var(--theme-text);
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    min-height: var(--min-touch-target);
  }

  .action-btn:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
  }

  .action-btn i {
    font-size: 16px;
  }

  /* Fork button */
  .action-btn.fork:hover {
    background: color-mix(in srgb, var(--semantic-success) 15%, transparent);
    border-color: color-mix(in srgb, var(--semantic-success) 40%, transparent);
    color: var(--semantic-success);
  }

  /* Star button */
  .action-btn.star:hover,
  .action-btn.star.active {
    background: color-mix(in srgb, rgba(250, 204, 21, 0.95) 15%, transparent);
    border-color: color-mix(in srgb, rgba(250, 204, 21, 0.95) 40%, transparent);
    color: rgba(250, 204, 21, 0.95);
  }

  /* Favorite button */
  .action-btn.favorite:hover,
  .action-btn.favorite.active {
    background: color-mix(in srgb, var(--semantic-error) 15%, transparent);
    border-color: color-mix(in srgb, var(--semantic-error) 40%, transparent);
    color: var(--semantic-error);
  }

  /* Edit button */
  .action-btn.edit:hover {
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 40%, transparent);
    color: var(--theme-accent);
  }

  /* Danger Zone */
  .danger-zone {
    padding-top: 16px;
    border-top: 1px solid var(--theme-stroke);
  }

  .delete-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 12px;
    background: transparent;
    border: 1px solid color-mix(in srgb, var(--semantic-error) 40%, transparent);
    border-radius: var(--radius-2026-sm, 10px);
    color: var(--semantic-error);
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    min-height: var(--min-touch-target);
  }

  .delete-btn:hover {
    background: color-mix(in srgb, var(--semantic-error) 10%, transparent);
  }

  /* Delete Confirmation */
  .delete-confirm {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: color-mix(in srgb, var(--semantic-error) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-error) 30%, transparent);
    border-radius: var(--radius-2026-sm, 10px);
  }

  .delete-confirm p {
    margin: 0;
    color: var(--semantic-error);
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
  }

  .confirm-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }

  .btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 20px;
    border-radius: var(--radius-2026-sm, 10px);
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    min-height: var(--min-touch-target);
  }

  .btn-secondary {
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    color: var(--theme-text);
  }

  .btn-secondary:hover {
    background: var(--theme-card-hover-bg);
  }

  .btn-danger {
    background: var(--semantic-error);
    border: none;
    color: white;
  }

  .btn-danger:hover {
    opacity: 0.9;
  }
</style>
