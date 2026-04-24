<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/getHapticFeedback";
  import { onMount, onDestroy } from "svelte";
  import { fade, fly } from "svelte/transition";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import PanelTabs from "$lib/shared/components/panel/PanelTabs.svelte";
  import PanelState from "$lib/shared/components/panel/PanelState.svelte";
  import type { LibrarySequence } from "$lib/features/library/domain/models/LibrarySequence";
  import type {
    EnhancedUserProfile,
    UserProfile,
  } from "$lib/shared/community/domain/models/enhanced-user-profile";
  import AvatarImage from "./AvatarImage.svelte";
  import PropAwareThumbnail from "$lib/features/browse/sequences/display/components/PropAwareThumbnail.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";

  type ProfileTab = "gallery" | "followers" | "following";

  let {
    activeTab,
    userProfile,
    userSequences = [],
    followerUsers = [],
    followingUsers = [],
    followersLoading = false,
    followingLoading = false,
    onTabChange,
    onSequenceClick,
    onUserClick,
  }: {
    activeTab: ProfileTab;
    userProfile: EnhancedUserProfile;
    userSequences?: readonly LibrarySequence[];
    followerUsers?: readonly UserProfile[];
    followingUsers?: readonly UserProfile[];
    followersLoading?: boolean;
    followingLoading?: boolean;
    onTabChange: (tab: ProfileTab) => void;
    onSequenceClick: (sequence: LibrarySequence) => void;
    onUserClick: (user: UserProfile) => void;
  } = $props();

  let hapticService: IHapticFeedback | undefined;

  // Light mode tracking - reacts to "L" key toggle
  const visibilityManager = getAnimationVisibilityManager();
  let lightMode = $state(!visibilityManager.isDarkMode());

  function handleVisibilityChange() {
    lightMode = !visibilityManager.isDarkMode();
  }

  onMount(() => {
    hapticService = getHapticFeedback();
    visibilityManager.registerObserver(handleVisibilityChange);
  });

  onDestroy(() => {
    visibilityManager.unregisterObserver(handleVisibilityChange);
  });

  function handleSequenceClick(sequence: LibrarySequence) {
    hapticService?.trigger("selection");
    onSequenceClick(sequence);
  }

  function handleUserClick(user: UserProfile) {
    hapticService?.trigger("selection");
    onUserClick(user);
  }

  /**
   * Get a display name for a sequence, handling malformed/auto-generated names
   */
  function getDisplayName(sequence: LibrarySequence): string {
    // Prefer word (the TKA notation) over name
    if (sequence.word) {
      return sequence.word;
    }

    if (sequence.name) {
      // Strip legacy prefixes/suffixes from old data
      const cleaned = sequence.name
        .replace(/^Circular\s+/i, "")
        .replace(/\s+Sequence$/i, "");
      if (cleaned && !/^Sequence\s+/i.test(cleaned)) return cleaned;
    }

    if (sequence.steps && sequence.steps.length > 0) {
      return `${sequence.steps.length} beats`;
    }

    return "Untitled";
  }
</script>

<div class="tabs-wrapper" transition:fly={{ y: 20, duration: 300, delay: 200 }}>
  <PanelTabs
    tabs={[
      {
        value: "gallery",
        label: `Sequences (${userSequences.length})`,
        icon: "fa-list",
      },
      {
        value: "followers",
        label: `Followers (${userProfile.followerCount})`,
        icon: "fa-users",
      },
      {
        value: "following",
        label: `Following (${userProfile.followingCount})`,
        icon: "fa-user-plus",
      },
    ]}
    {activeTab}
    onchange={(tab: string) => onTabChange(tab as ProfileTab)}
  />
</div>

