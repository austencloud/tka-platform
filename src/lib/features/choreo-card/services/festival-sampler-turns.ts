import { hydrateSequence } from "./sequence-render-hydrator";
import { applyVariationDescriptor, parseTurnUnit } from "./deck-variation";
import {
  updateSequenceData,
  type SequenceData,
} from "$lib/shared/foundation/domain/models/sequence-data";
import { hydrate as hydrateCompositionalSequence } from "$lib/shared/foundation/services/sequence-hydrator";
import publicSnapshot from "../../../../../static/data/snapshots/public-sequences.json";
import tndBaseWords from "../../../../../static/data/hero/tnd-base-words.json";
import localSequences from "../data/festival-sampler-sequences.json";
import type { FestivalSamplerCardManifest } from "./festival-sampler-manifest";

const publicDocuments = (publicSnapshot.documents ?? []) as unknown as Array<
  Record<string, unknown>
>;
const localTndRecords = new Map(
  (tndBaseWords as Array<Record<string, unknown>>).map((record) => [
    record.name as string,
    record,
  ])
);
const localSequenceRecords = (localSequences.records ?? {}) as Record<
  string,
  Record<string, unknown>
>;

async function findPublicSequence(
  card: FestivalSamplerCardManifest
): Promise<SequenceData> {
  const indexed = publicDocuments.find(
    (sequence) =>
      sequence.id === card.id && sequence.sourceRef === card.sourceRef
  );
  if (!indexed) throw new Error(`Published sequence not found: ${card.name}`);

  const sequence = hydrateCompositionalSequence(hydrateSequence(indexed));
  if (sequence.steps.length === 0) {
    throw new Error(`Published sequence has no renderable steps: ${card.name}`);
  }
  return sequence;
}

export async function loadFestivalSamplerBaseSequence(
  card: FestivalSamplerCardManifest
): Promise<SequenceData> {
  if (card.source === "publicSequences") return findPublicSequence(card);

  if (card.source === "catalog") {
    const record = localTndRecords.get(card.name);
    if (!record) {
      throw new Error(`Festival sampler TnD source is missing: ${card.name}`);
    }
    return hydrateSequence(record);
  }

  const localRecord = localSequenceRecords[card.id ?? card.name];
  if (localRecord) return hydrateSequence(localRecord);

  throw new Error(`Festival sampler source is missing: ${card.name}`);
}

function stablePatternHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function buildStructuralTurnPatternCandidates(
  unitLength: number,
  turnIntensity: number,
  seed: string
): string[] {
  const motifLengths =
    unitLength === 4 ? [1, 2] : unitLength === 8 ? [1, 2, 4] : [];
  const candidates = new Set<string>();
  for (const motifLength of motifLengths) {
    const bitCount = motifLength * 2;
    const allTurns = 2 ** bitCount - 1;
    for (let mask = 1; mask < allTurns; mask += 1) {
      const motif = Array.from({ length: motifLength }, (_, index) => {
        const blue = mask & (1 << (index * 2));
        const red = mask & (1 << (index * 2 + 1));
        return `${blue ? turnIntensity : 0}|${red ? turnIntensity : 0}`;
      });
      candidates.add(
        Array.from(
          { length: unitLength },
          (_, index) => motif[index % motifLength]!
        ).join("-")
      );
    }
  }
  return [...candidates].sort(
    (left, right) =>
      stablePatternHash(`${seed}|${left}`) -
        stablePatternHash(`${seed}|${right}`) || left.localeCompare(right)
  );
}

function hasRepeatingTurnMotif(
  unit: ReturnType<typeof parseTurnUnit>
): boolean {
  for (let motifLength = 1; motifLength < unit.length; motifLength += 1) {
    if (unit.length % motifLength !== 0) continue;
    if (
      unit.every((entry, index) => {
        const motifEntry = unit[index % motifLength]!;
        return entry.blue === motifEntry.blue && entry.red === motifEntry.red;
      })
    ) {
      return true;
    }
  }
  return false;
}

function festivalTurnUnitLength(
  card: FestivalSamplerCardManifest,
  base: SequenceData
): number {
  const period = card.source === "catalog" ? 1 : Number(card.period ?? 1);
  return base.steps.length / period;
}

