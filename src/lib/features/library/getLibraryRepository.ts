import type { ILibraryRepository } from './services/contracts/ILibraryRepository';
import { LibraryRepository } from './services/implementations/LibraryRepository';
import { getAchievementManager } from '$lib/shared/gamification/getAchievementManager';
import { getTagManager } from './getTagManager';
import { getOrientationCycleDetector } from '$lib/features/create/generate/circular/getOrientationCycleDetector';
import { getPublicIndexSyncer } from './getPublicIndexSyncer';
import { getConflictResolver } from '$lib/shared/offline/getConflictResolver';
import { getSequenceContentHasher } from './getSequenceContentHasher';

let instance: ILibraryRepository | null = null;
export function getLibraryRepository(): ILibraryRepository {
  return instance ??= new LibraryRepository(
    getAchievementManager(),
    getTagManager(),
    getOrientationCycleDetector(),
    getPublicIndexSyncer(),
    getConflictResolver(),
    getSequenceContentHasher()
  );
}
