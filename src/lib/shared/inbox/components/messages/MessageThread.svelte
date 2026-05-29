<script lang="ts">
  /**
   * MessageThread
   *
   * Full conversation message view with composer
   * Uses preview mode state for View As feature support
   * Supports both direct (1:1) and group conversations
   */

  import { onMount } from "svelte";
  import type {
    Conversation,
    ConversationType,
  } from "$lib/shared/messaging/domain/models/conversation-models";
  import type { Message } from "$lib/shared/messaging/domain/models/message-models";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { userPreviewState } from "$lib/shared/debug/state/user-preview-state.svelte";
  import { messagingService } from "$lib/shared/messaging/services/messenger";
  import { inboxState } from "../../state/inbox-state.svelte";
  import MessageBubble from "./MessageBubble.svelte";
  import MessageComposer from "./MessageComposer.svelte";
  import MessageSkeleton from "../skeletons/MessageSkeleton.svelte";
  import DateSeparator from "./DateSeparator.svelte";
  import EmptyMessages from "../empty-states/EmptyMessages.svelte";
  import TypingIndicator from "./TypingIndicator.svelte";

  interface Props {
    conversation: Conversation;
    messages: Message[];
    isLoading: boolean;
  }

  let { conversation, messages, isLoading }: Props = $props();

  // Determine conversation type (defaults to "direct" for backward compatibility)
  // Use optional chaining: parent {#if} guard unmounts this component when
  // conversation becomes null, but $derived values can re-evaluate before unmount.
  const conversationType = $derived<ConversationType>(
    conversation?.type || "direct"
  );
  const isGroup = $derived(conversationType === "group");

  let messagesContainer: HTMLDivElement | undefined = $state();

  // Subscribe to typing indicators
  onMount(() => {
    if (!conversation) return;
    const unsubscribe = messagingService.subscribeToTyping(
      conversation.id,
      (typingUsers) => {
        inboxState.setTypingUsers(typingUsers);
      }
    );

    return () => {
      unsubscribe();
      inboxState.setTypingUsers([]);
    };
  });

  // Get effective user ID (preview mode or actual)
  const currentUserId = $derived(
    userPreviewState.isActive && userPreviewState.data.profile
      ? userPreviewState.data.profile.uid
      : authState.user?.uid
  );

  // Auto-scroll to bottom when new messages arrive
  $effect(() => {
    if (messages.length > 0 && messagesContainer) {
      requestAnimationFrame(() => {
        messagesContainer?.scrollTo({
          top: messagesContainer.scrollHeight,
          behavior: "smooth",
        });
      });
    }
  });

  // Get other participant info
  const otherParticipantId = $derived(
    conversation?.participants?.find((p: string) => p !== currentUserId) || ""
  );
  const otherParticipant = $derived(
    conversation?.participantInfo?.[otherParticipantId]
  );

  // Group messages by date for separators
  interface MessageGroup {
    date: Date;
    messages: Message[];
  }

  function getDateKey(d: Date): string {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  const messageGroups = $derived.by(() => {
    const groups: MessageGroup[] = [];
    let currentDateKey = "";
    let currentGroup: MessageGroup | null = null;

    for (const message of messages) {
      const dateKey = getDateKey(message.createdAt);

      if (dateKey !== currentDateKey) {
        currentDateKey = dateKey;
        currentGroup = {
          date: message.createdAt,
          messages: [message],
        };
        groups.push(currentGroup);
      } else if (currentGroup) {
        currentGroup.messages.push(message);
      }
    }

    return groups;
  });

  // Find the last own message that was read by the other participant
  // This is the only message that should show the read receipt (Facebook-style)
  const lastReadOwnMessageId = $derived.by(() => {
    if (!currentUserId || !otherParticipantId) return null;

    // Iterate backwards through messages to find the last own message read by other
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (!msg) continue;
      if (
        msg.senderId === currentUserId &&
        !msg.isDeleted &&
        msg.readBy?.includes(otherParticipantId)
      ) {
        return msg.id;
      }
    }
    return null;
  });
</script>

<div class="message-thread">
  <!-- Messages container -->
  <div class="messages-container" bind:this={messagesContainer}>
    {#if isLoading}
      <MessageSkeleton count={6} />
    {:else if messages.length === 0}
      <EmptyMessages
        recipientName={isGroup
          ? conversation?.groupMetadata?.name
          : otherParticipant?.displayName}
        {isGroup}
      />
    {:else}
      <div class="messages">
        {#each messageGroups as group, groupIndex}
          <DateSeparator date={group.date} />
          {#each group.messages as message, messageIndex (message.id)}
            <MessageBubble
              {message}
              isOwn={message.senderId === currentUserId}
              isNew={groupIndex === messageGroups.length - 1 &&
                messageIndex === group.messages.length - 1}
              {otherParticipantId}
              showReadReceipt={!isGroup && message.id === lastReadOwnMessageId}
              {isGroup}
              senderInfo={isGroup
                ? conversation?.participantInfo?.[message.senderId]
                : undefined}
            />
          {/each}
        {/each}
      </div>
    {/if}
  </div>

  <!-- Typing indicator -->
  <TypingIndicator typingUsers={inboxState.typingUsers} />

  <!-- Composer -->
  {#if conversation?.id}
    <MessageComposer conversationId={conversation.id} />
  {/if}
</div>

<style>
  .message-thread {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .messages-container {
    flex: 1;
    overflow-y: auto;
    padding: 8px 16px 16px;
  }

  .messages {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
</style>
