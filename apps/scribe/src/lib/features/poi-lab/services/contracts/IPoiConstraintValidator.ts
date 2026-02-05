/**
 * Poi Constraint Validator Interface
 *
 * Validates individual motions and transitions against poi physics rules.
 */

import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { PoiValidationResult } from "../../domain/poi-models";

export interface IPoiConstraintValidator {
  /**
   * Validate a single motion against poi physics constraints.
   *
   * Checks:
   * - FLOAT: Only valid when orientation = gravity orientation
   * - ANTI 0 turns: Never valid (tramel motion impossible)
   * - PRO 0 + IN: Never valid (can't isolate inward-facing poi)
   * - DASH: Minimum 0.5 turns required
   */
  validateMotion(motion: MotionData): PoiValidationResult;

  /**
   * Validate a transition between two motions.
   *
   * Checks:
   * - Cannot instantly reverse spin direction (CW↔CCW needs stall)
   * - Momentum continuity (future: turn count change limits)
   */
  validateTransition(
    fromMotion: MotionData,
    toMotion: MotionData
  ): PoiValidationResult;
}
