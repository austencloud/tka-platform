/**
 * IUserRepository
 * Service contract for user profiles with social features (follow/unfollow)
 */

import type {
  EnhancedUserProfile,
  UserProfile,
  CreatorQueryOptions,
} from "../../domain/models/enhanced-user-profile";

export interface IUserRepository {
  /**
   * Get enhanced user profile by ID
   * @param userId - The user ID to fetch
   * @param currentUserId - Optional current user ID to check follow status
   */
  getUserProfile(
    userId: string,
    currentUserId?: string
  ): Promise<EnhancedUserProfile | null>;

  /**
   * Get multiple enhanced user profiles (for creator browsing)
   * @param options - Query options for filtering/sorting
   * @param currentUserId - Optional current user ID to check follow status
   */
  getUsers(
    options?: CreatorQueryOptions,
    currentUserId?: string
  ): Promise<EnhancedUserProfile[]>;

  /**
   * Get featured creators
   */
  getFeaturedCreators(limit?: number): Promise<EnhancedUserProfile[]>;

  /**
   * Subscribe to enhanced user profiles (for creator browsing)
   * @param callback - Callback to receive updated users
   * @param options - Query options
   * @param currentUserId - Optional current user ID to check follow status
   */
  subscribeToUsers(
    callback: (users: EnhancedUserProfile[]) => void,
    options?: CreatorQueryOptions,
    currentUserId?: string
  ): () => void;

  // ============================================================================
  // FOLLOW FUNCTIONALITY
  // ============================================================================

  /**
   * Follow a user
   * Creates follow relationship and updates denormalized counts
   * @param currentUserId - The user doing the following
   * @param targetUserId - The user being followed
   */
  followUser(currentUserId: string, targetUserId: string): Promise<void>;

  /**
   * Unfollow a user
   * Removes follow relationship and updates denormalized counts
   * @param currentUserId - The user doing the unfollowing
   * @param targetUserId - The user being unfollowed
   */
  unfollowUser(currentUserId: string, targetUserId: string): Promise<void>;

  /**
   * Check if a user is following another user
   * @param currentUserId - The potential follower
   * @param targetUserId - The potential followee
   */
  isFollowing(currentUserId: string, targetUserId: string): Promise<boolean>;

  /**
   * Get list of users that a user is following
   * @param userId - The user whose following list to fetch
   * @param limit - Maximum number of users to return
   */
  getFollowing(userId: string, limit?: number): Promise<UserProfile[]>;

  /**
   * Get list of users following a user
   * @param userId - The user whose followers to fetch
   * @param limit - Maximum number of users to return
   */
  getFollowers(userId: string, limit?: number): Promise<UserProfile[]>;

  /**
   * Subscribe to follow status changes for a specific user relationship
   * @param currentUserId - The potential follower
   * @param targetUserId - The potential followee
   * @param callback - Callback to receive follow status updates
   * @returns Unsubscribe function
   */
  subscribeToFollowStatus(
    currentUserId: string,
    targetUserId: string,
    callback: (isFollowing: boolean) => void
  ): () => void;
}
