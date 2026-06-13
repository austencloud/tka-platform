<script lang="ts">
  /**
   * CreatorsPanel (Browse Module)
   * Community creator browser for browsing users
   *
   * Features:
   * - Server-side paginated loading (30 users per page)
   * - Server-side sorting by followers, sequences, level, XP, join date
   * - Featured creators section (pinned at top)
   * - Virtualized grid for smooth scrolling with large lists
   * - Visibility-driven color extraction
   */

  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { onMount, onDestroy } from "svelte";
  import { doc, getDoc } from "firebase/firestore";
  import { followUser, unfollowUser } from "$lib/shared/community/services/user-repository";
  import { getFirestoreInstance } from "$lib/shared/auth/firebase";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import { authState, isEffectiveAdmin } from "$lib/shared/auth/state/auth-state.svelte";
  import { browseNavigationState } from "$lib/shared/browse/state/browse-navigation-state.svelte";
  import { creatorsDataState } from "../state/creators-data-state.svelte";
  import type { EnhancedUserProfile } from "$lib/shared/community/domain/models/enhanced-user-profile";
  import type { CreatorSortCriteria } from "$lib/shared/community/domain/models/enhanced-user-profile";
  import PanelState from "$lib/shared/components/panel/PanelState.svelte";
  import PanelContent from "$lib/shared/components/panel/PanelContent.svelte";
  import PanelSearch from "$lib/shared/components/panel/PanelSearch.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  // New components
  import VirtualizedCreatorGrid from "./VirtualizedCreatorGrid.svelte";
  import FeaturedCreatorsSection from "./FeaturedCreatorsSection.svelte";
  import CreatorsSortBar from "./CreatorsSortBar.svelte";

  let searchQuery = $state("");
  let followingInProgress = $state<Set<string>>(new Set());
  let initError = $state<string | null>(null);

  // Service instances
  let hapticService: HapticFeedback;

  // Get current user ID
  const currentUserId = $derived(authState.user?.uid);

  // Reactive getters from cached state
  const users = $derived(creatorsDataState.users);
  const featuredUsers = $derived(creatorsDataState.featuredUsers);
  const isLoading = $derived(creatorsDataState.isLoading);
  const isLoadingMore = $derived(creatorsDataState.isLoadingMore);
  const isLoadingFeatured = $derived(creatorsDataState.isLoadingFeatured);
  const hasMore = $derived(creatorsDataState.hasMore);
  const error = $derived(creatorsDataState.error);
  const sortBy = $derived(creatorsDataState.sortBy);
  const searchResults = $derived(creatorsDataState.searchResults);
  const isSearching = $derived(creatorsDataState.isSearching);

  // Accounts to hide from public view (test/system accounts)
  // Admins can still see these accounts
  // NOTE: Email-based filtering removed for privacy - use usernames only
  const HIDDEN_USERNAMES = [
    "netsua07",
    "flowtacocat",
    "tka.flowarts",
    "cirqueaflame_603",
    "tkascribe.review", // Previously filtered by email
  ];

  // Check if effective user is admin (respects preview mode)
  const isAdmin = $derived(isEffectiveAdmin());

  // Filter hidden accounts from user lists
  function filterHiddenAccounts(userList: EnhancedUserProfile[]): EnhancedUserProfile[] {
    if (isAdmin) return userList;
    return userList.filter((user) => !HIDDEN_USERNAMES.includes(user.username));
  }

  // Get display users - either search results or paginated list (filtered)
  const displayUsers = $derived.by(() => {
    const baseList = searchResults !== null ? searchResults : users;
    return filterHiddenAccounts(baseList);
  });

  // Featured users (filtered)
  const displayFeaturedUsers = $derived(filterHiddenAccounts(featuredUsers));

  // Debounce timer for search
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  onMount(async () => {
    try {
      hapticService = getHapticFeedback();

      // Load creators data if not already initialized
      if (!creatorsDataState.isInitialized) {
        await Promise.all([
          creatorsDataState.loadCreators(currentUserId),
          creatorsDataState.loadFeaturedCreators(),
        ]);
      } else if (currentUserId && !creatorsDataState.hasFollowState) {
        // The prefetch at app boot loaded creators before auth was ready,
        // so all isFollowing flags are false. Reload with the real userId
        // to get accurate follow state.
        await creatorsDataState.refreshCreators(currentUserId);
      }

      // Patch the current user's sequenceCount from the latest Firestore cache.
      // The creators list is cached, but a recent save updates the user doc
      // in the local Firestore cache. One getDoc refreshes the stale card.
      if (currentUserId) {
        void refreshCurrentUserCount(currentUserId);
      }
    } catch (err) {
      console.error("[CreatorsPanel] Error loading creators:", err);
      initError = "Failed to load creators. Please try again.";
    }
  });

  async function refreshCurrentUserCount(uid: string) {
    try {
      const firestore = await getFirestoreInstance();
      const snap = await getDoc(doc(firestore, `users/${uid}`));
      if (!snap.exists()) return;
      const freshCount = (snap.data().sequenceCount as number) ?? 0;
      creatorsDataState.patchUser(uid, { sequenceCount: freshCount });
    } catch {
      // Non-critical - the list still works with the cached value
    }
  }

  onDestroy(() => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  });

  function handleUserClick(user: EnhancedUserProfile) {
    hapticService?.trigger("selection");
    // Navigate to user profile using unified navigation state
    browseNavigationState.viewCreatorProfile(user.id, user.displayName);
  }

  async function handleFollowToggle(user: EnhancedUserProfile) {
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
        await unfollowUser(currentUserId, user.id);
        // Optimistic update via cached state
        creatorsDataState.updateUserFollowStatus(user.id, false, -1);
      } else {
        await followUser(currentUserId, user.id);
        // Optimistic update via cached state
        creatorsDataState.updateUserFollowStatus(user.id, true, 1);
      }
    } catch (err) {
      console.error("[CreatorsPanel] Follow toggle failed, reverting:", err);
      // Revert the optimistic update. The failure is already surfaced to the
      // user: followUser/unfollowUser in user-repository toast
      // "Failed to follow/unfollow user. Please try again." before throwing,
      // so a second toast here would duplicate it.
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

  function handleSearchInput(value: string) {
    searchQuery = value;

    // Debounce search by 300ms
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }

    searchDebounceTimer = setTimeout(() => {
      creatorsDataState.setSearchQuery(value);
    }, 300);
  }

  async function handleSortChange(newSortBy: CreatorSortCriteria) {
    hapticService?.trigger("selection");
    await creatorsDataState.changeSortOrder(
      newSortBy,
      "desc",
      currentUserId
    );
  }

  function handleLoadMore() {
    creatorsDataState.loadMoreCreators(currentUserId);
  }
