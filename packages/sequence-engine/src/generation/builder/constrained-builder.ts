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
} from "../constraints/types.js";
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
import { generateConstraintReport } from "../constraints/reporting/report-generator.js";
import { scoreBridgeOptions } from "./bridge-scorer.js";
import { getLetterTransitionGraph } from "../../core/transition-graph/LetterTransitionGraph.js";
import { calculateEndOrientation } from "../../core/orientation/OrientationCalculator.js";
import type { Orientation } from "../../core/types/sequence-engine-types.js";

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
  /** Index of this bridge step in the final steps array (set after path selection) */
  stepIndex?: number;
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

  /** Number of search states browsed */
  statesBrowsed?: number;

  /** Information about bridge letters used (deprecated - use bridgeStepIndices) */
  bridges?: BridgeInfo[];

  /** Indices of steps that are bridge letters (not user-requested letters) */
  bridgeStepIndices?: number[];
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
  let statesBrowsed = 0;

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
      statesBrowsed++;
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

        // First try single-letter bridges (can be scored for constraint optimization)
        let bridgeOptions = transitionGraph.findAllBridgeOptions(previousLetter, letter);
        let useMultiLetterBridge = false;
        let multiBridgePath: string[] = [];

        if (bridgeOptions.length === 0) {
          // No single-letter bridge - fall back to BFS for multi-letter path
          multiBridgePath = transitionGraph.findBridgeLetters(previousLetter, letter);
          if (multiBridgePath.length === 0) {
            // No bridge path available at all
            continue;
          }
          useMultiLetterBridge = true;
        }

        if (useMultiLetterBridge) {
          // Multi-letter bridge: add each bridge letter sequentially
          // NOTE: This code path should never be reached in practice.
          // TKA's position groups (alpha, beta, gamma) are all directly connected
          // via Type 2 letters (W, X, Y, Z, Σ, Δ, Θ, Ω). A single bridge letter
          // can always reach any target group. Multi-letter bridges would only
          // be needed if we added letter types that break this connectivity.
          let currentState = state;
          let bridgeSuccess = true;
          const totalBridgeSteps = multiBridgePath.length;

          for (let bridgeIdx = 0; bridgeIdx < multiBridgePath.length; bridgeIdx++) {
            const bridgeLetter = multiBridgePath[bridgeIdx];
            if (!bridgeLetter) {
              bridgeSuccess = false;
              break;
            }

            // Find variations of this bridge letter at current position
            const bridgeVariations = allPictographs.filter(
              (p) => p.letter === bridgeLetter && p.startPosition === currentState.currentEndPosition
            );

            if (bridgeVariations.length === 0) {
              bridgeSuccess = false;
              break;
            }

            // Score bridge variations
            const bridgeScores = scoreAndRankVariations(
              bridgeVariations,
              {
                stepIndex: i + bridgeIdx,
                totalSteps: letters.length + totalBridgeSteps,
                previousSteps: currentState.steps,
                letter: bridgeLetter,
              },
              constraintSet
            );

            const bestBridgeScore = bridgeScores[0];
            if (!bestBridgeScore || !bestBridgeScore.hardConstraintsSatisfied) {
              bridgeSuccess = false;
              break;
            }

            // Extend state with this bridge letter
            currentState = extendState(currentState, bestBridgeScore.variation, bestBridgeScore, true);
            statesBrowsed++;
          }

          if (!bridgeSuccess) {
            continue;
          }

          // Now find target letter variations from final bridge's end position
          validVariations = allPictographs.filter(
            (p) => p.letter === letter && p.startPosition === currentState.currentEndPosition
          );

          if (validVariations.length === 0) {
            continue;
          }

          // Score variations in context (after all bridges)
          const scores = scoreAndRankVariations(
            validVariations,
            {
              stepIndex: i + multiBridgePath.length,
              totalSteps: letters.length + multiBridgePath.length,
              previousSteps: currentState.steps,
              letter,
            },
            constraintSet
          );

          // Extend state with target letter variations
          for (const scored of scores.slice(0, config.beamWidth)) {
            if (!scored.hardConstraintsSatisfied) continue;

            const newState = extendState(currentState, scored.variation, scored);
            nextBeam.push(newState);
            statesBrowsed++;
          }
        } else {
          // Single-letter bridge: try ALL bridge options, not just the "best" one
          // The "best" bridge by constraint score may not have a variation at current position
          const scoredBridges = scoreBridgeOptions(bridgeOptions, constraintSet, allPictographs);

          let bridgeSucceeded = false;

          // Try each bridge option in score order until one works
          for (const bridgeOption of scoredBridges) {
            if (!bridgeOption) continue;

            // Find variations of this bridge letter that start at current position
            const bridgeVariations = allPictographs.filter(
              (p) => p.letter === bridgeOption.letter && p.startPosition === state.currentEndPosition
            );

            if (bridgeVariations.length === 0) {
              // This bridge doesn't have a variation at current position - try next bridge
              continue;
            }

            // Score and pick best bridge variation
            const bridgeScores = scoreAndRankVariations(
              bridgeVariations,
              {
                stepIndex: i,
                totalSteps: letters.length + 1, // Account for bridge
                previousSteps: state.steps,
                letter: bridgeOption.letter,
              },
              constraintSet
            );

            const bestBridgeScore = bridgeScores[0];
            if (!bestBridgeScore || !bestBridgeScore.hardConstraintsSatisfied) continue;

            // Extend state with bridge letter (marked as bridge)
            const stateWithBridge = extendState(state, bestBridgeScore.variation, bestBridgeScore, true);
            statesBrowsed++;

            // Now find target letter variations from bridge's end position
            const targetVariations = allPictographs.filter(
              (p) => p.letter === letter && p.startPosition === stateWithBridge.currentEndPosition
            );

            if (targetVariations.length === 0) {
              // This bridge doesn't lead to the target letter - try next bridge
              continue;
            }

            // Score variations in context (after bridge)
            const scores = scoreAndRankVariations(
              targetVariations,
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
              statesBrowsed++;
              bridgeSucceeded = true;
            }

            // If we found valid paths with this bridge, we can stop trying others
            // (they're sorted by score, so first success is likely best)
            if (bridgeSucceeded) break;
          }

          // If no single-letter bridge worked, the state will be dropped from beam
          // (which is correct - we've exhausted all options for this path)
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
          statesBrowsed++;
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
        statesBrowsed,
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
        return buildResult(partial, word, constraintSet, statesBrowsed, true);
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
      statesBrowsed,
    };
  }

  return buildResult(bestState, word, constraintSet, statesBrowsed, false);
}

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
 * Each step's start orientation = previous step's end orientation.
 */
