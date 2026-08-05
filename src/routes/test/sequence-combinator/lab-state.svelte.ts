/**
 * State for the /test/sequence-combinator lab.
 *
 * One factory, two responsibilities: hold the two input cards (however they got
 * loaded) and hold the tunables the engine runs under. Everything the page
 * renders is either one of those or derived from the report the engine handed
 * back — the page itself owns no state.
 *
 * The engine seam is `getSequenceCombinator()`. `findCombinations` auto-wires
 * the ambient bridge vocabulary off the live pictograph dataset, so nothing
 * here builds a provider; the report's `ambientUnavailable` flag is what tells
 * the lab whether that wiring actually happened.
 */

import { ALL_FIXTURE_LOOPS } from "$lib/shared/combination/domain/demo-fixtures";
import type {
  CombinationSearchReport,
  CombinatorOptions,
} from "$lib/shared/combination/domain/types";
import { getSequenceCombinator } from "$lib/shared/combination/get-sequence-combinator";
import type { EnumerateResult } from "$lib/shared/combination/services/letter-calculus";
import {
  createSequenceData,
  type SequenceData,
} from "$lib/shared/foundation/domain/models/sequence-data";
import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

export type SlotId = "A" | "B";

/** How a slot's card got there. `library` is the not-yet-wired picker. */
export type SlotInputMode = "fixture" | "json" | "library";

/**
 * The two measured search depths (2026-08-04, GGGG + HHHH).
 *
 * `default` is `COMBINATOR_DEFAULTS`: 4,096 raw walks / 200k nodes, ~190ms,
 * fully explored to length 5. `deep` is what it actually takes to reach the
 * eight-step "both whole cards" shapes the ranking exists to promote — the
 * harvest cap binds first at 4,096 and the node budget binds right behind it,
 * so both have to move together. ~700ms.
 */
export type DepthPreset = "default" | "deep";

const DEPTH_PRESETS: Record<
  DepthPreset,
  { readonly rawWalkCap: number; readonly searchBudget: number }
> = {
  default: { rawWalkCap: 4096, searchBudget: 200_000 },
  deep: { rawWalkCap: 16384, searchBudget: 2_000_000 },
};

/** The demo cards, keyed by the name the preset buttons show. */
export const FIXTURE_CARDS: ReadonlyMap<string, SequenceData> = new Map(
  ALL_FIXTURE_LOOPS.map(([name, sequence]) => [name, sequence])
);

export interface CardSlot {
  /** The loaded card, or null when the slot is empty. */
  readonly card: SequenceData | null;
  readonly mode: SlotInputMode;
  /** Which fixture is loaded, when `mode` is "fixture". */
  readonly fixtureName: string | null;
  /** Live textarea contents for the JSON path (kept across mode switches). */
  jsonText: string;
  /** Why the last load attempt failed. Empty when the slot is healthy. */
  readonly error: string;
  /** Display word — simplified, per `simplified-word-display`. */
  readonly displayWord: string;
}

export interface CombinatorLabState {
  readonly slotA: CardSlot;
  readonly slotB: CardSlot;
  readonly bothLoaded: boolean;

  // Tunables.
  depth: DepthPreset;
  maxResultLength: number;
  minBlockSize: number;
  maxResults: number;
  maxAmbientRun: number;
  allowMirror: boolean;
  allowRotation: boolean;
  allowColorSwap: boolean;
  exploreRotationFaithful: boolean;
  allowAmbient: boolean;
  wholeUnitsOnly: boolean;

  // Search lifecycle.
  readonly report: CombinationSearchReport | null;
  readonly running: boolean;
  readonly runError: string;
  readonly elapsedMs: number;
  /** Layer-0 preview for the currently loaded pair. Null until both are in. */
  readonly preview: EnumerateResult | null;

  loadFixture(slot: SlotId, name: string): void;
  loadJson(slot: SlotId, text: string): void;
  clearSlot(slot: SlotId): void;
  swapSlots(): void;
  run(): Promise<void>;
}

