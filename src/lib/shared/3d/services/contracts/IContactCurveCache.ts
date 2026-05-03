/**
 * Per-frame foot contact state for a single animation clip.
 * Values are 0 (airborne) to 1 (fully planted). Intermediate values
 * represent blend ramps during transitions.
 */
export interface ContactCurveData {
  /** Matches the clip name in the GLB */
  clipName: string;
  /** Frames per second the curves are sampled at */
  frameRate: number;
  /** Total frame count (= clip duration × frameRate) */
  frameCount: number;
  /** Per-frame left foot contact (length === frameCount) */
  leftFoot: number[];
  /** Per-frame right foot contact (length === frameCount) */
  rightFoot: number[];
}

export interface ContactSample {
  /** Left foot contact value at the sampled phase, 0-1 */
  leftFoot: number;
  /** Right foot contact value at the sampled phase, 0-1 */
  rightFoot: number;
  /** Whether the queried clip has a registered curve.
   *  Consumers use this to fall back to velocity-based detection. */
  hasCurve: boolean;
}

// IContactCurveCache interface retired — ContactCurveCache class is the contract now.
