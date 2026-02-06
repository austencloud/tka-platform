import type { ArrowPlacementData } from "./ArrowPlacementData";

export function createArrowPlacementData(
  data: Partial<ArrowPlacementData> = {}
): ArrowPlacementData {
  return {
    positionX: data.positionX ?? 0.0,
    positionY: data.positionY ?? 0.0,
    rotationAngle: data.rotationAngle ?? 0.0,
    coordinates: data.coordinates ?? null,
    svgCenter: data.svgCenter ?? null,
    svgMirrored: data.svgMirrored ?? false,
    manualAdjustmentX: data.manualAdjustmentX ?? 0,
    manualAdjustmentY: data.manualAdjustmentY ?? 0,
  };
}
