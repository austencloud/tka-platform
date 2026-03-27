/**
 * Exhibit Domain Models
 *
 * Defines an art exhibit in the 3D gallery - a sequence displayed
 * as a framed image with an optional animated avatar performing it.
 */

import type { LibrarySequence } from "$lib/features/library/domain/models/LibrarySequence";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

/**
 * A single exhibit in the gallery
 */
export interface Exhibit {
  /** Unique identifier */
  readonly id: string;
  /** ID of the slot this exhibit occupies */
  readonly slotId: string;
  /** The sequence being displayed */
  readonly sequence: LibrarySequence | SequenceData;
  /** URL to the thumbnail image (for the frame) */
  readonly thumbnailUrl: string | null;
  /** Whether to show the animated avatar */
  readonly showAvatar: boolean;
  /** Position of the avatar relative to the frame */
  readonly avatarPosition: { x: number; y: number; z: number };
  /** Y-axis rotation of the avatar (facing direction) */
  readonly avatarFacing: number;
}

/**
 * Source type for gallery content
 */
export type GalleryContentSource =
  | "user_library" // Current user's library
  | "public_library" // Another user's public sequences
  | "curated"; // Manually selected sequences

/**
 * Collection of exhibits with source metadata
 */
export interface ExhibitCollection {
  /** All exhibits in this collection */
  readonly exhibits: readonly Exhibit[];
  /** Where the sequences came from */
  readonly sourceType: GalleryContentSource;
  /** User ID if viewing another user's gallery */
  readonly sourceUserId?: string;
  /** Collection ID if viewing a specific collection */
  readonly collectionId?: string;
}

/**
 * Options for loading exhibits
 */
export interface ExhibitLoadOptions {
  /** Source of sequences */
  source: GalleryContentSource;
  /** User ID for public_library source */
  userId?: string;
  /** Collection ID for curated source */
  collectionId?: string;
  /** Maximum number of exhibits */
  limit?: number;
}
