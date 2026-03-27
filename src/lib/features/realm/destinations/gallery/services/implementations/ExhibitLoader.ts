/**
 * ExhibitLoader
 *
 * Loads sequences from various sources and assigns them to gallery exhibit slots.
 */

import type { IExhibitLoader } from "../contracts/IExhibitLoader";
import type { GalleryLayout } from "../../domain/models/GalleryLayout";
import type { Exhibit, ExhibitLoadOptions } from "../../domain/models/Exhibit";
import type { ILibraryRepository } from "$lib/features/library/services/contracts/ILibraryRepository";
import {
  AVATAR_OFFSET_FROM_WALL,
  AVATAR_OFFSET_X,
} from "../../domain/constants/gallery-dimensions";

export class ExhibitLoader implements IExhibitLoader {
  constructor(private readonly libraryRepository: ILibraryRepository) {}

  async loadExhibits(
    layout: GalleryLayout,
    options: ExhibitLoadOptions
  ): Promise<Exhibit[]> {
    // Get all exhibit slots from the layout
    const allSlots = layout.exhibitSlots;

    if (allSlots.length === 0) {
      return [];
    }

    // Load sequences based on source
    const sequences = await this.loadSequences(options);

    // Limit to available slots
    const sequencesToUse = sequences.slice(0, allSlots.length);

    // Create exhibits by pairing sequences with slots
    const exhibits: Exhibit[] = [];

    for (let i = 0; i < sequencesToUse.length; i++) {
      const sequence = sequencesToUse[i];
      const currentSlot = allSlots[i];

      // Skip if no slot available (shouldn't happen due to slice, but TypeScript needs this)
      if (!currentSlot || !sequence) continue;

      // Extract slot properties for TypeScript narrowing
      const slotPosition = currentSlot.position;
      const slotRotation = currentSlot.rotation;
      const slotId = currentSlot.id;

      // Calculate avatar position beside the frame
      // Avatar stands offset from the wall, slightly to the side of the frame
      const avatarX =
        slotPosition.x +
        Math.sin(slotRotation) * AVATAR_OFFSET_FROM_WALL +
        Math.cos(slotRotation) * AVATAR_OFFSET_X;
      const avatarZ =
        slotPosition.z +
        Math.cos(slotRotation) * AVATAR_OFFSET_FROM_WALL -
        Math.sin(slotRotation) * AVATAR_OFFSET_X;

      exhibits.push({
        id: `exhibit-${sequence.id}`,
        slotId,
        sequence,
        thumbnailUrl: sequence.thumbnails?.[0] ?? null,
        showAvatar: false, // Disabled for MVP - using 2D animation displays instead
        avatarPosition: {
          x: avatarX,
          y: 0, // Ground level
          z: avatarZ,
        },
        // Avatar faces away from wall (opposite of slot rotation)
        avatarFacing: slotRotation + Math.PI,
      });
    }

    return exhibits;
  }

  async loadExhibitsForModel(options: ExhibitLoadOptions): Promise<Exhibit[]> {
    // Load sequences without slot assignments
    // Slots will be assigned later when the 3D model reports its painting positions
    const sequences = await this.loadSequences(options);

    // Create exhibits with placeholder slot IDs
    // These will be matched to model slots in GalleryModule
    const exhibits: Exhibit[] = sequences.map((sequence, index) => ({
      id: `exhibit-${sequence.id}`,
      slotId: `pending_${index}`, // Will be reassigned when model slots load
      sequence,
      thumbnailUrl: sequence.thumbnails?.[0] ?? null,
      showAvatar: false,
      avatarPosition: { x: 0, y: 0, z: 0 }, // Will be set from model slot
      avatarFacing: 0,
    }));

    return exhibits;
  }

  async preloadThumbnails(exhibitIds: string[]): Promise<void> {
    // Thumbnail preloading will use the existing CloudThumbnailCache pattern
    // For now, this is a no-op placeholder
    // The actual thumbnails are loaded by the FramedSequence component
    console.debug(`[ExhibitLoader] Preloading ${exhibitIds.length} thumbnails`);
  }

  private async loadSequences(options: ExhibitLoadOptions) {
    const { source, userId, limit = 20 } = options;

    let sequences;

    switch (source) {
      case "user_library":
        sequences = await this.libraryRepository.getSequences({
          limit: limit * 2, // Fetch extra to account for filtering
          sortBy: "updatedAt",
          sortDirection: "desc",
        });
        break;

      case "public_library":
        if (!userId) {
          console.warn("[ExhibitLoader] public_library requires userId");
          return [];
        }
        sequences = await this.libraryRepository.getUserSequences(userId, {
          visibility: "public",
          limit: limit * 2,
          sortBy: "updatedAt",
          sortDirection: "desc",
        });
        break;

      case "curated":
        // TODO: Implement curated collections
        console.warn("[ExhibitLoader] curated source not yet implemented");
        return [];

      default:
        console.warn(`[ExhibitLoader] Unknown source: ${source}`);
        return [];
    }

    // Filter to only sequences with actual beat data (for animation)
    const sequencesWithBeats = sequences.filter(
      (seq) => seq.steps && seq.steps.length > 0
    );

    console.debug(
      `[ExhibitLoader] Loaded ${sequences.length} sequences, ${sequencesWithBeats.length} have steps`
    );

    return sequencesWithBeats.slice(0, limit);
  }
}
