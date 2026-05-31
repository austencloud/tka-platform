/**
 * Creators Data State
 *
 * Manages cached data for the Creators tab in the Browse module.
 * Supports cursor-based pagination, server-side sorting, and featured creators.
 */

import type { DocumentSnapshot } from "firebase/firestore";
import type { EnhancedUserProfile } from "$lib/shared/community/domain/models/enhanced-user-profile";
import type { CreatorSortCriteria } from "$lib/shared/community/domain/models/enhanced-user-profile";
import { getUsersPaginated, getFeaturedCreators } from "$lib/shared/community/services/user-repository";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

const DEFAULT_PAGE_SIZE = 30;

export type SortDirection = "asc" | "desc";

function createCreatorsDataState() {
  // Main user list (paginated)
  let users = $state<EnhancedUserProfile[]>([]);

  // Featured users (separate fetch, pinned at top)
  let featuredUsers = $state<EnhancedUserProfile[]>([]);

  // Loading states
  let isLoading = $state(false);
  let isLoadingMore = $state(false);
  let isLoadingFeatured = $state(false);
  let error = $state<string | null>(null);

  // Pagination state
  let hasMore = $state(true);
  let lastDocSnapshot = $state<DocumentSnapshot | null>(null);
  const pageSize = $state(DEFAULT_PAGE_SIZE);

  // Sort state
  let sortBy = $state<CreatorSortCriteria>("lastActive");
  let sortDirection = $state<SortDirection>("desc");

  // Search state
  let searchQuery = $state("");
  let searchResults = $state<EnhancedUserProfile[] | null>(null);
  let isSearching = $state(false);

  // Prop filter state (multi-select)
  let selectedPropFilters = $state<PropType[]>([]);

  // Cached userId so togglePropFilter can reload without needing the caller
  // to pass userId again on every filter change.
  let cachedCurrentUserId: string | undefined = undefined;

  // Track if initial load has happened
  let isInitialized = $state(false);

  // Track whether the cached data includes follow state (loaded with a userId).
  // When the prefetch runs before auth is ready, this stays false and the
  // CreatorsPanel knows to reload with the real userId once auth is available.
  let hasFollowState = $state(false);

  /**
   * Group creators by their favoriteProp field.
   *
   * Creators who have set a favorite prop come first, sorted alphabetically
   * by prop name so the same prop types cluster together. Those with no
   * favorite prop fall to the bottom in whatever order they arrived.
   */
  function groupByFavoriteProp(
    results: EnhancedUserProfile[]
  ): EnhancedUserProfile[] {
    const withFav = results.filter((u) => u.favoriteProp);
    const withoutFav = results.filter((u) => !u.favoriteProp);

    withFav.sort((a, b) => {
      const aProp = a.favoriteProp ?? "";
      const bProp = b.favoriteProp ?? "";
      return aProp.localeCompare(bProp);
    });

    return [...withFav, ...withoutFav];
  }

  /**
   * Load initial page of creators with current sort settings.
   *
   * When sortBy is "favoriteProp" we fetch all creators in one shot using a
   * neutral server sort and apply the grouping client-side. Cursor-based
   * pagination doesn't compose with a client-side reorder, so "group by prop"
   * loads the full set and disables the "load more" path.
   */
  async function loadCreators(
    currentUserId?: string
  ): Promise<void> {
    // If already loading, skip
    if (isLoading) return;

    // Cache for use by togglePropFilter, which needs to reload without
    // requiring the caller to pass userId again.
    cachedCurrentUserId = currentUserId;

    isLoading = true;
    error = null;

    // Prop filter applied to all query branches when active.
    const propFilter =
      selectedPropFilters.length > 0 ? selectedPropFilters : undefined;

    try {
      if (sortBy === "favoriteProp") {
        // Fetch all creators with a neutral sort, then group client-side.
        // We use a generous limit (1000) - typical creator counts are well
        // below this, and grouping only makes sense when you can see all groups.
        const result = await getUsersPaginated(
          {
            sortBy: "lastActive",
            sortDirection: "desc",
            limit: 1000,
            cursor: null,
            ...(propFilter ? { propFilter } : {}),
          },
          currentUserId
        );

        users = groupByFavoriteProp(result.users);
        lastDocSnapshot = null;
        hasMore = false; // Pagination disabled for grouped view
      } else {
        const result = await getUsersPaginated(
          {
            sortBy,
            sortDirection,
            limit: pageSize,
            cursor: null,
            ...(propFilter ? { propFilter } : {}),
          },
          currentUserId
        );

        users = result.users;
        lastDocSnapshot = result.lastDocSnapshot;
        hasMore = result.hasMore;
      }

      isInitialized = true;
      hasFollowState = !!currentUserId;
    } catch (err) {
      console.error("[CreatorsDataState] Failed to load creators:", err);
      error =
        err instanceof Error
          ? err.message
          : "Failed to load creators. Please try again.";
    } finally {
      isLoading = false;
    }
  }

  /**
   * Load next page of creators (append to existing list).
   * Not used when sortBy is "favoriteProp" - that view loads all at once.
   */
  async function loadMoreCreators(
    currentUserId?: string
  ): Promise<void> {
    // Don't load more if: already loading, no more to load, no cursor,
    // or we're in the grouped view which doesn't paginate
    if (isLoadingMore || !hasMore || !lastDocSnapshot) return;

    isLoadingMore = true;

    try {
      const result = await getUsersPaginated(
        {
          sortBy,
          sortDirection,
          limit: pageSize,
          cursor: lastDocSnapshot,
        },
        currentUserId
      );

      // Append new users to existing list
      users = [...users, ...result.users];
      lastDocSnapshot = result.lastDocSnapshot;
      hasMore = result.hasMore;
    } catch (err) {
      console.error("[CreatorsDataState] Failed to load more creators:", err);
      // Don't set error state for pagination failures - just log
    } finally {
      isLoadingMore = false;
    }
  }

  /**
   * Change sort order and reload from beginning
   */
  async function changeSortOrder(
    newSortBy: CreatorSortCriteria,
    newDirection: SortDirection,
    currentUserId?: string
  ): Promise<void> {
    // Update sort state
    sortBy = newSortBy;
    sortDirection = newDirection;

    // Reset pagination
    users = [];
    lastDocSnapshot = null;
    hasMore = true;

    // Reload with new sort
    await loadCreators(currentUserId);
  }

  /**
   * Toggle a prop filter on or off, then reload from the first page.
   *
   * Uses the cached repository from the most recent loadCreators call so the
   * caller doesn't need to pass it again on every chip tap.
   */
  async function togglePropFilter(prop: PropType): Promise<void> {
    if (selectedPropFilters.includes(prop)) {
      selectedPropFilters = selectedPropFilters.filter((p) => p !== prop);
    } else {
      selectedPropFilters = [...selectedPropFilters, prop];
    }

    // Reset pagination so we fetch from the start with the new filter set.
    users = [];
    lastDocSnapshot = null;
    hasMore = true;

    await loadCreators(cachedCurrentUserId);
  }

  /**
   * Load featured creators (separate from main list)
   */
  async function loadFeaturedCreators(
    limit = 8
  ): Promise<void> {
    if (isLoadingFeatured) return;

    isLoadingFeatured = true;

    try {
      featuredUsers = await getFeaturedCreators(limit);
    } catch (err) {
      console.error("[CreatorsDataState] Failed to load featured creators:", err);
      // Don't set error state - featured section is optional
      featuredUsers = [];
    } finally {
      isLoadingFeatured = false;
    }
  }

  /**
   * Search creators (client-side fuzzy search for now)
   * TODO: Replace with server-side Algolia search for scale
   */
  function setSearchQuery(query: string) {
    searchQuery = query;

    if (!query.trim()) {
      // Clear search results to show paginated list
      searchResults = null;
      isSearching = false;
      return;
    }

    isSearching = true;

    // Client-side fuzzy search on current users
    // This is temporary until Algolia is integrated
    const normalizedQuery = query.toLowerCase();
    const terms = normalizedQuery.split(/\s+/).filter(Boolean);

    const filtered = users.filter((user) => {
      const searchableText =
        `${user.username} ${user.displayName}`.toLowerCase();
      return terms.every((term) => searchableText.includes(term));
    });

    searchResults = filtered;
    isSearching = false;
  }

  /**
   * Clear search and return to paginated list
   */
  function clearSearch() {
    searchQuery = "";
    searchResults = null;
    isSearching = false;
  }

  /**
   * Force refresh all data
   */
  async function refreshCreators(
    currentUserId?: string
  ): Promise<void> {
    // Reset all state
    users = [];
    lastDocSnapshot = null;
    hasMore = true;
    isInitialized = false;

    // Reload
    await Promise.all([
      loadCreators(currentUserId),
      loadFeaturedCreators(),
    ]);
  }

  /**
   * Update a user's follow status (for optimistic updates)
   */
  function updateUserFollowStatus(
    userId: string,
    isFollowing: boolean,
    followerCountDelta: number
  ) {
    // Update in main list
    users = users.map((u) =>
      u.id === userId
        ? {
            ...u,
            isFollowing,
            followerCount: Math.max(0, u.followerCount + followerCountDelta),
          }
        : u
    );

    // Update in featured list
    featuredUsers = featuredUsers.map((u) =>
      u.id === userId
        ? {
            ...u,
            isFollowing,
            followerCount: Math.max(0, u.followerCount + followerCountDelta),
          }
        : u
    );

    // Update in search results if active
    if (searchResults) {
      searchResults = searchResults.map((u) =>
        u.id === userId
          ? {
              ...u,
              isFollowing,
              followerCount: Math.max(0, u.followerCount + followerCountDelta),
            }
          : u
      );
    }
  }

  /**
   * Patch any fields on a cached user entry (all lists: main, featured, search).
   * Used for reconciling stale denormalized fields like sequenceCount.
   */
  function patchUser(userId: string, patch: Partial<EnhancedUserProfile>) {
    const apply = (u: EnhancedUserProfile) =>
      u.id === userId ? { ...u, ...patch } : u;
    users = users.map(apply);
    featuredUsers = featuredUsers.map(apply);
    if (searchResults) {
      searchResults = searchResults.map(apply);
    }
  }

  return {
    // Data
    get users() {
      return users;
    },
    get featuredUsers() {
      return featuredUsers;
    },

    // Loading states
    get isLoading() {
      return isLoading;
    },
    get isLoadingMore() {
      return isLoadingMore;
    },
    get isLoadingFeatured() {
      return isLoadingFeatured;
    },
    get error() {
      return error;
    },
    get isInitialized() {
      return isInitialized;
    },
    get hasFollowState() {
      return hasFollowState;
    },

    // Pagination
    get hasMore() {
      return hasMore;
    },
    get pageSize() {
      return pageSize;
    },

    // Sort state
    get sortBy() {
      return sortBy;
    },
    get sortDirection() {
      return sortDirection;
    },

    // Search state
    get searchQuery() {
      return searchQuery;
    },
    get searchResults() {
      return searchResults;
    },
    get isSearching() {
      return isSearching;
    },

    // Prop filter state
    get selectedPropFilters() {
      return selectedPropFilters;
    },

    // Actions
    loadCreators,
    loadMoreCreators,
    changeSortOrder,
    togglePropFilter,
    loadFeaturedCreators,
    setSearchQuery,
    clearSearch,
    refreshCreators,
    updateUserFollowStatus,
    patchUser,
  };
}

