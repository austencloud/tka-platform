/**
 * Creators Data State
 *
 * Manages cached data for the Creators tab in the Browse module.
 * Supports cursor-based pagination, server-side sorting, and featured creators.
 */

import type { DocumentSnapshot } from "firebase/firestore";
import type { EnhancedUserProfile } from "$lib/shared/community/domain/models/enhanced-user-profile";
import type { CreatorSortCriteria } from "$lib/shared/community/domain/models/enhanced-user-profile";
import type { IUserRepository } from "$lib/shared/community/services/contracts/IUserRepository";

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
  let pageSize = $state(DEFAULT_PAGE_SIZE);

  // Sort state
  let sortBy = $state<CreatorSortCriteria>("lastActive");
  let sortDirection = $state<SortDirection>("desc");

  // Search state
  let searchQuery = $state("");
  let searchResults = $state<EnhancedUserProfile[] | null>(null);
  let isSearching = $state(false);

  // Track if initial load has happened
  let isInitialized = $state(false);

  /**
   * Load initial page of creators with current sort settings
   */
  async function loadCreators(
    repository: IUserRepository,
    currentUserId?: string
  ): Promise<void> {
    // If already loading, skip
    if (isLoading) return;

    isLoading = true;
    error = null;

    try {
      const result = await repository.getUsersPaginated(
        {
          sortBy,
          sortDirection,
          limit: pageSize,
          cursor: null,
        },
        currentUserId
      );

      users = result.users;
      lastDocSnapshot = result.lastDocSnapshot;
      hasMore = result.hasMore;
      isInitialized = true;
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
   * Load next page of creators (append to existing list)
   */
  async function loadMoreCreators(
    repository: IUserRepository,
    currentUserId?: string
  ): Promise<void> {
    // Don't load more if: already loading, no more to load, or no cursor
    if (isLoadingMore || !hasMore || !lastDocSnapshot) return;

    isLoadingMore = true;

    try {
      const result = await repository.getUsersPaginated(
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
    repository: IUserRepository,
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
    await loadCreators(repository, currentUserId);
  }

  /**
   * Load featured creators (separate from main list)
   */
  async function loadFeaturedCreators(
    repository: IUserRepository,
    limit = 8
  ): Promise<void> {
    if (isLoadingFeatured) return;

    isLoadingFeatured = true;

    try {
      featuredUsers = await repository.getFeaturedCreators(limit);
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
    repository: IUserRepository,
    currentUserId?: string
  ): Promise<void> {
    // Reset all state
    users = [];
    lastDocSnapshot = null;
    hasMore = true;
    isInitialized = false;

    // Reload
    await Promise.all([
      loadCreators(repository, currentUserId),
      loadFeaturedCreators(repository),
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

    // Actions
    loadCreators,
    loadMoreCreators,
    changeSortOrder,
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

  // Actions
  loadCreators(repository: IUserRepository, currentUserId?: string) {
    return getCreatorsDataState().loadCreators(repository, currentUserId);
  },
  loadMoreCreators(repository: IUserRepository, currentUserId?: string) {
    return getCreatorsDataState().loadMoreCreators(repository, currentUserId);
  },
  changeSortOrder(
    sortBy: CreatorSortCriteria,
    direction: SortDirection,
    repository: IUserRepository,
    currentUserId?: string
  ) {
    return getCreatorsDataState().changeSortOrder(
      sortBy,
      direction,
      repository,
      currentUserId
    );
  },
  loadFeaturedCreators(repository: IUserRepository, limit?: number) {
    return getCreatorsDataState().loadFeaturedCreators(repository, limit);
  },
  setSearchQuery(query: string) {
    return getCreatorsDataState().setSearchQuery(query);
  },
  clearSearch() {
    return getCreatorsDataState().clearSearch();
  },
  refreshCreators(repository: IUserRepository, currentUserId?: string) {
    return getCreatorsDataState().refreshCreators(repository, currentUserId);
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