function hasCleanFestivalTurnResult(
  sequence: SequenceData,
  turnIntensity: number
): boolean {
  const turns = sequence.steps.flatMap((step) => [
    step.motions?.blue?.turns,
    step.motions?.red?.turns,
  ]);
  return (
    turns.some((turn) => turn === turnIntensity) &&
    turns.some((turn) => turn === 0) &&
    turns.every(
      (turn) => typeof turn === "number" && turn >= 0 && turn <= turnIntensity
    )
  );
}

/** Pick a deterministic structural pattern that preserves loop closure. */
export function findCompatibleFestivalSamplerTurnPattern(
  card: FestivalSamplerCardManifest,
  base: SequenceData,
  seed = [card.source, card.sourceRef, card.id, card.name, card.slot].join("|")
): string {
  const turnIntensity = card.turnIntensity ?? 0;
  if (turnIntensity !== 1 && turnIntensity !== 0.5) {
    throw new Error(
      `Festival sampler cannot choose a pattern for turn intensity ${turnIntensity}: ${card.name}`
    );
  }
  const unitLength = festivalTurnUnitLength(card, base);
  const candidates = buildStructuralTurnPatternCandidates(
    unitLength,
    turnIntensity,
    seed
  );
  if (candidates.length === 0) {
    throw new Error(
      `Festival sampler has no structural turn patterns for ${unitLength} steps: ${card.name}`
    );
  }
  for (const turnPattern of candidates) {
    const applied = applyVariationDescriptor(base, { turnPattern }, []);
    if (
      applied.turnLoopClosed &&
      hasCleanFestivalTurnResult(applied.sequence, turnIntensity)
    ) {
      return turnPattern;
    }
  }
  throw new Error(
    `Festival sampler found no loop-closing ${turnIntensity}-turn pattern for ${card.name}`
  );
}

export function applyFestivalSamplerTurnAssignment(
  card: FestivalSamplerCardManifest,
  base: SequenceData
): SequenceData {
  const turnIntensity = card.turnIntensity ?? 0;
  if (turnIntensity === 0) {
    return updateSequenceData(base, { level: 1 });
  }
  const recipe =
    turnIntensity === 1
      ? { level: 2 }
      : turnIntensity === 0.5
        ? { level: 3 }
        : null;
  if (!recipe || !card.turnPattern) {
    throw new Error(
      `Festival sampler received an unsupported frozen turn assignment: ${card.turnPattern ?? "none"} at intensity ${turnIntensity} for ${card.name}`
    );
  }
  const unit = parseTurnUnit(card.turnPattern);
  const expectedUnitLength = festivalTurnUnitLength(card, base);
  const unitTurns = unit.flatMap((entry) => [entry.blue, entry.red]);
  if (
    unit.length !== expectedUnitLength ||
    !hasRepeatingTurnMotif(unit) ||
    !unitTurns.some((turn) => turn === turnIntensity) ||
    !unitTurns.some((turn) => turn === 0) ||
    unitTurns.some((turn) => turn !== 0 && turn !== turnIntensity)
  ) {
    throw new Error(
      `Festival sampler turn pattern is not a cyclic motif for the ${expectedUnitLength}-step structural unit and ${turnIntensity}-turn cap: ${card.name}`
    );
  }

  const applied = applyVariationDescriptor(
    base,
    { turnPattern: card.turnPattern },
    []
  );
  if (!applied.turnLoopClosed) {
    throw new Error(
      `Festival sampler turn assignment breaks loop closure: ${card.name}`
    );
  }
  if (!hasCleanFestivalTurnResult(applied.sequence, turnIntensity)) {
    throw new Error(
      `Festival sampler turn assignment was not applied cleanly: ${card.name}`
    );
  }
  return updateSequenceData(applied.sequence, { level: recipe.level });
}

export async function resolveFestivalSamplerCardSequence(
  card: FestivalSamplerCardManifest
): Promise<SequenceData> {
  const base = await loadFestivalSamplerBaseSequence(card);
  return applyFestivalSamplerTurnAssignment(card, base);
}
