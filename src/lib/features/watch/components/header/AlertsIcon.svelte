<!--
  AlertsIcon

  Shows notification bell icon with unread badge.
  Tapping navigates to alerts/notifications view.
-->
<script lang="ts">
  import { container } from "$lib/shared/di";
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import { onMount, onDestroy } from "svelte";

  interface Props {
    onClick?: () => void;
  }

  const { onClick }: Props = $props();

  let unreadCount = $state(0);
  let unsubscribe: (() => void) | null = null;

  const hasUnread = $derived(unreadCount > 0);
  const displayCount = $derived(unreadCount > 99 ? "99+" : String(unreadCount));

  onMount(() => {
    try {
      // Check if notification service exists in container
      // For now, this may not be implemented - alerts will show 0
      // notificationService not yet registered in DI - access via any
      const notificationService = (container.items as any).notificationService;
      if (notificationService?.subscribeToUnreadCount) {
        notificationService.getUnreadCount?.().then((count: number) => {
          unreadCount = count;
        });
        unsubscribe = notificationService.subscribeToUnreadCount((count: number) => {
          unreadCount = count;
        });
      }
    } catch {
      // Service not available - that's okay, badge won't show
    }
  });

  onDestroy(() => {
    unsubscribe?.();
  });

  function handleClick() {
    onClick?.();
  }
</script>

<button
  class="alerts-icon"
  onclick={handleClick}
  type="button"
  aria-label={hasUnread ? t('watch_alerts_unread', { count: unreadCount }) : t('watch_alerts')}
>
  <i class="fas fa-bell" aria-hidden="true"></i>
  {#if hasUnread}
    <span class="badge">{displayCount}</span>
  {/if}
</button>

<style>
  .alerts-icon {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 50%;
    color: var(--theme-text, #fff);
    font-size: 18px;
    cursor: pointer;
    transition: background var(--duration-fast, 150ms) ease;
  }

  .alerts-icon:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
  }

  .alerts-icon:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .badge {
    position: absolute;
    top: 4px;
    right: 4px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    background: var(--semantic-error, #ef4444);
    border-radius: 9px;
    font-size: 11px;
    font-weight: 700;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
