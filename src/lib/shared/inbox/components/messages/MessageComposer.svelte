<script lang="ts">
  /**
   * MessageComposer
   *
   * Input field and send button with optimistic UI and error handling.
   * Supports reply mode, edit mode, and typing indicators.
   */

  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { onMount } from "svelte";
  import { messagingService } from "../../../messaging/services/messenger";
  import { toast } from "../../../toast/state/toast-state.svelte";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import { inboxState } from "../../state/inbox-state.svelte";
  import ReplyPreview from "./ReplyPreview.svelte";
  import MessageAttachmentPicker from "./MessageAttachmentPicker.svelte";
  import type { PendingMessageAttachment } from "../../domain/pending-message-attachment";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { buildSequenceMessageAttachment } from "../../domain/message-attachment-builders";
  import { getMessagePreviewText } from "$lib/shared/messaging/domain/message-preview";
  import { getMessageImageSender } from "$lib/shared/messaging/get-message-image-sender";
  import { getShortCodeManager } from "$lib/shared/qr/get-short-code-manager";
  import type {
    MessageImageSendHandle,
    MessageImageSendProgress,
  } from "$lib/shared/messaging/services/contracts/IMessageImageSender";

  interface Props {
    conversationId: string;
  }

  let { conversationId }: Props = $props();

  let messageText = $state("");
  let isSending = $state(false);
  let inputElement: HTMLTextAreaElement | undefined = $state();
  let sendSuccess = $state(false);
  let pendingAttachment = $state<PendingMessageAttachment | null>(null);
  let attachmentProgress = $state<MessageImageSendProgress | null>(null);
  let imageSendHandle: MessageImageSendHandle | null = null;

  // Typing indicator debounce
  let typingTimeout: ReturnType<typeof setTimeout> | null = null;
  const TYPING_DEBOUNCE_MS = 1000;

  // Brief success indicator timer (cleared on unmount to avoid late state writes)
  let successTimeout: ReturnType<typeof setTimeout> | null = null;

  // Haptic feedback service
  let hapticService: HapticFeedback | undefined;

  onMount(() => {
    hapticService = getHapticFeedback();
    // Capture at mount time so the cleanup doesn't access a stale/null prop
    const mountedConversationId = conversationId;

    // Cleanup typing on unmount
    return () => {
      if (typingTimeout) clearTimeout(typingTimeout);
      if (successTimeout) clearTimeout(successTimeout);
      imageSendHandle?.cancel();
      if (mountedConversationId) {
        messagingService
          .setTyping(mountedConversationId, false)
          .catch(() => {});
      }
    };
  });

  // When entering edit mode, populate with the message content
  $effect(() => {
    if (inboxState.editingMessage) {
      pendingAttachment = null;
      attachmentProgress = null;
      messageText = inboxState.editingMessage.content;
      // Focus input when entering edit mode
      const focusTimer = setTimeout(() => inputElement?.focus(), 50);
      return () => clearTimeout(focusTimer);
    }
    return undefined;
  });

  // Auto-resize textarea and update typing indicator
  function handleInput(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";

    // Update typing indicator (debounced)
    if (!inboxState.isEditing) {
      messagingService.setTyping(conversationId, true).catch(() => {});

      // Clear previous timeout
      if (typingTimeout) clearTimeout(typingTimeout);

      // Set typing to false after debounce period of inactivity
      typingTimeout = setTimeout(() => {
        messagingService.setTyping(conversationId, false).catch(() => {});
      }, TYPING_DEBOUNCE_MS);
    }
  }

  // Handle keyboard shortcuts
  function handleKeydown(event: KeyboardEvent) {
    // Cancel edit on Escape
    if (event.key === "Escape") {
      if (inboxState.isEditing) {
        inboxState.clearEditingMessage();
        messageText = "";
        return;
      }
      if (inboxState.isReplying) {
        inboxState.clearReplyTo();
        return;
      }
      if (pendingAttachment) {
        pendingAttachment = null;
        attachmentProgress = null;
        return;
      }
    }

    // Send/save on Enter (without Shift)
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (inboxState.isEditing) {
        saveEdit();
      } else {
        sendMessage();
      }
    }
  }

  async function sendMessage() {
    const text = messageText.trim();
    if ((!text && !pendingAttachment) || isSending) return;

    hapticService?.trigger("selection");

    // Clear typing indicator
    if (typingTimeout) clearTimeout(typingTimeout);
    messagingService.setTyping(conversationId, false).catch(() => {});

    // Capture reply context before clearing
    const replyTo = inboxState.replyToMessage
      ? {
          messageId: inboxState.replyToMessage.id,
          senderName: inboxState.replyToMessage.senderName,
          content: getMessagePreviewText(
            inboxState.replyToMessage.content,
            inboxState.replyToMessage.attachments
          ),
        }
      : undefined;
    const attachment = pendingAttachment;

    isSending = true;
    try {
      if (attachment?.type === "image") {
        imageSendHandle = getMessageImageSender().send({
          conversationId,
          messageId: attachment.messageId,
          attachmentId: attachment.attachmentId,
          file: attachment.file,
          content: text,
          replyTo,
          onProgress: (progress) => {
            attachmentProgress = progress;
          },
        });
        await imageSendHandle.promise;
      } else {
        const sequenceAttachment =
          attachment?.type === "sequence"
            ? buildSequenceMessageAttachment(
                attachment.sequence,
                (
                  await getShortCodeManager().createShortCode(
                    attachment.sequence,
                    { embedSequenceData: true }
                  )
                ).code
              )
            : undefined;

        await messagingService.sendMessage({
          conversationId,
          content: text,
          attachments: sequenceAttachment ? [sequenceAttachment] : undefined,
          replyTo,
        });
      }

      messageText = "";
      pendingAttachment = null;
      attachmentProgress = null;
      inboxState.clearReplyTo();
      if (inputElement) inputElement.style.height = "auto";

      // Show brief success indicator with haptic feedback
      hapticService?.trigger("success");
      sendSuccess = true;
      if (successTimeout) clearTimeout(successTimeout);
      successTimeout = setTimeout(() => {
        sendSuccess = false;
      }, 1500);
    } catch (error) {
      console.error("Failed to send message:", error);

      // Show error toast
      toast.error("Failed to send message. Please try again.");
    } finally {
      imageSendHandle = null;
      attachmentProgress = null;
      isSending = false;
    }
  }

  function selectImage(file: File) {
    pendingAttachment = {
      type: "image",
      file,
      messageId: crypto.randomUUID(),
      attachmentId: crypto.randomUUID(),
    };
    attachmentProgress = null;
  }

  function selectSequence(sequence: SequenceData) {
    pendingAttachment = { type: "sequence", sequence };
    attachmentProgress = null;
  }

  function removeAttachment() {
    if (isSending) return;
    pendingAttachment = null;
    attachmentProgress = null;
  }

  async function saveEdit() {
    const text = messageText.trim();
    if (!text || isSending || !inboxState.editingMessage) return;

    hapticService?.trigger("selection");

    const editingMessage = inboxState.editingMessage;

    // Don't save if content hasn't changed
    if (text === editingMessage.content) {
      inboxState.clearEditingMessage();
      messageText = "";
      return;
    }

    isSending = true;
    try {
      await messagingService.editMessage(
        conversationId,
        editingMessage.id,
        text
      );

      hapticService?.trigger("success");
      inboxState.clearEditingMessage();
      messageText = "";

      sendSuccess = true;
      if (successTimeout) clearTimeout(successTimeout);
      successTimeout = setTimeout(() => {
        sendSuccess = false;
      }, 1500);
    } catch (error) {
      console.error("Failed to edit message:", error);
      toast.error("Failed to save changes. Please try again.");
    } finally {
      isSending = false;
    }
  }

  function cancelEdit() {
    inboxState.clearEditingMessage();
    messageText = "";
    if (inputElement) {
      inputElement.style.height = "auto";
    }
  }

  // Derive button state
  const canSend = $derived(
    (messageText.trim().length > 0 || pendingAttachment !== null) && !isSending
  );
  const isEditing = $derived(inboxState.isEditing);
  const isReplying = $derived(inboxState.isReplying);