function propagateOrientations(steps: PictographData[]): PictographData[] {
  if (steps.length === 0) return steps;

  const result: PictographData[] = [];

  // Get initial orientations from start position (step 0)
  const startPosition = steps[0];
  if (!startPosition) return steps;

  let blueOrientation = (startPosition.blueMotion.endOrientation || "in") as Orientation;
  let redOrientation = (startPosition.redMotion.endOrientation || "in") as Orientation;

  // Keep start position as-is
  result.push(startPosition);

  // Propagate through remaining steps
  for (let i = 1; i < steps.length; i++) {
    const step = steps[i];
    if (!step) continue;

    // Calculate blue end orientation
    const blueEndOrientation = calculateEndOrientation({
      motionType: step.blueMotion.motionType,
      turns: 0, // CSV variations are all 0 turns
      rotationDirection: step.blueMotion.rotationDirection || "cw",
      startLocation: step.blueMotion.startLocation,
      endLocation: step.blueMotion.endLocation,
      startOrientation: blueOrientation,
    });

    // Calculate red end orientation
    const redEndOrientation = calculateEndOrientation({
      motionType: step.redMotion.motionType,
      turns: 0,
      rotationDirection: step.redMotion.rotationDirection || "cw",
      startLocation: step.redMotion.startLocation,
      endLocation: step.redMotion.endLocation,
      startOrientation: redOrientation,
    });

    // Create updated step with correct orientations
    result.push({
      ...step,
      blueMotion: {
        ...step.blueMotion,
        startOrientation: blueOrientation,
        endOrientation: blueEndOrientation,
      },
      redMotion: {
        ...step.redMotion,
        startOrientation: redOrientation,
        endOrientation: redEndOrientation,
      },
    });

    // Update for next iteration
    blueOrientation = blueEndOrientation;
    redOrientation = redEndOrientation;
  }

  return result;
}

function buildResult(
  state: SearchState,
  word: string,
  constraintSet: ConstraintSet,
  statesBrowsed: number,
  isPartial: boolean
): ConstrainedSequenceResult {
  const report = generateConstraintReport(state, constraintSet);

  // Propagate orientations through the sequence
  const stepsWithOrientations = propagateOrientations(state.steps);

  // Extract bridge step indices from the state
  const bridgeStepIndices = state.bridgeStepIndices
    ? Array.from(state.bridgeStepIndices).sort((a, b) => a - b)
    : undefined;

  return {
    success: !isPartial && report.satisfied,
    steps: stepsWithOrientations,
    variationIndices: state.stepScores.map((s) => s.variationIndex),
    word,
    startPosition: stepsWithOrientations[0]?.startPosition || "",
    endPosition: state.currentEndPosition,
    constraintReport: report,
    statesBrowsed,
    error: isPartial ? "Partial result (minimum score not met)" : undefined,
    bridgeStepIndices: bridgeStepIndices && bridgeStepIndices.length > 0 ? bridgeStepIndices : undefined,
  };
}

export function emptyConstraintSet(): ConstraintSet {
  return {
    hard: [],
    soft: [],
  };
}
