<script lang="ts">
  /**
   * AdminListItem
   * Selectable list item with flexible slots
   */

  import type { Snippet } from "svelte";

  interface AdminListItemProps {
    selected?: boolean;
    disabled?: boolean;
    onClick: () => void;
    variant?: "default" | "compact" | "detailed";
    class?: string;
    children: Snippet;
    icon?: Snippet;
    meta?: Snippet;
  }

  let {
    selected = false,
    disabled = false,
    onClick,
    variant = "default",
    class: className = "",
    children,
    icon,
    meta,
  }: AdminListItemProps = $props();
</script>

<button
  class="admin-list-item variant-{variant} {className}"
  class:selected
  class:disabled
  onclick={onClick}
  {disabled}
>
  {#if icon}
    <div class="item-icon">
      {@render icon()}
    </div>
  {/if}

  <div class="item-content">
    {@render children()}
  </div>

  {#if meta}
    <div class="item-meta">
      {@render meta()}
    </div>
  {/if}
</button>

<style>
  .admin-list-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    cursor: pointer;
    transition: all var(--duration-normal);
    text-align: left;
    width: 100%;
    color: inherit;
    font: inherit;
  }

  .admin-list-item:hover:not(.disabled) {
    background: rgba(255, 255, 255, 0.08);
    border-color: var(--theme-stroke);
  }

  .admin-list-item.selected {
    background: rgba(59, 130, 246, 0.15);
    border-color: rgba(59, 130, 246, 0.3);
  }

  .admin-list-item.disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .item-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-lg);
    color: var(--theme-text-dim);
  }

  .item-content {
    flex: 1;
    min-width: 0;
  }

  .item-meta {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* Compact variant */
  .variant-compact {
    padding: 8px 12px;
    gap: 8px;
  }

  /* Detailed variant */
  .variant-detailed {
    padding: 16px;
    align-items: flex-start;
  }
</style>
