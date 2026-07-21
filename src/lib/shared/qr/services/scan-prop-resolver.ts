import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { parsePropTypeFromURLValue } from "$lib/shared/navigation/services/sequence-encoder";

export interface ScanPropCandidate {
  bluePropType?: unknown;
  redPropType?: unknown;
  catDogMode?: unknown;
}

export interface ScanPropConfig {
  bluePropType: PropType;
  redPropType: PropType;
  catDogMode: boolean;
}

function propFromCandidates(
  color: "bluePropType" | "redPropType",
  candidates: readonly (ScanPropCandidate | null | undefined)[]
): PropType | undefined {
  for (const candidate of candidates) {
    const raw = candidate?.[color];
    if (typeof raw !== "string") continue;
    const propType = parsePropTypeFromURLValue(raw);
    if (propType) return propType;
  }
  return undefined;
}

function catDogFromCandidates(
  candidates: readonly (ScanPropCandidate | null | undefined)[]
): boolean | undefined {
  for (const candidate of candidates) {
    if (typeof candidate?.catDogMode === "boolean") {
      return candidate.catDogMode;
    }
  }
  return undefined;
}

function motionProps(
  sequence: SequenceData | null | undefined
): ScanPropCandidate {
  if (!sequence) return {};
  let bluePropType: unknown;
  let redPropType: unknown;
  const pictographs = [sequence.startPosition, ...(sequence.steps ?? [])];
  for (const pictograph of pictographs) {
    bluePropType ??= pictograph?.motions?.blue?.propType;
    redPropType ??= pictograph?.motions?.red?.propType;
    if (bluePropType && redPropType) break;
  }
  return { bluePropType, redPropType };
}

/**
 * Resolve the prop represented by a scan. Callers pass strongest evidence
 * first: the scan event, then its shortcode record. Sequence intent and motion
 * data cover historical events that predate per-scan prop telemetry.
 */
export function resolveScanPropConfig(
  sequence: SequenceData | null | undefined,
  ...scanCandidates: readonly (ScanPropCandidate | null | undefined)[]
): ScanPropConfig {
  const sequenceCandidates: (ScanPropCandidate | null | undefined)[] = [
    sequence?.creatorIntent?.propConfig,
    sequence?.intendedProp,
    motionProps(sequence),
  ];
  const candidates = [...scanCandidates, ...sequenceCandidates];

  return {
    bluePropType:
      propFromCandidates("bluePropType", candidates) ?? PropType.STAFF,
    redPropType:
      propFromCandidates("redPropType", candidates) ?? PropType.STAFF,
    catDogMode: catDogFromCandidates(candidates) ?? false,
  };
}
