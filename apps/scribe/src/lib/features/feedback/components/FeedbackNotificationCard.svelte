<!--
  FeedbackNotificationCard - Styled notification card for dashboard

  Displays a notification with icon, message, and two actions:
  - Click card: Mark as read (dismiss)
  - Click action button: Mark as read + navigate to context
-->
<script lang="ts">
  import type {
    UserNotification,
    NotificationType,
  } from "../domain/models/notification-models";
  import { NOTIFICATION_TYPE_CONFIG } from "../domain/models/notification-models";
  import { notificationService } from "../services/implementations/Notifier";
  import { authState } from "$lib/shared/auth/state/authState.svelte";

  let { notification, onAction, onDismiss } = $props<{
    notification: UserNotification;
    onAction?: (notification: UserNotification) => void;
    onDismiss?: (notificationId: string) => void;
  }>();

  const config = $derived(
    NOTIFICATION_TYPE_CONFIG[notification.type as NotificationType]
  );

  // Generate subtle background color from the notification type's color
  const bgColor = $derived.by(() => {
    const color = config.color;
    // Convert hex to rgb and add transparency
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, 0.08)`;
  });

  const borderColor = $derived.by(() => {
    const color = config.color;
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, 0.2)`;
  });

  // Format timestamp
  const timeAgo = $derived(() => {
    const now = Date.now();
    const then = notification.createdAt.getTime();
    const diff = now - then;

    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diff < minute) return "Just now";
    if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
    if (diff < day) return `${Math.floor(diff / hour)}h ago`;
    if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;

    // Format as date
    return notification.createdAt.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  });

  async function handleDismiss() {
    // Delete the notification
    const user = authState.user;
    if (user) {
      try {
        // Dynamically import to avoid circular dependencies
        const { notificationService } =
          await import("$lib/features/feedback/services/implementations/Notifier");
        await notificationService.deleteNotification(user.uid, notification.id);
      } catch (error) {
        console.error("Failed to delete notification:", error);
      }
    }

    onDismiss?.(notification.id);
  }

  async function handleAction() {
    // Mark as read and trigger action (navigate)
    const user = authState.user;
    if (user && !notification.read) {
      await notificationService.markAsRead(user.uid, notification.id);
    }

    // Trigger action
    onAction?.(notification);
  }
</script>

<div
  class="notification-item"
  class:unread={!notification.read}
  style="background: {bgColor}; border-color: {borderColor};"
>
  <button
    class="notification-card"
    onclick={handleDismiss}
    type="button"
    title="Click to dismiss and remove"
    aria-label="Dismiss notification: {notification.message}"
  >
    <div class="notification-icon" style="background: {config.color};">
      <i class="fas {config.icon}" aria-hidden="true"></i>
    </div>

    <div class="notification-content">
      <div class="notification-header">
        <span class="notification-label">{config.label}</span>
        <span class="notification-time">{timeAgo()}</span>
      </div>
      <p class="notification-message">{notification.message}</p>
      {#if notification.fromUserName}
        <span class="notification-from">from {notification.fromUserName}</span>
      {/if}
    </div>

    {#if !notification.read}
      <div class="unread-indicator"></div>
    {/if}
  </button>

  <button
    class="notification-action"
    onclick={handleAction}
    type="button"
    title={config.actionLabel}
    aria-label={config.actionLabel}
  >
    {config.actionLabel}
  </button>
</div>

<style>
  .notification-item {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border: 1px solid;
    border-radius: var(--radius-2026-md);
    transition: all var(--duration-normal) var(--ease-out);
    position: relative;
  }

  .notification-item:hover {
    filter: brightness(1.15);
  }

  .notification-item.unread {
    box-shadow: 0 0 0 1px inset
      color-mix(
        in srgb,
        var(--theme-accent-strong, var(--theme-accent)) 30%,
        transparent
      );
  }

  /* ============================================================================
     NOTIFICATION CARD (dismiss area)
     ============================================================================ */
  .notification-card {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    width: 100%;
    padding: 0;
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
    transition: opacity var(--duration-fast) var(--ease-out);
  }

  .notification-card:hover {
    opacity: 0.85;
  }

  /* ============================================================================
     NOTIFICATION ICON
     ============================================================================ */
  .notification-icon {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: var(--font-size-base);
    flex-shrink: 0;
    box-shadow: 0 2px 8px var(--theme-shadow);
  }

  /* ============================================================================
     NOTIFICATION CONTENT
     ============================================================================ */
  .notification-content {
    flex: 1;
    min-width: 0;
  }

  .notification-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 4px;
  }

  .notification-label {
    font-size: var(--font-size-compact);
    font-weight: 600;
    color: var(--theme-text, var(--theme-text));
  }

  .notification-time {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    flex-shrink: 0;
  }

  .notification-message {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim, var(--theme-text-dim));
    margin: 0;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .notification-from {
    display: block;
    font-size: var(--font-size-compact);
    color: color-mix(
      in srgb,
      var(--theme-text-dim, var(--theme-text-dim)) 80%,
      transparent
    );
    margin-top: 4px;
  }

  /* ============================================================================
     UNREAD INDICATOR
     ============================================================================ */
  .unread-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: linear-gradient(
      135deg,
      var(--theme-accent-strong, var(--theme-accent)) 0%,
      color-mix(
          in srgb,
          var(--theme-accent-strong, var(--theme-accent)) 80%,
          var(--theme-accent-strong, var(--theme-accent-strong))
        )
        100%
    );
    flex-shrink: 0;
    margin-top: 4px;
    box-shadow: 0 0 8px
      color-mix(
        in srgb,
        var(--theme-accent-strong, var(--theme-accent)) 50%,
        transparent
      );
  }

  /* ============================================================================
     ACTION BUTTON (navigate)
     ============================================================================ */
  .notification-action {
    align-self: flex-end;
    padding: 6px 12px;
    background: var(--theme-accent, var(--semantic-info));
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease-out);
    box-shadow: 0 2px 6px
      color-mix(
        in srgb,
        var(--theme-accent, var(--semantic-info)) 20%,
        transparent
      );
  }

  .notification-action:hover {
    background: color-mix(
      in srgb,
      var(--theme-accent, var(--semantic-info)) 85%,
      black
    );
    transform: translateY(-2px);
    box-shadow: 0 4px 12px
      color-mix(
        in srgb,
        var(--theme-accent, var(--semantic-info)) 35%,
        transparent
      );
  }

  .notification-action:active {
    transform: translateY(-1px);
  }

  /* ============================================================================
     ACCESSIBILITY
     ============================================================================ */
  .notification-item:focus-within {
    outline: 2px solid
      color-mix(in srgb, var(--theme-accent-strong) 70%, transparent);
    outline-offset: 2px;
  }

  .notification-card:focus-visible {
    outline: none; /* Handled by parent */
  }

  .notification-action:focus-visible {
    outline: 2px solid
      color-mix(
        in srgb,
        var(--theme-accent, var(--semantic-info)) 70%,
        transparent
      );
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .notification-item,
    .notification-action {
      transition: none;
    }
  }
</style>
