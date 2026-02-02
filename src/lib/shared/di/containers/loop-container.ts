/**
 * LOOP Container - ITI Implementation
 *
 * Provides services for LOOP preset management and social discovery.
 * Includes preset repository, popularity aggregation, and following loader.
 */

import { createContainer } from "iti";
import { LOOPPresetRepository } from "$lib/features/create/generate/shared/services/implementations/LOOPPresetRepository";
import { LOOPPopularityAggregator } from "$lib/features/create/generate/shared/services/implementations/LOOPPopularityAggregator";
import { LOOPFollowingLoader } from "$lib/features/create/generate/shared/services/implementations/LOOPFollowingLoader";
import type { IUserRepository } from "$lib/shared/community/services/contracts/IUserRepository";

/**
 * Dependencies required from other containers
 */
export interface LOOPContainerDeps {
  userRepository: IUserRepository;
}

/**
 * Create the LOOP container
 *
 * @param deps - Dependencies from other containers
 */
export function createLOOPContainer(deps: LOOPContainerDeps) {
  return createContainer()
    .add({
      // LOOP preset repository for user-created presets
      // Services get Firestore lazily to avoid SSR issues
      loopPresetRepository: () => new LOOPPresetRepository(),

      // LOOP popularity aggregator for trending data
      loopPopularityAggregator: () => new LOOPPopularityAggregator(),
    })
    .add(() => ({
      // LOOP following loader for social presets
      loopFollowingLoader: () => new LOOPFollowingLoader(deps.userRepository),
    }));
}

export type LOOPContainer = ReturnType<typeof createLOOPContainer>;
