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

export class ContactCurveCache implements IContactCurveCache {
  private readonly curves = new Map<string, ContactCurveData>();

  register(data: ContactCurveData): void {
    if (data.leftFoot.length !== data.frameCount || data.rightFoot.length !== data.frameCount) {
      console.warn(
        `[ContactCurveCache] Curve "${data.clipName}" has mismatched frame counts — skipping`
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

    return {
      leftFoot: curve.leftFoot[i0] * (1 - t) + curve.leftFoot[i1] * t,
      rightFoot: curve.rightFoot[i0] * (1 - t) + curve.rightFoot[i1] * t,
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
