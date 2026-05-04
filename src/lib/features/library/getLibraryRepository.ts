
import { LibraryRepository } from './services/implementations/LibraryRepository';
import { getAchievementManager } from '$lib/shared/gamification/getAchievementManager';
import { getOrientationCycleDetector } from '$lib/features/create/generate/circular/getOrientationCycleDetector';
import { getPublicIndexSyncer } from './getPublicIndexSyncer';
import { getConflictResolver } from '$lib/shared/offline/getConflictResolver';

let instance: LibraryRepository | null = null;
export function getLibraryRepository(): LibraryRepository {
  return instance ??= new LibraryRepository(
    getAchievementManager(),
    getOrientationCycleDetector(),
    getPublicIndexSyncer(),
    getConflictResolver()
  );
}
