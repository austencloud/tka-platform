/**
 * Constrained Sequence Builder
 *
 * Builds TKA sequences using beam search with constraint scoring.
 * This replaces random selection with intelligent variation selection
 * based on user-specified constraints.
 *
 * Now supports constraint-aware bridge letter selection when direct
 * transitions are not possible.
 */

import type {
  PictographData,
  ConstraintSet,
  SearchState,
  VariationScore,
  ConstraintReport,
  ConstraintContext,
} from "../types.js";
import { scoreAndRankVariations } from "./variation-scorer.js";
import {
  createInitialState,
  extendState,
  pruneBeam,
  getBestState,
  countReversals,
  calculateContinuityPercentage,
  DEFAULT_BEAM_CONFIG,
  type BeamSearchConfig,
} from "./search-state.js";
import { generateConstraintReport } from "../reporting/report-generator.js";
import { scoreBridgeOptions } from "./bridge-scorer.js";
import { getLetterTransitionGraph } from "../../letter-transition-graph.js";

/**
 * Type 6 static letters - valid for starting positions.
 */
const TYPE_6_LETTERS = ["α", "β", "γ"];

/**
 * Information about a bridge letter used in the sequence.
 */
export interface BridgeInfo {
  /** Index of the transition (which gap between letters) */
  transitionIndex: number;
  /** The letter before the bridge */
  fromLetter: string;
  /** The letter after the bridge */
  toLetter: string;
  /** All available bridge options for this transition */
  availableOptions: string[];
  /** The bridge letter that was selected */
  selectedBridge: string;
  /** Index of the selected bridge in availableOptions */
  selectedIndex: number;
  /** Whether this bridge was selected based on constraint scoring */
  constraintScored: boolean;
}

/**
 * Result of constrained sequence building.
 */
export interface ConstrainedSequenceResult {
  /** Whether a valid sequence was found */
  success: boolean;

  /** The sequence steps (including start position) */
  steps: PictographData[];

  /** Variation indices for each step */
  variationIndices: number[];

  /** The original word */
  word: string;

  /** Start position name */
  startPosition: string;

  /** End position name */
  endPosition: string;

  /** Constraint satisfaction report */
  constraintReport: ConstraintReport;

  /** Error message if not successful */
  error?: string;

  /** Number of search states explored */
  statesExplored?: number;

  /** Information about bridge letters used */
  bridges?: BridgeInfo[];
}

/**
 * Options for the constrained builder.
 */
export interface ConstrainedBuilderOptions {
  /** Beam search configuration */
  beamConfig?: Partial<BeamSearchConfig>;

  /** Letters to build (already parsed) */
  letters: string[];

  /** All available pictograph data */
  allPictographs: PictographData[];

  /** Constraint set to apply */
  constraintSet: ConstraintSet;
}

/**
 * Build a sequence using beam search with constraint scoring.
 */
