import type { FestivalSamplerCardManifest } from "./festival-sampler-manifest";
import {
  LOOPComponent,
  loopSpecFromLegacyRhythm,
} from "@tka/sequence-engine/loop";
import {
  FESTIVAL_TURN_PATTERN_PRESETS,
  type FestivalTurnPatternId,
} from "./festival-sampler-turns";
import voteSeed from "../data/festival-sampler-turn-vote-seed.json";

export type FestivalTurnDecision = "yay" | "nay";
export type FestivalTurnHand = "left" | "right";
export type FestivalTurnValue = 0 | 0.5 | 1;
export type FestivalTurnReviewFilter = "all" | "unreviewed" | "yay" | "nay";

export interface FestivalTurnEntry {
  left: FestivalTurnValue;
  right: FestivalTurnValue;
}

export interface FestivalTurnReviewManifest {
  rank: number;
  cards: FestivalSamplerCardManifest[];
}

export interface FestivalTurnReviewExample {
  id: string;
  turnIntensity: 0.5 | 1;
  pattern: string;
  effectivePattern: string;
  assignedEntries: FestivalTurnEntry[];
  effectiveEntries: FestivalTurnEntry[];
  swapMask: boolean[];
  unitLength: number;
  sequenceLength: number;
  loopType: string | null;
  period: number | null;
  swapPeriod: number | null;
  usageCount: number;
  packNumbers: number[];
  slots: string[];
  representativeCard: FestivalSamplerCardManifest;
  representativePackNumber: number;
}

export interface FestivalTurnReviewItem {
  id: FestivalTurnPatternId;
  label: string;
  symbols: string;
  minSequenceLength: 4 | 8 | 16;
  usageCount: number;
  packNumbers: number[];
  slots: string[];
  examples: FestivalTurnReviewExample[];
  representativeCard: FestivalSamplerCardManifest;
  representativePackNumber: number;
}

export interface FestivalTurnReviewDecisionRecord {
  decision: FestivalTurnDecision;
  originalPattern: string;
  reviewedPattern: string;
  originalEffectivePattern: string;
  reviewedEffectivePattern: string;
  loopType: string | null;
  period: number | null;
  updatedAt: string;
  source?: "imported-v2" | "conversation-2026-08-14" | "browser";
}

export interface FestivalTurnPatternContext {
  pattern: string;
  effectivePattern: string;
  assignedEntries: FestivalTurnEntry[];
  effectiveEntries: FestivalTurnEntry[];
  swapMask: boolean[];
  unitLength: number;
  sequenceLength: number;
  loopType: string | null;
  period: number | null;
  swapPeriod: number | null;
}

export type FestivalTurnReviewDecisions = Record<
  string,
  FestivalTurnReviewDecisionRecord
>;

export interface FestivalTurnReviewStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface FestivalTurnReviewSession {
  selectedId: string;
  selectedExampleId: string;
  filter: FestivalTurnReviewFilter;
  draftPattern: string;
  motifLength: number;
  patternScrollTop: number;
  patternScrollLeft: number;
  workspaceScrollTop: number;
  pageScrollTop: number;
}

export const FESTIVAL_TURN_REVIEW_STORAGE_KEY =
  "deckReleaser.festivalSampler.turnReview.v3";
export const FESTIVAL_TURN_REVIEW_SESSION_KEY =
  "deckReleaser.festivalSampler.turnReview.session.v3";

function isTurnIntensity(value: number): value is 0.5 | 1 {
  return value === 0.5 || value === 1;
}

function turnPatternExampleId(
  turnIntensity: number,
  context: FestivalTurnPatternContext
): string {
  return [
    turnIntensity,
    context.loopType ?? "none",
    context.period ?? "none",
    context.pattern,
    context.effectivePattern,
  ].join(":");
}

export function parseFestivalTurnPattern(pattern: string): FestivalTurnEntry[] {
  if (!pattern.trim()) throw new Error("Turn pattern is empty.");

  return pattern.split("-").map((pair) => {
    const values = pair.split("|");
    if (values.length !== 2) {
      throw new Error(`Turn pair is not blue|red: ${pair}`);
    }
    const left = Number(values[0]);
    const right = Number(values[1]);
    if (![0, 0.5, 1].includes(left) || ![0, 0.5, 1].includes(right)) {
      throw new Error(`Turn pair has an unsupported value: ${pair}`);
    }
    return {
      left: left as FestivalTurnValue,
      right: right as FestivalTurnValue,
    };
  });
}

