/**
 * ISequenceCurator
 *
 * Selects sequences from the user's library for museum exhibits.
 * Handles curation logic - which sequences to show in which rooms.
 */

import type { LibrarySequence } from "$lib/features/library/domain/models/LibrarySequence";

/**
 * Exhibit placement info for a sequence
 */
export interface ExhibitInfo {
  sequence: LibrarySequence;
  displayType: "wall-pictograph" | "pedestal-3d" | "display-case";
  position: { x: number; y: number; z: number };
  rotation: number;
}

/**
 * Room exhibit assignment
 */
export interface RoomExhibits {
  roomId: string;
  exhibits: ExhibitInfo[];
}

/**
 * Interface for sequence curation
 */
export interface ISequenceCurator {
  /**
   * Load all available sequences from user's library
   */
  loadSequences(): Promise<LibrarySequence[]>;

  /**
   * Get sequences for a specific room
   * @param roomId Room identifier
   * @param maxExhibits Maximum exhibits for this room
   * @returns Exhibit placements for the room
   */
  getExhibitsForRoom(roomId: string, maxExhibits: number): Promise<RoomExhibits>;

  /**
   * Get a specific sequence by ID
   */
  getSequence(sequenceId: string): LibrarySequence | undefined;

  /**
   * Get total available sequences
   */
  getTotalSequences(): number;

  /**
   * Check if sequences are loaded
   */
  isLoaded(): boolean;
}
