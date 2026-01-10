<!--
  InboxSubscriptionProvider.svelte

  Invisible component that sets up inbox subscriptions globally.
  Should be mounted at the app root level when user is authenticated.

  Subscribes to:
  - Conversations (for unread message counts)
  - Notifications (for unread notification counts)

  This enables badge counts to appear on navigation elements
  without requiring the user to visit the Inbox module first.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { inboxState } from "../state/inbox-state.svelte";
  import { conversationService } from "$lib/shared/messaging/services/implementations/ConversationManager";
  import { notificationService } from "$lib/features/feedback/services/implementations/Notifier";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { userPreviewState } from "$lib/shared/debug/state/user-preview-state.svelte";
  // Note: Module loading is handled by container

  let unsubscribeMessages: (() => void) | null = null;
  let unsubscribeNotifications: (() => void) | null = null;
  let messagingModuleLoaded = $state(false);

  onMount(() => {
    // Module is now loaded via container
    messagingModuleLoaded = true;
  });

  // Track effective user ID (supports preview/impersonation mode)
  const currentUserId = $derived(
    userPreviewState.isActive && userPreviewState.data.profile
      ? userPreviewState.data.profile.uid
      : authState.user?.uid
  );

  // Set up subscriptions when user is authenticated
  $effect(() => {
    const userId = currentUserId;
    const isReady = messagingModuleLoaded;

    const cleanup = () => {
      unsubscribeMessages?.();
      unsubscribeNotifications?.();
      unsubscribeMessages = null;
      unsubscribeNotifications = null;
    };

    if (!isReady || !userId) {
      return cleanup;
    }

    // Subscribe to conversations for unread message counts
    unsubscribeMessages = conversationService.subscribeToConversations(
      (conversations) => {
        inboxState.setConversations(conversations);
      }
    );

    // Subscribe to notifications (all notifications, no limit for Inbox)
    unsubscribeNotifications = notificationService.subscribeToNotifications(
      userId,
      (notifications) => {
        inboxState.setNotifications(notifications);
      },
      0 // No limit - load all notifications for Inbox
    );

    return cleanup;
  });
</script>

<!-- This component renders nothing - it just sets up subscriptions -->
