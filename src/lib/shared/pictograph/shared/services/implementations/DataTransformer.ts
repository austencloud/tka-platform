/**
 * Data Transformation Service
 *
 * Handles data transformation and adaptation between different formats.
 * Extracted from PictographRenderer.
 */

import type { StepData } from "../../../../../features/create/shared/domain/models/StepData";
import type { GridMode } from "../../../grid/domain/enums/grid-enums";
import type {
  GridData,
  GridPointData as RawGridData,
} from "../../../grid/domain/models/grid-models";
import { createPictographData } from "../../domain/factories/createPictographData";
import type { MotionData } from "../../domain/models/MotionData";
import type { PictographData } from "../../domain/models/PictographData";

// Types moved to application/services/contracts/types.ts

export class DataTransformer {
  /**
   * Convert step data to pictograph data
   */
  stepToPictographData(beat: StepData): PictographData {
    const motions: Record<string, MotionData> = {};
    if (beat.motions["blue"]) motions["blue"] = beat.motions["blue"];
    if (beat.motions["red"]) motions["red"] = beat.motions["red"];
    return createPictographData({
      id: `step-${beat.stepNumber}`,
      motions,
      letter: beat.letter || null,
    });
  }

  /**
   * Adapt raw grid data to match the interface requirements
   */
  adaptGridData(rawGridData: RawGridData, mode: GridMode): GridData {
    // Filter out null coordinates and adapt to interface
    const adaptPoints = (
      points: Record<string, { coordinates: { x: number; y: number } | null }>
    ) => {
      const adapted: Record<string, { coordinates: { x: number; y: number } }> =
        {};
      for (const [key, point] of Object.entries(points)) {
        if (point.coordinates) {
          adapted[key] = { coordinates: point.coordinates };
        }
      }
      return adapted;
    };

    return {
      gridMode: mode,
      centerX: 0.0,
      centerY: 0.0,
      radius: 100.0,
      gridPointData: {
        allLayer2PointsNormal: adaptPoints(
          rawGridData.allLayer2PointsNormal || {}
        ),
        allHandPointsNormal: adaptPoints(rawGridData.allHandPointsNormal || {}),
        allHandPointsStrict: {},
        allLayer2PointsStrict: {},
        allOuterPoints: {},
        centerPoint: { coordinates: { x: 475, y: 475 } },
      },
    };
  }
}
