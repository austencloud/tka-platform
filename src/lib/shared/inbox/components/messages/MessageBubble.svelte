<script lang="ts">
  /**
   * MessageBubble
   *
   * Single message bubble with read receipts, animations, reactions, and rich attachments
   * Supports both direct (1:1) and group conversations with sender display
   */

  import type { Message } from "$lib/shared/messaging/domain/models/message-models";
  import type { ParticipantInfo } from "$lib/shared/messaging/domain/models/conversation-models";
  import { formatTime } from "../../utils/format";
  import FeedbackMessageCard from "./FeedbackMessageCard.svelte";
  import SequenceMessageCard from "./SequenceMessageCard.svelte";
  import ReplyPreview from "./ReplyPreview.svelte";
  import MessageReactions from "./MessageReactions.svelte";
  import EditHistorySheet from "./EditHistorySheet.svelte";
  import MessageActions from "./MessageActions.svelte";
  import { messagingService } from "$lib/shared/messaging/services/implementations/Messenger";

  interface Props {
    message: Message;
    isOwn: boolean;
    isNew?: boolean;
    otherParticipantId?: string;
    showReadReceipt?: boolean;
    isGroup?: boolean;
    senderInfo?: ParticipantInfo;
  }

  let {
    message,
    isOwn,
    isNew = false,
    otherParticipantId,
    showReadReceipt = false,
    isGroup = false,
    senderInfo,
  }: Props = $props();

  // Show sender info for non-own messages in groups
  const showSender = $derived(isGroup && !isOwn && senderInfo);

  // Edit history sheet state
  let showEditHistory = $state(false);

  // Check if message was edited
  const wasEdited = $derived(message.editedAt !== undefined);

  // Check if message has reactions
  const hasReactions = $derived(
    message.reactions && message.reactions.length > 0
  );

  // Check for feedback attachment
  const feedbackAttachment = $derived(
    message.attachments?.find((a) => a.type === "feedback")
  );

  // Check for sequence attachment
  const sequenceAttachment = $derived(
    message.attachments?.find((a) => a.type === "sequence")
  );

  // Get the read timestamp for the other participant
  const readTimestamp = $derived.by(() => {
    if (!otherParticipantId || !message.readAt) return null;
    return message.readAt[otherParticipantId] || null;
  });

  // Format the read timestamp for display
  function formatReadTime(date: Date): string {
    return formatTime(date);
  }

  function handleToggleReaction(emoji: string) {
    messagingService
      .toggleReaction(message.conversationId, message.id, emoji)
      .catch((err) => {
        console.error("Failed to toggle reaction:", err);
      });
  }

  function handleEditedClick() {
    if (message.editHistory && message.editHistory.length > 0) {
      showEditHistory = true;
    }
  }
</script>

