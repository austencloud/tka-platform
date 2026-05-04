import type {
  ContactCurveData,
  ContactSample,
} from "./contracts/types";

const EMPTY_SAMPLE: ContactSample = Object.freeze({
  leftFoot: 0,
  rightFoot: 0,
  hasCurve: false,
}) as ContactSample;

export interface ContactCurveCacheState {
  readonly curves: Map<string, ContactCurveData>;
}

export function createContactCurveCache(): ContactCurveCacheState {
  return { curves: new Map() };
}

export function registerCurve(state: ContactCurveCacheState, data: ContactCurveData): void {
  if (data.leftFoot.length !== data.frameCount || data.rightFoot.length !== data.frameCount) {
    console.warn(
      `[contact-curve-cache] Curve "${data.clipName}" has mismatched frame counts - skipping`,
    );
    return;
  }
  state.curves.set(data.clipName, data);
}

export function getContactAt(state: ContactCurveCacheState, clipName: string, phase: number): ContactSample {
  const curve = state.curves.get(clipName);
  if (!curve) return EMPTY_SAMPLE;

  const clampedPhase = Math.max(0, Math.min(1, phase));
  const floatIndex = clampedPhase * (curve.frameCount - 1);
  const i0 = Math.floor(floatIndex);
  const i1 = Math.min(curve.frameCount - 1, i0 + 1);
  const t = floatIndex - i0;

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

export function hasCurve(state: ContactCurveCacheState, clipName: string): boolean {
  return state.curves.has(clipName);
}

export function unregisterCurve(state: ContactCurveCacheState, clipName: string): void {
  state.curves.delete(clipName);
}
