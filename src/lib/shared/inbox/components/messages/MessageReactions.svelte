<!--
  MessageReactions.svelte

  Displays reaction pills below a message bubble.
  Shows emoji + count, with visual indication if current user has reacted.
-->
<script lang="ts">
  import type { MessageReaction } from "$lib/shared/messaging/domain/models/message-models";
  import { authState } from "$lib/shared/auth/state/authState.svelte";

  let {
    reactions,
    onToggleReaction,
    onShowPicker,
  } = $props<{
    reactions: MessageReaction[];
    onToggleReaction: (emoji: string) => void;
    onShowPicker?: () => void;
  }>();

  const currentUserId = $derived(authState.user?.uid);

  function hasUserReacted(reaction: MessageReaction): boolean {
    return currentUserId ? reaction.userIds.includes(currentUserId) : false;
  }
</script>

<div class="reactions-container">
  {#each reactions as reaction}
    <button
      type="button"
      class="reaction-pill"
      class:user-reacted={hasUserReacted(reaction)}
      onclick={() => onToggleReaction(reaction.emoji)}
      aria-label="{reaction.emoji} reaction, {reaction.userIds.length} {reaction.userIds.length === 1 ? 'person' : 'people'}"
    >
      <span class="emoji">{reaction.emoji}</span>
      <span class="count">{reaction.userIds.length}</span>
    </button>
  {/each}

  {#if onShowPicker}
    <button
      type="button"
      class="add-reaction-button"
      onclick={onShowPicker}
      aria-label="Add reaction"
    >
      <i class="fa-regular fa-face-smile" aria-hidden="true"></i>
    </button>
  {/if}
</div>

<style>
  .reactions-container {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 6px;
  }

  .reaction-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 100px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    cursor: pointer;
    transition: all 0.15s ease;
    font-size: var(--font-size-sm, 14px);
  }

  .reaction-pill:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    transform: scale(1.05);
  }

  .reaction-pill:active {
    transform: scale(0.95);
  }

  .reaction-pill.user-reacted {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 20%, transparent);
    border-color: var(--theme-accent, #6366f1);
  }

  .reaction-pill.user-reacted:hover {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 30%, transparent);
  }

  .emoji {
    font-size: 1rem;
    line-height: 1;
  }

  .count {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    font-weight: 500;
  }

  .reaction-pill.user-reacted .count {
    color: var(--theme-accent, #6366f1);
  }

  .add-reaction-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 100px;
    background: transparent;
    border: 1px dashed var(--theme-stroke, rgba(255, 255, 255, 0.1));
    cursor: pointer;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    transition: all 0.15s ease;
    font-size: var(--font-size-sm, 14px);
  }

  .add-reaction-button:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-style: solid;
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #ffffff);
  }
</style>