// Module singleton instance
let creatorsDataStateInstance: ReturnType<
  typeof createCreatorsDataState
> | null = null;

/**
 * Get the creators data state singleton
 */
function getCreatorsDataState() {
  if (!creatorsDataStateInstance) {
    creatorsDataStateInstance = createCreatorsDataState();
  }
  return creatorsDataStateInstance;
}

// Export a proxy that delegates to the singleton
export const creatorsDataState = {
  // Data
  get users() {
    return getCreatorsDataState().users;
  },
  get featuredUsers() {
    return getCreatorsDataState().featuredUsers;
  },

  // Loading states
  get isLoading() {
    return getCreatorsDataState().isLoading;
  },
  get isLoadingMore() {
    return getCreatorsDataState().isLoadingMore;
  },
  get isLoadingFeatured() {
    return getCreatorsDataState().isLoadingFeatured;
  },
  get error() {
    return getCreatorsDataState().error;
  },
  get isInitialized() {
    return getCreatorsDataState().isInitialized;
  },
  get hasFollowState() {
    return getCreatorsDataState().hasFollowState;
  },

  // Pagination
  get hasMore() {
    return getCreatorsDataState().hasMore;
  },
  get pageSize() {
    return getCreatorsDataState().pageSize;
  },

  // Sort state
  get sortBy() {
    return getCreatorsDataState().sortBy;
  },
  get sortDirection() {
    return getCreatorsDataState().sortDirection;
  },

  // Search state
  get searchQuery() {
    return getCreatorsDataState().searchQuery;
  },
  get searchResults() {
    return getCreatorsDataState().searchResults;
  },
  get isSearching() {
    return getCreatorsDataState().isSearching;
  },

  // Prop filter state
  get selectedPropFilters() {
    return getCreatorsDataState().selectedPropFilters;
  },

  // Actions
  loadCreators(currentUserId?: string) {
    return getCreatorsDataState().loadCreators(currentUserId);
  },
  loadMoreCreators(currentUserId?: string) {
    return getCreatorsDataState().loadMoreCreators(currentUserId);
  },
  changeSortOrder(
    sortBy: CreatorSortCriteria,
    direction: SortDirection,
    currentUserId?: string
  ) {
    return getCreatorsDataState().changeSortOrder(
      sortBy,
      direction,
      currentUserId
    );
  },
  togglePropFilter(prop: PropType) {
    return getCreatorsDataState().togglePropFilter(prop);
  },
  loadFeaturedCreators(limit?: number) {
    return getCreatorsDataState().loadFeaturedCreators(limit);
  },
  setSearchQuery(query: string) {
    return getCreatorsDataState().setSearchQuery(query);
  },
  clearSearch() {
    return getCreatorsDataState().clearSearch();
  },
  refreshCreators(currentUserId?: string) {
    return getCreatorsDataState().refreshCreators(currentUserId);
  },
  updateUserFollowStatus(
    userId: string,
    isFollowing: boolean,
    followerCountDelta: number
  ) {
    getCreatorsDataState().updateUserFollowStatus(
      userId,
      isFollowing,
      followerCountDelta
    );
  },
  patchUser(userId: string, patch: Partial<EnhancedUserProfile>) {
    getCreatorsDataState().patchUser(userId, patch);
  },
};

export type CreatorsDataState = ReturnType<typeof createCreatorsDataState>;