export function formatFestivalTurnPattern(
  entries: readonly FestivalTurnEntry[]
): string {
  return entries.map(({ left, right }) => `${left}|${right}`).join("-");
}

export function smallestFestivalTurnMotifLength(
  entries: readonly FestivalTurnEntry[]
): number {
  for (let length = 1; length <= entries.length; length += 1) {
    if (entries.length % length !== 0) continue;
    const repeats = entries.every((entry, index) => {
      const motifEntry = entries[index % length];
      return motifEntry?.left === entry.left && motifEntry.right === entry.right;
    });
    if (repeats) return length;
  }
  return entries.length;
}

export function repeatFestivalTurnMotif(
  entries: readonly FestivalTurnEntry[],
  motifLength: number,
  unitLength: number
): FestivalTurnEntry[] {
  if (
    motifLength < 1 ||
    motifLength > entries.length ||
    unitLength % motifLength !== 0
  ) {
    throw new Error(
      `${motifLength} steps cannot repeat across a ${unitLength}-step unit.`
    );
  }
  const motif = entries.slice(0, motifLength);
  return Array.from({ length: unitLength }, (_, index) => ({
    ...motif[index % motifLength]!,
  }));
}

export function setFestivalTurnMotifValue(
  entries: readonly FestivalTurnEntry[],
  motifLength: number,
  stepIndex: number,
  hand: FestivalTurnHand,
  value: FestivalTurnValue
): FestivalTurnEntry[] {
  const motif = entries.slice(0, motifLength).map((entry) => ({ ...entry }));
  const motifIndex = stepIndex % motifLength;
  const entry = motif[motifIndex];
  if (!entry)
    throw new Error(`Turn step ${stepIndex + 1} is outside the motif.`);
  entry[hand] = value;
  return repeatFestivalTurnMotif(motif, motifLength, entries.length);
}

function swapPeriodForCard(card: FestivalSamplerCardManifest): number | null {
  if (!card.loopType) return null;
  const spec = loopSpecFromLegacyRhythm(card.loopType, card.period ?? 2);
  return (
    spec.left?.components.get(LOOPComponent.SWAPPED)?.period ??
    spec.right?.components.get(LOOPComponent.SWAPPED)?.period ??
    null
  );
}

/**
 * The card stores turns by the color printed on each finished step. A swapped
 * LOOP changes which continuing motion wears that color, so review also needs
 * the assignment translated back onto the two continuing motion tracks.
 */
export function resolveFestivalTurnPatternContext(
  card: FestivalSamplerCardManifest,
  pattern = card.turnPattern ?? ""
): FestivalTurnPatternContext {
  const unit = parseFestivalTurnPattern(pattern);
  const sequenceLength = card.sequenceLength ?? unit.length;
  if (
    !Number.isInteger(sequenceLength) ||
    sequenceLength < unit.length ||
    sequenceLength % unit.length !== 0
  ) {
    throw new Error(
      `Turn pattern length ${unit.length} cannot fill ${sequenceLength} steps: ${card.name}`
    );
  }

  const assignedEntries = Array.from(
    { length: sequenceLength },
    (_, index) => ({
      ...unit[index % unit.length]!,
    })
  );
  const swapPeriod = swapPeriodForCard(card);
  const sliceLength = swapPeriod ? sequenceLength / swapPeriod : sequenceLength;
  if (swapPeriod && !Number.isInteger(sliceLength)) {
    throw new Error(
      `Swap period ${swapPeriod} cannot divide ${sequenceLength} steps: ${card.name}`
    );
  }

  const swapMask = assignedEntries.map((_, index) =>
    Boolean(swapPeriod && Math.floor(index / sliceLength) % 2 === 1)
  );
  const effectiveEntries = assignedEntries.map((entry, index) =>
    swapMask[index] ? { left: entry.right, right: entry.left } : { ...entry }
  );

  return {
    pattern: formatFestivalTurnPattern(unit),
    effectivePattern: formatFestivalTurnPattern(effectiveEntries),
    assignedEntries,
    effectiveEntries,
    swapMask,
    unitLength: unit.length,
    sequenceLength,
    loopType: card.loopType ?? null,
    period: card.period ?? null,
    swapPeriod,
  };
}

