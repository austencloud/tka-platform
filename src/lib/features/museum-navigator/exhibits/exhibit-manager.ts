/**
 * Exhibit Manager
 *
 * Coordinates exhibit placement in museum rooms.
 * Creates pictographs on walls and pedestals for 3D animations.
 */

import type { Scene } from "three";
import type { LibrarySequence } from "$lib/features/library/domain/models/LibrarySequence";
import type { IImageComposer } from "$lib/shared/render/services/contracts/IImageComposer";
import type { ExhibitInfo, RoomExhibits } from "../services/contracts/ISequenceCurator";
import {
  createPictographDisplay,
  createPlaceholderDisplay,
  type PictographDisplay,
} from "./pictograph-display";
import {
  createPedestalDisplay,
  type PedestalDisplay,
} from "./pedestal-display";

// ============================================================================
// TYPES
// ============================================================================

export interface Exhibit {
  id: string;
  type: "pictograph" | "pedestal";
  sequence: LibrarySequence;
  display: PictographDisplay | PedestalDisplay;
}

export interface ExhibitManagerState {
  exhibits: Map<string, Exhibit>;
  roomExhibits: Map<string, string[]>; // roomId -> exhibitIds
}

// ============================================================================
// EXHIBIT MANAGER
// ============================================================================

export class ExhibitManager {
  private scene: Scene;
  private imageComposer: IImageComposer | null;
  private state: ExhibitManagerState = {
    exhibits: new Map(),
    roomExhibits: new Map(),
  };

  constructor(scene: Scene, imageComposer: IImageComposer | null = null) {
    this.scene = scene;
    this.imageComposer = imageComposer;
  }

  /**
   * Set the image composer (can be set after construction)
   */
  setImageComposer(composer: IImageComposer): void {
    this.imageComposer = composer;
  }

  /**
   * Create exhibits for a room
   */
  async createExhibitsForRoom(roomExhibits: RoomExhibits): Promise<void> {
    const { roomId, exhibits: exhibitInfos } = roomExhibits;
    const exhibitIds: string[] = [];

    for (const info of exhibitInfos) {
      try {
        const exhibit = await this.createExhibit(info);
        if (exhibit) {
          this.state.exhibits.set(exhibit.id, exhibit);
          exhibitIds.push(exhibit.id);
        }
      } catch (error) {
        console.error(`[ExhibitManager] Failed to create exhibit:`, error);
      }
    }

    this.state.roomExhibits.set(roomId, exhibitIds);
  }

  /**
   * Create a single exhibit
   */
  private async createExhibit(info: ExhibitInfo): Promise<Exhibit | null> {
    const { sequence, displayType, position, rotation } = info;
    const exhibitId = `exhibit-${sequence.id}-${Date.now()}`;

    if (displayType === "wall-pictograph" || displayType === "display-case") {
      if (this.imageComposer) {
        const display = await createPictographDisplay(
          this.scene,
          sequence,
          position,
          rotation,
          this.imageComposer
        );

        return {
          id: exhibitId,
          type: "pictograph",
          sequence,
          display,
        };
      } else {
        // Create placeholder if no image composer
        const display = createPlaceholderDisplay(
          this.scene,
          sequence.id,
          position,
          rotation
        );

        return {
          id: exhibitId,
          type: "pictograph",
          sequence,
          display,
        };
      }
    }

    if (displayType === "pedestal-3d") {
      const display = createPedestalDisplay(
        this.scene,
        sequence,
        position,
        rotation
      );

      return {
        id: exhibitId,
        type: "pedestal",
        sequence,
        display,
      };
    }

    return null;
  }

  /**
   * Remove exhibits for a room
   */
  removeRoomExhibits(roomId: string): void {
    const exhibitIds = this.state.roomExhibits.get(roomId);
    if (!exhibitIds) return;

    for (const id of exhibitIds) {
      const exhibit = this.state.exhibits.get(id);
      if (exhibit) {
        exhibit.display.dispose();
        this.state.exhibits.delete(id);
      }
    }

    this.state.roomExhibits.delete(roomId);
  }

  /**
   * Get exhibit by ID
   */
  getExhibit(exhibitId: string): Exhibit | undefined {
    return this.state.exhibits.get(exhibitId);
  }

  /**
   * Get all exhibits in a room
   */
  getRoomExhibits(roomId: string): Exhibit[] {
    const exhibitIds = this.state.roomExhibits.get(roomId) || [];
    return exhibitIds
      .map((id) => this.state.exhibits.get(id))
      .filter((e): e is Exhibit => !!e);
  }

  /**
   * Get exhibit count
   */
  getExhibitCount(): number {
    return this.state.exhibits.size;
  }

  /**
   * Find exhibit at ray intersection (for click handling)
   */
  findExhibitAtPosition(x: number, y: number, z: number, threshold = 1): Exhibit | null {
    for (const exhibit of this.state.exhibits.values()) {
      const pos = exhibit.display.group.position;
      const dx = pos.x - x;
      const dy = pos.y - y;
      const dz = pos.z - z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (distance < threshold) {
        return exhibit;
      }
    }
    return null;
  }

  /**
   * Dispose all exhibits
   */
  dispose(): void {
    for (const exhibit of this.state.exhibits.values()) {
      exhibit.display.dispose();
    }
    this.state.exhibits.clear();
    this.state.roomExhibits.clear();
  }
}
