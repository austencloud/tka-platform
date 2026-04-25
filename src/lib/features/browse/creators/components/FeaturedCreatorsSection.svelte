<script lang="ts">
  /**
   * FeaturedCreatorsSection - Pinned section for featured creators
   *
   * Displays a non-virtualized horizontal section of featured creators
   * at the top of the creators list. Limited to 6-8 users.
   */

  import type { EnhancedUserProfile, CreatorSortCriteria } from "$lib/shared/community/domain/models/enhanced-user-profile";
  import PanelGrid from "$lib/shared/components/panel/PanelGrid.svelte";
  import CreatorCard from "./CreatorCard.svelte";

  interface Props {
    users: EnhancedUserProfile[];
    sortBy?: CreatorSortCriteria;
    currentUserId?: string;
    followingInProgress: Set<string>;
    onUserClick: (user: EnhancedUserProfile) => void;
    onFollowToggle: (user: EnhancedUserProfile) => void;
    isLoading?: boolean;
  }

  const {
    users = [],
    sortBy = "lastActive",
    currentUserId,
    followingInProgress = new Set(),
    onUserClick,
    onFollowToggle,
    isLoading = false,
  }: Props = $props();

  // Track extracted colors per user ID for this section
  let userColors = $state<Map<string, string>>(new Map());

  function handleColorExtracted(userId: string, color: string) {
    userColors = new Map(userColors).set(userId, color);
  }

  // Don't show section if no users and not loading
  const shouldShow = $derived(users.length > 0 || isLoading);
</script>

{#if shouldShow}
  <section class="featured-section">
    <h3 class="section-title">
      <i class="fas fa-star" aria-hidden="true"></i>
      Featured Creators
    </h3>

    {#if isLoading}
      <div class="loading-skeleton">
        {#each Array(4) as _, i}
          <div class="skeleton-card"></div>
        {/each}
      </div>
    {:else}
      <PanelGrid minCardWidth="200px" maxCardWidth="280px" gap="16px">
        {#each users as user (user.id)}
          <CreatorCard
            {user}
            {sortBy}
            accentColor={userColors.get(user.id)}
            {currentUserId}
            isFollowLoading={followingInProgress.has(user.id)}
            onUserClick={() => onUserClick(user)}
            onFollowToggle={() => onFollowToggle(user)}
            onColorExtracted={(color) => handleColorExtracted(user.id, color)}
          />
        {/each}
      </PanelGrid>
    {/if}
  </section>
{/if}

<style>
  .featured-section {
    margin-bottom: 24px;
    padding-bottom: 24px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 16px 0;
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--theme-text);
  }

  .section-title i {
    color: var(--semantic-warning, #fbbf24);
    font-size: var(--font-size-sm);
  }

  .loading-skeleton {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 280px));
    gap: 16px;
    padding: 4px;
  }

  .skeleton-card {
    height: 180px;
    background: linear-gradient(
      135deg,
      var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 0%,
      var(--surface-color, rgba(255, 255, 255, 0.02)) 100%
    );
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 14px;
    animation: skeleton-pulse 1.5s ease-in-out infinite;
  }

  @keyframes skeleton-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  @media (max-width: 640px) {
    .featured-section {
      margin-bottom: 16px;
      padding-bottom: 16px;
    }

    .section-title {
      font-size: var(--font-size-sm);
      margin-bottom: 12px;
    }

    .loading-skeleton {
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }
  }
</style>
