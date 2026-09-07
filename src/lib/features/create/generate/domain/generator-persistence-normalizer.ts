import { normalizeLegacyHandPair, normalizeLegacyStep } from "@tka/tka-types";
import {
  clampToAvailableLevel,
  type UIGenerationConfig,
} from "../shared/utils/config-mapper";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Generator settings have lived in localStorage and Firestore since before hand
 * identity became performer-relative. Normalize those records before the live
 * state or sequence engine sees them; every subsequent save stays left/right.
 */
export function normalizePersistedGenerationConfig(
  value: unknown
): Partial<UIGenerationConfig> {
  if (!isRecord(value)) return {};

  const normalized: UnknownRecord = { ...value };
  if (value.turnPattern !== undefined) {
    normalized.turnPattern = normalizeLegacyHandPair(value.turnPattern);
  }
  // Level 4 (SKEWED) pictograph data does not exist yet (see
  // MAX_AVAILABLE_LEVEL in config-mapper.ts). A config saved to localStorage
  // or Firestore before that gate existed can still carry level 4; clamp it
  // here so it degrades to the nearest available level instead of silently
  // asking the generator to build data that isn't there.
  if (typeof value.level === "number") {
    normalized.level = clampToAvailableLevel(value.level);
  }
  return normalized as Partial<UIGenerationConfig>;
}

/** Restores the legacy generator constraint envelope without weakening its live type. */
export function normalizePersistedStartEndOptions<T>(value: T): T {
  if (!isRecord(value)) return value;

  const normalized: UnknownRecord = { ...value };
  if (
    normalized.leftStartOrientation === undefined &&
    value.blueStartOrientation !== undefined
  ) {
    normalized.leftStartOrientation = value.blueStartOrientation;
  }
  if (
    normalized.rightStartOrientation === undefined &&
    value.redStartOrientation !== undefined
  ) {
    normalized.rightStartOrientation = value.redStartOrientation;
  }
  delete normalized.blueStartOrientation;
  delete normalized.redStartOrientation;

  if (value.startPosition !== undefined) {
    normalized.startPosition = normalizeLegacyStep(value.startPosition);
  }
  if (value.endPosition !== undefined) {
    normalized.endPosition = normalizeLegacyStep(value.endPosition);
  }

  return normalized as T;
}