export function buildFestivalTurnReviewItems(
  manifests: readonly FestivalTurnReviewManifest[]
): FestivalTurnReviewItem[] {
  const items = new Map<FestivalTurnPatternId, FestivalTurnReviewItem>();

  for (const manifest of manifests) {
    for (const card of manifest.cards) {
      const turnIntensity = card.turnIntensity ?? 0;
      if (
        !isTurnIntensity(turnIntensity) ||
        !card.turnPattern ||
        !card.turnPatternId
      )
        continue;

      const preset = FESTIVAL_TURN_PATTERN_PRESETS.find(
        (candidate) => candidate.id === card.turnPatternId
      );
      if (!preset) continue;

      const context = resolveFestivalTurnPatternContext(card);
      const exampleId = turnPatternExampleId(turnIntensity, context);
      const current = items.get(preset.id);
      if (current) {
        current.usageCount += 1;
        if (!current.packNumbers.includes(manifest.rank)) {
          current.packNumbers.push(manifest.rank);
        }
        if (!current.slots.includes(card.slot)) current.slots.push(card.slot);
        const example = current.examples.find(
          (candidate) => candidate.id === exampleId
        );
        if (example) {
          example.usageCount += 1;
          if (!example.packNumbers.includes(manifest.rank)) {
            example.packNumbers.push(manifest.rank);
          }
          if (!example.slots.includes(card.slot)) example.slots.push(card.slot);
        } else {
          current.examples.push({
            id: exampleId,
            turnIntensity,
            pattern: context.pattern,
            effectivePattern: context.effectivePattern,
            assignedEntries: context.assignedEntries,
            effectiveEntries: context.effectiveEntries,
            swapMask: context.swapMask,
            unitLength: context.unitLength,
            sequenceLength: context.sequenceLength,
            loopType: context.loopType,
            period: context.period,
            swapPeriod: context.swapPeriod,
            usageCount: 1,
            packNumbers: [manifest.rank],
            slots: [card.slot],
            representativeCard: card,
            representativePackNumber: manifest.rank,
          });
        }
        continue;
      }

      const example: FestivalTurnReviewExample = {
        id: exampleId,
        turnIntensity,
        pattern: context.pattern,
        effectivePattern: context.effectivePattern,
        assignedEntries: context.assignedEntries,
        effectiveEntries: context.effectiveEntries,
        swapMask: context.swapMask,
        unitLength: context.unitLength,
        sequenceLength: context.sequenceLength,
        loopType: context.loopType,
        period: context.period,
        swapPeriod: context.swapPeriod,
        usageCount: 1,
        packNumbers: [manifest.rank],
        slots: [card.slot],
        representativeCard: card,
        representativePackNumber: manifest.rank,
      };
      items.set(preset.id, {
        id: preset.id,
        label: preset.label,
        symbols: preset.symbols.join(" "),
        minSequenceLength: preset.minSequenceLength,
        usageCount: 1,
        packNumbers: [manifest.rank],
        slots: [card.slot],
        examples: [example],
        representativeCard: card,
        representativePackNumber: manifest.rank,
      });
    }
  }

  return FESTIVAL_TURN_PATTERN_PRESETS.flatMap((preset) => {
    const item = items.get(preset.id);
    if (!item) return [];
    item.packNumbers.sort((left, right) => left - right);
    item.examples.sort(
      (left, right) =>
        left.sequenceLength - right.sequenceLength ||
        left.turnIntensity - right.turnIntensity ||
        left.representativePackNumber - right.representativePackNumber
    );
    return [item];
  });
}

function isDecisionRecord(
  value: unknown
): value is FestivalTurnReviewDecisionRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    (record.decision === "yay" || record.decision === "nay") &&
    typeof record.originalPattern === "string" &&
    typeof record.reviewedPattern === "string" &&
    typeof record.originalEffectivePattern === "string" &&
    typeof record.reviewedEffectivePattern === "string" &&
    (typeof record.loopType === "string" || record.loopType === null) &&
    (typeof record.period === "number" || record.period === null) &&
    typeof record.updatedAt === "string"
  );
}

