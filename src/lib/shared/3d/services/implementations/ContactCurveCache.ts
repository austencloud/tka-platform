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
  /** Total frame count (= clip duration x frameRate) */
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

const EMPTY_SAMPLE: ContactSample = Object.freeze({
  leftFoot: 0,
  rightFoot: 0,
  hasCurve: false,
}) as ContactSample;

export class ContactCurveCache {
  private readonly curves = new Map<string, ContactCurveData>();

  register(data: ContactCurveData): void {
    if (data.leftFoot.length !== data.frameCount || data.rightFoot.length !== data.frameCount) {
      console.warn(
        `[ContactCurveCache] Curve "${data.clipName}" has mismatched frame counts - skipping`
      );
      return;
    }
    this.curves.set(data.clipName, data);
  }

  getContactAt(clipName: string, phase: number): ContactSample {
    const curve = this.curves.get(clipName);
    if (!curve) return EMPTY_SAMPLE;

    const clampedPhase = Math.max(0, Math.min(1, phase));
    const floatIndex = clampedPhase * (curve.frameCount - 1);
    const i0 = Math.floor(floatIndex);
    const i1 = Math.min(curve.frameCount - 1, i0 + 1);
    const t = floatIndex - i0;

    // `register()` validates that leftFoot.length === rightFoot.length === frameCount,
    // and i0/i1 are clamped to [0, frameCount-1] above, so these indexed accesses are
    // always in-bounds. The non-null assertions satisfy noUncheckedIndexedAccess.
    const l0 = curve.leftFoot[i0]!;
    const l1 = curve.leftFoot[i1]!;
    const r0 = curve.rightFoot[i0]!;
    const r1 = curve.rightFoot[i1]!;

    return {
      leftFoot: l0 * (1 - t) + l1 * t,
      rightFoot: r0 * (1 - t) + r1 * t,
      hasCurve: true,
    };
  }

  has(clipName: string): boolean {
    return this.curves.has(clipName);
  }

  unregister(clipName: string): void {
    this.curves.delete(clipName);
  }
}
