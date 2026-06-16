<!--
  MessageReactions.svelte

  Messenger-style reaction badge: tiny emoji pill at the bubble corner.
  Just the emoji(s) in a small rounded container with a shadow for depth.
-->
<script lang="ts">
  import type { MessageReaction } from "$lib/shared/messaging/domain/models/message-models";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";

  let {
    reactions,
    onToggleReaction,
  } = $props<{
    reactions: MessageReaction[];
    onToggleReaction: (emoji: string) => void;
  }>();

  const currentUserId = $derived(authState.user?.uid);

  function hasUserReacted(reaction: MessageReaction): boolean {
    return currentUserId ? reaction.userIds.includes(currentUserId) : false;
  }

  const totalCount = $derived(
    reactions.reduce((sum: number, r: MessageReaction) => sum + r.userIds.length, 0)
  );
</script>

<button
  type="button"
  class="reaction-badge-pill"
  onclick={() => {
    if (reactions.length === 1) {
      onToggleReaction(reactions[0].emoji);
    }
  }}
  aria-label="Reactions: {reactions.map((r: MessageReaction) => r.emoji).join(', ')}"
>
  {#each reactions as reaction}
    <span class="emoji">{reaction.emoji}</span>
  {/each}
  {#if totalCount > 1}
    <span class="count">{totalCount}</span>
  {/if}
</button>

<style>
  .reaction-badge-pill {
    display: inline-flex;
    align-items: center;
    gap: 1px;
    height: 20px;
    padding: 0 5px;
    border-radius: 10px;
    border: none;
    cursor: pointer;
    background: var(--theme-panel-bg, #16161e);
    box-shadow:
      0 0.5px 3px rgba(0, 0, 0, 0.35),
      0 0 0 0.5px rgba(255, 255, 255, 0.08);
    transition: transform var(--duration-fast) ease;
  }

  .reaction-badge-pill:hover {
    transform: scale(1.1);
  }

  .reaction-badge-pill:active {
    transform: scale(0.92);
  }

  .emoji {
    font-size: 12px;
    line-height: 1;
  }

  .count {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
    line-height: 1;
    margin-left: 1px;
  }
</style>
