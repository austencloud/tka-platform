/**
 * Community ITI Container
 *
 * Provides services for community features: leaderboards, user profiles, and following feed.
 */

import { createContainer } from "iti";
import { LeaderboardManager } from "$lib/shared/community/services/implementations/LeaderboardManager";
import { UserRepository } from "$lib/shared/community/services/implementations/UserRepository";
import { FollowingFeedProvider } from "$lib/features/dashboard/services/implementations/FollowingFeedProvider";

export const communityContainer = createContainer().add({
  leaderboardManager: () => new LeaderboardManager(),
  userRepository: () => new UserRepository(),
  followingFeedProvider: () => new FollowingFeedProvider(),
});

export type CommunityContainer = typeof communityContainer;
