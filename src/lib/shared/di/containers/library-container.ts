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
import type { ISharer } from "$lib/shared/share/services/contracts/ISharer";
import type { IVideoUploader } from "$lib/shared/share/services/contracts/IVideoUploader";
import type { IContentModerator } from "$lib/features/moderation/services/contracts/IContentModerator";
import type { IContentAppealManager } from "$lib/features/moderation/services/contracts/IContentAppealManager";
import type { IConflictResolver } from "$lib/shared/offline/services/contracts/IConflictResolver";
import type { IBrowseLoader } from "$lib/features/browse/sequences/display/services/contracts/IBrowseLoader";
import { SequenceContentHasher } from "$lib/features/library/services/implementations/SequenceContentHasher";
import { ArtifactExtractor } from "$lib/features/library/services/implementations/ArtifactExtractor";
import { SoloPropSaveOrchestrator } from "$lib/features/library/services/implementations/SoloPropSaveOrchestrator";
import { handPathRepository } from "$lib/shared/foundation/services/implementations/HandPathRepository";
import { soloPropRepository } from "$lib/shared/foundation/services/implementations/SoloPropRepository";

/**
 * Library Repository dependencies
 */
interface LibraryRepositoryDeps {
  achievementManager: IAchievementManager;
  tagManager: ITagManager;
  orientationCycleDetector: IOrientationCycleDetector;
  conflictResolver?: IConflictResolver;
}

/**
 * Library Save Service dependencies (all optional)
 */
interface LibrarySaveServiceDeps {
  sharer?: ISharer | null;
  videoUploader?: IVideoUploader | null;
  tagManager?: ITagManager | null;
}

/**
 * Public Index Syncer dependencies (content moderation + browse cache)
 */
interface PublicIndexSyncerDeps {
  contentModerator?: IContentModerator;
  contentAppealManager?: IContentAppealManager;
  browseLoader?: IBrowseLoader;
}

/**
 * Creates the library container with required dependencies.
 *
 * @param deps - Dependencies for services that require them
 */
export function createLibraryContainer(deps: {
  libraryRepository: LibraryRepositoryDeps;
  librarySaveService: LibrarySaveServiceDeps;
  publicIndexSyncer?: PublicIndexSyncerDeps;
}) {
  // PublicIndexSyncer is the bridge between a user's private library and the public
  // browse gallery. Every user's sequences live under users/{userId}/sequences — private
  // by default. When a sequence is published, PublicIndexSyncer writes a denormalized
  // copy into the top-level publicSequences collection, which is what the browse gallery
  // reads. When a sequence is unpublished or deleted, it removes that copy so the
  // gallery stays accurate.
  //
  // IMPORTANT: LibraryRepository MUST receive this same instance — do not pass null or
  // create a second instance. Any code path that saves, updates visibility, or deletes
  // a sequence goes through LibraryRepository, which delegates public-index side effects
  // to this syncer. If it's missing, deletions and visibility changes will silently leave
  // ghost entries in the public gallery (or fail outright on delete).
  //
  // Optional content moderation deps (contentModerator, contentAppealManager) gate which
  // sequences are allowed into the public index. They can be omitted in environments
  // where moderation is not needed (e.g. local dev, non-SSR containers).
  const publicIndexSyncer = new PublicIndexSyncer(
    deps.publicIndexSyncer?.contentModerator,
    deps.publicIndexSyncer?.contentAppealManager,
    deps.publicIndexSyncer?.browseLoader
  );

  const contentHasher = new SequenceContentHasher();

  const libraryRepository = new LibraryRepository(
    deps.libraryRepository.achievementManager,
    deps.libraryRepository.tagManager,
    deps.libraryRepository.orientationCycleDetector,
    publicIndexSyncer,
    deps.libraryRepository.conflictResolver,
    contentHasher
  );

  const artifactExtractor = new ArtifactExtractor(handPathRepository, soloPropRepository);

  return createContainer().add({
    publicIndexSyncer: () => publicIndexSyncer,
    collectionManager: () => new CollectionManager(),
    contentHasher: () => contentHasher,
    artifactExtractor: () => artifactExtractor,
    soloPropSaveOrchestrator: () =>
      new SoloPropSaveOrchestrator(soloPropRepository, handPathRepository),
    libraryRepository: () => libraryRepository,
    librarySaveService: () =>
      new LibrarySaveService(
        deps.librarySaveService.sharer ?? null,
        deps.librarySaveService.videoUploader ?? null,
        deps.librarySaveService.tagManager ?? null,
        libraryRepository,
        artifactExtractor
      ),
  });
}

export type LibraryContainer = ReturnType<typeof createLibraryContainer>;
