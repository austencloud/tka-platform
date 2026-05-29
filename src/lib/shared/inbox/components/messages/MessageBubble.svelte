<script lang="ts">
  /**
   * MessageBubble
   *
   * Single message bubble with read receipts, animations, reactions, and rich attachments
   * Supports both direct (1:1) and group conversations with sender display
   *
   * Reaction layout follows the Messenger pattern:
   * - Reactions are a sibling to .bubble inside a flex-column wrapper
   * - translateY(-50%) pulls the reaction pill up to overlap the bubble's bottom edge
   * - align-items on the wrapper controls left/right anchoring
   * - No absolute positioning - reactions stay in document flow
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
  import { messagingService } from "$lib/shared/messaging/services/messenger";
  import RobustAvatar from "../../../components/avatar/RobustAvatar.svelte";

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

  const showSender = $derived(isGroup && !isOwn && senderInfo);
  let showEditHistory = $state(false);
  const wasEdited = $derived(message.editedAt !== undefined);
  const hasReactions = $derived(
    message.reactions && message.reactions.length > 0
  );
  const feedbackAttachment = $derived(
    message.attachments?.find((a) => a.type === "feedback")
  );
  const sequenceAttachment = $derived(
    message.attachments?.find((a) => a.type === "sequence")
  );
  const readTimestamp = $derived.by(() => {
    if (!otherParticipantId || !message.readAt) return null;
    return message.readAt[otherParticipantId] || null;
  });

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

<!--
  Shared snippet: the bubble content (reply, attachments, text, meta).
  Used in both group and 1:1 paths to avoid duplication.
-->
{#snippet bubbleContent()}
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
          <span class="read-time">Seen {formatReadTime(readTimestamp)}</span>
        {/if}
      </span>
    {/if}
  </div>
{/snippet}

<!-- Shared snippet: reaction badge anchored to bubble corner -->
{#snippet reactionBadge()}
  {#if hasReactions && message.reactions}
    <div class="reaction-badge">
      <MessageReactions
        reactions={message.reactions}
        onToggleReaction={handleToggleReaction}
      />
    </div>
  {/if}
{/snippet}

<MessageActions {message} {isOwn}>
  {#if showSender && senderInfo}
    <!-- Group messages from others: avatar gutter layout -->
    <div class="group-message-row">
      <div class="avatar-gutter">
        <RobustAvatar
          src={senderInfo.avatar}
          name={senderInfo.displayName}
          alt=""
          customSize={28}
        />
      </div>
      <div
        class="message-bubble"
        class:deleted={message.isDeleted}
        class:is-new={isNew}
        class:has-attachment={feedbackAttachment || sequenceAttachment}
        class:has-reactions={hasReactions}
        class:has-sender={true}
        role="article"
        aria-label="{message.senderName} said: {message.content}"
      >
        <span class="sender-name">{senderInfo.displayName}</span>
        <div class="bubble">
          {@render bubbleContent()}
          {@render reactionBadge()}
        </div>
      </div>
    </div>
  {:else}
    <!-- Own messages and 1:1 chat messages -->
    <div
      class="message-bubble"
      class:own={isOwn}
      class:deleted={message.isDeleted}
      class:is-new={isNew}
      class:has-attachment={feedbackAttachment || sequenceAttachment}
      class:has-reactions={hasReactions}
      role="article"
      aria-label="{isOwn ? 'You' : message.senderName} said: {message.content}"
    >
      <div class="bubble">
        {@render bubbleContent()}
        {@render reactionBadge()}
      </div>
    </div>
  {/if}
</MessageActions>

{#if message.editHistory && message.editHistory.length > 0}
  <EditHistorySheet
    bind:isOpen={showEditHistory}
    currentContent={message.content}
    editHistory={message.editHistory}
  />
{/if}

<style>
  /* ===== Message bubble wrapper (flex column: bubble + reaction tray) ===== */
  .message-bubble {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    max-width: 80%;
    animation: slideIn var(--duration-normal) ease-out;
    transform-origin: bottom left;
  }

  .message-bubble.own {
    margin-left: auto;
    align-items: flex-end;
    transform-origin: bottom right;
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

  /* ===== The bubble itself ===== */
  .bubble {
    position: relative;
    padding: 10px 14px;
    border-radius: 18px;
    background: var(--theme-card-bg);
    overflow: visible;
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

  /* ===== Reaction badge: Messenger-style corner sticker =====
     Positioned so it sits half-in, half-out of the bubble bottom edge.
     The badge is 20px tall, so bottom: -10px centers it on the edge. */
  .reaction-badge {
    position: absolute;
    bottom: -10px;
    right: 8px;
    z-index: 1;
    pointer-events: auto;
  }

  .message-bubble:not(.own) .reaction-badge {
    right: auto;
    left: 8px;
  }

  /* Clearance below bubble so the badge doesn't overlap the next message */
  .message-bubble.has-reactions {
    margin-bottom: 12px;
  }

  /* ===== Group message layout ===== */
  .group-message-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    max-width: 85%;
  }

  .avatar-gutter {
    flex-shrink: 0;
    padding-top: 2px;
  }

  .sender-name {
    display: block;
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    color: var(--theme-text-dim);
    margin-bottom: 2px;
    padding-left: 2px;
  }

  .message-bubble.has-sender {
    margin-top: 8px;
  }

  /* ===== Content ===== */
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
    border-top: 1px solid var(--theme-stroke);
  }

  .has-attachment .bubble {
    max-width: 300px;
  }

  /* ===== Meta (timestamp, edited, read receipt) ===== */
  .meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
  }

  .own .meta {
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

  /* ===== Read receipts ===== */
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

  /* ===== Reduced motion ===== */
  @media (prefers-reduced-motion: reduce) {
    .message-bubble,
    .bubble {
      animation: none !important;
      transition: none !important;
    }
  }
</style>