</script>

<div class="creators-panel">
  <div class="content-container">
    <!-- Header -->
    <div class="creators-topbar">
      <div class="header-section">
        <h2 class="panel-title">
          <i class="fas fa-users" aria-hidden="true"></i>
          {t("browse_creators_title")}
        </h2>
      </div>
    </div>

    <!-- Search + Sort row -->
    <div class="search-sort-row">
      <PanelSearch
        placeholder={t("browse_search_creators")}
        value={searchQuery}
        oninput={handleSearchInput}
        maxWidth="none"
      />
      {#if !searchResults}
        <CreatorsSortBar {sortBy} onSortChange={handleSortChange} />
      {/if}
    </div>

    <PanelContent>
      {#if initError}
        <PanelState type="error" title="Initialization Error" message={initError} />
      {:else if error}
        <PanelState type="error" title={t("browse_error")} message={error} />
      {:else if isLoading && !creatorsDataState.isInitialized}
        <PanelState type="loading" message={t("browse_loading_creators")} />
      {:else if isSearching}
        <PanelState type="loading" message="Searching..." />
      {:else if displayUsers.length === 0}
        <PanelState
          type="empty"
          icon="fa-users"
          title={t("browse_no_creators")}
          message={searchQuery
            ? t("browse_no_match")
            : t("browse_no_members")}
        />
      {:else}
        <!-- Featured creators section (only show when not searching) -->
        {#if !searchResults && displayFeaturedUsers.length > 0}
          <FeaturedCreatorsSection
            users={displayFeaturedUsers}
            {sortBy}
            {currentUserId}
            {followingInProgress}
            onUserClick={handleUserClick}
            onFollowToggle={handleFollowToggle}
            isLoading={isLoadingFeatured}
          />
        {/if}

        <!-- Main virtualized grid -->
        <VirtualizedCreatorGrid
          users={displayUsers}
          {sortBy}
          {currentUserId}
          {followingInProgress}
          hasMore={!searchResults && hasMore}
          {isLoadingMore}
          onUserClick={handleUserClick}
          onFollowToggle={handleFollowToggle}
          onLoadMore={handleLoadMore}
        />
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
    overflow: hidden;
    /* Generous responsive padding */
    padding: 0 clamp(16px, 4vw, 48px);
  }

  /* Centered content container - everything aligns to same width */
  .content-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
    max-width: 1100px;
    height: 100%;
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
    color: var(--theme-text, rgba(255, 255, 255, 0.95));
  }

  .panel-title i {
    font-size: var(--font-size-lg);
    color: var(--theme-text-dim);
  }

  /* Search + Sort row - aligned with grid cards */
  .search-sort-row {
    display: flex;
    align-items: center;
    gap: 12px;
    /* Left: PanelContent (20px) + virtual-row (4px) = 24px
       Right: Same + scrollbar (8px) = 32px */
    padding: 0 32px 0 24px;
  }

  .search-sort-row :global(.panel-search) {
    flex: 1;
    max-width: none;
    padding: 0;
  }

  /* Fix icon position when padding removed */
  .search-sort-row :global(.panel-search__icon) {
    left: 12px;
  }

  /* ============================================================================
     RESPONSIVE
     ============================================================================ */
  @media (max-width: 640px) {
    .creators-panel {
      padding: 0 12px;
    }

    .content-container {
      gap: 12px;
    }

    /* The bottom-nav tab already labels this view "Creators" - the title
       row is pure redundancy on mobile, where vertical space is tightest */
    .creators-topbar {
      display: none;
    }

    .search-sort-row {
      flex-direction: column;
      gap: 8px;
      padding: 12px 16px 0;
    }

    .search-sort-row :global(.panel-search) {
      width: 100%;
    }
  }
</style>
