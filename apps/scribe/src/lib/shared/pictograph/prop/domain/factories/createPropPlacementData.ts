import type { PropPlacementData } from "../models/PropPlacementData";

/**
 * Create PropPlacementData with default values
 */
export function createPropPlacementData(
  data: Partial<PropPlacementData> = {}
): PropPlacementData {
  return {
    positionX: data.positionX ?? 0.0,
    positionY: data.positionY ?? 0.0,
    rotationAngle: data.rotationAngle ?? 0.0,
    coordinates: data.coordinates ?? null,
    svgCenter: data.svgCenter ?? null,
  };
}

/**
 * Create PropPlacementData from position and rotation
 */
export function createPropPlacementFromPosition(
  x: number,
  y: number,
  rotation: number = 0
): PropPlacementData {
  return createPropPlacementData({
    positionX: x,
    positionY: y,
    rotationAngle: rotation,
    coordinates: { x, y },
  });
}
