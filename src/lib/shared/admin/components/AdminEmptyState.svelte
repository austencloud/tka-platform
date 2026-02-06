<script lang="ts">
  /**
   * AdminEmptyState
   * Empty state display with icon and optional action
   */

  interface AdminEmptyStateProps {
    icon: string;
    title: string;
    message?: string;
    actionLabel?: string;
    onAction?: () => void;
    class?: string;
  }

  let {
    icon,
    title,
    message,
    actionLabel,
    onAction,
    class: className = "",
  }: AdminEmptyStateProps = $props();
</script>

<div class="admin-empty-state {className}">
  <i class="fas {icon} empty-icon" aria-hidden="true"></i>
  <h3 class="empty-title">{title}</h3>
  {#if message}
    <p class="empty-message">{message}</p>
  {/if}
  {#if actionLabel && onAction}
    <button class="empty-action" onclick={onAction}>
      {actionLabel}
    </button>
  {/if}
</div>

<style>
  .admin-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 50px 24px;
    color: var(--theme-text-dim);
    gap: 12px;
    text-align: center;
  }

  .empty-icon {
    font-size: var(--font-size-3xl);
    margin-bottom: 8px;
  }

  .empty-title {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--theme-text-dim);
  }

  .empty-message {
    margin: 0;
    font-size: var(--font-size-sm);
    max-width: 400px;
  }

  .empty-action {
    margin-top: 8px;
    padding: 10px 20px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: white;
    cursor: pointer;
    transition: all var(--duration-normal);
  }

  .empty-action:hover {
    background: rgba(255, 255, 255, 0.15);
  }
</style>
