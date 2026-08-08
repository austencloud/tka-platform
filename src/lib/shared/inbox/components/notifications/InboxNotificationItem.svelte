<script lang="ts">
  /**
   * InboxNotificationItem
   *
   * Simple notification card - Facebook/Instagram style
   */

  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { onMount } from "svelte";
  import type { UserNotification } from "$lib/shared/notifications/domain/models/notification-models";
  import { formatRelativeTimeVerbose } from "../../utils/format";
  import { goto } from "$app/navigation";
  import { inboxState } from "../../state/inbox-state.svelte";
  import { handleModuleChange } from "$lib/shared/navigation-coordinator/navigation-coordinator.svelte";
  import { setNotificationTargetFeedback } from "$lib/shared/feedback/state/notification-action-state.svelte";
  import { setScanNotificationTarget } from "$lib/features/choreo-card/state/scan-notification-target.svelte";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";

  interface Props {
    notification: UserNotification;
    wasUnread?: boolean; // Track if it was unread when first rendered
  }

  let { notification, wasUnread = false }: Props = $props();

  // Track if this notification just became read (for animation)
  let justMarkedRead = $state(false);

  // Watch for read state changes to trigger animation
  $effect(() => {
    if (wasUnread && notification.read && !justMarkedRead) {
      justMarkedRead = true;
      // Reset after animation completes (1.8s total)
      const timer = setTimeout(() => {
        justMarkedRead = false;
      }, 1800);
      return () => clearTimeout(timer);
    }
    return undefined;
  });

  // Haptic feedback service
  let hapticService: HapticFeedback | undefined;

  onMount(() => {
    hapticService = getHapticFeedback();
  });

  // Get icon based on notification type
  function getIcon(type: UserNotification["type"]): string {
    switch (type) {
      case "feedback-resolved":
        return "fa-check-circle";
      case "feedback-in-progress":
        return "fa-clock";
      case "feedback-needs-info":
        return "fa-question-circle";
      case "feedback-response":
        return "fa-comment";
      case "sequence-liked":
        return "fa-heart";
      case "user-followed":
        return "fa-user-plus";
      case "achievement-unlocked":
        return "fa-trophy";
      case "message-received":
        return "fa-envelope";
      case "admin-new-user-signup":
        return "fa-user-check";
      case "admin-user-returned":
        return "fa-door-open";
      case "admin-qr-scan":
        return "fa-qrcode";
      case "admin-content-created":
        return "fa-wand-magic-sparkles";
      case "admin-parity-audit":
        return "fa-shield-halved";
      case "system-announcement":
        return "fa-bullhorn";
      default:
        return "fa-bell";
    }
  }

  // Get color based on notification type
  function getColor(type: UserNotification["type"]): string {
    switch (type) {
      case "feedback-resolved":
        return "var(--semantic-success, var(--semantic-success))";
      case "feedback-in-progress":
        return "var(--semantic-warning, var(--semantic-warning))";
      case "feedback-needs-info":
        return "var(--semantic-info, var(--semantic-info))";
      case "sequence-liked":
        return "var(--semantic-error)";
      case "user-followed":
        return "var(--theme-accent, var(--semantic-info))";
      case "achievement-unlocked":
        return "var(--semantic-warning)";
      case "message-received":
        return "var(--theme-accent-strong)";
      case "admin-parity-audit":
        return "var(--semantic-warning)";
      default:
        return "var(--theme-text-dim)";
    }
  }

  // Handle card click - navigate directly (Facebook/Instagram pattern)
  async function handleCardClick() {
    hapticService?.trigger("selection");

    // Deep-link to relevant content based on notification type.
    // Each union member carries a subset of these target fields; type the
    // payload as the partial set of known deep-link keys rather than `any`.
    type DeepLinkFields = Partial<
      Record<
        | "feedbackId"
        | "sequenceId"
        | "fromUserId"
        | "conversationId"
        | "newUserId"
        | "actionUrl"
        | "shortCode",
        string
      >
    > & { scanLat?: number | null; scanLng?: number | null };
    const n = notification as UserNotification & DeepLinkFields;

    switch (notification.type) {
      case "feedback-resolved":
      case "feedback-in-progress":
      case "feedback-needs-info":
      case "feedback-response":
        // Navigate to My Feedback tab via module change
        if (n["feedbackId"]) {
          setNotificationTargetFeedback(n["feedbackId"] as string);
          inboxState.close();
          await handleModuleChange("feedback", "my-feedback");
        }
        break;

      case "sequence-liked":
        // Navigate to the sequence
        if (n["sequenceId"]) {
          inboxState.close();
          goto(`/sequence/${n["sequenceId"]}`);
        }
        break;

      case "user-followed":
        // Navigate to the follower's profile
        if (n["fromUserId"]) {
          inboxState.close();
          goto(`/profile/${n["fromUserId"]}`);
        }
        break;

      case "message-received":
        // Switch to messages tab and open conversation
        if (n["conversationId"]) {
          inboxState.setTab("messages");
          // The ConversationList will be shown, user can click the conversation
        }
        break;

      case "achievement-unlocked":
        // Navigate to user's profile to see achievements
        inboxState.close();
        if (authState.effectiveUserId) {
          goto(`/profile/${authState.effectiveUserId}`);
        }
        break;

      case "admin-new-user-signup":
        // Navigate to the new user's profile
        if (n["newUserId"]) {
          inboxState.close();
          goto(`/profile/${n["newUserId"]}`);
        }
        break;

      case "admin-qr-scan":
        // Open the Scan Activity tab, flown to the scan and peeking the card.
        if (n["shortCode"]) {
          setScanNotificationTarget({
            code: n["shortCode"] as string,
            lat: typeof n.scanLat === "number" ? n.scanLat : null,
            lng: typeof n.scanLng === "number" ? n.scanLng : null,
          });
          inboxState.close();
          await handleModuleChange("choreo_card", "scan-activity");
        }
        break;

      case "admin-parity-audit":
        inboxState.close();
        await goto(
          n["actionUrl"] ||
            `/admin/parity-audit?notification=${encodeURIComponent(notification.id)}`
        );
        break;

      case "system-announcement":
        // Navigate to action URL if provided
        if (n["actionUrl"]) {
          inboxState.close();
          goto(n["actionUrl"] as string);
        }
        break;

      default:
        // No specific navigation for other types
        break;
    }
  }

  function handleCardKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleCardClick();
    }
  }
