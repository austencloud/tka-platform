/**
 * Prop Placement Data Model
 *
 * Immutable data for prop positioning and placement calculations.
 */

export interface PropPlacementData {
  readonly positionX: number;
  readonly positionY: number;
  readonly rotationAngle: number;
  readonly coordinates?: { x: number; y: number } | null;
  readonly svgCenter?: { x: number; y: number } | null;
}
