/**
 * Simple 2D point class.
 *
 * Replaces fabric.Point dependency for the shared package.
 * API-compatible subset: just x, y properties.
 */
export class Point {
  constructor(
    public x: number,
    public y: number
  ) {}
}
