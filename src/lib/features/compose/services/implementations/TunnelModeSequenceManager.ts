/**
 * Tunnel Mode Sequence Manager
 *
 * Coordinates sequence loading and transformations for Tunnel Mode.
 */

import { inject, injectable } from "inversify";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { TYPES } from "$lib/shared/inversify/types";

import type {
  ITunnelModeSequenceManager,
  SequenceType,
  TransformOperation,
} from "../contracts/ITunnelModeSequenceManager";
import type { ISequenceRepository } from "../../../create/shared/services/contracts/ISequenceRepository";
import type { ISequenceTransformer } from "../../../create/shared/services/contracts/ISequenceTransformer";

@injectable()
export class TunnelModeSequenceManager implements ITunnelModeSequenceManager {
  constructor(
    @inject(TYPES.ISequenceRepository)
    private readonly sequenceService: ISequenceRepository,
    @inject(TYPES.ISequenceTransformer)
    private readonly transformationService: ISequenceTransformer
  ) {}

  /**
   * Load a sequence for animation
   */
  async loadSequence(
    sequence: SequenceData,
    type: SequenceType
  ): Promise<SequenceData | null> {
    try {
      const result = await this.loadSequenceData(sequence);

      if (result) {
        return result;
      } else {
        console.error(
          `❌ TunnelModeSequenceManager: Failed to load ${type} sequence`
        );
        return null;
      }
    } catch (err) {
      console.error(
        `❌ TunnelModeSequenceManager: Exception loading ${type} sequence:`,
        err
      );
      return null;
    }
  }

  /**
   * Load and hydrate sequence data for animation
   */
  private async loadSequenceData(
    sequence: SequenceData | null
  ): Promise<SequenceData | null> {
    if (!sequence) return null;

    const hasMotionData = (s: SequenceData) =>
      Array.isArray(s.beats) &&
      s.beats.length > 0 &&
      s.beats.some((beat) => beat?.motions?.blue && beat?.motions?.red);

    // Check if identifier looks like a UUID (user-created sequence)
    // UUIDs: 8-4-4-4-12 hex pattern, gallery words are letters like "DKIIEJII"
    const isUUID = (id: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id
      );

    // Get a valid gallery-compatible identifier (word preferred, or non-UUID id)
    const getGalleryIdentifier = (s: SequenceData): string | null => {
      if (s.word?.trim()) return s.word;
      if (s.name?.trim() && !isUUID(s.name)) return s.name;
      if (s.id && !isUUID(s.id)) return s.id;
      return null; // No gallery-compatible identifier available
    };

    let fullSequence = sequence;

    // If sequence already has motion data, use it directly
    if (hasMotionData(sequence)) {
      fullSequence = sequence;
    }
    // Load from database/gallery if needed (empty beats)
    else if (sequence.id && (!sequence.beats || sequence.beats.length === 0)) {
      const galleryId = getGalleryIdentifier(sequence);
      if (galleryId) {
        const loaded = await this.sequenceService.getSequence(galleryId);
        if (loaded) {
          fullSequence = loaded;
        } else {
          console.warn(`⚠️ Could not load sequence from gallery: ${galleryId}`);
        }
      }
    }
    // Hydrate if missing motion data (try gallery lookup)
    else if (fullSequence && !hasMotionData(fullSequence)) {
      const galleryId = getGalleryIdentifier(fullSequence);
      if (galleryId) {
        const hydrated = await this.sequenceService.getSequence(galleryId);
        if (hydrated && hasMotionData(hydrated)) {
          fullSequence = hydrated;
        }
      }
    }

    // Normalize startPosition
    const withStarting = fullSequence as unknown as {
      startingPositionBeat?: unknown;
    };
    if (!fullSequence.startPosition && withStarting.startingPositionBeat) {
      fullSequence = {
        ...fullSequence,
        startPosition:
          withStarting.startingPositionBeat as SequenceData["startPosition"],
      };
    }

    return fullSequence;
  }

  /**
   * Transform a sequence and invoke callback with result
   */
  async transformAndUpdate(
    sequence: SequenceData,
    type: SequenceType,
    operation: TransformOperation,
    onUpdate: (transformed: SequenceData) => void
  ): Promise<void> {
    try {
      let transformed: SequenceData;

      switch (operation) {
        case "mirror":
          transformed = await this.transformationService.mirrorSequence(sequence);
          break;

        case "rotate":
          transformed = await this.transformationService.rotateSequence(sequence, 1);
          break;

        case "colorSwap":
          transformed = this.transformationService.swapColors(sequence);
          break;

        case "rewind":
          transformed =
            await this.transformationService.rewindSequence(sequence);
          break;

        default:
          console.error(`❌ Unknown transformation operation: ${operation}`);
          return;
      }

      onUpdate(transformed);
    } catch (err) {
      console.error(
        `❌ Failed to transform ${type} sequence (${operation}):`,
        err
      );
    }
  }
}
