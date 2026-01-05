/**
 * Pictograph Example Loader
 *
 * Fetches real pictographs from the dataframe for transform examples.
 * Provides random selection for interactive demonstrations.
 */

import { resolve, TYPES } from "$lib/shared/inversify/di";
import type { ILetterQueryHandler } from "$lib/shared/foundation/services/contracts/data/data-contracts";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

// Cache loaded pictographs to avoid repeated fetches
let cachedPictographs: PictographData[] = [];
let loadingPromise: Promise<PictographData[]> | null = null;

/**
 * Load all pictographs from the dataframe (cached)
 */
export async function loadAllPictographs(): Promise<PictographData[]> {
  if (cachedPictographs.length > 0) return cachedPictographs;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      const letterQueryHandler = resolve<ILetterQueryHandler>(
        TYPES.ILetterQueryHandler
      );
      const pictographs = await letterQueryHandler.getAllPictographVariations(
        GridMode.DIAMOND
      );
      // Filter out any invalid pictographs
      cachedPictographs = pictographs.filter(
        (p: PictographData) => p.motions?.blue && p.motions?.red
      );
      return cachedPictographs;
    } catch (error) {
      console.error("Failed to load pictographs:", error);
      return [];
    } finally {
      loadingPromise = null;
    }
  })();

  return loadingPromise;
}

/**
 * Get a random pictograph from the dataframe
 */
export async function getRandomPictograph(): Promise<PictographData | null> {
  const pictographs = await loadAllPictographs();
  if (pictographs.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * pictographs.length);
  return pictographs[randomIndex] ?? null;
}

/**
 * Get multiple random pictographs (non-repeating)
 */
export async function getRandomPictographs(
  count: number
): Promise<PictographData[]> {
  const pictographs = await loadAllPictographs();
  if (pictographs.length === 0) return [];

  const shuffled = [...pictographs].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, pictographs.length));
}

/**
 * Check if pictographs are loaded
 */
export function isPictographsLoaded(): boolean {
  return cachedPictographs.length > 0;
}

/**
 * Get count of available pictographs
 */
export function getPictographCount(): number {
  return cachedPictographs.length;
}

/**
 * Get a random dual-motion pictograph (both hands active)
 * This is essentially the same as getRandomPictograph since we filter for dual-motion
 */
export async function getRandomDualMotionPictograph(): Promise<PictographData | null> {
  return getRandomPictograph();
}