export function readFestivalTurnReviewDecisions(
  storage: FestivalTurnReviewStorage | null,
  items: readonly FestivalTurnReviewItem[] = []
): FestivalTurnReviewDecisions {
  const seeded = Object.fromEntries(
    items.flatMap((item) => {
      if (!voteSeed.approvedPatternIds.includes(item.id)) return [];
      const example = item.examples[0];
      if (!example) return [];
      return [
        [
          item.id,
          {
            decision: "yay" as const,
            originalPattern: example.pattern,
            reviewedPattern: example.pattern,
            originalEffectivePattern: example.effectivePattern,
            reviewedEffectivePattern: example.effectivePattern,
            loopType: example.loopType,
            period: example.period,
            updatedAt: "2026-08-14T00:00:00.000Z",
            source: voteSeed.conversationApprovedPatternIds.includes(item.id)
              ? ("conversation-2026-08-14" as const)
              : ("imported-v2" as const),
          },
        ],
      ];
    })
  );
  if (!storage) return seeded;
  try {
    const raw = storage.getItem(FESTIVAL_TURN_REVIEW_STORAGE_KEY);
    if (!raw) return seeded;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return seeded;
    return {
      ...seeded,
      ...Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).filter(
          ([id, value]) =>
            items.some((item) => item.id === id) && isDecisionRecord(value)
        )
      ),
    };
  } catch {
    return seeded;
  }
}

export function writeFestivalTurnReviewDecisions(
  storage: FestivalTurnReviewStorage | null,
  decisions: FestivalTurnReviewDecisions
): void {
  if (!storage) return;
  try {
    storage.setItem(
      FESTIVAL_TURN_REVIEW_STORAGE_KEY,
      JSON.stringify(decisions)
    );
  } catch {
    // Reviewing still works when browser preference storage is unavailable.
  }
}

function isReviewFilter(value: unknown): value is FestivalTurnReviewFilter {
  return ["all", "unreviewed", "yay", "nay"].includes(String(value));
}

function isScrollPosition(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isSessionDraftValid(
  session: Record<string, unknown>,
  example: FestivalTurnReviewExample
): session is Record<string, unknown> & {
  draftPattern: string;
  motifLength: number;
} {
  if (
    typeof session.draftPattern !== "string" ||
    typeof session.motifLength !== "number" ||
    !Number.isInteger(session.motifLength) ||
    session.motifLength < 1 ||
    session.motifLength > example.unitLength ||
    example.unitLength % session.motifLength !== 0
  ) {
    return false;
  }

  try {
    const entries = parseFestivalTurnPattern(session.draftPattern);
    if (
      entries.length !== example.unitLength ||
      !entries.every(
        ({ left, right }) =>
          (left === 0 || left === example.turnIntensity) &&
          (right === 0 || right === example.turnIntensity)
      )
    ) {
      return false;
    }
    return (
      formatFestivalTurnPattern(
        repeatFestivalTurnMotif(
          entries,
          session.motifLength,
          example.unitLength
        )
      ) === session.draftPattern
    );
  } catch {
    return false;
  }
}

export function readFestivalTurnReviewSession(
  storage: FestivalTurnReviewStorage | null,
  items: readonly FestivalTurnReviewItem[]
): FestivalTurnReviewSession | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(FESTIVAL_TURN_REVIEW_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const session = parsed as Record<string, unknown>;
    const item = items.find((candidate) => candidate.id === session.selectedId);
    const example = item?.examples.find(
      (candidate) => candidate.id === session.selectedExampleId
    );
    if (
      !item ||
      !example ||
      !isReviewFilter(session.filter) ||
      !isSessionDraftValid(session, example) ||
      !isScrollPosition(session.patternScrollTop) ||
      !isScrollPosition(session.patternScrollLeft) ||
      !isScrollPosition(session.workspaceScrollTop) ||
      !isScrollPosition(session.pageScrollTop)
    ) {
      return null;
    }
    return {
      selectedId: item.id,
      selectedExampleId: example.id,
      filter: session.filter,
      draftPattern: session.draftPattern,
      motifLength: session.motifLength,
      patternScrollTop: session.patternScrollTop,
      patternScrollLeft: session.patternScrollLeft,
      workspaceScrollTop: session.workspaceScrollTop,
      pageScrollTop: session.pageScrollTop,
    };
  } catch {
    return null;
  }
}

export function writeFestivalTurnReviewSession(
  storage: FestivalTurnReviewStorage | null,
  session: FestivalTurnReviewSession
): void {
  if (!storage) return;
  try {
    storage.setItem(FESTIVAL_TURN_REVIEW_SESSION_KEY, JSON.stringify(session));
  } catch {
    // A storage failure should not interrupt an active review session.
  }
}
