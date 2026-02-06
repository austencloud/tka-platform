<script lang="ts">
  /**
   * UserBrowserPanel - Unified user browsing experience
   *
   * Beautiful avatar-colored cards for everyone.
   * Admin tools appear conditionally when signed in as admin.
   *
   * Features:
   * - Dynamic avatar color extraction for personalized cards
   * - Search and filter users
   * - View user profiles
   * - [Admin] Role badges on cards
   * - [Admin] Role filter buttons
   * - [Admin] Role management & account actions
   */

  import { onMount } from "svelte";
  import { container } from "$lib/shared/di";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { authState } from "$lib/shared/auth/state/authState.svelte.ts";
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
  import {
    ROLE_DISPLAY,
    type UserRole,
  } from "$lib/shared/auth/domain/models/UserRole";
  import UserCard from "./UserCard.svelte";
  import RoleFilterButtons from "./RoleFilterButtons.svelte";

  interface Props {
    /** Title shown in header */
    title?: string;
    /** Icon class for header */
    icon?: string;
    /** Callback when user is selected */
    onUserSelect?: (user: UserProfile) => void;
    /** Optional header slot content */
    headerContent?: import("svelte").Snippet;
  }

  let {
    title = "Browse Users",
    icon = "fa-users",
    onUserSelect,
    headerContent,
  }: Props = $props();

  // State
  let searchQuery = $state("");
  let roleFilter = $state<UserRole | "all">("all");
  let followingInProgress = $state<Set<string>>(new Set());
  let userColors = $state<Map<string, string>>(new Map());
  let users = $state<UserProfile[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  // Services
  const userService = container.items.userRepository;
  const hapticService = container.items.hapticFeedback;

  // Computed
  const currentUserId = $derived(authState.user?.uid);
  const isAdmin = $derived(authState.isAdmin);

  // Filtered users based on search and role filter
  const filteredUsers = $derived.by(() => {
    let result = users;

    // Apply role filter (admin only)
    if (isAdmin && roleFilter !== "all") {
      result = result.filter((user) => user.role === roleFilter);
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (user) =>
          user.username.toLowerCase().includes(query) ||
          user.displayName.toLowerCase().includes(query)
      );
    }

    return result;
  });

  onMount(async () => {
    try {
      await loadUsers();
    } catch (err) {
      console.error("[UserBrowserPanel] Error initializing:", err);
      error = "Failed to load users";
    }
  });

  async function loadUsers() {
    isLoading = true;
    error = null;
    try {
      users = await userService.getUsers(undefined, currentUserId);
    } catch (err) {
      console.error("[UserBrowserPanel] Error loading users:", err);
      error = "Failed to load users";
    } finally {
      isLoading = false;
    }
  }

  function handleUserClick(user: UserProfile) {
    hapticService?.trigger("selection");
    onUserSelect?.(user);
  }

  function getUserColor(user: UserProfile): string {
    const extracted = userColors.get(user.id);
    if (extracted) return extracted;
    return getCachedOrFallbackColor(user.avatar, user.displayName);
  }

  async function handleAvatarLoad(
    user: UserProfile,
    imgElement: HTMLImageElement
  ) {
    if (userColors.has(user.id)) return;
    try {
      const color = await extractDominantColor(user.avatar, user.displayName);
      userColors = new Map(userColors).set(user.id, color);
    } catch {
      // Use fallback
    }
  }

  function handleAvatarError(user: UserProfile, imgElement: HTMLImageElement) {
    imgElement.style.display = "none";
    const fallback = imgElement.nextElementSibling as HTMLElement;
    if (fallback) fallback.style.display = "flex";

    if (!userColors.has(user.id)) {
      const fallbackColor = getCachedOrFallbackColor(
        undefined,
        user.displayName
      );
      userColors = new Map(userColors).set(user.id, fallbackColor);
    }
  }

  async function handleFollowToggle(user: UserProfile) {
    if (!currentUserId || currentUserId === user.id) return;
    if (followingInProgress.has(user.id)) return;

    followingInProgress = new Set([...followingInProgress, user.id]);
    hapticService?.trigger("selection");

    try {
      if (user.isFollowing) {
        await userService.unfollowUser(currentUserId, user.id);
        users = users.map((u) =>
          u.id === user.id
            ? { ...u, isFollowing: false, followerCount: u.followerCount - 1 }
            : u
        );
      } else {
        await userService.followUser(currentUserId, user.id);
        users = users.map((u) =>
          u.id === user.id
            ? { ...u, isFollowing: true, followerCount: u.followerCount + 1 }
            : u
        );
      }
    } catch {
      // Revert handled by UI feedback
    } finally {
      const newSet = new Set(followingInProgress);
      newSet.delete(user.id);
      followingInProgress = newSet;
    }
  }
</script>

<div class="user-browser">
  <div class="content-container">
    <!-- Header -->
    <div class="browser-header">
      {#if headerContent}
        {@render headerContent()}
      {:else}
        <h2 class="panel-title">
          <i class="fas {icon}" aria-hidden="true"></i>
          {title}
        </h2>
      {/if}
    </div>

    <!-- Search + Admin Filters -->
    <div class="controls-row">
      <PanelSearch
        placeholder="Search users..."
        bind:value={searchQuery}
        maxWidth="400px"
      />
      {#if isAdmin}
        <RoleFilterButtons bind:value={roleFilter} />
      {/if}
    </div>

    <PanelContent>
      {#if error}
        <PanelState type="error" title="Error" message={error} />
      {:else if isLoading}
        <PanelState type="loading" message="Loading users..." />
      {:else if filteredUsers.length === 0}
        <PanelState
          type="empty"
          icon="fa-users"
          title="No Users Found"
          message={searchQuery
            ? "No users match your search"
            : "No users found"}
        />
      {:else}
        <PanelGrid minCardWidth="240px" gap="20px">
          {#each filteredUsers as user (user.id)}
            <UserCard
              {user}
              accentColor={getUserColor(user)}
              showRoleBadge={isAdmin}
              showFollowButton={!!currentUserId && currentUserId !== user.id}
              isFollowing={user.isFollowing}
              isFollowLoading={followingInProgress.has(user.id)}
              onclick={() => handleUserClick(user)}
              onAvatarLoad={(img) => handleAvatarLoad(user, img)}
              onAvatarError={(img) => handleAvatarError(user, img)}
              onFollowToggle={() => handleFollowToggle(user)}
            />
          {/each}
        </PanelGrid>
      {/if}
    </PanelContent>
  </div>
</div>

<style>
  .user-browser {
    display: flex;
    justify-content: center;
    width: 100%;
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0 clamp(16px, 4vw, 48px);
  }

  .content-container {
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
    max-width: 1100px;
    padding-bottom: 48px;
  }

  .browser-header {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px 0 8px;
    min-height: 48px;
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

  .controls-row {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }

  @media (max-width: 640px) {
    .controls-row {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>
