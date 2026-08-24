import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { parsePropTypeFromURLValue } from "$lib/shared/navigation/services/sequence-encoder";

/** A raw, untrusted prop-config shape. Values come from Firestore wire data,
 * URL params, or scan telemetry, so nothing is assumed valid until parsed. */
export interface PropConfigCandidate {
  bluePropType?: unknown;
  redPropType?: unknown;
  catDogMode?: unknown;
}

export interface ResolvedPropConfig {
  bluePropType: PropType;
  redPropType: PropType;
  catDogMode: boolean;
}

export function propFromCandidates(
  color: "bluePropType" | "redPropType",
  candidates: readonly (PropConfigCandidate | null | undefined)[]
): PropType | undefined {
  for (const candidate of candidates) {
    const raw = candidate?.[color];
    if (typeof raw !== "string") continue;
    const propType = parsePropTypeFromURLValue(raw);
    if (propType) return propType;
  }
  return undefined;
}

export function catDogFromCandidates(
  candidates: readonly (PropConfigCandidate | null | undefined)[]
): boolean | undefined {
  for (const candidate of candidates) {
    if (typeof candidate?.catDogMode === "boolean") {
      return candidate.catDogMode;
    }
  }
  return undefined;
}

/** Creator-recorded evidence on the sequence itself, strongest first.
 * Deliberately excludes per-motion propType: public-index hydration derives
 * steps with a staff default, so motion data on hydrated public sequences
 * always reads staff and would poison any fallback built on it. */
export function sequenceIntentCandidates(
  sequence: SequenceData | null | undefined
): (PropConfigCandidate | null | undefined)[] {
  return [sequence?.creatorIntent?.propConfig, sequence?.intendedProp];
}

/** The slice of AppSettings that describes the creator's active prop pair. */
export interface ActivePropSettings {
  bluePropType?: PropType;
  redPropType?: PropType;
  /** Legacy single-prop field, still the only value on old profiles. */
  propType?: PropType;
  catDogMode?: boolean;
}

/**
 * The prop pair a creator is actively looking at, for stamping onto a
 * sequence at a publication moment. Settings always resolve to a pair (staff
 * is the app's render default), so unlike resolveRecordedPropConfig this
 * never returns null.
 */
export function captureActivePropConfig(
  settings: ActivePropSettings
): ResolvedPropConfig {
  const bluePropType =
    settings.bluePropType ?? settings.propType ?? PropType.STAFF;
  const redPropType =
    settings.redPropType ?? settings.propType ?? PropType.STAFF;
  return {
    bluePropType,
    redPropType,
    catDogMode:
      bluePropType !== redPropType ? true : (settings.catDogMode ?? false),
  };
}

/**
 * The prop pair the creator recorded for this sequence, or null when no valid
 * recording exists. Both hands must parse — a half-valid record is corrupt,
 * not a recording — and null means the caller keeps its own context (public
 * previews fall back to the visitor's props). Never returns a guessed default.
 */
export function resolveRecordedPropConfig(
  sequence: SequenceData | null | undefined
): ResolvedPropConfig | null {
  const candidates = sequenceIntentCandidates(sequence);
  const bluePropType = propFromCandidates("bluePropType", candidates);
  const redPropType = propFromCandidates("redPropType", candidates);
  if (!bluePropType || !redPropType) return null;

  const recordedCatDog = catDogFromCandidates(candidates);
  return {
    bluePropType,
    redPropType,
    // A mixed pair is cat-dog by construction, even when an older record's
    // sequence-level flag says false — same inference the scan resolver uses.
    catDogMode:
      bluePropType !== redPropType ? true : (recordedCatDog ?? false),
  };
}
