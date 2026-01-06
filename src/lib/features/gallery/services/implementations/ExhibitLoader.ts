/**
 * ExhibitLoader
 *
 * Loads sequences from various sources and assigns them to gallery exhibit slots.
 */

import { injectable, inject } from "inversify";
import type { IExhibitLoader } from "../contracts/IExhibitLoader";
import type { GalleryLayout } from "../../domain/models/GalleryLayout";
import type { Exhibit, ExhibitLoadOptions } from "../../domain/models/Exhibit";
import type { ILibraryRepository } from "$lib/features/library/services/contracts/ILibraryRepository";
import { TYPES } from "$lib/shared/inversify/types";
import {
  AVATAR_OFFSET_FROM_WALL,
  AVATAR_OFFSET_X,
} from "../../domain/constants/gallery-dimensions";

@injectable()
export class ExhibitLoader implements IExhibitLoader {
  constructor(
    @inject(TYPES.ILibraryRepository)
    private readonly libraryRepository: ILibraryRepository
  ) {}

  async loadExhibits(
    layout: GalleryLayout,
    options: ExhibitLoadOptions
  ): Promise<Exhibit[]> {
    // Collect all slots from all walls
    const allSlots = layout.walls.flatMap((wall) => wall.exhibitSlots);

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

  async preloadThumbnails(exhibitIds: string[]): Promise<void> {
    // Thumbnail preloading will use the existing CloudThumbnailCache pattern
    // For now, this is a no-op placeholder
    // The actual thumbnails are loaded by the FramedSequence component
    console.debug(`[ExhibitLoader] Preloading ${exhibitIds.length} thumbnails`);
  }

  private async loadSequences(options: ExhibitLoadOptions) {
    const { source, userId, limit = 20 } = options;

    switch (source) {
      case "user_library":
        return this.libraryRepository.getSequences({
          limit,
          sortBy: "updatedAt",
          sortDirection: "desc",
        });

      case "public_library":
        if (!userId) {
          console.warn("[ExhibitLoader] public_library requires userId");
          return [];
        }
        return this.libraryRepository.getUserSequences(userId, {
          visibility: "public",
          limit,
          sortBy: "updatedAt",
          sortDirection: "desc",
        });

      case "curated":
        // TODO: Implement curated collections
        console.warn("[ExhibitLoader] curated source not yet implemented");
        return [];

      default:
        console.warn(`[ExhibitLoader] Unknown source: ${source}`);
        return [];
    }
  }
}
