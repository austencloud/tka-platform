import { HandSide, type HandSide as HandSideValue } from "./hand-side.js";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeLegacyHandSide(
  value: unknown
): HandSideValue | undefined {
  switch (value) {
    case HandSide.LEFT:
    case "blue":
      return HandSide.LEFT;
    case HandSide.RIGHT:
    case "red":
      return HandSide.RIGHT;
    default:
      return undefined;
  }
}

/**
 * Converts the legacy motion `color` field into canonical `hand` identity.
 * Unknown view-layer fields are retained so app data can use this at ingress.
 */
export function normalizeLegacyMotion<T>(value: T): T {
  if (!isRecord(value)) return value;

  const normalized: UnknownRecord = { ...value };
  const hand = normalizeLegacyHandSide(value.hand ?? value.color);
  delete normalized.color;
  if (hand !== undefined) normalized.hand = hand;
  return normalized as T;
}

/** Converts a legacy `{blue, red}` motion record into `{left, right}`. */
export function normalizeLegacyMotionRecord<T>(value: T): T {
  if (!isRecord(value)) return value;

  const left = value.left ?? value.blue;
  const right = value.right ?? value.red;
  return {
    ...(left !== undefined && { left: normalizeLegacyMotion(left) }),
    ...(right !== undefined && { right: normalizeLegacyMotion(right) }),
  } as T;
}

/**
 * Normalizes one persisted step while preserving all non-identity metadata.
 */
export function normalizeLegacyStep<T>(value: T): T {
  if (!isRecord(value)) return value;

  const normalized: UnknownRecord = { ...value };
  if (value.motions !== undefined) {
    normalized.motions = normalizeLegacyMotionRecord(value.motions);
  }

  if (normalized.leftReversal === undefined && value.blueReversal !== undefined) {
    normalized.leftReversal = value.blueReversal;
  }
  if (normalized.rightReversal === undefined && value.redReversal !== undefined) {
    normalized.rightReversal = value.redReversal;
  }
  delete normalized.blueReversal;
  delete normalized.redReversal;

  return normalized as T;
}

export function normalizeLegacySteps<T>(values: readonly T[]): T[] {
  return values.map(normalizeLegacyStep);
}
