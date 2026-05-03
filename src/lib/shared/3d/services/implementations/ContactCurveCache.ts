import type {
  IContactCurveCache,
  ContactCurveData,
  ContactSample,
} from "../contracts/IContactCurveCache";

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
