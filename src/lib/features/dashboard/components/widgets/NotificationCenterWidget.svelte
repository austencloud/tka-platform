<!--
  NotificationCenterWidget - Dashboard Notification Widget

  Displays recent notifications with quick access to all notifications.
  Supports preview mode - shows previewed user's notifications when active.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { createNotificationState } from "$lib/features/feedback/state/notification-state.svelte";
  import FeedbackNotificationCard from "$lib/features/feedback/components/FeedbackNotificationCard.svelte";
  import { handleModuleChange } from "$lib/shared/navigation-coordinator/navigation-coordinator.svelte";
  import { setNotificationTargetFeedback } from "$lib/features/feedback/state/notification-action-state.svelte";
  import type {
    UserNotification,
    FeedbackNotification,
    AdminNotification,
  } from "$lib/features/feedback/domain/models/notification-models";
  import { exploreNavigationState } from "$lib/features/explore/shared/state/explore-navigation-state.svelte";
  import {
    userPreviewState,
    loadPreviewSection,
    type PreviewNotification,
  } from "$lib/shared/debug/state/user-preview-state.svelte";

  const notificationState = createNotificationState();

  // Check if in preview mode
  const isPreviewActive = $derived(userPreviewState.isActive);
  const previewNotifications = $derived(userPreviewState.data.notifications);

  // Convert preview notifications to UserNotification format for display
  const effectiveNotifications = $derived.by(() => {
    if (isPreviewActive) {
      // Transform preview notifications to match UserNotification interface
      return previewNotifications.map((n: PreviewNotification) => ({
        id: n.id,
        type: n.type,
        title: n.title || "",
        message: n.message || "",
        read: n.read ?? false,
        createdAt: n.createdAt ? new Date(n.createdAt) : new Date(),
      })) as unknown as UserNotification[];
    }
    return notificationState.notifications;
  });

  // Show only first 5 notifications
  const recentNotifications = $derived(effectiveNotifications.slice(0, 5));
  const hasMore = $derived(effectiveNotifications.length > 5);

  // Effective unread count
  const effectiveUnreadCount = $derived(
    isPreviewActive
      ? previewNotifications.filter((n: PreviewNotification) => !n.read).length
      : notificationState.unreadCount
  );

  onMount(() => {
    if (authState.isAuthenticated && !isPreviewActive) {
      notificationState.init();
    }

    return () => {
      notificationState.cleanup();
    };
  });

  // Watch auth state changes and preview mode
  $effect(() => {
    if (isPreviewActive) {
      // In preview mode, load preview notifications if not already loaded
      if (!userPreviewState.loadedSections.has("notifications")) {
        loadPreviewSection("notifications");
      }
      notificationState.cleanup();
    } else if (authState.isAuthenticated) {
      notificationState.init();
    } else {
      notificationState.cleanup();
    }
  });

  function handleNotificationAction(notification: UserNotification) {
    // Navigate based on notification type
    if (notification.type.startsWith("feedback-")) {
      // For feedback notifications, set the target feedback ID so MyFeedbackTab can open it
      const feedbackNotif = notification as FeedbackNotification;
      setNotificationTargetFeedback(feedbackNotif.feedbackId);
      handleModuleChange("feedback", "my-feedback");
    } else if (notification.type.startsWith("sequence-")) {
      // Could navigate to specific sequence or discover module
      handleModuleChange("explore", "gallery");
    } else if (notification.type === "admin-new-user-signup") {
      // Navigate to the new user's profile
      const adminNotif = notification as AdminNotification;
      exploreNavigationState.viewCreatorProfile(
        adminNotif.newUserId,
        adminNotif.newUserDisplayName
      );
      handleModuleChange("explore", "creators");
    }
  }

  function handleNotificationDismiss(notificationId: string) {
    // Optimistic update - notification already marked as read in NotificationItem
    // Just need to update our local state if needed
  }

  async function handleClearAll() {
    const user = authState.user;
    if (!user) return;

    // Call service to delete all notifications
    const { notificationService } =
      await import("$lib/features/feedback/services/implementations/Notifier");
    await notificationService.deleteAllNotifications(user.uid);
  }

  function viewAllNotifications() {
    // Navigate to a notifications view (settings for now, could be a dedicated view later)
    handleModuleChange("settings", "notifications");
  }
</script>

