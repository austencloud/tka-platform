<script lang="ts">
  /**
   * CreatorsPanel (Discover Module)
   * Community creator browser for discovering users
   * Displays user profiles with their contributions and stats.
   *
   * Uses singleton data state for caching - data persists across tab switches.
   * Each creator card color is extracted from their avatar for a personalized look.
   */

  import { onMount } from "svelte";
  import { resolve, loadFeatureModule } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { authState } from "$lib/shared/auth/state/authState.svelte.ts";
  import { discoverNavigationState } from "../../shared/state/discover-navigation-state.svelte";
  import { creatorsDataState } from "../state/creators-data-state.svelte";
  import type { UserProfile } from "$lib/shared/community/domain/models/enhanced-user-profile";
  import type { IUserRepository } from "$lib/shared/community/services/contracts/IUserRepository";
  import PanelState from "$lib/shared/components/panel/PanelState.svelte";
  import PanelContent from "$lib/shared/components/panel/PanelContent.svelte";
  import PanelSearch from "$lib/shared/components/panel/PanelSearch.svelte";
  import PanelGrid from "$lib/shared/components/panel/PanelGrid.svelte";
  import {
    extractDominantColor,
    getCachedOrFallbackColor,
  } from "$lib/shared/foundation/utils/color-extractor";

  let searchQuery = $state("");
  let followingInProgress = $state<Set<string>>(new Set());

  // Track extracted colors per user ID
  let userColors = $state<Map<string, string>>(new Map());

  // Service instances
  let userService: IUserRepository;
  let hapticService: IHapticFeedback;

  // Get current user ID
  const currentUserId = $derived(authState.user?.uid);

  // Reactive getters from cached state
  const users = $derived(creatorsDataState.users);
  const isLoading = $derived(
    creatorsDataState.isLoading && !creatorsDataState.isLoaded
  );
  const error = $derived(creatorsDataState.error);

  // Accounts to hide from public view (test/system accounts)
  const HIDDEN_ACCOUNTS = ["tkascribe.review@gmail.com"];

  // Filtered users based on search (excludes hidden accounts)
  const filteredUsers = $derived.by(() => {
    // First filter out hidden accounts
    const visibleUsers = users.filter(
      (user) => !user.email || !HIDDEN_ACCOUNTS.includes(user.email)
    );

    if (!searchQuery) return visibleUsers;
    const query = searchQuery.toLowerCase();
    return visibleUsers.filter(
      (user) =>
        user.username.toLowerCase().includes(query) ||
        user.displayName.toLowerCase().includes(query)
    );
  });

  onMount(async () => {
    try {
      // Ensure community module is loaded (provides IUserRepository)
      await loadFeatureModule("community");

      // Resolve services from DI container
      userService = resolve<IUserRepository>(TYPES.IUserRepository);
      hapticService = resolve<IHapticFeedback>(TYPES.IHapticFeedback);

      // Load creators data (uses cache if already loaded)
      await creatorsDataState.loadCreators(userService, currentUserId);
    } catch (err) {
      console.error("[CreatorsPanel] Error loading creators:", err);
    }
  });

  function handleUserClick(user: UserProfile) {
    hapticService?.trigger("selection");
    // Navigate to user profile using unified navigation state
    discoverNavigationState.viewCreatorProfile(user.id, user.displayName);
  }

  /**
   * Get the accent color for a user card
   * Uses extracted color if available, falls back to name-based color
   */
  function getUserColor(user: UserProfile): string {
    // Check if we've already extracted this user's color
    const extracted = userColors.get(user.id);
    if (extracted) return extracted;

    // Use cached or generate fallback from name
    return getCachedOrFallbackColor(user.avatar, user.displayName);
  }

  /**
   * Handle successful avatar image load - extract color
   */
  async function handleAvatarLoad(
    user: UserProfile,
    imgElement: HTMLImageElement
  ) {
    // Skip if already have color for this user
    if (userColors.has(user.id)) return;

    try {
      const color = await extractDominantColor(user.avatar, user.displayName);
      // Update state to trigger re-render with new color
      userColors = new Map(userColors).set(user.id, color);
    } catch {
      // Extraction failed, use fallback (already handled by getCachedOrFallbackColor)
    }
  }

  /**
   * Handle avatar load error - ensure fallback color is set
   */
  function handleAvatarError(user: UserProfile, imgElement: HTMLImageElement) {
    // Hide broken image, show placeholder
    imgElement.style.display = "none";
    const fallback = imgElement.nextElementSibling as HTMLElement;
    if (fallback) fallback.style.display = "flex";

    // Set fallback color based on name
    if (!userColors.has(user.id)) {
      const fallbackColor = getCachedOrFallbackColor(
        undefined,
        user.displayName
      );
      userColors = new Map(userColors).set(user.id, fallbackColor);
    }
  }

  async function handleFollowToggle(user: UserProfile) {
    if (!currentUserId) {
      return;
    }

    if (currentUserId === user.id) {
      return;
    }

    // Prevent double-clicking
    if (followingInProgress.has(user.id)) {
      return;
    }

    // Add to in-progress set
    followingInProgress = new Set([...followingInProgress, user.id]);
    hapticService?.trigger("selection");

    try {
      if (user.isFollowing) {
        await userService.unfollowUser(currentUserId, user.id);
        // Optimistic update via cached state
        creatorsDataState.updateUserFollowStatus(user.id, false, -1);
      } else {
        await userService.followUser(currentUserId, user.id);
        // Optimistic update via cached state
        creatorsDataState.updateUserFollowStatus(user.id, true, 1);
      }
    } catch (err) {
      // Revert on error
      if (user.isFollowing) {
        creatorsDataState.updateUserFollowStatus(user.id, true, 1);
      } else {
        creatorsDataState.updateUserFollowStatus(user.id, false, -1);
      }
    } finally {
      // Remove from in-progress set
      const newSet = new Set(followingInProgress);
      newSet.delete(user.id);
      followingInProgress = newSet;
    }
  }
