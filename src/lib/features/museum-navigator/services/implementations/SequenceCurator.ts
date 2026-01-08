/**
 * SequenceCurator
 *
 * Fetches sequences from user's library and assigns them to museum rooms.
 * Uses deterministic selection based on room ID for consistent placement.
 */

import { injectable, inject } from "inversify";
import type {
  ISequenceCurator,
  ExhibitInfo,
  RoomExhibits,
} from "../contracts/ISequenceCurator";
import type { ILibraryRepository } from "$lib/features/library/services/contracts/ILibraryRepository";
import type { LibrarySequence } from "$lib/features/library/domain/models/LibrarySequence";
import { LibraryTypes } from "$lib/shared/inversify/types/library.types";

@injectable()
export class SequenceCurator implements ISequenceCurator {
  private sequences: LibrarySequence[] = [];
  private sequenceMap: Map<string, LibrarySequence> = new Map();
  private loaded = false;
  private assignedSequences: Set<string> = new Set();

  constructor(
    @inject(LibraryTypes.ILibraryRepository)
    private libraryRepository: ILibraryRepository
  ) {}

  async loadSequences(): Promise<LibrarySequence[]> {
    try {
      const allSequences = await this.libraryRepository.getSequences({
        sortBy: "updatedAt",
        sortDirection: "desc",
      });

      // Filter to only sequences with at least one beat (required for rendering)
      this.sequences = allSequences.filter((seq) => seq.beats && seq.beats.length > 0);

      // Build lookup map
      this.sequenceMap.clear();
      for (const seq of this.sequences) {
        this.sequenceMap.set(seq.id, seq);
      }

      this.loaded = true;
      const filtered = allSequences.length - this.sequences.length;
      console.log(`[SequenceCurator] Loaded ${this.sequences.length} sequences (${filtered} empty sequences filtered)`);

      return this.sequences;
    } catch (error) {
      console.error("[SequenceCurator] Failed to load sequences:", error);
      this.sequences = [];
      this.loaded = true;
      return [];
    }
  }

  async getExhibitsForRoom(roomId: string, maxExhibits: number): Promise<RoomExhibits> {
    if (!this.loaded) {
      await this.loadSequences();
    }

    const exhibits: ExhibitInfo[] = [];

    // Get unassigned sequences
    const available = this.sequences.filter(
      (seq) => !this.assignedSequences.has(seq.id)
    );

    // Take up to maxExhibits sequences
    const toAssign = available.slice(0, maxExhibits);

    // Calculate positions based on room layout
    const positions = this.calculateExhibitPositions(roomId, toAssign.length);

    for (let i = 0; i < toAssign.length; i++) {
      const seq = toAssign[i]!;
      const pos = positions[i]!;

      // Determine display type based on sequence characteristics
      const displayType = this.selectDisplayType(seq, i);

      exhibits.push({
        sequence: seq,
        displayType,
        position: pos.position,
        rotation: pos.rotation,
      });

      this.assignedSequences.add(seq.id);
    }

    return { roomId, exhibits };
  }

  getSequence(sequenceId: string): LibrarySequence | undefined {
    return this.sequenceMap.get(sequenceId);
  }

  getTotalSequences(): number {
    return this.sequences.length;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Calculate exhibit positions for a room
   */
  private calculateExhibitPositions(
    roomId: string,
    count: number
  ): { position: { x: number; y: number; z: number }; rotation: number }[] {
    const positions: { position: { x: number; y: number; z: number }; rotation: number }[] = [];

    // Hub room: 12x12, exhibits on all 4 walls
    if (roomId === "hub" || roomId.startsWith("gallery")) {
      const wallPositions = [
        // North wall (-Z)
        { x: -3, y: 1.6, z: -5.5, rot: 0 },
        { x: 3, y: 1.6, z: -5.5, rot: 0 },
        // South wall (+Z)
        { x: -3, y: 1.6, z: 5.5, rot: Math.PI },
        { x: 3, y: 1.6, z: 5.5, rot: Math.PI },
        // East wall (+X)
        { x: 5.5, y: 1.6, z: -2, rot: -Math.PI / 2 },
        { x: 5.5, y: 1.6, z: 2, rot: -Math.PI / 2 },
        // West wall (-X)
        { x: -5.5, y: 1.6, z: -2, rot: Math.PI / 2 },
        { x: -5.5, y: 1.6, z: 2, rot: Math.PI / 2 },
      ];

      for (let i = 0; i < Math.min(count, wallPositions.length); i++) {
        const wp = wallPositions[i]!;
        positions.push({
          position: { x: wp.x, y: wp.y, z: wp.z },
          rotation: wp.rot,
        });
      }
    } else if (roomId.startsWith("hallway")) {
      // Hallway: 4x16, exhibits on long walls
      const hallwayPositions = [
        { x: -1.5, y: 1.6, z: -5, rot: Math.PI / 2 },
        { x: -1.5, y: 1.6, z: 0, rot: Math.PI / 2 },
        { x: -1.5, y: 1.6, z: 5, rot: Math.PI / 2 },
        { x: 1.5, y: 1.6, z: -5, rot: -Math.PI / 2 },
        { x: 1.5, y: 1.6, z: 0, rot: -Math.PI / 2 },
        { x: 1.5, y: 1.6, z: 5, rot: -Math.PI / 2 },
      ];

      for (let i = 0; i < Math.min(count, hallwayPositions.length); i++) {
        const hp = hallwayPositions[i]!;
        positions.push({
          position: { x: hp.x, y: hp.y, z: hp.z },
          rotation: hp.rot,
        });
      }
    }

    return positions;
  }

  /**
   * Select display type based on sequence and index
   */
  private selectDisplayType(
    seq: LibrarySequence,
    index: number
  ): "wall-pictograph" | "pedestal-3d" | "display-case" {
    // Every 4th exhibit gets a pedestal (3D animation)
    if (index % 4 === 0) {
      return "pedestal-3d";
    }

    // Featured sequences get display cases
    if (seq.isFeatured) {
      return "display-case";
    }

    // Default to wall pictograph
    return "wall-pictograph";
  }
}
