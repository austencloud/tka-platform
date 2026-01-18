/**
 * Community ITI Container
 *
 * Provides services for community features: leaderboards, user profiles, following feed, and global user map.
 */

import { createContainer } from "iti";
import { LeaderboardManager } from "$lib/shared/community/services/implementations/LeaderboardManager";
import { UserRepository } from "$lib/shared/community/services/implementations/UserRepository";
import { FollowingFeedProvider } from "$lib/features/dashboard/services/implementations/FollowingFeedProvider";
import { LocationProvider } from "$lib/features/community/services/implementations/LocationProvider";
import { UserLocationRepository } from "$lib/features/community/services/implementations/UserLocationRepository";
import { GeocodingService } from "$lib/features/community/services/implementations/GeocodingService";
import { LocationSharingOrchestrator } from "$lib/features/community/services/implementations/LocationSharingOrchestrator";
import { PUBLIC_GOOGLE_MAPS_API_KEY } from "$env/static/public";

export const communityContainer = createContainer()
  .add({
    leaderboardManager: () => new LeaderboardManager(),
    userRepository: () => new UserRepository(),
    followingFeedProvider: () => new FollowingFeedProvider(),
    locationProvider: () => new LocationProvider(),
    userLocationRepository: () => new UserLocationRepository(),
    geocodingService: () => new GeocodingService(PUBLIC_GOOGLE_MAPS_API_KEY),
  })
  .add((deps) => ({
    locationSharingOrchestrator: () =>
      new LocationSharingOrchestrator(
        deps.locationProvider,
        deps.userLocationRepository,
        deps.geocodingService
      ),
  }));

export type CommunityContainer = typeof communityContainer;