</script>

<div class="message-composer" class:editing={isEditing}>
  <!-- Reply preview strip -->
  {#if isReplying && inboxState.replyToMessage}
    <div class="reply-strip">
      <ReplyPreview
        reply={{
          messageId: inboxState.replyToMessage.id,
          senderName: inboxState.replyToMessage.senderName,
          content: getMessagePreviewText(
            inboxState.replyToMessage.content,
            inboxState.replyToMessage.attachments
          ),
        }}
        onDismiss={() => inboxState.clearReplyTo()}
      />
    </div>
  {/if}

  <!-- Edit mode header -->
  {#if isEditing}
    <div class="edit-header">
      <i class="fa-solid fa-pen" aria-hidden="true"></i>
      <span>Editing message</span>
      <button
        type="button"
        class="cancel-edit-button"
        onclick={cancelEdit}
        aria-label="Cancel editing"
      >
        Cancel
      </button>
    </div>
  {/if}

  <div class="compose-grid" class:editing={isEditing}>
    {#if !isEditing}
      <MessageAttachmentPicker
        attachment={pendingAttachment}
        disabled={isSending}
        progress={attachmentProgress}
        onImageSelected={selectImage}
        onSequenceSelected={selectSequence}
        onRemove={removeAttachment}
      />
    {/if}
    <textarea
      bind:this={inputElement}
      bind:value={messageText}
      oninput={handleInput}
      onkeydown={handleKeydown}
      placeholder={isEditing ? "Edit your message..." : "Type a message..."}
      rows="1"
      maxlength={2000}
      disabled={isSending}
      aria-label={isEditing ? "Edit message" : "Message input"}
    ></textarea>
    <button
      class="send-button"
      class:success={sendSuccess}
      onclick={isEditing ? saveEdit : sendMessage}
      disabled={!canSend}
      aria-label={isSending
        ? "Sending..."
        : sendSuccess
          ? "Sent"
          : isEditing
            ? "Save changes"
            : "Send message"}
    >
      {#if isSending}
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      {:else if sendSuccess}
        <i class="fas fa-check" aria-hidden="true"></i>
      {:else if isEditing}
        <i class="fas fa-check" aria-hidden="true"></i>
      {:else}
        <i class="fas fa-paper-plane" aria-hidden="true"></i>
      {/if}
    </button>
  </div>
</div>

<style>
  .message-composer {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 12px 16px;
    background: var(--theme-panel-bg);
    border-top: 1px solid var(--theme-stroke, var(--theme-stroke));
  }

  .message-composer.editing {
    border-top-color: var(--theme-accent, #6366f1);
    background: color-mix(
      in srgb,
      var(--theme-accent, #6366f1) 5%,
      var(--theme-panel-bg)
    );
  }

  .reply-strip {
    margin-bottom: 8px;
  }

  .edit-header {
    display: flex;
    align-items: center;
    column-gap: 8px;
    row-gap: 0;
    padding: 8px 0;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-accent, #6366f1);
  }

  .edit-header i {
    font-size: var(--font-size-compact, 12px);
  }

  .edit-header span {
    flex: 1;
    font-weight: 500;
  }

  .cancel-edit-button {
    padding: 4px 12px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 4px;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .cancel-edit-button:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #ffffff);
  }

  .compose-grid {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: flex-end;
    gap: 8px;
  }

  .compose-grid.editing {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  textarea {
    grid-column: 2;
    grid-row: 2;
    min-height: var(--min-touch-target);
    max-height: 120px;
    padding: 14px 16px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 24px;
    color: var(--theme-text);
    font-family: inherit;
    font-size: var(--font-size-sm);
    line-height: 1.4;
    resize: none;
    outline: none;
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  .compose-grid.editing textarea {
    grid-column: 1;
    grid-row: 1;
  }

  textarea::placeholder {
    color: var(--theme-text-dim);
  }

  textarea:focus {
    border-color: var(--theme-accent, var(--semantic-info));
    box-shadow: 0 0 0 3px
      color-mix(in srgb, var(--theme-accent) 20%, transparent);
  }

  textarea:disabled {
    opacity: 0.6;
  }

  .send-button {
    grid-column: 3;
    grid-row: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    padding: 0;
    background: var(--theme-accent, var(--semantic-info));
    border: none;
    border-radius: 50%;
    color: white;
    cursor: pointer;
    transition:
      background 0.2s ease,
      transform 0.15s ease,
      box-shadow 0.2s ease;
  }

  .compose-grid.editing .send-button {
    grid-column: 2;
    grid-row: 1;
  }

  .send-button:hover:not(:disabled) {
    background: color-mix(
      in srgb,
      var(--theme-accent, var(--semantic-info)) 85%,
      white
    );
    transform: scale(1.05);
    box-shadow: 0 4px 12px
      color-mix(in srgb, var(--theme-accent) 40%, transparent);
  }

  .send-button:active:not(:disabled) {
    transform: scale(0.95);
  }

  .send-button:focus-visible {
    outline: none;
    box-shadow:
      0 0 0 3px color-mix(in srgb, var(--theme-accent) 40%, transparent),
      0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .send-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .send-button.success {
    background: var(--semantic-success, var(--semantic-success));
    animation: successPop var(--duration-emphasis) ease;
  }

  @keyframes successPop {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.15);
    }
    100% {
      transform: scale(1);
    }
  }

  .send-button i {
    font-size: var(--font-size-base);
    transition: transform var(--duration-normal) ease;
  }

  .send-button:hover:not(:disabled) i {
    transform: translateX(1px);
  }

  .send-button.success i {
    animation: checkPop var(--duration-emphasis) ease;
  }

  @keyframes checkPop {
    0% {
      transform: scale(0);
    }
    50% {
      transform: scale(1.2);
    }
    100% {
      transform: scale(1);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    textarea,
    .send-button,
    .send-button i {
      transition: none !important;
      animation: none !important;
    }
  }
</style>
