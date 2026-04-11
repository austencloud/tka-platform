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

export interface IContactCurveCache {
  /** Register a contact curve for a clip. Overwrites if already present. */
  register(data: ContactCurveData): void;

  /**
   * Sample the contact state for a clip at a given phase (0-1).
   * Out-of-range phases are clamped. Returns zero-contact with
   * hasCurve=false if no curve is registered for the clip.
   */
  getContactAt(clipName: string, phase: number): ContactSample;

  /** Check whether a clip has a registered curve. */
  has(clipName: string): boolean;

  /** Remove a clip's curve from the cache. */
  unregister(clipName: string): void;
}
