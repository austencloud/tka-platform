/**
 * Library ITI Container
 *
 * Provides services for library management: sequence storage, collections, and public indexing.
 *
 * Note: LibraryRepository and LibrarySaveService have dependencies on other services.
 * These are passed as parameters to the factory functions.
 */

import { createContainer } from "iti";
import { LibraryRepository } from "$lib/features/library/services/implementations/LibraryRepository";
import { LibrarySaveService } from "$lib/features/library/services/implementations/LibrarySaveService";
import { CollectionManager } from "$lib/features/library/services/implementations/CollectionManager";
import { PublicIndexSyncer } from "$lib/features/library/services/implementations/PublicIndexSyncer";
import type { IAchievementManager } from "$lib/shared/gamification/services/contracts/IAchievementManager";
import type { ITagManager } from "$lib/features/library/services/contracts/ITagManager";
import type { IOrientationCycleDetector } from "$lib/features/create/generate/circular/services/contracts/IOrientationCycleDetector";
import type { IPublicIndexSyncer } from "$lib/features/library/services/contracts/IPublicIndexSyncer";
import type { ISharer } from "$lib/shared/share/services/contracts/ISharer";
import type { IFirebaseVideoUploader } from "$lib/shared/share/services/contracts/IFirebaseVideoUploader";

/**
 * Library Repository dependencies
 */
interface LibraryRepositoryDeps {
  achievementManager: IAchievementManager;
  tagManager: ITagManager;
  orientationCycleDetector: IOrientationCycleDetector;
  publicIndexSyncer: IPublicIndexSyncer;
}

/**
 * Library Save Service dependencies (all optional)
 */
interface LibrarySaveServiceDeps {
  sharer?: ISharer | null;
  firebaseVideoUploader?: IFirebaseVideoUploader | null;
  tagManager?: ITagManager | null;
}

/**
 * Creates the library container with required dependencies.
 *
 * @param deps - Dependencies for services that require them
 */
export function createLibraryContainer(deps: {
  libraryRepository: LibraryRepositoryDeps;
  librarySaveService: LibrarySaveServiceDeps;
}) {
  // Create PublicIndexSyncer first since LibraryRepository depends on it
  const publicIndexSyncer = new PublicIndexSyncer();

  return createContainer().add({
    publicIndexSyncer: () => publicIndexSyncer,
    collectionManager: () => new CollectionManager(),
    libraryRepository: () =>
      new LibraryRepository(
        deps.libraryRepository.achievementManager,
        deps.libraryRepository.tagManager,
        deps.libraryRepository.orientationCycleDetector,
        deps.libraryRepository.publicIndexSyncer
      ),
    librarySaveService: () =>
      new LibrarySaveService(
        deps.librarySaveService.sharer ?? null,
        deps.librarySaveService.firebaseVideoUploader ?? null,
        deps.librarySaveService.tagManager ?? null
      ),
  });
}

export type LibraryContainer = ReturnType<typeof createLibraryContainer>;