</script>

<div
  class="notification-item"
  class:unread={!notification.read}
  class:just-marked-read={justMarkedRead}
  onclick={handleCardClick}
  onkeydown={handleCardKeydown}
  role="button"
  tabindex="0"
  aria-label="{notification.message}{!notification.read ? ' (unread)' : ''}"
>
  <!-- Icon -->
  <div class="icon" style="--icon-color: {getColor(notification.type)}">
    <i class="fas {getIcon(notification.type)}" aria-hidden="true"></i>
  </div>

  <!-- Content -->
  <div class="content">
    <p class="message">{notification.message}</p>
    <span class="time">{formatRelativeTimeVerbose(notification.createdAt)}</span
    >
  </div>

  <!-- Chevron indicator -->
  <div class="chevron">
    <i class="fas fa-chevron-right" aria-hidden="true"></i>
  </div>
</div>

<style>
  .notification-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 64px;
    padding: 16px;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--theme-stroke);
    text-align: left;
    cursor: pointer;
    transition:
      background 0.2s ease,
      transform 0.2s ease;
  }

  .notification-item:hover {
    background: var(--theme-card-bg);
  }

  .notification-item:active {
    transform: scale(0.995);
  }

  .notification-item:focus-visible {
    outline: none;
    background: var(--theme-card-hover-bg);
    box-shadow: inset 0 0 0 2px
      color-mix(in srgb, var(--theme-accent) 50%, transparent);
  }

  .notification-item.unread {
    background: color-mix(in srgb, var(--theme-accent) 5%, transparent);
  }

  /* Animation when notification is marked as read */
  .notification-item.just-marked-read {
    animation: markAsRead 1.8s ease-out;
  }

  @keyframes markAsRead {
    0% {
      background: color-mix(in srgb, var(--theme-accent) 25%, transparent);
      transform: scale(1.03);
    }
    40% {
      background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
      transform: scale(1.02);
    }
    70% {
      background: color-mix(in srgb, var(--theme-accent) 8%, transparent);
      transform: scale(1.01);
    }
    100% {
      background: transparent;
      transform: scale(1);
    }
  }

  /* Icon */
  .icon {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--icon-color) 15%, transparent);
    border-radius: 50%;
    font-size: var(--font-size-sm);
    color: var(--icon-color);
    transition: transform var(--duration-normal) ease;
  }

  .notification-item:hover .icon {
    transform: scale(1.1);
  }

  /* Content */
  .content {
    flex: 1;
    min-width: 0;
  }

  .message {
    margin: 0 0 4px;
    font-size: var(--font-size-min);
    line-height: 1.4;
    color: var(--theme-text);
    transition: font-weight var(--duration-emphasis) ease;
  }

  .unread .message {
    font-weight: 500;
  }

  .just-marked-read .message {
    animation: messageUnbold 0.8s ease-out forwards;
  }

  @keyframes messageUnbold {
    0% {
      font-weight: 500;
    }
    100% {
      font-weight: 400;
    }
  }

  .time {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  /* Chevron indicator */
  .chevron {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    transition: all var(--duration-normal) ease;
  }

  .notification-item:hover .chevron {
    color: var(--theme-text-dim);
    transform: translateX(2px);
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .notification-item,
    .icon,
    .chevron,
    .message {
      transition: none !important;
      animation: none !important;
    }

    .notification-item.just-marked-read {
      animation: none !important;
    }

    .just-marked-read .message {
      animation: none !important;
      font-weight: 400;
    }
  }
</style>