<MessageActions {message} {isOwn}>
  <div
    class="message-bubble"
    class:own={isOwn}
    class:deleted={message.isDeleted}
    class:is-new={isNew}
    class:has-attachment={feedbackAttachment || sequenceAttachment}
    class:has-reactions={hasReactions}
    class:has-sender={showSender}
    role="article"
    aria-label="{isOwn ? 'You' : message.senderName} said: {message.content}"
  >
    <!-- Group message sender info -->
    {#if showSender && senderInfo}
      <div class="sender-row">
        <div class="sender-avatar">
          {#if senderInfo.avatar}
            <img src={senderInfo.avatar} alt="" />
          {:else}
            <span class="sender-initials">
              {(senderInfo.displayName || "?").charAt(0).toUpperCase()}
            </span>
          {/if}
        </div>
        <span class="sender-name">{senderInfo.displayName}</span>
      </div>
    {/if}

    <div class="bubble">
      <!-- Reply preview -->
      {#if message.replyTo}
        <ReplyPreview reply={message.replyTo} compact />
      {/if}

      {#if sequenceAttachment}
        <SequenceMessageCard attachment={sequenceAttachment} {isOwn} />
        {#if message.content && !message.content.startsWith("Check out this sequence")}
          <p class="content attachment-content">{message.content}</p>
        {/if}
      {:else if feedbackAttachment}
        <FeedbackMessageCard attachment={feedbackAttachment} {isOwn} />
        {#if message.content && message.content !== "[Feedback submitted]"}
          <p class="content attachment-content">{message.content}</p>
        {/if}
      {:else}
        <p class="content">{message.content}</p>
      {/if}
      <div class="meta">
        <time class="time" datetime={message.createdAt.toISOString()}
          >{formatTime(message.createdAt)}</time
        >
        {#if wasEdited && !message.isDeleted}
          {#if message.editHistory && message.editHistory.length > 0}
            <button
              type="button"
              class="edited-button"
              onclick={handleEditedClick}
              aria-label="View edit history"
            >
              (edited)
            </button>
          {:else}
            <span class="edited">(edited)</span>
          {/if}
        {/if}
        {#if showReadReceipt && !message.isDeleted}
          <span class="read-receipt read" aria-label="Read">
            <i class="fas fa-check-double" aria-hidden="true"></i>
            {#if readTimestamp}
              <span class="read-time">{formatReadTime(readTimestamp)}</span>
            {/if}
          </span>
        {/if}
      </div>
    </div>

    <!-- Reactions -->
    {#if hasReactions && message.reactions}
      <div class="reactions-wrapper">
        <MessageReactions
          reactions={message.reactions}
          onToggleReaction={handleToggleReaction}
        />
      </div>
    {/if}
  </div>
</MessageActions>

<!-- Edit History Sheet -->
{#if message.editHistory && message.editHistory.length > 0}
  <EditHistorySheet
    bind:isOpen={showEditHistory}
    currentContent={message.content}
    editHistory={message.editHistory}
  />
{/if}

<style>
  .message-bubble {
    display: flex;
    flex-direction: column;
    max-width: 80%;
    animation: slideIn var(--duration-normal) ease-out;
    transform-origin: bottom left;
  }

  .message-bubble.own {
    margin-left: auto;
    transform-origin: bottom right;
    align-items: flex-end;
  }

  .message-bubble:not(.own) {
    align-items: flex-start;
  }

  .message-bubble.has-reactions {
    margin-bottom: 4px;
  }

  .message-bubble.is-new {
    animation: slideInNew var(--duration-emphasis) ease-out;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @keyframes slideInNew {
    from {
      opacity: 0;
      transform: translateY(16px) scale(0.9);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .bubble {
    padding: 10px 14px;
    border-radius: 18px;
    background: var(--theme-card-bg, var(--theme-card-bg));
    transition: transform var(--duration-fast) ease;
  }

  .bubble:hover {
    transform: scale(1.01);
  }

  .own .bubble {
    background: var(--theme-accent, var(--semantic-info));
    color: white;
    border-bottom-right-radius: 6px;
  }

  .message-bubble:not(.own) .bubble {
    border-bottom-left-radius: 6px;
  }

  /* Group message sender info */
  .sender-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
    padding-left: 2px;
  }

  .sender-avatar {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    background: linear-gradient(
      135deg,
      var(--semantic-info) 0%,
      var(--theme-accent-strong, var(--semantic-info)) 100%
    );
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .sender-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .sender-initials {
    font-size: 10px;
    font-weight: 600;
    color: white;
    text-transform: uppercase;
  }

  .sender-name {
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    color: var(--theme-text-dim);
  }

  .message-bubble.has-sender {
    margin-top: 8px;
  }

  .deleted .bubble {
    background: var(--theme-card-bg);
    font-style: italic;
    opacity: 0.7;
  }

  .content {
    margin: 0 0 4px;
    font-size: var(--font-size-sm);
    line-height: 1.4;
    word-break: break-word;
    color: var(--theme-text);
  }

  .own .content {
    color: white;
  }

  .attachment-content {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--theme-stroke, var(--theme-stroke));
  }

  .has-attachment .bubble {
    max-width: 300px;
  }

  .meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .own .meta {
    color: var(--theme-text-dim);
    justify-content: flex-end;
  }

  .edited {
    font-style: italic;
  }

  .edited-button {
    font-style: italic;
    font-size: inherit;
    color: inherit;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 2px;
  }

  .edited-button:hover {
    text-decoration-style: solid;
  }

  .reactions-wrapper {
    margin-top: 4px;
  }

  /* Read receipts */
  .read-receipt {
    font-size: var(--font-size-compact);
    opacity: 0.7;
    transition: color var(--duration-normal) ease;
  }

  .read-receipt.read {
    color: var(--semantic-info);
    opacity: 1;
  }

  .own .read-receipt.read {
    color: #93c5fd;
  }

  .read-time {
    margin-left: 4px;
    font-size: var(--font-size-compact, 12px);
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .message-bubble,
    .bubble {
      animation: none !important;
      transition: none !important;
    }
  }
</style>
