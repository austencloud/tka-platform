<script lang="ts">
  /**
   * NotificationsDrawer
   *
   * Dedicated drawer for viewing system notifications.
   * Mobile: Opens from bottom. Desktop: Opens from right.
   * No tabs, no messages - focused on notifications only.
   */

  import { onMount, onDestroy } from "svelte";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import { inboxState } from "$lib/shared/inbox/state/inbox-state.svelte";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { notificationService } from "$lib/features/feedback/services/implementations/Notifier";
  import NotificationList from "$lib/shared/inbox/components/notifications/NotificationList.svelte";
  import { handleModuleChange } from "$lib/shared/navigation-coordinator/navigation-coordinator.svelte";
  import type { ModuleId } from "$lib/shared/navigation/domain/types";
  import { container } from "$lib/shared/di";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";

  // Props
  interface Props {
    isOpen?: boolean;
  }

  let { isOpen = $bindable(false) }: Props = $props();

  // Responsive placement
  let isMobile = $state(false);
  let placement = $derived(isMobile ? "bottom" : "right") as "bottom" | "right";

  // Haptic feedback service
  let hapticService: IHapticFeedback | undefined;

  // Media query for responsive behavior
  let mediaQuery: MediaQueryList | null = null;
  function handleMediaChange(e: MediaQueryListEvent) {
    isMobile = e.matches;
  }

  onMount(() => {
    hapticService = container.items.hapticFeedback;

    mediaQuery = window.matchMedia("(max-width: 768px)");
    isMobile = mediaQuery.matches;
    mediaQuery.addEventListener("change", handleMediaChange);
  });

  onDestroy(() => {
    mediaQuery?.removeEventListener("change", handleMediaChange);
  });

  // Auto-mark all notifications as read when drawer opens (viewing = acknowledging)
  $effect(() => {
    const unreadCount = inboxState.unreadNotificationCount;
    const userId = authState.user?.uid;

    if (!isOpen || unreadCount === 0 || !userId) {
      return;
    }

    // Small delay to let drawer render, then mark all as read
    const timer = setTimeout(() => {
      notificationService.markAllAsRead(userId).catch(console.error);
    }, 150);

    return () => clearTimeout(timer);
  });

  // Handle notification-specific actions (navigate to relevant location)
  async function handleNotificationAction(notificationId: string) {
    const notification = inboxState.notifications.find(
      (n) => n.id === notificationId
    );
    if (!notification) return;

    switch (notification.type) {
      case "message-received": {
        // This shouldn't happen in NotificationsDrawer, but handle gracefully
        // User should use MessagesDrawer for conversations
        break;
      }
      case "sequence-liked": {
        // Navigate to discover gallery
        isOpen = false;
        await handleModuleChange("discover" as ModuleId, "gallery");
        break;
      }
      case "user-followed": {
        // Navigate to discover creators
        isOpen = false;
        await handleModuleChange("discover" as ModuleId, "creators");
        break;
      }
      case "achievement-unlocked": {
        // Navigate to collect/achievements
        isOpen = false;
        await handleModuleChange("collect" as ModuleId);
        break;
      }
      case "feedback-resolved":
      case "feedback-in-progress":
      case "feedback-needs-info":
      case "feedback-response": {
        // Navigate to feedback module with the specific feedback item
        isOpen = false;
        await handleModuleChange("feedback" as ModuleId, "my-feedback");
        break;
      }
      default:
        // For unknown types, just stay in notifications list
        break;
    }
  }

  function handleClose() {
    hapticService?.trigger("selection");
    isOpen = false;
  }

  // Custom escape handler
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      event.stopPropagation();
      handleClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<Drawer
  bind:isOpen
  {placement}
  showHandle={isMobile}
  closeOnBackdrop={true}
  closeOnEscape={false}
  onclose={handleClose}
  class="notifications-drawer"
  ariaLabel="Notifications"
>
  <div
    class="notifications-container"
    role="dialog"
    aria-labelledby="notifications-title"
  >
    <!-- Header -->
    <header class="notifications-header">
      <h2 id="notifications-title">Notifications</h2>
      <button
        class="close-button"
        onclick={handleClose}
        aria-label="Close notifications"
      >
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </header>

    <!-- Content -->
    <section class="notifications-content">
      <NotificationList
        notifications={inboxState.notifications}
        isLoading={inboxState.isLoadingNotifications}
      />
    </section>
  </div>
</Drawer>

<style>
  .notifications-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 400px;
  }

  .notifications-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    border-bottom: 1px solid var(--theme-stroke, var(--theme-stroke));
  }

  .notifications-header h2 {
    flex: 1;
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--theme-text);
  }

  .close-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 12px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    cursor: pointer;
    transition:
      background 0.2s ease,
      color 0.2s ease,
      transform 0.15s ease;
  }

  .close-button:hover {
    background: var(--theme-card-bg);
    color: var(--theme-text);
  }

  .close-button:active {
    transform: scale(0.95);
  }

  .close-button:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px
      color-mix(in srgb, var(--theme-accent) 50%, transparent);
  }

  .notifications-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  :global(.drawer-content.notifications-drawer) {
    --sheet-width: min(480px, 95vw);
    width: var(--sheet-width) !important;
  }

  @media (max-width: 768px) {
    :global(.drawer-content.notifications-drawer) {
      --sheet-width: 100%;
      width: 100% !important;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .close-button {
      transition: none !important;
    }
  }
</style>