/**
 * Structural check on pasted JSON.
 *
 * Deliberately shallow: it verifies the shape the engine actually reads (steps
 * with both seam positions and both hands) and then hands the object to
 * `createSequenceData` for defaults. It does NOT re-validate the pictograph
 * against the dataframe — a lab that only accepted canon material could not be
 * used to find out what non-canon material does.
 */
function parseCard(text: string, slot: SlotId): SequenceData {
  const trimmed = text.trim();
  if (trimmed.length === 0) throw new Error("Nothing pasted.");

  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch (cause) {
    throw new Error(
      `Not valid JSON: ${cause instanceof Error ? cause.message : String(cause)}`
    );
  }

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(
      "Expected a sequence object, not an array or a bare value."
    );
  }

  const candidate = raw as Partial<SequenceData>;
  const steps = candidate.steps;
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error("Expected a non-empty `steps` array.");
  }

  steps.forEach((step, index) => {
    const label = `step ${index + 1}`;
    if (typeof step !== "object" || step === null) {
      throw new Error(`${label} is not an object.`);
    }
    if (!step.startPosition || !step.endPosition) {
      throw new Error(
        `${label} is missing startPosition/endPosition — the engine walks on seams.`
      );
    }
    if (!step.motions?.blue || !step.motions?.red) {
      throw new Error(`${label} is missing a blue or red motion.`);
    }
  });

  const word =
    typeof candidate.word === "string" && candidate.word.length > 0
      ? candidate.word
      : steps.map((step) => step.letter ?? "?").join("");

  return createSequenceData({
    ...candidate,
    id: candidate.id ?? `pasted-${slot}-${Date.now()}`,
    name: candidate.name ?? word,
    word,
    steps,
    gridMode: candidate.gridMode ?? GridMode.DIAMOND,
  });
}

function emptySlot(): {
  card: SequenceData | null;
  mode: SlotInputMode;
  fixtureName: string | null;
  jsonText: string;
  error: string;
} {
  return {
    card: null,
    mode: "fixture",
    fixtureName: null,
    jsonText: "",
    error: "",
  };
}

