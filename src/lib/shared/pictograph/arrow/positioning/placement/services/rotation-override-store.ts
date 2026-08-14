import {
  normalizePlacementFrame,
  PlacementFrame,
  type PlacementFrame as PlacementFrameValue,
} from "../domain/placement-frame";

export const ROTATION_OVERRIDE_STORAGE_KEY = "tka_rotation_overrides_v2";
const LEGACY_STORAGE_KEY = "tka_rotation_overrides";

export interface RotationOverrideData {
  [placementFrame: string]: {
    [oriKey: string]: {
      [letter: string]: {
        [turnsTuple: string]: {
          [rotationKey: string]: boolean;
        };
      };
    };
  };
}

function parseStoredData(raw: string | null): RotationOverrideData {
  if (!raw) return {};
  const value = JSON.parse(raw) as unknown;
  return value && typeof value === "object"
    ? (value as RotationOverrideData)
    : {};
}

function normalizeImportedData(
  data: RotationOverrideData
): RotationOverrideData {
  const normalized: RotationOverrideData = {};
  for (const [owner, buckets] of Object.entries(data)) {
    let frame: PlacementFrameValue;
    try {
      frame = normalizePlacementFrame(owner);
    } catch {
      continue;
    }
    // A Box-only legacy override was authored against the retired second
    // coordinate system. It cannot be merged into canonical data safely.
    if (owner === "box") continue;
    normalized[frame] = { ...(normalized[frame] ?? {}), ...buckets };
  }
  return normalized;
}

export function loadRotationOverrides(): RotationOverrideData {
  if (typeof localStorage === "undefined") return {};
  try {
    const current = localStorage.getItem(ROTATION_OVERRIDE_STORAGE_KEY);
    if (current) return normalizeImportedData(parseStoredData(current));

    const legacy = normalizeImportedData(
      parseStoredData(localStorage.getItem(LEGACY_STORAGE_KEY))
    );
    if (Object.keys(legacy).length > 0) {
      localStorage.setItem(
        ROTATION_OVERRIDE_STORAGE_KEY,
        JSON.stringify(legacy)
      );
    }
    return legacy;
  } catch (error) {
    console.error("Failed to load rotation overrides:", error);
    return {};
  }
}

export function saveRotationOverrides(overrides: RotationOverrideData): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(
    ROTATION_OVERRIDE_STORAGE_KEY,
    JSON.stringify(normalizeImportedData(overrides))
  );
}

export function clearRotationOverrides(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(ROTATION_OVERRIDE_STORAGE_KEY);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}

export function getStoredRotationOverride(
  placementFrame: PlacementFrameValue,
  oriKey: string,
  letter: string,
  turnsTuple: string,
  rotationKey: string
): boolean | null {
  const value =
    loadRotationOverrides()?.[placementFrame]?.[oriKey]?.[letter]?.[
      turnsTuple
    ]?.[rotationKey];
  return typeof value === "boolean" ? value : null;
}

export function canonicalRotationOverrideData(
  data: RotationOverrideData
): RotationOverrideData {
  return normalizeImportedData(data);
}

export const DEFAULT_ROTATION_OVERRIDE_FRAME = PlacementFrame.CANONICAL;
