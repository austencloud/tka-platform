/**
 * Domain Factories
 *
 * Factory functions for creating pictograph domain objects with sensible defaults.
 */

import type {
  PictographData,
  ArrowPlacementData,
  PropPlacementData,
} from "@tka/types";

export function createPictographData(
  data: Partial<PictographData> = {}
): PictographData {
  return {
    id: data.id || crypto.randomUUID(),
    motions: data.motions || {},
    ...(data.letter !== undefined && { letter: data.letter }),
    ...(data.startPosition !== undefined && {
      startPosition: data.startPosition,
    }),
    ...(data.endPosition !== undefined && { endPosition: data.endPosition }),
    ...(data.category !== undefined && { category: data.category }),
  };
}

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
