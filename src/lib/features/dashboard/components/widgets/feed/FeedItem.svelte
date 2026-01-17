<script lang="ts">
  /**
   * FeedItem - Single item in the Following Feed
   *
   * Displays a feed event with user avatar, action description, and timestamp
   */

  import type { FollowingFeedItem } from "$lib/features/dashboard/services/contracts/IFollowingFeedProvider";
  import RobustAvatar from "$lib/shared/components/avatar/RobustAvatar.svelte";
  import { handleModuleChange } from "$lib/shared/navigation-coordinator/navigation-coordinator.svelte";

  interface Props {
    item: FollowingFeedItem;
  }

  let { item }: Props = $props();

  /**
   * Format relative time (e.g., "2h ago", "3d ago")
   */
  function formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "now";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }

  /**
   * Get action text based on event type
   */
  function getActionText(type: FollowingFeedItem["eventType"]): string {
    switch (type) {
      case "sequence_create":
        return "created a new sequence";
      case "sequence_favorite":
        return "favorited a sequence";
      case "achievement_unlock":
        return "earned an achievement";
      default:
        return "did something";
    }
  }

  /**
   * Get icon for event type
   */
  function getEventIcon(type: FollowingFeedItem["eventType"]): string {
    switch (type) {
      case "sequence_create":
        return "fa-plus-circle";
      case "sequence_favorite":
        return "fa-heart";
      case "achievement_unlock":
        return "fa-trophy";
      default:
        return "fa-circle";
    }
  }

  /**
   * Get icon color class for event type
   */
  function getIconColorClass(type: FollowingFeedItem["eventType"]): string {
    switch (type) {
      case "sequence_create":
        return "icon-create";
      case "sequence_favorite":
        return "icon-favorite";
      case "achievement_unlock":
        return "icon-achievement";
      default:
        return "";
    }
  }

  async function handleClick() {
    if (
      item.eventType === "sequence_create" ||
      item.eventType === "sequence_favorite"
    ) {
      // Navigate to discover to find the sequence
      await handleModuleChange("discover", "gallery");
    }
  }
</script>

<button class="feed-item" onclick={handleClick}>
  <div class="avatar-container">
    <RobustAvatar
      src={item.userAvatarUrl}
      name={item.userDisplayName}
      alt={item.userDisplayName}
      size="sm"
    />
    <div class="event-badge {getIconColorClass(item.eventType)}">
      <i class="fas {getEventIcon(item.eventType)}" aria-hidden="true"></i>
    </div>
  </div>

  <div class="item-content">
    <div class="action-line">
      <span class="user-name">{item.userDisplayName}</span>
      <span class="action-text">{getActionText(item.eventType)}</span>
    </div>

    {#if item.sequenceWord}
      <div class="sequence-info">
        <span class="sequence-name">"{item.sequenceWord}"</span>
      </div>
    {:else if item.achievementName}
      <div class="achievement-info">
        <span class="achievement-name">{item.achievementName}</span>
      </div>
    {/if}
  </div>

  <div class="timestamp">
    {formatRelativeTime(item.timestamp)}
  </div>
</button>

<style>
  .feed-item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px;
    background: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 5%,
      transparent
    );
    border: 1px solid
      color-mix(
        in srgb,
        var(--theme-accent, var(--theme-accent)) 10%,
        transparent
      );
    border-radius: 12px;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    text-align: left;
  }

  .feed-item:hover {
    background: color-mix(in srgb, var(--theme-accent) 12%, transparent);
    border-color: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 25%,
      transparent
    );
    transform: translateX(2px);
  }

  .feed-item:active {
    transform: scale(0.99);
  }

  .avatar-container {
    position: relative;
    flex-shrink: 0;
  }

  .event-badge {
    position: absolute;
    bottom: -4px;
    right: -4px;
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg);
    border-radius: 50%;
    font-size: var(--font-size-compact);
  }

  .event-badge.icon-create {
    color: var(--semantic-success);
  }

  .event-badge.icon-favorite {
    color: var(--semantic-error);
  }

  .event-badge.icon-achievement {
    color: var(--semantic-warning);
  }

  .item-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .action-line {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    font-size: var(--font-size-compact);
    line-height: 1.3;
  }

  .user-name {
    font-weight: 600;
    color: var(--theme-text);
  }

  .action-text {
    color: var(--theme-text-dim);
  }

  .sequence-info,
  .achievement-info {
    font-size: var(--font-size-compact);
  }

  .sequence-name {
    color: var(--theme-accent, var(--theme-accent));
    font-weight: 500;
  }

  .achievement-name {
    color: rgba(253, 230, 138, 1);
    font-weight: 500;
  }

  .timestamp {
    flex-shrink: 0;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    font-weight: 500;
  }

  .feed-item:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .feed-item {
      transition: none;
    }

    .feed-item:hover {
      transform: none;
    }
  }
</style>
