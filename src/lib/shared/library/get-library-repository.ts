import { LibraryRepository } from './services/library-repository';
import { getConflictResolver } from '$lib/shared/offline/get-conflict-resolver';
import type { IPublicIndexSyncer } from './services/IPublicIndexSyncer';

let publicIndexSyncerFactory: (() => IPublicIndexSyncer) | null = null;

/**
 * Register the factory that creates PublicIndexSyncer.
 * Called once from features/library at app startup to avoid a reverse import
 * (shared/ must not import from features/).
 */
export function registerPublicIndexSyncerFactory(
  fn: () => IPublicIndexSyncer
): void {
  publicIndexSyncerFactory = fn;
}

let instance: LibraryRepository | null = null;
export function getLibraryRepository(): LibraryRepository {
  if (!publicIndexSyncerFactory) {
    throw new Error(
      "PublicIndexSyncer factory not registered. " +
      "Ensure registerPublicIndexSyncerFactory() is called at app startup."
    );
  }
  return instance ??= new LibraryRepository(
    publicIndexSyncerFactory(),
    getConflictResolver()
  );
}
