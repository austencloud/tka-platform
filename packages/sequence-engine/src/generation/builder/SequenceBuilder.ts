/**
 * Sequence Builder
 *
 * The single entry point for all sequence generation. Orchestrates a 7-stage pipeline:
 *
 *   1. Parse letters from word
 *   2. Assemble constraints (domain hard + style from preset/text)
 *   3. Select start position
 *   4. Allocate turns
 *   5. Beam search
 *   6. Post-process (orientation propagation, reversal detection, convert to SequenceStep)
 *   7. LOOP extension (if requested)
 *
 * Consumers provide an IVariationProvider for their platform (MCP or browser).
 * Everything else is handled internally.
 */

import type { IVariationProvider } from "../data/IVariationProvider.js";
import type {
  PictographData,
  ConstraintSet,
  ConstraintReport,
  IConstraint,
} from "../constraints/types.js";
import type { SequenceStep, Orientation } from "../../core/types/sequence-engine-types.js";
import {
  OrientationPropagator,
  OrientationCalculator as OrientationCalculatorImpl,
} from "../../core/orientation/OrientationPropagator.js";
import { LetterParser } from "../../core/letters/LetterParser.js";
import { LetterClassifier } from "../../core/letters/LetterClassifier.js";
import { allocateTurns, type TurnAllocation } from "../turns/TurnAllocator.js";
import { BeamSearch, type BeamSearchResult } from "./BeamSearch.js";
import { Type6Constraint } from "../constraints/domain/Type6Constraint.js";
import { PositionContinuityConstraint } from "../constraints/domain/PositionContinuityConstraint.js";
import { FloatConstraint } from "../constraints/domain/FloatConstraint.js";
import { PropTypeConstraint } from "../constraints/domain/PropTypeConstraint.js";
import { getPresetOptions } from "../constraints/presets/preset-constraints.js";
import { buildConstraintSet } from "../constraints/composition/build-constraint-set.js";
import { parseConstraintSet } from "../constraints/parsing/constraint-parser.js";
import type { ConstraintOptions } from "../constraints/composition/constraint-options.js";
import { LOOPType, SliceSize } from "../../loop/loop-types.js";
import { loopExecutorSelector } from "../../loop/execution/LOOPExecutorSelector.js";
import { loopEndPositionSelector } from "../../loop/targeting/LOOPEndPositionSelector.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dash and static motions in the CSV have "noRotation" because at 0 turns
 * they don't spin. When non-zero turns are allocated, the prop DOES spin
 * and needs a rotation direction for the renderer and orientation calculator.
 *
 * Behavior depends on the reversal preference:
 * - "maximize" (smooth): inherit the previous beat's rotation direction
 * - "force-reversals" (choppy): flip the previous beat's rotation direction
 * - "allow-reversals" (mixed) or default: random choice
 */
