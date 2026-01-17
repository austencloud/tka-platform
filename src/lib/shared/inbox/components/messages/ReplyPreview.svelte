<!--
  ReplyPreview.svelte

  Shows a quoted message preview - used both in message bubbles and in the composer.
  Displays sender name and truncated content.
-->
<script lang="ts">
  import type { ReplyPreview as ReplyPreviewType } from "$lib/shared/messaging/domain/models/message-models";

  let {
    reply,
    onDismiss,
    compact = false,
  } = $props<{
    reply: ReplyPreviewType;
    onDismiss?: () => void;
    compact?: boolean;
  }>();
</script>

<div class="reply-preview" class:compact class:dismissible={!!onDismiss}>
  <div class="reply-indicator"></div>

  <div class="reply-content">
    <span class="reply-sender">{reply.senderName}</span>
    <span class="reply-text">{reply.content}</span>
  </div>

  {#if onDismiss}
    <button
      type="button"
      class="dismiss-button"
      onclick={onDismiss}
      aria-label="Cancel reply"
    >
      <i class="fa-solid fa-xmark" aria-hidden="true"></i>
    </button>
  {/if}
</div>

<style>
  .reply-preview {
    display: flex;
    align-items: stretch;
    gap: 10px;
    padding: 8px 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 8px;
    margin-bottom: 6px;
    overflow: hidden;
  }

  .reply-preview.compact {
    padding: 6px 10px;
    margin-bottom: 4px;
  }

  .reply-preview.dismissible {
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    margin-bottom: 8px;
  }

  .reply-indicator {
    width: 3px;
    min-height: 100%;
    background: var(--theme-accent, #6366f1);
    border-radius: 2px;
    flex-shrink: 0;
  }

  .reply-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .reply-sender {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-accent, #6366f1);
  }

  .reply-text {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .compact .reply-text {
    font-size: var(--font-size-compact, 12px);
  }

  .dismiss-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    border-radius: 4px;
    transition: all var(--duration-fast) ease;
    flex-shrink: 0;
    align-self: center;
  }

  .dismiss-button:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, #ffffff);
  }
</style>
