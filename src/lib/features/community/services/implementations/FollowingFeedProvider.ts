/**
 * FollowingFeedProvider
 *
 * Aggregates activity from users that the current user follows.
 * Queries activity logs and favorites from followed users to build a personalized feed.
 */

import { authState } from "$lib/shared/auth/state/authState.svelte";
import { getFollowing } from "$lib/shared/community/services/user-repository";
import { queryEvents } from "$lib/shared/analytics/services/posthog-activity-logger";
import type {
  FollowingFeedItem, FollowingFeedOptions } from "../contracts/types";
import type { ActivityEvent } from "$lib/shared/analytics/domain/models/ActivityEvent";
import type { UserProfile } from "$lib/shared/community/domain/models/enhanced-user-profile";

export class FollowingFeedProvider {
  async getFollowingFeed(
    options: FollowingFeedOptions = {}
  ): Promise<FollowingFeedItem[]> {
    const { limit = 10, daysBack = 7, eventTypes, userId } = options;

    // Use provided userId (for preview mode) or fall back to authenticated user
    const effectiveUserId = userId || authState.user?.uid;

    if (!effectiveUserId) {
      return [];
    }

    try {
      // Get followed users
      const followedUsers = await getFollowing(effectiveUserId, 100);

      if (followedUsers.length === 0) {
        return [];
      }

      // Build a map of user info for enriching feed items
      const userMap = new Map<string, UserProfile>();
      for (const user of followedUsers) {
        userMap.set(user.id, user);
      }

      // Calculate date cutoff
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      // Collect all feed items from followed users
      const allItems: FollowingFeedItem[] = [];

      // Query activity events from each followed user in parallel
      const activityPromises = followedUsers.map(async (user) => {
        const events = await queryEvents({
          userId: user.id,
          startDate,
          limit: 20, // Get more than we need for filtering
          orderDirection: "desc",
        });

        // Filter to relevant event types
        const relevantEvents = events.filter((event) => {
          const isRelevantType =
            event.eventType === "sequence_create" ||
            event.eventType === "sequence_favorite" ||
            event.eventType === "achievement_unlock";

          if (!isRelevantType) return false;

          // Further filter if specific event types requested
          if (eventTypes && eventTypes.length > 0) {
            return eventTypes.includes(
              event.eventType as FollowingFeedItem["eventType"]
            );
          }

          return true;
        });

        return relevantEvents.map((event) =>
          this.activityEventToFeedItem(event, user)
        );
      });

      const activityResults = await Promise.all(activityPromises);
      for (const items of activityResults) {
        allItems.push(...items);
      }

      // Sort by timestamp (newest first) and limit
      allItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return allItems.slice(0, limit);
    } catch (error) {
      console.error("[FollowingFeedProvider] Error getting feed:", error);
      return [];
    }
  }

  async hasFollowing(userId?: string): Promise<boolean> {
    const count = await this.getFollowingCount(userId);
    return count > 0;
  }

  async getFollowingCount(userId?: string): Promise<number> {
    // Use provided userId (for preview mode) or fall back to authenticated user
    const effectiveUserId = userId || authState.user?.uid;

    if (!effectiveUserId) {
      return 0;
    }

    try {
      const followedUsers = await getFollowing(effectiveUserId, 1);
      return followedUsers.length;
    } catch (error) {
      console.error(
        "[FollowingFeedProvider] Error getting following count:",
        error
      );
      return 0;
    }
  }

  /**
   * Convert an ActivityEvent to a FollowingFeedItem
   */
  private activityEventToFeedItem(
    event: ActivityEvent,
    user: UserProfile
  ): FollowingFeedItem {
    const base: FollowingFeedItem = {
      id: event.id ?? `${event.userId}-${event.timestamp.getTime()}`,
      userId: event.userId,
      userDisplayName: user.displayName || user.username || "Anonymous",
      userAvatarUrl: user.avatar,
      eventType: event.eventType as FollowingFeedItem["eventType"],
      timestamp: event.timestamp,
    };

    // Enrich with metadata based on event type
    if (
      event.eventType === "sequence_create" ||
      event.eventType === "sequence_favorite"
    ) {
      if (event.metadata?.sequenceId) {
        base.sequenceId = event.metadata.sequenceId;
        base.sequenceWord = event.metadata.sequenceWord as string | undefined;
      }
    } else if (event.eventType === "achievement_unlock") {
      if (event.metadata?.achievementId) {
        base.achievementId = event.metadata.achievementId;
        base.achievementName = event.metadata.achievementName as
          | string
          | undefined;
      }
    }

    return base;
  }
}
