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

type FestivalTurnSymbol = "B" | "R" | "X" | "·";

export interface FestivalTurnPatternPreset {
  id: string;
  label: string;
  symbols: readonly FestivalTurnSymbol[];
  minSequenceLength: 4 | 8 | 16;
}

/**
 * A deliberately small rhythm vocabulary. Four-step cards only receive the
 * strict core. Eight- and sixteen-step cards progressively unlock more room.
 */
export const FESTIVAL_TURN_PATTERN_PRESETS = [
  {
    id: "together-block",
    label: "Together block",
    symbols: ["X", "X", "·", "·"],
    minSequenceLength: 4,
  },
  {
    id: "together-pulse",
    label: "Together pulse",
    symbols: ["X", "·", "X", "·"],
    minSequenceLength: 4,
  },
  {
    id: "split-blocks",
    label: "Split blocks",
    symbols: ["B", "B", "R", "R"],
    minSequenceLength: 4,
  },
  {
    id: "alternating-hands",
    label: "Alternating hands",
    symbols: ["B", "R", "B", "R"],
    minSequenceLength: 4,
  },
  {
    id: "offbeat-together",
    label: "Offbeat together",
    symbols: ["·", "X", "·", "·"],
    minSequenceLength: 8,
  },
  {
    id: "spaced-handoff",
    label: "Spaced handoff",
    symbols: ["B", "·", "R", "·"],
    minSequenceLength: 8,
  },
  {
    id: "trade-then-accent",
    label: "Trade, then accent",
    symbols: ["B", "R", "X", "·"],
    minSequenceLength: 8,
  },
  {
    id: "bookended-trade",
    label: "Bookended trade",
    symbols: ["B", "·", "R", "X"],
    minSequenceLength: 8,
  },
  {
    id: "adjacent-handoff",
    label: "Adjacent handoff",
    symbols: ["B", "R", "·", "·"],
    minSequenceLength: 16,
  },
  {
    id: "accent-then-trade",
    label: "Accent, then trade",
    symbols: ["X", "·", "B", "R"],
    minSequenceLength: 16,
  },
  {
    id: "dense-handoff",
    label: "Dense handoff",
    symbols: ["X", "X", "B", "R"],
    minSequenceLength: 16,
  },
  {
    id: "cross-accent",
    label: "Cross accent",
    symbols: ["B", "X", "R", "X"],
    minSequenceLength: 16,
  },
] as const satisfies readonly FestivalTurnPatternPreset[];

export type FestivalTurnPatternId =
  (typeof FESTIVAL_TURN_PATTERN_PRESETS)[number]["id"];

function turnPairForSymbol(
  symbol: FestivalTurnSymbol,
  intensity: 0.5 | 1
): string {
  if (symbol === "B") return `${intensity}|0`;
  if (symbol === "R") return `0|${intensity}`;
  if (symbol === "X") return `${intensity}|${intensity}`;
  return "0|0";
}

export function buildFestivalTurnPattern(
  preset: FestivalTurnPatternPreset,
  unitLength: number,
  intensity: 0.5 | 1
): string {
  if (
    unitLength < preset.symbols.length ||
    unitLength % preset.symbols.length !== 0
  ) {
    throw new Error(
      `${preset.label} cannot fill a ${unitLength}-step structural unit.`
    );
  }
  return Array.from({ length: unitLength }, (_, index) =>
    turnPairForSymbol(preset.symbols[index % preset.symbols.length]!, intensity)
  ).join("-");
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
export interface FestivalSamplerTurnAssignment {
  id: FestivalTurnPatternId;
  pattern: string;
}

export function findCompatibleFestivalSamplerTurnAssignment(
  card: FestivalSamplerCardManifest,
  base: SequenceData,
  seed = [card.source, card.sourceRef, card.id, card.name, card.slot].join("|")
): FestivalSamplerTurnAssignment {
  const turnIntensity = card.turnIntensity ?? 0;
  if (turnIntensity !== 1 && turnIntensity !== 0.5) {
    throw new Error(
      `Festival sampler cannot choose a pattern for turn intensity ${turnIntensity}: ${card.name}`
    );
  }
  const unitLength = festivalTurnUnitLength(card, base);
  const sequenceLength = card.sequenceLength ?? base.steps.length;
  const candidates = FESTIVAL_TURN_PATTERN_PRESETS.filter(
    (preset) => sequenceLength >= preset.minSequenceLength
  )
    .map((preset) => ({
      preset,
      turnPattern: buildFestivalTurnPattern(preset, unitLength, turnIntensity),
    }))
    .sort(
      (left, right) =>
        stablePatternHash(`${seed}|${left.preset.id}`) -
          stablePatternHash(`${seed}|${right.preset.id}`) ||
        left.preset.id.localeCompare(right.preset.id)
    );
  if (candidates.length === 0) {
    throw new Error(
      `Festival sampler has no structural turn patterns for ${unitLength} steps: ${card.name}`
    );
  }
  for (const { preset, turnPattern } of candidates) {
    const applied = applyVariationDescriptor(base, { turnPattern }, []);
    if (
      applied.turnLoopClosed &&
      hasCleanFestivalTurnResult(applied.sequence, turnIntensity)
    ) {
      return { id: preset.id, pattern: turnPattern };
    }
  }
  throw new Error(
    `Festival sampler found no loop-closing ${turnIntensity}-turn pattern for ${card.name}`
  );
}

export function findCompatibleFestivalSamplerTurnPattern(
  card: FestivalSamplerCardManifest,
  base: SequenceData,
  seed?: string
): string {
  return findCompatibleFestivalSamplerTurnAssignment(card, base, seed).pattern;
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
  const frozenPreset = card.turnPatternId
    ? FESTIVAL_TURN_PATTERN_PRESETS.find(
        (preset) => preset.id === card.turnPatternId
      )
    : null;
  const sequenceLength = card.sequenceLength ?? base.steps.length;
  const frozenPatternMatches = frozenPreset
    ? sequenceLength >= frozenPreset.minSequenceLength &&
      buildFestivalTurnPattern(
        frozenPreset,
        expectedUnitLength,
        turnIntensity
      ) === card.turnPattern
    : true;
  if (
    unit.length !== expectedUnitLength ||
    !frozenPatternMatches ||
    !unitTurns.some((turn) => turn === turnIntensity) ||
    !unitTurns.some((turn) => turn === 0) ||
    unitTurns.some((turn) => turn !== 0 && turn !== turnIntensity)
  ) {
    throw new Error(
      `Festival sampler turn pattern is not valid for the ${expectedUnitLength}-step structural unit, ${sequenceLength}-step card, and ${turnIntensity}-turn cap: ${card.name}`
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
