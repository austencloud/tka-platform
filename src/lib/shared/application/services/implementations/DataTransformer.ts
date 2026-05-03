/**
 * Data Transformation Service Implementation
 *
 * Handles all data transformation and derivation logic for UI components.
 * This includes merging different data sources, filtering, and computing display values.
 */

import type { PictographData } from "../../../pictograph/shared/domain/models/PictographData";
import type { MotionColor } from "../../../pictograph/shared/domain/enums/pictograph-enums";
import type { MotionData } from "../../../pictograph/shared/domain/models/MotionData";
import type {
  MotionRenderData,
  PictographDisplayData,
} from "../contracts/IDataTransformer";

export class DataTransformer {
  /**
   * Transform pictograph data into display-ready format
   */
  transformPictographData(
    pictographData?: PictographData | null
  ): PictographDisplayData {
    const effectivePictographData =
      this.getEffectivePictographData(pictographData);

    return {
      effectivePictographData,
      hasValidData: this.hasValidPictographData(effectivePictographData),
      displayLetter: this.getDisplayLetter(effectivePictographData),
      motionsToRender: this.getMotionsToRender(effectivePictographData),
    };
  }

  /**
   * Get the effective pictograph data from multiple sources
   */
  getEffectivePictographData(
    pictographData?: PictographData | null
  ): PictographData | null {
    return pictographData || null;
  }

  /**
   * Check if pictograph data is valid for rendering
   */
  hasValidPictographData(data: PictographData | null): boolean {
    return data != null;
  }

  /**
   * Extract display letter from pictograph data
   */
  getDisplayLetter(data: PictographData | null): string | null {
    if (data?.letter) return data.letter;
    return null;
  }

  /**
   * Get motions that should be rendered (visible motions only)
   */
  getMotionsToRender(data: PictographData | null): MotionRenderData[] {
    if (!data?.motions) return [];
    // Convert undefined to null for type compatibility
    const normalizedMotions: Partial<Record<MotionColor, MotionData | null>> =
      {};
    for (const [key, value] of Object.entries(data.motions)) {
      normalizedMotions[key as MotionColor] =
        value === undefined ? null : value;
    }
    return this.filterVisibleMotions(normalizedMotions);
  }

  /**
   * Filter motion data by visibility
   */
  filterVisibleMotions(
    motions: Partial<Record<MotionColor, MotionData | null>> | undefined
  ): MotionRenderData[] {
    if (!motions) return [];

    return Object.entries(motions)
      .filter(
        ([, motionData]) => motionData !== null && motionData !== undefined
      )
      .filter(([_, motionData]) => motionData!.isVisible)
      .map(([color, motionData]) => ({
        color: color as MotionColor,
        motionData: motionData!,
      }));
  }
}
