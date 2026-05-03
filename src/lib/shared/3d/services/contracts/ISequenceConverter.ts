/**
 * ISequenceConverter Contract
 *
 * Service for converting SequenceData to MotionConfig3D.
 * Bridges 2D sequence data model with 3D animation system.
 */

import type { MotionConfig3D } from "../../domain/models/MotionData3D";

/**
 * Motion configurations for a single beat
 */
export interface StepMotionConfigs {
  stepNumber: number;
  blue: MotionConfig3D | null;
  red: MotionConfig3D | null;
}

// ISequenceConverter interface retired — SequenceConverter class is the contract now.
