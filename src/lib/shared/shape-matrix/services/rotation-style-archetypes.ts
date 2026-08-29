import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  buildTnDSeedClasses,
  getTnDFamilyOptions,
} from "$lib/features/choreo-card/services/deck-composer";
import { loadTndBaseWords } from "$lib/features/choreo-card/services/tnd-base-word-snapshot";
import { applyVariationDescriptor } from "$lib/features/choreo-card/services/deck-variation";
import type { CardVariation } from "$lib/features/choreo-card/domain/models/DeckRelease";
import { loadDiamondEdges } from "$lib/features/choreo-card/services/pictograph-letter-lookup";
import {
  classifyRotationStyle,
  type RotationStyle,
} from "../domain/rotation-style";

export type RotationGridMode = "diamond" | "box";
export type StartOrientationPair = {
  blue?: Orientation;
  red?: Orientation;
};

export interface ClassifiedRotationStyleMember {
  seq: SequenceData;
  familyId: string;
}

export interface RotationStyleArchetype {
  style: RotationStyle;
  byTurn: Map<string, SequenceData>;
}

export const ROTATION_STYLE_ORDER: RotationStyle[] = [
  "iso",
  "antispin",
  "hybrid",
];

function word(seedId: string): string {
  return (seedId.split("-").pop() ?? seedId).toUpperCase();
}

let basesPromise: Promise<SequenceData[]> | null = null;

export function loadRotationStyleBases(): Promise<SequenceData[]> {
  if (!basesPromise) basesPromise = loadTndBaseWords();
  return basesPromise;
}

export function classifyRotationStyleMembers(
  bases: SequenceData[],
  grid: RotationGridMode
): Map<RotationStyle, ClassifiedRotationStyleMember[]> {
  const seedClasses = buildTnDSeedClasses(bases);
  const familyBySeed = new Map<string, string>();
  for (const family of getTnDFamilyOptions(seedClasses, [grid])) {
    for (const entry of family.entries) {
      familyBySeed.set(entry.sequenceId, family.familyId);
    }
  }

  const baseById = new Map(bases.map((base) => [base.id, base]));
  const byStyle = new Map<RotationStyle, ClassifiedRotationStyleMember[]>();
  for (const [seedId, familyId] of familyBySeed) {
    const sequence = baseById.get(seedId);
    if (!sequence) continue;
    const style = classifyRotationStyle(sequence);
    const members = byStyle.get(style) ?? [];
    members.push({ seq: sequence, familyId });
    byStyle.set(style, members);
  }
  return byStyle;
}

export function representativeRotationStyleMember(
  members: ClassifiedRotationStyleMember[]
): SequenceData {
  return [...members].sort((left, right) => {
    const leftDistinct = new Set(word(left.seq.id).split("")).size;
    const rightDistinct = new Set(word(right.seq.id).split("")).size;
    if (leftDistinct !== rightDistinct) {
      return leftDistinct - rightDistinct;
    }
    return word(left.seq.id).localeCompare(word(right.seq.id));
  })[0]!.seq;
}

/** Resolve only the zero-turn representatives consumed by flower paths. */
export async function resolveRotationStyleArchetypes(
  grid: RotationGridMode = "diamond",
  startOrientation?: StartOrientationPair
): Promise<RotationStyleArchetype[]> {
  const [bases, edges] = await Promise.all([
    loadRotationStyleBases(),
    loadDiamondEdges(),
  ]);
  const byStyle = classifyRotationStyleMembers(bases, grid);
  const archetypes: RotationStyleArchetype[] = [];

  for (const style of ROTATION_STYLE_ORDER) {
    const members = byStyle.get(style) ?? [];
    if (members.length === 0) continue;
    const representative = representativeRotationStyleMember(members);
    const sequence = applyVariationDescriptor(
      representative,
      {
        turnPattern: "0|0",
        turnLabel: "0|0",
        gridMode: grid,
        startOriPair: startOrientation,
      } satisfies CardVariation,
      edges
    ).sequence;
    archetypes.push({ style, byTurn: new Map([["0|0", sequence]]) });
  }
  return archetypes;
}