<div class="profile-tab-content">
  {#if activeTab === "gallery"}
    {#if userSequences.length === 0}
      <PanelState
        type="empty"
        icon="fa-list"
        title="No Sequences"
        message="This creator hasn't published any sequences yet."
      />
    {:else}
      <div class="sequences-grid">
        {#each userSequences as sequence (sequence.id)}
          <button
            class="sequence-card"
            onclick={() => handleSequenceClick(sequence)}
            transition:fade={{ duration: 200 }}
          >
            <div class="sequence-thumbnail">
              <PropAwareThumbnail sequence={sequence} {lightMode} />
            </div>

            <div class="sequence-info">
              <h3 class="sequence-name">{getDisplayName(sequence)}</h3>

              <div class="sequence-meta">
                {#if sequence.createdAt}
                  <span class="meta-item">
                    <i class="fas fa-clock" aria-hidden="true"></i>
                    {sequence.createdAt instanceof Date
                      ? sequence.createdAt.toLocaleDateString()
                      : new Date(sequence.createdAt).toLocaleDateString()}
                  </span>
                {/if}
                {#if sequence.steps && sequence.steps.length > 0}
                  <span class="meta-item">
                    <i class="fas fa-music" aria-hidden="true"></i>
                    {sequence.steps.length} steps
                  </span>
                {/if}
              </div>
            </div>
          </button>
        {/each}
      </div>
    {/if}
  {:else if activeTab === "followers"}
    {#if followersLoading}
      <PanelState type="loading" message="Loading followers..." />
    {:else if followerUsers.length === 0}
      <PanelState
        type="empty"
        icon="fa-users"
        title="No Followers Yet"
        message="This user doesn't have any followers yet"
      />
    {:else}
      <div class="user-list-grid">
        {#each followerUsers as user (user.id)}
          <button
            class="user-list-card"
            onclick={() => handleUserClick(user)}
            transition:fade={{ duration: 200 }}
          >
            <div class="user-list-avatar">
              <AvatarImage src={user.avatar} alt={user.displayName} size={48} />
            </div>
            <div class="user-list-info">
              <h4 class="user-list-name">{user.displayName}</h4>
              <p class="user-list-username">@{user.username}</p>
            </div>
            <div class="user-list-stats">
              <span class="user-list-stat">
                <i class="fas fa-list" aria-hidden="true"></i>
                {user.sequenceCount}
              </span>
              <span class="user-list-stat">
                <i class="fas fa-users" aria-hidden="true"></i>
                {user.followerCount}
              </span>
            </div>
            <i class="fas fa-chevron-right user-list-arrow" aria-hidden="true"
            ></i>
          </button>
        {/each}
      </div>
    {/if}
  {:else if activeTab === "following"}
    {#if followingLoading}
      <PanelState type="loading" message="Loading following..." />
    {:else if followingUsers.length === 0}
      <PanelState
        type="empty"
        icon="fa-user-plus"
        title="Not Following Anyone"
        message="This user isn't following anyone yet"
      />
    {:else}
      <div class="user-list-grid">
        {#each followingUsers as user (user.id)}
          <button
            class="user-list-card"
            onclick={() => handleUserClick(user)}
            transition:fade={{ duration: 200 }}
          >
            <div class="user-list-avatar">
              <AvatarImage src={user.avatar} alt={user.displayName} size={48} />
            </div>
            <div class="user-list-info">
              <h4 class="user-list-name">{user.displayName}</h4>
              <p class="user-list-username">@{user.username}</p>
            </div>
            <div class="user-list-stats">
              <span class="user-list-stat">
                <i class="fas fa-list" aria-hidden="true"></i>
                {user.sequenceCount}
              </span>
              <span class="user-list-stat">
                <i class="fas fa-users" aria-hidden="true"></i>
                {user.followerCount}
              </span>
            </div>
            <i class="fas fa-chevron-right user-list-arrow" aria-hidden="true"
            ></i>
          </button>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .tabs-wrapper {
    container-type: inline-size;
    container-name: tabs-wrapper;

    display: flex;
    justify-content: center;
    margin-bottom: 16px;
  }

  .profile-tab-content {
    container-type: inline-size;
    container-name: tab-content;

    min-height: 300px;
  }

  .sequences-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 16px;
  }

  /* Wide screens: cap at 3 columns for readability */
  @container tab-content (min-width: 800px) {
    .sequences-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  .sequence-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    text-align: left;
  }

  .sequence-card:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px var(--theme-shadow);
  }

  .sequence-thumbnail {
    width: 100%;
    border-radius: 8px;
    overflow: hidden;
    container-type: inline-size;
    container-name: sequence-card;
  }

  .sequence-info {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .sequence-name {
    margin: 0;
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--theme-text, white);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sequence-meta {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
  }

  .meta-item i {
    font-size: var(--font-size-compact);
  }

  .user-list-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .user-list-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    text-align: left;
    width: 100%;
  }

  .user-list-card:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    transform: translateX(4px);
  }

  .user-list-avatar {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    flex-shrink: 0;
  }

  .user-list-info {
    flex: 1;
    min-width: 0;
  }

  .user-list-name {
    margin: 0;
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--theme-text, white);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .user-list-username {
    margin: 2px 0 0 0;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .user-list-stats {
    display: flex;
    gap: 12px;
    flex-shrink: 0;
  }

  .user-list-stat {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
  }

  .user-list-stat i {
    font-size: var(--font-size-compact);
  }

  .user-list-arrow {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    flex-shrink: 0;
    transition: transform var(--duration-normal) ease;
  }

  .user-list-card:hover .user-list-arrow {
    transform: translateX(4px);
    color: var(--theme-text-dim);
  }

  /* Narrow: single column */
  @container tab-content (max-width: 500px) {
    .sequences-grid {
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .sequence-card {
      padding: 12px;
    }
  }

  /* Very narrow: tighter spacing */
  @container tab-content (max-width: 360px) {
    .sequence-card,
    .user-list-card {
      padding: 10px;
      gap: 10px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sequence-card,
    .user-list-card {
      transition: none;
    }

    .sequence-card:hover,
    .user-list-card:hover {
      transform: none;
    }

    .user-list-arrow,
    .user-list-card:hover .user-list-arrow {
      transition: none;
      transform: none;
    }
  }
</style>
