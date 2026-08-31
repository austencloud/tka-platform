import { HandSide, type HandSide as HandSideValue } from "./hand-side.js";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function moveLegacyField(
  target: UnknownRecord,
  source: UnknownRecord,
  canonicalKey: string,
  legacyKey: string
): void {
  if (target[canonicalKey] === undefined && source[legacyKey] !== undefined) {
    target[canonicalKey] = source[legacyKey];
  }
  delete target[legacyKey];
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

/** Converts legacy reversal aliases on a compositional step pairing. */
export function normalizeLegacyStepPairing<T>(value: T): T {
  if (!isRecord(value)) return value;

  const normalized: UnknownRecord = { ...value };
  moveLegacyField(normalized, value, "leftReversal", "blueReversal");
  moveLegacyField(normalized, value, "rightReversal", "redReversal");
  return normalized as T;
}

/** Converts legacy per-color prop configuration into performer-relative keys. */
export function normalizeLegacyPropConfig<T>(value: T): T {
  if (!isRecord(value)) return value;

  const normalized: UnknownRecord = { ...value };
  moveLegacyField(normalized, value, "leftPropType", "bluePropType");
  moveLegacyField(normalized, value, "rightPropType", "redPropType");
  moveLegacyField(normalized, value, "leftPropDimensions", "bluePropDimensions");
  moveLegacyField(normalized, value, "rightPropDimensions", "redPropDimensions");
  return normalized as T;
}

/**
 * Normalizes every known persisted hand-identity field on a sequence document.
 * This is deliberately structural and retains unrelated application metadata.
 */
export function normalizeLegacySequence<T>(value: T): T {
  if (!isRecord(value)) return value;

  const normalized: UnknownRecord = { ...value };
  moveLegacyField(normalized, value, "leftSoloProp", "blueSoloProp");
  moveLegacyField(normalized, value, "rightSoloProp", "redSoloProp");
  moveLegacyField(normalized, value, "leftPathHash", "bluePathHash");
  moveLegacyField(normalized, value, "rightPathHash", "redPathHash");
  moveLegacyField(normalized, value, "leftSoloHash", "blueSoloHash");
  moveLegacyField(normalized, value, "rightSoloHash", "redSoloHash");

  if (Array.isArray(value.steps)) {
    normalized.steps = normalizeLegacySteps(value.steps);
  }
  if (value.startPosition !== undefined) {
    normalized.startPosition = normalizeLegacyStep(value.startPosition);
  }
  if (value.startingPosition !== undefined) {
    normalized.startingPosition = normalizeLegacyStep(value.startingPosition);
  }
  if (Array.isArray(value.stepPairings)) {
    normalized.stepPairings = value.stepPairings.map(normalizeLegacyStepPairing);
  }
  if (value.intendedProp !== undefined) {
    normalized.intendedProp = normalizeLegacyPropConfig(value.intendedProp);
  }
  if (isRecord(value.creatorIntent)) {
    normalized.creatorIntent = {
      ...value.creatorIntent,
      ...(value.creatorIntent.propConfig !== undefined && {
        propConfig: normalizeLegacyPropConfig(value.creatorIntent.propConfig),
      }),
    };
  }

  return normalized as T;
}
