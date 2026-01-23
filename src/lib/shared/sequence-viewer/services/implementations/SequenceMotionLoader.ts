/**
 * SequenceMotionLoader
 *
 * Ensures sequence data has motion information for animation playback.
 * Delegates to IExploreLoader for gallery-based sequence loading.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { IExploreLoader } from "$lib/features/explore/sequences/display/services/contracts/IExploreLoader";
import type { ISequenceMotionLoader } from "../contracts/ISequenceMotionLoader";

export class SequenceMotionLoader implements ISequenceMotionLoader {
  constructor(private readonly exploreLoader: IExploreLoader) {}

  async ensureMotionData(seq: SequenceData): Promise<SequenceData | null> {
    // Check if sequence already has motion data
    const hasMotions = seq.steps?.some(
      (b) => b?.motions?.blue && b?.motions?.red
    );
    if (hasMotions) return seq;

    // Try to load from gallery using word/name (gallery sequences)
    const galleryId = seq.word || seq.name;
    if (galleryId) {
      try {
        const loaded = await this.exploreLoader.loadFullSequenceData(galleryId);
        if (loaded?.steps?.some((b) => b?.motions?.blue && b?.motions?.red)) {
          return loaded;
        }
      } catch (err) {
        console.warn(`Could not load sequence from gallery: ${galleryId}`, err);
      }
    }

    // Return original sequence if we couldn't load motion data
    return seq;
  }
}
