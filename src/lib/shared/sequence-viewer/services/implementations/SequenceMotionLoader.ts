/**
 * SequenceMotionLoader
 *
 * Ensures sequence data has motion information for animation playback.
 * Delegates to IDiscoverLoader for gallery-based sequence loading.
 */

import { inject, injectable } from "inversify";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { IDiscoverLoader } from "$lib/features/discover/gallery/display/services/contracts/IDiscoverLoader";
import { TYPES } from "$lib/shared/inversify/types";
import type { ISequenceMotionLoader } from "../contracts/ISequenceMotionLoader";

@injectable()
export class SequenceMotionLoader implements ISequenceMotionLoader {
  constructor(
    @inject(TYPES.IDiscoverLoader)
    private readonly discoverLoader: IDiscoverLoader
  ) {}

  async ensureMotionData(seq: SequenceData): Promise<SequenceData | null> {
    // Check if sequence already has motion data
    const hasMotions = seq.beats?.some(
      (b) => b?.motions?.blue && b?.motions?.red
    );
    if (hasMotions) return seq;

    // Try to load from gallery using word/name (gallery sequences)
    const galleryId = seq.word || seq.name;
    if (galleryId) {
      try {
        const loaded = await this.discoverLoader.loadFullSequenceData(galleryId);
        if (loaded?.beats?.some((b) => b?.motions?.blue && b?.motions?.red)) {
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