export function createCombinatorLabState(): CombinatorLabState {
  const slots = $state({ A: emptySlot(), B: emptySlot() });

  let depth = $state<DepthPreset>("default");
  let maxResultLength = $state(16);
  let minBlockSize = $state(1);
  let maxResults = $state(24);
  let maxAmbientRun = $state(2);
  let allowMirror = $state(true);
  let allowRotation = $state(true);
  let allowColorSwap = $state(true);
  let exploreRotationFaithful = $state(true);
  let allowAmbient = $state(true);
  let wholeUnitsOnly = $state(false);

  let report = $state<CombinationSearchReport | null>(null);
  let running = $state(false);
  let runError = $state("");
  let elapsedMs = $state(0);

  /**
   * Re-entrancy guard. A plain local rather than `running`, because `running`
   * is reactive state a caller could in principle be reading mid-update, and
   * the guard has to be true the instant `run` is entered.
   */
  let inFlight = false;

  const preview = $derived.by<EnumerateResult | null>(() => {
    const cardA = slots.A.card;
    const cardB = slots.B.card;
    if (!cardA || !cardB) return null;
    try {
      return getSequenceCombinator().candidateWords(cardA, cardB);
    } catch {
      // Layer 0 is a preview, not a gate — a card it cannot read (a seam label
      // outside the alpha/beta/gamma families) must not take the page down.
      return null;
    }
  });

  function slotView(id: SlotId): CardSlot {
    return {
      get card() {
        return slots[id].card;
      },
      get mode() {
        return slots[id].mode;
      },
      get fixtureName() {
        return slots[id].fixtureName;
      },
      get jsonText() {
        return slots[id].jsonText;
      },
      set jsonText(value: string) {
        slots[id].jsonText = value;
      },
      get error() {
        return slots[id].error;
      },
      get displayWord() {
        return simplifyRepeatedWord(slots[id].card?.word ?? "");
      },
    };
  }

  const viewA = slotView("A");
  const viewB = slotView("B");

  function options(): CombinatorOptions {
    return {
      ...DEPTH_PRESETS[depth],
      minBlockSize,
      maxResultLength,
      maxResults,
      maxAmbientRun,
      allowMirror,
      allowRotation,
      allowColorSwap,
      exploreRotationFaithful,
      allowAmbient,
      wholeUnitsOnly,
    };
  }

  return {
    slotA: viewA,
    slotB: viewB,
    get bothLoaded() {
      return slots.A.card !== null && slots.B.card !== null;
    },

    get depth() {
      return depth;
    },
    set depth(value: DepthPreset) {
      depth = value;
    },
    get maxResultLength() {
      return maxResultLength;
    },
    set maxResultLength(value: number) {
      maxResultLength = value;
    },
    get minBlockSize() {
      return minBlockSize;
    },
    set minBlockSize(value: number) {
      minBlockSize = value;
    },
    get maxResults() {
      return maxResults;
    },
    set maxResults(value: number) {
      maxResults = value;
    },
    get maxAmbientRun() {
      return maxAmbientRun;
    },
    set maxAmbientRun(value: number) {
      maxAmbientRun = value;
    },
    get allowMirror() {
      return allowMirror;
    },
    set allowMirror(value: boolean) {
      allowMirror = value;
    },
    get allowRotation() {
      return allowRotation;
    },
    set allowRotation(value: boolean) {
      allowRotation = value;
    },
    get allowColorSwap() {
      return allowColorSwap;
    },
    set allowColorSwap(value: boolean) {
      allowColorSwap = value;
    },
    get exploreRotationFaithful() {
      return exploreRotationFaithful;
    },
    set exploreRotationFaithful(value: boolean) {
      exploreRotationFaithful = value;
    },
    get allowAmbient() {
      return allowAmbient;
    },
    set allowAmbient(value: boolean) {
      allowAmbient = value;
    },
    get wholeUnitsOnly() {
      return wholeUnitsOnly;
    },
    set wholeUnitsOnly(value: boolean) {
      wholeUnitsOnly = value;
    },

    get report() {
      return report;
    },
    get running() {
      return running;
    },
    get runError() {
      return runError;
    },
    get elapsedMs() {
      return elapsedMs;
    },
    get preview() {
      return preview;
    },

    loadFixture(slot, name) {
      const card = FIXTURE_CARDS.get(name);
      if (!card) {
        slots[slot].error = `No demo card named "${name}".`;
        return;
      }
      slots[slot].card = card;
      slots[slot].mode = "fixture";
      slots[slot].fixtureName = name;
      slots[slot].error = "";
      report = null;
    },

    loadJson(slot, text) {
      slots[slot].jsonText = text;
      try {
        slots[slot].card = parseCard(text, slot);
        slots[slot].mode = "json";
        slots[slot].fixtureName = null;
        slots[slot].error = "";
        report = null;
      } catch (cause) {
        slots[slot].card = null;
        slots[slot].error =
          cause instanceof Error ? cause.message : String(cause);
      }
    },

    clearSlot(slot) {
      slots[slot].card = null;
      slots[slot].fixtureName = null;
      slots[slot].error = "";
      report = null;
    },

    swapSlots() {
      const a = slots.A;
      slots.A = slots.B;
      slots.B = a;
      report = null;
    },

    async run() {
      if (inFlight) return;
      const cardA = slots.A.card;
      const cardB = slots.B.card;
      if (!cardA || !cardB) return;

      inFlight = true;
      running = true;
      runError = "";
      const startedAt = performance.now();
      try {
        report = await getSequenceCombinator().findCombinations(
          cardA,
          cardB,
          options()
        );
      } catch (cause) {
        report = null;
        runError = cause instanceof Error ? cause.message : String(cause);
      } finally {
        elapsedMs = Math.round(performance.now() - startedAt);
        running = false;
        inFlight = false;
      }
    },
  };
}
