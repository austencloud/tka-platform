export interface IProximityGrid<T> {
  /** Insert an item at a tile position. */
  insert(item: T, tileX: number, tileY: number): void;
  /** Return all items within `radius` tiles of the center point. */
  queryRadius(centerX: number, centerY: number, radius: number): T[];
  /** Return total item count (for debugging). */
  readonly size: number;
}
