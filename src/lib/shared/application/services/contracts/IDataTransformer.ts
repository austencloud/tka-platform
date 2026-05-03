/**
 * Data Transformation Types
 *
 * Co-exported types for the data transformation system.
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

