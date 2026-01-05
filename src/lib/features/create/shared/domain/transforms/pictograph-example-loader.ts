/**
 * Pictograph Example Loader
 *
 * Fetches real pictographs from the dataframe for transform examples.
 * Provides random selection with transform-specific filtering to ensure
 * the selected example will show a visible change when transformed.
 */

import { resolve, TYPES } from "$lib/shared/inversify/di";
import type { ILetterQueryHandler } from "$lib/shared/foundation/services/contracts/data/data-contracts";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import { GridMode, GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export type TransformId = "mirror" | "flip" | "invert" | "rotate" | "swap" | "rewind";

// Cache loaded pictographs to avoid repeated fetches
let cachedPictographs: PictographData[] = [];
let loadingPromise: Promise<PictographData[]> | null = null;

// Locations with east/west components (Mirror needs these)
const EW_LOCATIONS = new Set([
  GridLocation.EAST,
  GridLocation.WEST,
  GridLocation.NORTHEAST,
  GridLocation.NORTHWEST,
  GridLocation.SOUTHEAST,
  GridLocation.SOUTHWEST,
]);

// Locations with north/south components (Flip needs these)
const NS_LOCATIONS = new Set([
  GridLocation.NORTH,
  GridLocation.SOUTH,
  GridLocation.NORTHEAST,
  GridLocation.NORTHWEST,
  GridLocation.SOUTHEAST,
  GridLocation.SOUTHWEST,
]);

/**
 * Check if a motion has E/W components (for Mirror visibility)
 */
function hasEastWestComponent(motion: MotionData): boolean {
  return EW_LOCATIONS.has(motion.startLocation) || EW_LOCATIONS.has(motion.endLocation);
}

/**
 * Check if a motion has N/S components (for Flip visibility)
 */
function hasNorthSouthComponent(motion: MotionData): boolean {
  return NS_LOCATIONS.has(motion.startLocation) || NS_LOCATIONS.has(motion.endLocation);
}

/**
 * Check if a motion has rotation (for Invert visibility)
 */
function hasRotation(motion: MotionData): boolean {
  return motion.rotationDirection === RotationDirection.CLOCKWISE ||
         motion.rotationDirection === RotationDirection.COUNTER_CLOCKWISE;
}

/**
 * Check if a motion moves (start ≠ end, for Rewind visibility)
 */
function hasMovement(motion: MotionData): boolean {
  return motion.startLocation !== motion.endLocation;
}

/**
 * Filter pictographs suitable for a specific transform
 */
function filterForTransform(pictographs: PictographData[], transformId: TransformId): PictographData[] {
  return pictographs.filter(p => {
    const blue = p.motions?.blue;
    const red = p.motions?.red;
    if (!blue || !red) return false;

    switch (transformId) {
      case "mirror":
        // Need E/W components so mirror produces visible change
        return hasEastWestComponent(blue) || hasEastWestComponent(red);

      case "flip":
        // Need N/S components so flip produces visible change
        return hasNorthSouthComponent(blue) || hasNorthSouthComponent(red);

      case "invert":
        // Need rotation so invert produces visible change
        return hasRotation(blue) || hasRotation(red);

      case "rewind":
        // Need movement so rewind produces visible change
        return hasMovement(blue) || hasMovement(red);

      case "rotate":
        // Rotate always produces visible change
        return true;

      case "swap":
        // Swap always produces visible change (colors switch)
        // But filter out symmetric patterns where blue and red are identical
        return blue.startLocation !== red.startLocation ||
               blue.endLocation !== red.endLocation ||
               blue.rotationDirection !== red.rotationDirection;

      default:
        return true;
    }
  });
}

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
      // Filter out any invalid pictographs (need both motions)
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
 * Get a random pictograph suitable for demonstrating a specific transform
 */
export async function getRandomPictographForTransform(
  transformId: TransformId
): Promise<PictographData | null> {
  const allPictographs = await loadAllPictographs();
  const suitable = filterForTransform(allPictographs, transformId);

  if (suitable.length === 0) {
    // Fallback to any pictograph if no suitable ones found
    if (allPictographs.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * allPictographs.length);
    return allPictographs[randomIndex] ?? null;
  }

  const randomIndex = Math.floor(Math.random() * suitable.length);
  return suitable[randomIndex] ?? null;
}

/**
 * Result type for single-motion examples
 * Returns both the pictograph AND which hand to display
 */
export interface SingleMotionExample {
  pictograph: PictographData;
  visibleHand: "blue" | "red";
}

/**
 * Check if a specific motion is suitable for a transform
 */
function isMotionSuitableForTransform(motion: MotionData | undefined, transformId: TransformId): boolean {
  if (!motion) return false;

  switch (transformId) {
    case "mirror":
      return hasEastWestComponent(motion);
    case "flip":
      return hasNorthSouthComponent(motion);
    case "invert":
      return hasRotation(motion);
    case "rewind":
      return hasMovement(motion);
    case "rotate":
      // Rotate always visible
      return true;
    case "swap":
      // Swap needs dual motion context - not meaningful for single
      return true;
    default:
      return true;
  }
}

/**
 * Get a random SINGLE motion suitable for demonstrating a specific transform.
 * Returns the pictograph AND which hand to show.
 *
 * This ensures the displayed motion will show a visible change when transformed:
 * - Mirror: motion has E/W component
 * - Flip: motion has N/S component
 * - Invert: motion has rotation
 * - Rewind: motion has movement (start ≠ end)
 */
export async function getRandomSingleMotionForTransform(
  transformId: TransformId
): Promise<SingleMotionExample | null> {
  const allPictographs = await loadAllPictographs();

  // Build a list of (pictograph, hand) pairs where the motion is suitable
  const candidates: SingleMotionExample[] = [];

  for (const p of allPictographs) {
    const blue = p.motions?.blue;
    const red = p.motions?.red;

    // Check blue motion
    if (blue && isMotionSuitableForTransform(blue, transformId)) {
      candidates.push({ pictograph: p, visibleHand: "blue" });
    }

    // Check red motion (even if blue was added, both could be valid)
    if (red && isMotionSuitableForTransform(red, transformId)) {
      candidates.push({ pictograph: p, visibleHand: "red" });
    }
  }

  if (candidates.length === 0) {
    // Fallback: pick any pictograph with blue hand visible
    if (allPictographs.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * allPictographs.length);
    const fallback = allPictographs[randomIndex];
    if (!fallback) return null;
    return { pictograph: fallback, visibleHand: "blue" };
  }

  const randomIndex = Math.floor(Math.random() * candidates.length);
  return candidates[randomIndex] ?? null;
}

/**
 * Get a random pictograph from the dataframe (no filtering)
 * @deprecated Use getRandomPictographForTransform for transform examples
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
 * Get a random dual-motion pictograph suitable for a specific transform
 */
export async function getRandomDualMotionPictographForTransform(
  transformId: TransformId
): Promise<PictographData | null> {
  return getRandomPictographForTransform(transformId);
}

/**
 * @deprecated Use getRandomDualMotionPictographForTransform
 */
export async function getRandomDualMotionPictograph(): Promise<PictographData | null> {
  return getRandomPictograph();
}
