export interface ArrowPlacementData {
  readonly positionX: number;
  readonly positionY: number;
  readonly rotationAngle: number;
  readonly coordinates: { x: number; y: number } | null;
  readonly svgCenter: { x: number; y: number } | null;
  readonly svgMirrored: boolean;
  readonly manualAdjustmentX?: number;
  readonly manualAdjustmentY?: number;
}
