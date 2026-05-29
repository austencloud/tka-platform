/**
 * Co-exported types from retired interface contracts.
 */

import type { ExhibitSlot } from "../domain/museum-types";

// === From IInteractionDetector ===

export interface InteractionTarget {
  slot: ExhibitSlot;
  distance: number;
}

// === From IMuseumPersister ===

export interface MuseumMetadata {
  name: string;
  createdAt: number;
  updatedAt: number;
  isPublic: boolean;
}
