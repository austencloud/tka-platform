<!--
  GroupAvatarStack.svelte

  Stacked avatar display for group conversations.
  Shows overlapping avatars with a "+N" indicator for overflow.
  Can display a custom group avatar instead.
-->
<script lang="ts">
  import type { ParticipantInfo } from "$lib/shared/messaging/domain/models/conversation-models";

  interface Props {
    participants: ParticipantInfo[];
    customAvatar?: string;
    maxVisible?: number;
    size?: number;
  }

  let {
    participants,
    customAvatar,
    maxVisible = 3,
    size = 44,
  }: Props = $props();

  const visibleParticipants = $derived(participants.slice(0, maxVisible));
  const overflowCount = $derived(
    Math.max(0, participants.length - maxVisible)
  );
  const hasOverflow = $derived(overflowCount > 0);

  // Calculate individual avatar size based on container size
  const avatarSize = $derived(Math.round(size * 0.65));
  const overlap = $derived(Math.round(avatarSize * 0.3));
</script>

{#if customAvatar}
  <!-- Custom group avatar -->
  <div class="custom-avatar" style="width: {size}px; height: {size}px;">
    <img src={customAvatar} alt="Group avatar" />
    <span class="group-indicator">
      <i class="fas fa-users" aria-hidden="true"></i>
    </span>
  </div>
{:else}
  <!-- Stacked participant avatars -->
  <div
    class="avatar-stack"
    style="height: {size}px; min-width: {avatarSize + (visibleParticipants.length - 1 + (hasOverflow ? 1 : 0)) * (avatarSize - overlap)}px;"
  >
    {#each visibleParticipants as participant, i}
      <div
        class="avatar"
        style="
          width: {avatarSize}px;
          height: {avatarSize}px;
          z-index: {maxVisible - i};
          right: {i * (avatarSize - overlap)}px;
        "
        title={participant.displayName}
      >
        {#if participant.avatar}
          <img src={participant.avatar} alt="" />
        {:else}
          <span class="initials">
            {(participant.displayName || "?").charAt(0).toUpperCase()}
          </span>
        {/if}
      </div>
    {/each}

    {#if hasOverflow}
      <div
        class="avatar overflow"
        style="
          width: {avatarSize}px;
          height: {avatarSize}px;
          z-index: 0;
          right: {visibleParticipants.length * (avatarSize - overlap)}px;
        "
      >
        <span class="overflow-count">+{overflowCount}</span>
      </div>
    {/if}
  </div>
{/if}

<style>
  .custom-avatar {
    position: relative;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
  }

  .custom-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .group-indicator {
    position: absolute;
    bottom: -2px;
    right: -2px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    background: var(--theme-accent, var(--semantic-info));
    border: 2px solid var(--theme-panel-bg);
    border-radius: 50%;
    color: white;
    font-size: 8px;
  }

  .avatar-stack {
    position: relative;
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .avatar {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: linear-gradient(
      135deg,
      var(--semantic-info) 0%,
      var(--theme-accent-strong, var(--semantic-info)) 100%
    );
    border: 2px solid var(--theme-panel-bg);
    overflow: hidden;
  }

  .avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .initials {
    font-size: 0.7rem;
    font-weight: 600;
    color: white;
    text-transform: uppercase;
  }

  .avatar.overflow {
    background: rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(4px);
  }

  .overflow-count {
    font-size: 0.65rem;
    font-weight: 600;
    color: var(--theme-text);
  }
</style>