function resolveRotationDirection(
  original: string,
  turns?: number | "fl",
  previousRotation?: string,
  propContinuity?: "maximize" | "allow-reversals" | "force-reversals",
): string {
  const hasTurns = turns !== undefined && turns !== 0;
  const isNoRotation = original === "noRotation" || original === "no_rot" || !original;

  if (hasTurns && isNoRotation) {
    const hasPrevious = previousRotation && previousRotation !== "noRotation" && previousRotation !== "no_rot";

    if (hasPrevious) {
      if (propContinuity === "force-reversals") {
        // Choppy: flip the direction every beat
        return previousRotation === "cw" ? "ccw" : "cw";
      }
      if (propContinuity === "maximize") {
        // Smooth: inherit the direction
        return previousRotation!;
      }
    }
    // Mixed / no previous / default: random
    return Math.random() < 0.5 ? "cw" : "ccw";
  }
  return original;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for building a sequence.
 */
export interface BuildOptions {
  /** The word to spell (e.g. "BOOK", "AΣ-B"). Either word or length must be provided. */
  word?: string;

  /** Number of beats to generate (excluding start position). Either word or length must be provided. */
  length?: number;

  /** Grid mode for position lookups */
  gridMode: string; // "diamond" | "box" | "skewed"

  /** Difficulty level (1-3). Controls turn pool. */
  level: number;

  /** Named constraint preset (e.g. "smooth", "reversal") */
  constraintPreset?: string;

  /** Natural-language constraints (parsed into constraint set) */
  constraints?: string;

  /** Structured constraint composition (alternative to preset/NL) */
  constraintOptions?: ConstraintOptions;

  /** Force a specific start position (e.g. "alpha1") */
  startPosition?: string;

  /** Prop type filter passed to variation provider and PropTypeConstraint */
  propType?: string;

  /** Beam width for the search (default 10) */
  beamWidth?: number;

  /** Maximum turn intensity cap (0-3). Undefined = level default. */
  maxTurnIntensity?: number;

  /** LOOP extension options. When present, the seed sequence is extended. */
  loop?: LoopOptions;
}

/**
 * LOOP extension configuration.
 */
export interface LoopOptions {
  /** LOOP transformation type */
  type: LOOPType;

  /** How the sequence is sliced for rotation */
  sliceSize: SliceSize;

  /** Whether to use targeted end-position generation */
  useTargetedGeneration?: boolean;
}

/**
 * Result of building a sequence.
 */
export interface BuildResult {
  /** The generated sequence steps (index 0 = start position) */
  sequence: SequenceStep[];

  /** The start position step */
  startPosition: SequenceStep;

  /** Indices of steps that are bridge letters */
  bridgeStepIndices: number[];

  /** Constraint satisfaction report */
  constraintReport: ConstraintReport;

  /** Search performance metrics */
  metrics: {
    statesExplored: number;
    beamPrunings: number;
  };

  /** Turn allocation used for the sequence */
  turnAllocation: TurnAllocation;

  /** LOOP extension metadata (present when loop options were provided) */
  loop?: {
    derivedWord: string;
    seedWord: string;
    components: string[];
    derivedBeatIndices: number[];
    orientationCycleMultiplier: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Builder
// ─────────────────────────────────────────────────────────────────────────────

export class SequenceBuilder {
  private readonly letterParser = new LetterParser();
  private readonly letterClassifier = new LetterClassifier();

  constructor(private readonly variationProvider: IVariationProvider) {}

  /**
   * Build a sequence through the 7-stage pipeline.
   *
   * @throws Error if neither word nor length is provided
   * @throws Error if beam search finds no valid path at all
   */
  build(options: BuildOptions): BuildResult {
    if (!options.word && !options.length) {
      throw new Error("Either word or length must be provided");
    }

    if (options.word) {
      return this.buildByWord(options as BuildOptions & { word: string });
    }

    return this.buildByLength(options as BuildOptions & { length: number });
  }

  /**
   * Word-based generation: parse letters from word, beam search for each letter sequentially.
   */
  private buildByWord(options: BuildOptions & { word: string }): BuildResult {
    // Stage 1: Parse letters
    const letters = this.letterParser.parse(options.word);

    if (letters.length === 0) {
      throw new Error(`No letters parsed from word "${options.word}"`);
    }

    // Stage 2: Assemble constraints
    const constraintSet = this.assembleConstraints(options);

    // Stage 3: Allocate turns
    const turnAllocation = allocateTurns(
      letters.length,
      options.level,
      options.maxTurnIntensity,
    );

    // Stage 4: Beam search
    const beamSearch = new BeamSearch(this.variationProvider, options.gridMode);
    const searchResult = beamSearch.search(
      letters,
      options.startPosition,
      constraintSet,
      options.beamWidth ?? 10,
    );

    if (!searchResult.success && searchResult.steps.length === 0) {
      throw new Error(
        searchResult.error ?? `No valid sequence found for "${options.word}"`,
      );
    }

    // Stage 5: Post-process (convert PictographData to SequenceStep)
    const result = this.postProcess(searchResult, turnAllocation, letters, options.constraintOptions?.propContinuity);

    // Stage 6: LOOP extension (if requested)
    if (options.loop) {
      return this.extendWithLOOP(result, options.loop);
    }

    return result;
  }

  /**
   * Length-based generation: pick random letters per beat using beam search with
   * constraint scoring. No bridges needed since every transition is direct.
   */
  private buildByLength(options: BuildOptions & { length: number }): BuildResult {
    const { length } = options;

    // Stage 2: Assemble constraints
    const constraintSet = this.assembleConstraints(options);

    // Stage 3: Allocate turns
    const turnAllocation = allocateTurns(
      length,
      options.level,
      options.maxTurnIntensity,
    );

    // Stage 4: Beam search by length
    // When generating a LOOP seed, the last beat must end at a specific
    // position determined by the LOOP type and start position. Each LOOP
    // type has its own requirement (rotated = 180°/90° away, inverted =
    // same position, mirrored = vertically mirrored, etc.).
    //
    // LOOPEndPositionSelector handles all LOOP types correctly.
    // When no start position is specified, the beam search picks a random
    // one — we retry up to 10 times if the path fails.
    const needsLoopTargeting = options.loop?.useTargetedGeneration;
    const maxRetries = needsLoopTargeting && !options.startPosition ? 10 : 1;
    let searchResult: BeamSearchResult | undefined;
    let lastError: string | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // For LOOP generation, compute the required end position.
      // If startPosition is specified, compute upfront. If not,
      // the beam search picks a random start — we compute end position
      // from the actual start after the first beat is selected.
      let requiredEndPosition: string | undefined;
      let loopPositionMap: Record<string, string> | undefined;

      if (needsLoopTargeting && options.startPosition) {
        requiredEndPosition = loopEndPositionSelector.determineEndPosition(
          options.loop!.type,
          options.startPosition,
          options.loop!.sliceSize,
        ) ?? undefined;
      } else if (needsLoopTargeting) {
        // No start position specified — build a position map so the beam
        // search can compute the end position from the actual random start.
        // We build this from LOOPEndPositionSelector for all known positions.
        loopPositionMap = this.buildLoopPositionMap(options.loop!);
      }

      const beamSearch = new BeamSearch(this.variationProvider, options.gridMode);
      const result = beamSearch.searchByLength(
        length,
        options.startPosition,
        constraintSet,
        options.beamWidth ?? 10,
        requiredEndPosition,
        loopPositionMap,
      );

      if (result.success || result.steps.length > 0) {
        searchResult = result;
        break;
      }
      lastError = result.error;
    }

    if (!searchResult || (!searchResult.success && searchResult.steps.length === 0)) {
      throw new Error(
        lastError ?? "No valid sequence found for length-based generation",
      );
    }

    // Stage 5: Post-process
    const letters = searchResult.steps.slice(1).map((s) => s.letter);
    const result = this.postProcess(searchResult, turnAllocation, letters, options.constraintOptions?.propContinuity);

    // Stage 6: LOOP extension (if requested)
    if (options.loop) {
      return this.extendWithLOOP(result, options.loop);
    }

    return result;
  }

  /**
   * Stage 2: Assemble constraints from domain rules + user preferences.
   *
   * Domain constraints are always-on hard constraints that enforce TKA physics.
   * Style constraints come from presets or natural language parsing.
   */
  private assembleConstraints(options: BuildOptions): ConstraintSet {
    // Always-on domain hard constraints
    const hard: IConstraint[] = [
      new Type6Constraint(),
      new PositionContinuityConstraint(),
      new FloatConstraint(),
    ];

    if (options.propType) {
      hard.push(new PropTypeConstraint());
    }

    let soft: IConstraint[] = [];

    // Style constraints — all three paths resolve through buildConstraintSet
    let styleSet: ConstraintSet | undefined;

    if (options.constraintOptions) {
      styleSet = buildConstraintSet(options.constraintOptions);
    } else if (options.constraintPreset) {
      const presetOptions = getPresetOptions(options.constraintPreset);
      if (presetOptions) {
        styleSet = buildConstraintSet(presetOptions);
      }
    } else if (options.constraints) {
      // NL parsing still goes through legacy path for now
      const { constraintSet: parsedSet } = parseConstraintSet(options.constraints);
      styleSet = parsedSet;
    }

    if (styleSet) {
      hard.push(...styleSet.hard);
      soft.push(...styleSet.soft);
    }

    // Preserve weights from style constraints if present
    const weights = styleSet?.weights;
    return { hard, soft, weights };
  }

  /**
   * Stage 5: Convert beam search PictographData into SequenceStep format
   * with beat indices, turn allocation, and bridge flags.
   */
  private postProcess(
    searchResult: BeamSearchResult,
    turnAllocation: TurnAllocation,
    letters: string[],
    propContinuity?: "maximize" | "allow-reversals" | "force-reversals",
  ): BuildResult {
    const bridgeIndices = new Set(searchResult.bridgeStepIndices);
    const sequence: SequenceStep[] = [];

    for (let i = 0; i < searchResult.steps.length; i++) {
      const pd = searchResult.steps[i]!;
      const isBridge = bridgeIndices.has(i);

      // Beat index: start position = 0, first letter = 1, etc.
      // Bridge letters share the beat index of the letter they precede.
      const beatIndex = i;

      // Apply turn allocation. Index 0 = start position (no turns),
      // beats are 1-indexed in the turn allocation arrays.
      const beatTurnIndex = i > 0 ? i - 1 : -1;
      const blueTurns = beatTurnIndex >= 0 && beatTurnIndex < turnAllocation.blue.length
        ? turnAllocation.blue[beatTurnIndex]
        : undefined;
      const redTurns = beatTurnIndex >= 0 && beatTurnIndex < turnAllocation.red.length
        ? turnAllocation.red[beatTurnIndex]
        : undefined;

      // Get the previous step's rotation directions for continuity
      const prevStep = sequence.length > 0 ? sequence[sequence.length - 1] : undefined;
      const prevBlueRot = prevStep?.blueMotion.rotationDirection;
      const prevRedRot = prevStep?.redMotion.rotationDirection;

      sequence.push({
        letter: pd.letter,
        startPosition: pd.startPosition,
        endPosition: pd.endPosition,
        blueMotion: {
          motionType: pd.blueMotion.motionType,
          startLocation: pd.blueMotion.startLocation,
          endLocation: pd.blueMotion.endLocation,
          rotationDirection: resolveRotationDirection(pd.blueMotion.rotationDirection, blueTurns, prevBlueRot, propContinuity),
          startOrientation: pd.blueMotion.startOrientation,
          endOrientation: pd.blueMotion.endOrientation,
          turns: blueTurns,
        },
        redMotion: {
          motionType: pd.redMotion.motionType,
          startLocation: pd.redMotion.startLocation,
          endLocation: pd.redMotion.endLocation,
          rotationDirection: resolveRotationDirection(pd.redMotion.rotationDirection, redTurns, prevRedRot, propContinuity),
          startOrientation: pd.redMotion.startOrientation,
          endOrientation: pd.redMotion.endOrientation,
          turns: redTurns,
        },
        beatIndex,
        stepNumber: i,
        isBridge,
      });
    }

    // Propagate orientations through the sequence. The CSV data has
    // orientations for 0-turn variations. After applying non-zero turns,
    // the end orientations must be recalculated: each beat's start
    // orientation = previous beat's end orientation, and end orientation
    // is derived from motion type + turns + rotation direction.
    const propagator = new OrientationPropagator(new OrientationCalculatorImpl());
    const blueStartOrientation = (sequence[0]?.blueMotion.endOrientation || "in") as Orientation;
    let propagated = propagator.propagateForColor(sequence, "blue", blueStartOrientation);
    const redStartOrientation = (sequence[0]?.redMotion.endOrientation || "in") as Orientation;
    propagated = propagator.propagateForColor(propagated, "red", redStartOrientation);

    const startPosition = propagated[0]!;

    return {
      sequence: propagated,
      startPosition,
      bridgeStepIndices: searchResult.bridgeStepIndices,
      constraintReport: searchResult.constraintReport,
      metrics: {
        statesExplored: searchResult.statesExplored,
        beamPrunings: searchResult.beamPrunings,
      },
      turnAllocation,
    };
  }

  /**
   * Stage 6: Extend the seed sequence with a LOOP transformation.
   *
   * The LOOP executors operate on SequenceStep[] directly (via ILOOPExecutor).
   * We select the executor for the requested LOOPType, pass the seed sequence
   * through, then build metadata about what was derived.
   *
   * The executors mutate the input array (shift/unshift the start position),
   * so we pass a copy to keep the original result intact if needed.
   */
  private extendWithLOOP(result: BuildResult, loopOptions: LoopOptions): BuildResult {
    const executor = loopExecutorSelector.getExecutor(loopOptions.type);

    // Build the seed word from non-start-position, non-bridge letters
    const seedWord = result.sequence
      .slice(1)
      .filter((s) => !s.isBridge)
      .map((s) => s.letter)
      .join("");

    // Copy the sequence so the executor's mutations don't affect the original
    const inputSteps = result.sequence.map((s) => ({ ...s }));

    // Execute the LOOP transformation. The executor returns the complete
    // circular sequence (start position + seed beats + derived beats).
    const extendedSteps = executor.executeLOOP(inputSteps, loopOptions.sliceSize);

    // Figure out which beats are derived (everything after the original seed).
    // The original sequence had result.sequence.length steps (including start position).
    // The seed beats occupy indices 1 through (result.sequence.length - 1).
    // Derived beats start at index result.sequence.length.
    const seedStepCount = result.sequence.length;
    const derivedBeatIndices: number[] = [];
    const derivedLetters: string[] = [];

    for (let i = seedStepCount; i < extendedSteps.length; i++) {
      derivedBeatIndices.push(i);
      derivedLetters.push(extendedSteps[i]!.letter);
    }

    const derivedWord = derivedLetters.join("");

    // The orientation cycle multiplier tells the renderer how many
    // times the orientation pattern repeats. For halved it's 2, quartered is 4.
    const orientationCycleMultiplier =
      loopOptions.sliceSize === SliceSize.QUARTERED ? 4 : 2;

    // Build the component labels (seed + derived segments)
    const components = [seedWord];
    if (derivedWord) {
      components.push(derivedWord);
    }

    return {
      ...result,
      sequence: extendedSteps,
      startPosition: extendedSteps[0]!,
      loop: {
        seedWord,
        derivedWord,
        components,
        derivedBeatIndices,
        orientationCycleMultiplier,
      },
    };
  }

  /**
   * Build a position map for LOOP end-position targeting.
   * Maps each possible start position to its required end position
   * for the given LOOP type, using LOOPEndPositionSelector.
   */
  private buildLoopPositionMap(loopOptions: LoopOptions): Record<string, string> {
    const map: Record<string, string> = {};
    // All known position prefixes and counts
    const positions = [
      ...Array.from({ length: 8 }, (_, i) => `alpha${i + 1}`),
      ...Array.from({ length: 8 }, (_, i) => `beta${i + 1}`),
      ...Array.from({ length: 16 }, (_, i) => `gamma${i + 1}`),
    ];
    for (const pos of positions) {
      const endPos = loopEndPositionSelector.determineEndPosition(
        loopOptions.type,
        pos,
        loopOptions.sliceSize,
      );
      if (endPos) {
        map[pos] = endPos;
      }
    }
    return map;
  }
}