<div class="notification-center-widget" class:preview-mode={isPreviewActive}>
  {#if isPreviewActive}
    <div class="preview-banner">
      <i class="fas fa-eye" aria-hidden="true"></i>
      <span>Viewing user's notifications</span>
    </div>
  {/if}
  <div class="widget-header">
    <div class="header-left">
      <i class="fas fa-bell" aria-hidden="true"></i>
      <h3>Notifications</h3>
    </div>
    <div class="header-right">
      {#if effectiveNotifications.length > 0 && !isPreviewActive}
        <button
          class="clear-all-btn"
          onclick={() => handleClearAll()}
          type="button"
          title="Clear all notifications"
        >
          Clear all
        </button>
      {/if}
      {#if effectiveUnreadCount > 0}
        <span class="unread-badge">{effectiveUnreadCount}</span>
      {/if}
    </div>
  </div>

  <div class="widget-content">
    {#if !authState.isAuthenticated && !isPreviewActive}
      <div class="empty-state">
        <i class="fas fa-bell-slash" aria-hidden="true"></i>
        <p>Sign in to see notifications</p>
      </div>
    {:else if notificationState.isLoading || userPreviewState.loadingSection === "notifications"}
      <div class="loading-state">
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        <p>Loading notifications...</p>
      </div>
    {:else if recentNotifications.length === 0}
      <div class="empty-state">
        <i class="fas fa-inbox" aria-hidden="true"></i>
        <p>No notifications yet</p>
        <span class="empty-hint"
          >{isPreviewActive
            ? "This user has no notifications"
            : "You'll be notified when there's activity"}</span
        >
      </div>
    {:else}
      <div class="notifications-list">
        {#each recentNotifications as notification (notification.id)}
          <FeedbackNotificationCard
            {notification}
            onAction={handleNotificationAction}
            onDismiss={handleNotificationDismiss}
          />
        {/each}
      </div>

      {#if hasMore}
        <button class="view-all-button" onclick={viewAllNotifications}>
          <span>View all notifications</span>
          <i class="fas fa-arrow-right" aria-hidden="true"></i>
        </button>
      {/if}
    {/if}
  </div>
</div>

<style>
  .notification-center-widget {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: rgba(255, 255, 255, 0.01);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: var(--radius-2026-md);
    overflow: hidden;
    transition: border-color var(--duration-normal) var(--ease-out);
  }

  .notification-center-widget:hover {
    border-color: rgba(255, 255, 255, 0.1);
  }

  /* ============================================================================
     PREVIEW MODE
     ============================================================================ */
  .notification-center-widget.preview-mode {
    border-color: rgba(59, 130, 246, 0.3);
    background: rgba(59, 130, 246, 0.03);
  }

  .preview-banner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(59, 130, 246, 0.15);
    border-bottom: 1px solid rgba(59, 130, 246, 0.2);
    font-size: var(--font-size-compact);
    font-weight: 600;
    color: var(--semantic-info);
  }

  .preview-banner i {
    font-size: var(--font-size-compact);
  }

  /* ============================================================================
     WIDGET HEADER
     ============================================================================ */
  .widget-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    gap: 12px;
    transition: border-color var(--duration-normal) var(--ease-out);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .widget-header i {
    font-size: var(--font-size-lg);
    color: rgba(239, 68, 68, 0.8);
  }

  .widget-header h3 {
    font-size: var(--font-size-base);
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
    margin: 0;
  }

  .clear-all-btn {
    padding: 4px 8px;
    background: transparent;
    border: none;
    font-size: 0.75rem;
    color: var(--theme-text-dim);
    cursor: pointer;
    transition: color var(--duration-fast) var(--ease-out);
    border-radius: 4px;
  }

  .clear-all-btn:hover {
    color: var(--semantic-error);
  }

  .clear-all-btn:active {
    opacity: 0.8;
  }

  .unread-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    height: 24px;
    padding: 0 8px;
    background: linear-gradient(
      135deg,
      var(--semantic-error) 0%,
      var(--semantic-error) 100%
    );
    color: white;
    font-size: var(--font-size-compact);
    font-weight: 700;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
  }

  /* ============================================================================
     WIDGET CONTENT
     ============================================================================ */
  .widget-content {
    flex: 1;
    padding: 16px;
    overflow-y: auto;
  }

  /* ============================================================================
     NOTIFICATIONS LIST
     ============================================================================ */
  .notifications-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* ============================================================================
     EMPTY/LOADING STATES
     ============================================================================ */
  .empty-state,
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 32px 24px;
    color: var(--theme-text-dim);
    text-align: center;
  }

  .empty-state i,
  .loading-state i {
    font-size: var(--font-size-3xl);
  }

  .empty-state p,
  .loading-state p {
    font-size: var(--font-size-sm);
    margin: 0;
  }

  .empty-hint {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
  }

  /* ============================================================================
     VIEW ALL BUTTON
     ============================================================================ */
  .view-all-button {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    margin-top: 8px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-2026-md);
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-size: var(--font-size-compact);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal) var(--ease-out);
  }

  .view-all-button:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong, var(--theme-stroke-strong));
    color: var(--theme-text, var(--theme-text));
    transform: translateY(-1px);
  }

  .view-all-button:active {
    transform: translateY(0);
  }

  .view-all-button i {
    font-size: var(--font-size-compact);
    transition: transform var(--duration-normal) var(--ease-out);
  }

  .view-all-button:hover i {
    transform: translateX(4px);
  }

  /* ============================================================================
     SCROLLBAR
     ============================================================================ */
  .widget-content::-webkit-scrollbar {
    width: 6px;
  }

  .widget-content::-webkit-scrollbar-track {
    background: transparent;
    border-radius: 3px;
  }

  .widget-content::-webkit-scrollbar-thumb {
    background: var(--theme-stroke);
    border-radius: 3px;
    transition: background var(--duration-fast) var(--ease-out);
  }

  .widget-content::-webkit-scrollbar-thumb:hover {
    background: var(--theme-stroke-strong);
  }

  /* ============================================================================
     ACCESSIBILITY
     ============================================================================ */
  @media (prefers-reduced-motion: reduce) {
    .notification-center-widget,
    .widget-header,
    .clear-all-btn,
    .view-all-button,
    .view-all-button i {
      transition: none;
    }
  }
</style>
