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
  "egyptian": [
    { id: "egyptian-modern-fixture-1775532654513", objectDefId: "modern-fixture", tileX: 2, tileY: 12, wallFacing: "east", yaw: 1.5708 },
    { id: "egyptian-modern-fixture-1775532655873", objectDefId: "modern-fixture", tileX: 13, tileY: 3, wallFacing: "south", yaw: 0.0000 },
    { id: "egyptian-modern-fixture-1775532661166", objectDefId: "modern-fixture", tileX: 3, tileY: 5, wallFacing: "east", yaw: 1.5708 },
    { id: "egyptian-modern-fixture-1775532667228", objectDefId: "modern-fixture", tileX: 15, tileY: 3, wallFacing: "south", yaw: 0.0000 },
  ],
};
