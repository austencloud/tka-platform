import type { ManualPlacement } from '../../data/museum-manual-placements';

export interface IPlacementPersister {
  save(roomId: string, placement: ManualPlacement): Promise<void>;
  remove(roomId: string, placementId: string): Promise<void>;
  getAll(roomId: string): ManualPlacement[];
}
