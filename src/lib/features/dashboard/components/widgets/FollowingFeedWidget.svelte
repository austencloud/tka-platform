<script lang="ts">
  /**
   * FollowingFeedWidget - Activity from followed users
   *
   * Shows recent activity from creators the current user follows.
   * Displays: sequences created, sequences favorited, achievements earned
   */

  import { container } from "$lib/shared/di";
  import type {
    IFollowingFeedProvider,
    FollowingFeedItem,
  } from "$lib/features/dashboard/services/contracts/IFollowingFeedProvider";
  import { handleModuleChange } from "$lib/shared/navigation-coordinator/navigation-coordinator.svelte";
  import { getEffectiveUserId } from "$lib/shared/debug/state/user-preview-state.svelte";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import FeedItem from "./feed/FeedItem.svelte";

  // State
  let isLoading = $state(true);
  let feedItems = $state<FollowingFeedItem[]>([]);
  let hasFollowing = $state(false);
  let error = $state<string | null>(null);

  // Reactive: reload feed when effective user changes (preview mode toggle)
  const effectiveUserId = $derived(
    getEffectiveUserId(authState.user?.uid || null)
  );

  async function loadFeed() {
    isLoading = true;
    error = null;

    try {
      const feedService = container.items.followingFeedProvider;

      if (!feedService || !effectiveUserId) {
        isLoading = false;
        return;
      }

      // Check if user follows anyone
      hasFollowing = await feedService.hasFollowing(effectiveUserId);

      if (hasFollowing) {
        // Fetch the feed
        feedItems = await feedService.getFollowingFeed({
          limit: 8,
          daysBack: 7,
          userId: effectiveUserId,
        });
      } else {
        feedItems = [];
      }
    } catch (e) {
      console.warn("[FollowingFeed] Failed to load feed:", e);
      error = "Unable to load feed";
    } finally {
      isLoading = false;
    }
  }

  // Load feed when effectiveUserId changes
  $effect(() => {
    if (effectiveUserId) {
      loadFeed();
    }
  });

  async function viewCreators() {
    await handleModuleChange("browse", "creators");
  }
</script>

<div class="following-widget">
  <div class="widget-header">
    <div class="header-icon">
      <i class="fas fa-user-friends" aria-hidden="true"></i>
    </div>
    <h3>Following</h3>
  </div>

  <div class="widget-content">
    {#if isLoading}
      <div class="loading-state">
        <div class="skeleton-list">
          {#each Array(3) as _}
            <div class="skeleton-item">
              <div class="skeleton-avatar"></div>
              <div class="skeleton-text">
                <div class="skeleton-line short"></div>
                <div class="skeleton-line long"></div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {:else if error}
      <div class="empty-state">
        <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
        <p>{error}</p>
      </div>
    {:else if !hasFollowing}
      <div class="empty-state">
        <i class="fas fa-user-plus" aria-hidden="true"></i>
        <p>Not following anyone yet</p>
        <span class="empty-hint"
          >Follow creators to see their activity here</span
        >
      </div>
    {:else if feedItems.length === 0}
      <div class="empty-state">
        <i class="fas fa-stream" aria-hidden="true"></i>
        <p>No recent activity</p>
        <span class="empty-hint"
          >Your followed creators haven't posted lately</span
        >
      </div>
    {:else}
      <div class="feed-list">
        {#each feedItems as item (item.id)}
          <FeedItem {item} />
        {/each}
      </div>
    {/if}
  </div>

  <button class="view-all-btn" onclick={viewCreators}>
    <span>Browse Creators</span>
    <i class="fas fa-arrow-right" aria-hidden="true"></i>
  </button>
</div>

<style>
  .following-widget {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
    padding: 24px;
    background: var(--theme-panel-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 24px;
    overflow: hidden;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  }

  .widget-header {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 20px;
  }

  .header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    background: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 25%,
      var(--theme-card-bg, var(--theme-shadow))
    );
    border-radius: 14px;
    color: var(--theme-accent, var(--theme-accent));
    font-size: var(--font-size-lg);
  }

  .widget-header h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--theme-text);
  }

  .widget-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 140px;
    overflow-y: auto;
  }

  /* Loading skeleton */
  .skeleton-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
  }

  .skeleton-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 5%,
      transparent
    );
    border-radius: 12px;
  }

  .skeleton-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: linear-gradient(
      90deg,
      color-mix(
          in srgb,
          var(--theme-accent, var(--theme-accent)) 8%,
          transparent
        )
        25%,
      color-mix(
          in srgb,
          var(--theme-accent, var(--theme-accent)) 15%,
          transparent
        )
        50%,
      color-mix(
          in srgb,
          var(--theme-accent, var(--theme-accent)) 8%,
          transparent
        )
        75%
    );
    background-size: 200% 100%;
    animation: shimmer 2s infinite ease-in-out;
  }

  .skeleton-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .skeleton-line {
    height: 10px;
    border-radius: 5px;
    background: linear-gradient(
      90deg,
      color-mix(
          in srgb,
          var(--theme-accent, var(--theme-accent)) 8%,
          transparent
        )
        25%,
      color-mix(
          in srgb,
          var(--theme-accent, var(--theme-accent)) 15%,
          transparent
        )
        50%,
      color-mix(
          in srgb,
          var(--theme-accent, var(--theme-accent)) 8%,
          transparent
        )
        75%
    );
    background-size: 200% 100%;
    animation: shimmer 2s infinite ease-in-out;
  }

  .skeleton-line.short {
    width: 60%;
  }

  .skeleton-line.long {
    width: 90%;
  }

  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    text-align: center;
    padding: 20px;
    flex: 1;
  }

  .empty-state i {
    font-size: var(--font-size-3xl);
    color: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 40%,
      transparent
    );
  }

  .empty-state p {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--theme-text, var(--theme-text));
  }

  .empty-hint {
    font-size: 0.8125rem;
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  /* Feed list */
  .feed-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }

  .view-all-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: var(--min-touch-target);
    padding: 14px 20px;
    background: linear-gradient(
      135deg,
      var(--theme-accent, var(--theme-accent)) 0%,
      color-mix(in srgb, var(--theme-accent, var(--theme-accent)) 80%, black)
        100%
    );
    border: none;
    border-radius: 14px;
    color: white;
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    margin-top: auto;
  }

  .view-all-btn:hover {
    filter: brightness(1.1);
    transform: translateY(-1px);
  }

  .view-all-btn i {
    font-size: var(--font-size-sm);
  }

  @media (max-width: 768px) {
    .following-widget {
      padding: 20px;
      border-radius: 20px;
    }

    .header-icon {
      width: 40px;
      height: 40px;
      font-size: var(--font-size-base);
    }

    .widget-header h3 {
      font-size: 1rem;
    }

    .view-all-btn {
      min-height: 44px;
      padding: 12px 16px;
      font-size: 0.875rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .skeleton-avatar,
    .skeleton-line {
      animation: none;
      background: rgba(99, 102, 241, 0.1);
    }

    .view-all-btn {
      transition: none;
    }

    .view-all-btn:hover {
      transform: none;
    }
  }
</style>
