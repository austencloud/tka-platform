/**
 * Co-exported types from retired interface contracts.
 */

import type { ExhibitSlot } from "../domain/museum-types";


export interface InteractionTarget {
  slot: ExhibitSlot;
  distance: number;
}


export interface MuseumMetadata {
  name: string;
  createdAt: number;
  updatedAt: number;
  isPublic: boolean;
}