</script>

<div class="creators-panel">
  <div class="content-container">
    <!-- Header -->
    <div class="creators-topbar">
      <div class="header-section">
        <h2 class="panel-title">
          <i class="fas fa-users" aria-hidden="true"></i>
          Discover Creators
        </h2>
      </div>
    </div>

    <PanelSearch placeholder="Search creators..." bind:value={searchQuery} />

    <PanelContent>
      {#if error}
        <PanelState type="error" title="Error" message={error} />
      {:else if isLoading}
        <PanelState type="loading" message="Loading creators..." />
      {:else if filteredUsers.length === 0}
        <PanelState
          type="empty"
          icon="fa-users"
          title="No Creators Found"
          message={searchQuery
            ? "No creators match your search"
            : "No members found"}
        />
      {:else}
        <PanelGrid minCardWidth="240px" gap="20px">
          {#each filteredUsers as user (user.id)}
            <div
              class="user-card"
              style="--card-accent: {getUserColor(user)}"
              onclick={() => handleUserClick(user)}
              role="button"
              tabindex="0"
              aria-label="View profile of {user.displayName}"
              onkeydown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleUserClick(user);
                }
              }}
            >
              <!-- Avatar -->
              <div class="user-avatar">
                {#if user.avatar}
                  <img
                    src={user.avatar}
                    alt={user.displayName}
                    crossorigin="anonymous"
                    referrerpolicy="no-referrer"
                    onload={(e) =>
                      handleAvatarLoad(
                        user,
                        e.currentTarget as HTMLImageElement
                      )}
                    onerror={(e) =>
                      handleAvatarError(
                        user,
                        e.currentTarget as HTMLImageElement
                      )}
                  />
                  <!-- Fallback placeholder (shown if image fails to load) -->
                  <div
                    class="avatar-placeholder"
                    style="display: none;"
                    aria-hidden="true"
                  >
                    <i class="fas fa-user" aria-hidden="true"></i>
                  </div>
                {:else}
                  <div class="avatar-placeholder" aria-hidden="true">
                    <i class="fas fa-user" aria-hidden="true"></i>
                  </div>
                {/if}
              </div>

              <!-- User info -->
              <div class="user-info">
                <h3 class="display-name">{user.displayName}</h3>
                <p class="username">@{user.username}</p>

                <!-- Stats -->
                <div class="user-stats">
                  <div class="stat">
                    <i class="fas fa-list" aria-hidden="true"></i>
                    <span>{user.sequenceCount}</span>
                  </div>
                  <div class="stat">
                    <i class="fas fa-folder" aria-hidden="true"></i>
                    <span>{user.collectionCount}</span>
                  </div>
                  <div class="stat">
                    <i class="fas fa-users" aria-hidden="true"></i>
                    <span>{user.followerCount}</span>
                  </div>
                </div>
              </div>

              <!-- Actions - only show follow button if logged in and not own profile -->
              {#if currentUserId && currentUserId !== user.id}
                <div class="user-actions">
                  <button
                    class="follow-button"
                    class:following={user.isFollowing}
                    class:loading={followingInProgress.has(user.id)}
                    disabled={followingInProgress.has(user.id)}
                    aria-busy={followingInProgress.has(user.id)}
                    onclick={(e) => {
                      e.stopPropagation();
                      handleFollowToggle(user);
                    }}
                  >
                    {#if followingInProgress.has(user.id)}
                      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
                    {:else}
                      {user.isFollowing ? "Following" : "Follow"}
                    {/if}
                  </button>
                </div>
              {/if}
            </div>
          {/each}
        </PanelGrid>
      {/if}
    </PanelContent>
  </div>
</div>

<style>
  .creators-panel {
    display: flex;
    justify-content: center;
    width: 100%;
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    /* Generous responsive padding */
    padding: 0 clamp(16px, 4vw, 48px);
  }

  /* 2026 Centered content container - everything aligns to same width */
  .content-container {
    display: flex;
    flex-direction: column;
    gap: 24px;
    width: 100%;
    max-width: 1100px;
    padding-bottom: 48px;
  }

  /* Top bar with navigation */
  .creators-topbar {
    display: flex;
    align-items: center;
    padding: 16px 0 8px;
    background: transparent;
    width: 100%;
    min-height: 48px;
  }

  .nav-section {
    flex-shrink: 0;
    min-width: 104px;
  }

  .header-section {
    flex: 1;
    display: flex;
    justify-content: center;
  }

  .panel-title {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    font-size: var(--font-size-xl);
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
  }

  .panel-title i {
    font-size: var(--font-size-lg);
    color: var(--theme-text-dim);
  }

  .spacer {
    flex-shrink: 0;
    min-width: 104px;
  }

  /* ============================================================================
     USER CARD - Dynamic Avatar-Based Color Theming
     --card-accent is set dynamically per card via inline style
     ============================================================================ */
  .user-card {
    /* Fallback if no color extracted yet */
    --card-accent: var(--theme-accent-strong);
    /* Derive lighter variant using color-mix */
    --card-accent-light: color-mix(in srgb, var(--card-accent) 80%, #fff);
    --card-accent-glow: color-mix(in srgb, var(--card-accent) 25%, transparent);

    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
    /* Soft gradient fill using extracted color */
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--card-accent) 10%, rgba(255, 255, 255, 0.03)) 0%,
      color-mix(in srgb, var(--card-accent) 5%, rgba(255, 255, 255, 0.02)) 100%
    );
    border: 1px solid color-mix(in srgb, var(--card-accent) 18%, transparent);
    border-radius: 14px;
    transition:
      background 0.3s var(--ease-out, ease),
      border-color 0.3s var(--ease-out, ease),
      box-shadow 0.2s var(--ease-out, ease),
      transform 0.2s var(--ease-out, ease);
    cursor: pointer;
  }

  .user-card:hover {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--card-accent) 16%, var(--theme-card-bg)) 0%,
      color-mix(in srgb, var(--card-accent) 10%, rgba(255, 255, 255, 0.03)) 100%
    );
    border-color: color-mix(in srgb, var(--card-accent) 40%, transparent);
    transform: translateY(var(--hover-lift-md, -2px));
    /* Dynamic color glow on hover */
    box-shadow:
      0 8px 24px var(--card-accent-glow),
      0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .user-card:focus {
    outline: 2px solid var(--card-accent);
    outline-offset: 2px;
  }

  /* Avatar with dynamic color ring */
  .user-avatar {
    position: relative;
    width: 56px;
    height: 56px;
    margin: 0 auto;
    flex-shrink: 0;
    /* Gradient ring using extracted color */
    padding: 2px;
    background: linear-gradient(
      135deg,
      var(--card-accent) 0%,
      var(--card-accent-light) 100%
    );
    border-radius: 50%;
    transition: background 0.3s var(--ease-out, ease);
  }

  .user-avatar img,
  .avatar-placeholder {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    /* Inner background to create ring effect */
    background: #1a1a2e;
  }

  .avatar-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--card-accent) 20%, #1a1a2e) 0%,
      #1a1a2e 100%
    );
  }

  .avatar-placeholder i {
    font-size: var(--font-size-xl);
    color: var(--card-accent-light);
    transition: color 0.3s var(--ease-out, ease);
  }

  /* User info */
  .user-info {
    text-align: center;
    min-width: 0;
  }

  .display-name {
    margin: 0;
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--theme-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .username {
    margin: 2px 0 0 0;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim, var(--theme-text-dim));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* User stats */
  .user-stats {
    display: flex;
    justify-content: center;
    gap: 12px;
    margin-top: 6px;
  }

  .stat {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
  }

  .stat i {
    font-size: var(--font-size-compact);
    /* Dynamic color tinted icons */
    color: var(--card-accent);
    opacity: 0.75;
    transition:
      opacity 0.2s ease,
      color 0.3s ease;
  }

  .user-card:hover .stat i {
    opacity: 1;
  }

  /* Actions */
  .user-actions {
    display: flex;
    margin-top: 4px;
  }

  .follow-button {
    width: 100%;
    padding: 6px 12px;
    border: 1px solid var(--card-accent);
    border-radius: 6px;
    font-size: var(--font-size-compact);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s var(--ease-out, ease);
    background: var(--card-accent);
    color: white;
  }

  .follow-button:hover {
    filter: brightness(1.15);
    box-shadow: 0 2px 8px var(--card-accent-glow);
  }

  .follow-button.following {
    background: transparent;
    border-color: color-mix(in srgb, var(--card-accent) 30%, transparent);
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .follow-button.following:hover {
    background: color-mix(in srgb, var(--card-accent) 10%, transparent);
    border-color: color-mix(in srgb, var(--card-accent) 50%, transparent);
    color: var(--card-accent-light);
  }

  .follow-button.loading {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .follow-button:disabled {
    pointer-events: none;
  }

  /* ============================================================================
     RESPONSIVE
     ============================================================================ */
  @media (max-width: 640px) {
    .creators-panel {
      padding: 0 12px;
    }

    .content-container {
      gap: 16px;
      padding-bottom: 24px;
    }

    .creators-topbar {
      padding: 12px 0 4px;
    }

    .panel-title {
      font-size: var(--font-size-base);
    }

    .user-card {
      padding: 12px;
      gap: 8px;
      border-radius: 12px;
    }

    .user-avatar {
      width: 48px;
      height: 48px;
      padding: 2px;
    }

    .avatar-placeholder i {
      font-size: var(--font-size-lg);
    }

    .display-name {
      font-size: var(--font-size-compact);
    }

    .username {
      font-size: var(--font-size-compact);
    }

    .user-stats {
      margin-top: 4px;
      gap: 10px;
    }

    .stat {
      font-size: var(--font-size-compact);
      gap: 3px;
    }

    .stat i {
      font-size: var(--font-size-compact);
    }

    .follow-button {
      padding: 6px 12px;
      font-size: var(--font-size-compact);
    }
  }

  @media (max-width: 360px) {
    .user-avatar {
      width: 44px;
      height: 44px;
    }
  }

  /* ============================================================================
     ACCESSIBILITY
     ============================================================================ */
  @media (prefers-reduced-motion: reduce) {
    .user-card {
      transition: none;
    }

    .user-card:hover {
      transform: none;
    }
  }
</style>
