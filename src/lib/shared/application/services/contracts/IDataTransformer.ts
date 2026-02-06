/**
 * Data Transformation Service Contract
 *
 * Handles all data transformation and derivation logic for UI components.
 * This includes merging different data sources, filtering, and computing display values.
 */

import type { PictographData } from "../../../pictograph/shared/domain/models/PictographData";
import type { MotionColor } from "../../../pictograph/shared/domain/enums/pictograph-enums";
import type { MotionData } from "../../../pictograph/shared/domain/models/MotionData";

export interface MotionRenderData {
  color: MotionColor;
  motionData: MotionData;
}

export interface PictographDisplayData {
  /** The effective pictograph data from sources */
  effectivePictographData: PictographData | null;
  /** Whether we have valid data to render */
  hasValidData: boolean;
  /** The display letter for the pictograph */
  displayLetter: string | null;
  /** Motion data ready for rendering */
  motionsToRender: MotionRenderData[];
}

export interface IDataTransformer {
  /**
   * Transform pictograph data into display-ready format
   */
  transformPictographData(
    pictographData?: PictographData | null
  ): PictographDisplayData;

  /**
   * Get the effective pictograph data from multiple sources
   */
  getEffectivePictographData(
    pictographData?: PictographData | null
  ): PictographData | null;

  /**
   * Check if pictograph data is valid for rendering
   */
  hasValidPictographData(data: PictographData | null): boolean;

  /**
   * Extract display letter from pictograph data
   */
  getDisplayLetter(data: PictographData | null): string | null;

  /**
   * Get motions that should be rendered (visible motions only)
   */
  getMotionsToRender(data: PictographData | null): MotionRenderData[];

  /**
   * Filter motion data by visibility
   */
  filterVisibleMotions(
    motions: Record<MotionColor, MotionData | null> | undefined
  ): MotionRenderData[];
}
