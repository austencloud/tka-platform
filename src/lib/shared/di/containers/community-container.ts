/**
 * Community ITI Container
 *
 * Provides services for community features: leaderboards, user profiles, following feed, and global user map.
 */

import { createContainer } from "iti";
import { LeaderboardManager } from "$lib/shared/community/services/implementations/LeaderboardManager";
import { UserRepository } from "$lib/shared/community/services/implementations/UserRepository";
import { ConnectionManager } from "$lib/shared/community/services/implementations/ConnectionManager";
import { UserSearcher } from "$lib/shared/user-search/services/implementations/UserSearcher";
import { FollowingFeedProvider } from "$lib/features/community/services/implementations/FollowingFeedProvider";
import { LocationProvider } from "$lib/features/community/services/implementations/LocationProvider";
import { UserLocationRepository } from "$lib/features/community/services/implementations/UserLocationRepository";
import { GeocodingService } from "$lib/features/community/services/implementations/GeocodingService";
import { LocationSharingOrchestrator } from "$lib/features/community/services/implementations/LocationSharingOrchestrator";
import { PropPreferencePersister } from "$lib/shared/community/services/implementations/PropPreferencePersister";
import { PresentationResolver } from "$lib/shared/sequence-viewer/services/implementations/PresentationResolver";
import { CreatorPropFilter } from "$lib/features/browse/creators/services/implementations/CreatorPropFilter";
import { FavoriteConfigRepository } from "$lib/features/create/generate/services/implementations/FavoriteConfigRepository";
import { env } from "$env/dynamic/public";

export const communityContainer = createContainer()
  .add({
    leaderboardManager: () => new LeaderboardManager(),
    userRepository: () => new UserRepository(),
    connectionManager: () => new ConnectionManager(),
    userSearcher: () => new UserSearcher(),
    followingFeedProvider: () => new FollowingFeedProvider(),
    locationProvider: () => new LocationProvider(),
    userLocationRepository: () => new UserLocationRepository(),
    geocodingService: () => new GeocodingService(env.PUBLIC_GOOGLE_MAPS_API_KEY ?? ""),
    propPreferencePersister: () => new PropPreferencePersister(),
    favoriteConfigRepository: () => new FavoriteConfigRepository(),
presentationResolver: () => new PresentationResolver(),
    creatorPropFilter: () => new CreatorPropFilter(),
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