export function buildConstrainedSequence(
  options: ConstrainedBuilderOptions
): ConstrainedSequenceResult {
  const { letters, allPictographs, constraintSet } = options;
  const config = { ...DEFAULT_BEAM_CONFIG, ...options.beamConfig };

  if (letters.length === 0) {
    return {
      success: false,
      steps: [],
      variationIndices: [],
      word: "",
      startPosition: "",
      endPosition: "",
      constraintReport: {
        score: 0,
        satisfied: false,
        details: [],
      },
      error: "No letters provided",
    };
  }

  const word = letters.join("");

  // Step 1: Find valid first letter variations and score them
  const firstLetter = letters[0];
  if (!firstLetter) {
    return {
      success: false,
      steps: [],
      variationIndices: [],
      word,
      startPosition: "",
      endPosition: "",
      constraintReport: {
        score: 0,
        satisfied: false,
        details: [],
      },
      error: "No first letter",
    };
  }

  const firstLetterVariations = allPictographs.filter(
    (p) => p.letter === firstLetter
  );

  if (firstLetterVariations.length === 0) {
    return {
      success: false,
      steps: [],
      variationIndices: [],
      word,
      startPosition: "",
      endPosition: "",
      constraintReport: {
        score: 0,
        satisfied: false,
        details: [],
      },
      error: `No variations found for letter "${firstLetter}"`,
    };
  }

  // Step 2: Score first letter variations
  const firstLetterScores = scoreAndRankVariations(
    firstLetterVariations,
    {
      stepIndex: 0,
      totalSteps: letters.length,
      previousSteps: [],
      letter: firstLetter,
    },
    constraintSet
  );

  // Initialize beam with top-scored first variations
  let beam: SearchState[] = [];
  let statesExplored = 0;

  for (const scored of firstLetterScores.slice(0, config.beamWidth)) {
    if (!scored.hardConstraintsSatisfied) continue;

    // Find a valid start position for this variation
    const startPictograph = findStartPosition(
      allPictographs,
      scored.variation.startPosition
    );

    if (startPictograph) {
      // Create initial state with start position + first letter
      const initialState = createInitialState(startPictograph.variation, startPictograph.index);
      const state = extendState(initialState, scored.variation, scored);
      beam.push(state);
      statesExplored++;
    }
  }

  if (beam.length === 0) {
    return {
      success: false,
      steps: [],
      variationIndices: [],
      word,
      startPosition: "",
      endPosition: "",
      constraintReport: {
        score: 0,
        satisfied: false,
        details: [],
      },
      error: "No valid starting configurations found",
    };
  }

  // Track bridge information
  const bridges: BridgeInfo[] = [];
  let bridgeTransitionIndex = 0;

  // Get transition graph for bridge finding
  const transitionGraph = getLetterTransitionGraph();

  // Step 3: Beam search through remaining letters
  for (let i = 1; i < letters.length; i++) {
    const letter = letters[i];
    if (!letter) continue;

    const nextBeam: SearchState[] = [];

    for (const state of beam) {
      // Find variations that match the current end position
      let validVariations = allPictographs.filter(
        (p) => p.letter === letter && p.startPosition === state.currentEndPosition
      );

      if (validVariations.length === 0) {
        // No direct path - try to find bridge letters
        const previousLetter = state.steps[state.steps.length - 1]?.letter;
        if (!previousLetter) continue;

        // Find all valid single-letter bridges
        const bridgeOptions = transitionGraph.findAllBridgeOptions(previousLetter, letter);

        if (bridgeOptions.length === 0) {
          // No single-letter bridge available, this state cannot continue
          continue;
        }

        // Score bridge options against constraints
        const scoredBridges = scoreBridgeOptions(bridgeOptions, constraintSet, allPictographs);
        const bestBridge = scoredBridges[0];
        if (!bestBridge) continue;

        // Find variations of the best bridge letter that start at current position
        const bridgeVariations = allPictographs.filter(
          (p) => p.letter === bestBridge.letter && p.startPosition === state.currentEndPosition
        );

        if (bridgeVariations.length === 0) {
          // Bridge letter doesn't have a variation at this position
          continue;
        }

        // Score and pick best bridge variation
        const bridgeScores = scoreAndRankVariations(
          bridgeVariations,
          {
            stepIndex: i,
            totalSteps: letters.length + 1, // Account for bridge
            previousSteps: state.steps,
            letter: bestBridge.letter,
          },
          constraintSet
        );

        const bestBridgeScore = bridgeScores[0];
        if (!bestBridgeScore || !bestBridgeScore.hardConstraintsSatisfied) continue;

        // Extend state with bridge letter
        const stateWithBridge = extendState(state, bestBridgeScore.variation, bestBridgeScore);
        statesExplored++;

        // Record bridge info
        bridges.push({
          transitionIndex: bridgeTransitionIndex++,
          fromLetter: previousLetter,
          toLetter: letter,
          availableOptions: bridgeOptions,
          selectedBridge: bestBridge.letter,
          selectedIndex: bridgeOptions.indexOf(bestBridge.letter),
          constraintScored: constraintSet.hard.length > 0 || constraintSet.soft.length > 0,
        });

        // Now find target letter variations from bridge's end position
        validVariations = allPictographs.filter(
          (p) => p.letter === letter && p.startPosition === stateWithBridge.currentEndPosition
        );

        if (validVariations.length === 0) {
          // Still no valid path even with bridge
          continue;
        }

        // Score variations in context (after bridge)
        const scores = scoreAndRankVariations(
          validVariations,
          {
            stepIndex: i + 1, // Adjusted for bridge
            totalSteps: letters.length + 1,
            previousSteps: stateWithBridge.steps,
            letter,
          },
          constraintSet
        );

        // Extend state with target letter variations
        for (const scored of scores.slice(0, config.beamWidth)) {
          if (!scored.hardConstraintsSatisfied) continue;

          const newState = extendState(stateWithBridge, scored.variation, scored);
          nextBeam.push(newState);
          statesExplored++;
        }
      } else {
        // Direct path available - score and extend normally
        const scores = scoreAndRankVariations(
          validVariations,
          {
            stepIndex: i,
            totalSteps: letters.length,
            previousSteps: state.steps,
            letter,
          },
          constraintSet
        );

        // Extend state with top-scored variations
        for (const scored of scores.slice(0, config.beamWidth)) {
          if (!scored.hardConstraintsSatisfied) continue;

          const newState = extendState(state, scored.variation, scored);
          nextBeam.push(newState);
          statesExplored++;
        }
      }
    }

    // Prune beam to keep top states
    beam = pruneBeam(nextBeam, config.beamWidth);

    if (beam.length === 0) {
      // Total dead end - no viable paths
      return {
        success: false,
        steps: [],
        variationIndices: [],
        word,
        startPosition: "",
        endPosition: "",
        constraintReport: {
          score: 0,
          satisfied: false,
          details: [],
        },
        error: `No valid path found after letter "${letter}" (position ${i + 1})`,
        statesExplored,
        bridges: bridges.length > 0 ? bridges : undefined,
      };
    }
  }

  // Step 4: Select best final state
  const bestState = getBestState(beam, config.minAcceptableScore);

  if (!bestState) {
    // No state meets minimum score
    // Return best available if partial allowed
    if (config.allowPartial && beam.length > 0) {
      const partial = beam.sort((a, b) => b.cumulativeScore - a.cumulativeScore)[0];
      if (partial) {
        return buildResult(partial, word, constraintSet, statesExplored, true, bridges);
      }
    }

    return {
      success: false,
      steps: [],
      variationIndices: [],
      word,
      startPosition: "",
      endPosition: "",
      constraintReport: {
        score: 0,
        satisfied: false,
        details: [],
      },
      error: `No sequence met minimum score threshold (${config.minAcceptableScore})`,
      statesExplored,
      bridges: bridges.length > 0 ? bridges : undefined,
    };
  }

  return buildResult(bestState, word, constraintSet, statesExplored, false, bridges);
}

