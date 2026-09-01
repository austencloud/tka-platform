import { normalizeLegacyPropConfig } from "@tka/tka-types";

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

/** Restores the plane pair written by pre-left/right 3D viewer builds. */
export function normalizeLegacyPerformerSnapshot<T>(value: T): T {
  if (!isRecord(value)) return value;

  const normalized: UnknownRecord = { ...value };
  moveLegacyField(normalized, value, "customLeftPlane", "customBluePlane");
  moveLegacyField(normalized, value, "customRightPlane", "customRedPlane");
  return normalized as T;
}

/**
 * Normalizes the hand-identity fields shared by local viewer snapshots and
 * collected 3D scenes. Unknown versioned fields stay intact for their schema.
 */
export function normalizeLegacyScene3DSnapshot<T>(value: T): T {
  if (!isRecord(value)) return value;

  const normalized: UnknownRecord = { ...value };
  if (Array.isArray(value.performers)) {
    normalized.performers = value.performers.map(
      normalizeLegacyPerformerSnapshot
    );
  }
  if (value.defaultSettings !== undefined) {
    normalized.defaultSettings = normalizeLegacyPerformerSnapshot(
      value.defaultSettings
    );
  }
  if (value.props !== undefined) {
    normalized.props = normalizeLegacyPropConfig(value.props);
  }
  return normalized as T;
}
