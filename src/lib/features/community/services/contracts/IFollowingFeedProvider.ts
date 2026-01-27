/**
 * IFollowingFeedProvider - Following Feed Service Contract
 *
 * Aggregates activity from users that the current user follows.
 * Used by the FollowingFeedWidget to show personalized feed content.
 */

/**
 * A single item in the following feed
 */
export interface FollowingFeedItem {
  /** Unique event ID */
  id: string;

  /** User who performed the action */
  userId: string;
  userDisplayName: string;
  userAvatarUrl?: string;

  /** Type of activity */
  eventType: "sequence_create" | "sequence_favorite" | "achievement_unlock";

  /** When the event occurred */
  timestamp: Date;

  /** Sequence context (for sequence events) */
  sequenceId?: string;
  sequenceWord?: string;
  sequenceThumbnailUrl?: string;

  /** Achievement context (for achievement events) */
  achievementId?: string;
  achievementName?: string;
  achievementIcon?: string;
}

/**
 * Options for fetching the feed
 */
export interface FollowingFeedOptions {
  /** Maximum number of items to return (default: 10) */
  limit?: number;

  /** Only fetch items from the last N days (default: 7) */
  daysBack?: number;

  /** Event types to include (default: all) */
  eventTypes?: FollowingFeedItem["eventType"][];

  /** Optional user ID (for preview mode). If not provided, uses authenticated user. */
  userId?: string;
}

/**
 * Following Feed Service Interface
 */
export interface IFollowingFeedProvider {
  /**
   * Get the following feed for a user
   * Aggregates recent activity from all followed users
   *
   * @param options Feed options (limit, days, event types, userId for preview)
   * @returns Array of feed items sorted by timestamp (newest first)
   */
  getFollowingFeed(
    options?: FollowingFeedOptions
  ): Promise<FollowingFeedItem[]>;

  /**
   * Check if a user follows anyone
   * Used to determine if the feed widget should be shown
   *
   * @param userId Optional user ID (for preview mode). If not provided, uses authenticated user.
   * @returns true if user follows at least one other user
   */
  hasFollowing(userId?: string): Promise<boolean>;

  /**
   * Get the count of users a user follows
   *
   * @param userId Optional user ID (for preview mode). If not provided, uses authenticated user.
   * @returns Number of followed users
   */
  getFollowingCount(userId?: string): Promise<number>;
}