/**
 * Find a valid Type 6 start position for a given position.
 */
function findStartPosition(
  allPictographs: PictographData[],
  position: string
): { variation: PictographData; index: number } | null {
  const validStarts = allPictographs.filter(
    (p) =>
      TYPE_6_LETTERS.includes(p.letter) &&
      p.startPosition === position &&
      p.endPosition === position
  );

  if (validStarts.length === 0) {
    return null;
  }

  // Pick a random start position (could also score these)
  const index = Math.floor(Math.random() * validStarts.length);
  const variation = validStarts[index];
  if (!variation) return null;

  return { variation, index };
}

/**
 * Build the final result from a search state.
 */
function buildResult(
  state: SearchState,
  word: string,
  constraintSet: ConstraintSet,
  statesExplored: number,
  isPartial: boolean,
  bridges?: BridgeInfo[]
): ConstrainedSequenceResult {
  const report = generateConstraintReport(state, constraintSet);

  return {
    success: !isPartial && report.satisfied,
    steps: state.steps,
    variationIndices: state.stepScores.map((s) => s.variationIndex),
    word,
    startPosition: state.steps[0]?.startPosition || "",
    endPosition: state.currentEndPosition,
    constraintReport: report,
    statesExplored,
    error: isPartial ? "Partial result (minimum score not met)" : undefined,
    bridges: bridges && bridges.length > 0 ? bridges : undefined,
  };
}

/**
 * Empty constraint set for unconstrained generation.
 */
export function emptyConstraintSet(): ConstraintSet {
  return {
    hard: [],
    soft: [],
  };
}
