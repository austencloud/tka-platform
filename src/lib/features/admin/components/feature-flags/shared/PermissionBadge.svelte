<script lang="ts">
  /**
   * PermissionBadge
   * Shows access status with icon and optional label
   */

  interface Props {
    hasAccess: boolean;
    reason?: string;
    showLabel?: boolean;
    size?: "sm" | "md";
  }

  let {
    hasAccess,
    reason,
    showLabel = false,
    size = "md",
  }: Props = $props();
</script>

<span
  class="permission-badge"
  class:granted={hasAccess}
  class:denied={!hasAccess}
  class:sm={size === "sm"}
  title={reason}
>
  <i class="fas {hasAccess ? 'fa-check-circle' : 'fa-times-circle'}" aria-hidden="true"></i>
  {#if showLabel}
    <span class="label">{hasAccess ? "Access" : "No Access"}</span>
  {/if}
</span>

<style>
  .permission-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    white-space: nowrap;
  }

  .permission-badge.sm {
    padding: 2px 6px;
    font-size: var(--font-size-compact, 12px);
    gap: 3px;
  }

  .permission-badge.sm i {
    font-size: 10px;
  }

  .permission-badge.granted {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
  }

  .permission-badge.denied {
    background: rgba(239, 68, 68, 0.12);
    color: #fca5a5;
  }

  .permission-badge i {
    font-size: var(--font-size-sm, 14px);
  }
</style>
