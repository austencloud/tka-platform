import type { Direction } from '../domain/museum-grid-types';

export interface ManualPlacement {
  id: string;
  objectDefId: string;
  tileX: number;
  tileY: number;
  wallFacing: Direction | null;
  yaw: number;
}

/**
 * Manual placements keyed by room ID. Written by the editor save action.
 * The geometry builder reads this at build time to merge with auto-placed objects.
 */
export const MANUAL_PLACEMENTS: Record<string, ManualPlacement[]> = {
  // Populated by editor — do not edit manually
};
