import { Vector3 } from 'three';

export interface PixelPoint { x: number; y: number; }

/**
 * 2D calibration: screen pixels (origin top-left, y down) -> TKA grid frame
 * (X=East, Y=North up, origin = grid center, unit = one grid radius).
 * Single-camera wall-plane mapping; exact for in-plane flow.
 */
export class ScreenToGrid {
  constructor(private center: PixelPoint, private radiusPx: number) {}

  /** Map a screen point to a grid position. */
  toGrid(px: PixelPoint): Vector3 {
    return new Vector3(
      (px.x - this.center.x) / this.radiusPx,
      -(px.y - this.center.y) / this.radiusPx,
      0,
    );
  }

  /** Map a screen displacement (from a->b) to a grid-frame direction (Y flipped). */
  toGridDir(a: PixelPoint, b: PixelPoint): Vector3 {
    return new Vector3(
      (b.x - a.x) / this.radiusPx,
      -(b.y - a.y) / this.radiusPx,
      0,
    );
  }
}
