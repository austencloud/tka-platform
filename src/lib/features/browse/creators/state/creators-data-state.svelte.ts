/**
 * Creators Data State
 *
 * Manages cached data for the Creators tab in the Browse module.
 * Data is cached at module level to prevent reloading on tab switches.
 */

import type { UserProfile } from "$lib/shared/community/domain/models/enhanced-user-profile";
import type { IUserRepository } from "$lib/shared/community/services/contracts/IUserRepository";

function createCreatorsDataState() {
  // Data cache
  let users = $state<UserProfile[]>([]);
  let isLoaded = $state(false);
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  /**
   * Load creators data if not already cached
   */
  async function loadCreators(
    service: IUserRepository,
    currentUserId?: string
  ): Promise<void> {
    // If already loaded, skip
    if (isLoaded) return;

    // If already loading, skip
    if (isLoading) return;

    isLoading = true;
    error = null;

    try {
      const creatorsData = await service.getUsers(undefined, currentUserId);
      users = creatorsData;
      isLoaded = true;
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
   * Force reload creators data (bypasses cache)
   */
  async function refreshCreators(
    service: IUserRepository,
    currentUserId?: string
  ): Promise<void> {
    isLoaded = false;
    await loadCreators(service, currentUserId);
  }

  /**
   * Update a user's follow status (for optimistic updates)
   */
  function updateUserFollowStatus(
    userId: string,
    isFollowing: boolean,
    followerCountDelta: number
  ) {
    users = users.map((u) =>
      u.id === userId
        ? {
            ...u,
            isFollowing,
            followerCount: Math.max(0, u.followerCount + followerCountDelta),
          }
        : u
    );
  }

  return {
    // Data cache
    get users() {
      return users;
    },
    get isLoaded() {
      return isLoaded;
    },
    get isLoading() {
      return isLoading;
    },
    get error() {
      return error;
    },
    loadCreators,
    refreshCreators,
    updateUserFollowStatus,
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
  get users() {
    return getCreatorsDataState().users;
  },
  get isLoaded() {
    return getCreatorsDataState().isLoaded;
  },
  get isLoading() {
    return getCreatorsDataState().isLoading;
  },
  get error() {
    return getCreatorsDataState().error;
  },
  loadCreators(service: IUserRepository, currentUserId?: string) {
    return getCreatorsDataState().loadCreators(service, currentUserId);
  },
  refreshCreators(service: IUserRepository, currentUserId?: string) {
    return getCreatorsDataState().refreshCreators(service, currentUserId);
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
};

export type CreatorsDataState = ReturnType<typeof createCreatorsDataState>;
