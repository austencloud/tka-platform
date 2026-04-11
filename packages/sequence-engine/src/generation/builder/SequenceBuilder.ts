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
  IVariationConstraint,
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
import { ContinuityConstraint } from "../constraints/style/continuity-constraint.js";
import { ConstraintType } from "../constraints/constraint-types.js";
import { FloatConstraint } from "../constraints/domain/FloatConstraint.js";
import { PropTypeConstraint } from "../constraints/domain/PropTypeConstraint.js";
import { getPresetOptions } from "../constraints/presets/preset-constraints.js";
import { buildConstraintSet } from "../constraints/composition/build-constraint-set.js";
import { parseConstraintSet } from "../constraints/parsing/constraint-parser.js";
import type { ConstraintOptions } from "../constraints/composition/constraint-options.js";
import { LOOPType, SliceSize, ROTATED_LOOP_TYPES } from "../../loop/loop-types.js";
import { loopExecutorSelector } from "../../loop/execution/LOOPExecutorSelector.js";
import { loopEndPositionSelector } from "../../loop/targeting/LOOPEndPositionSelector.js";
import {
  QUARTER_POSITION_MAP_CW,
  QUARTER_POSITION_MAP_CCW,
} from "../../loop/position-maps/circular-position-maps.js";
import { VERTICAL_MIRROR_POSITION_MAP } from "../../loop/position-maps/strict-loop-position-maps.js";
import { PositionReachabilityAnalyzer, type ReachabilityResult } from "../reachability/PositionReachabilityAnalyzer.js";

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

  /** Force a specific end position (e.g. "beta5"). The last beat must end here. */
  endPosition?: string;

  /** Start positions to exclude from the random start pool. */
  blockedStartPositions?: string[];

  /** Letters that must NOT appear in the generated sequence. */
  mustNotContainLetters?: string[];

  /** Letters that MUST appear at least once in the generated sequence. */
  mustContainLetters?: string[];

  /** Override the starting orientation for the blue prop (e.g. "in", "out", "clock", "counter") */
  blueStartOrientation?: string;

  /** Override the starting orientation for the red prop (e.g. "in", "out", "clock", "counter") */
  redStartOrientation?: string;
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
    // When LOOP is requested, the last letter must end at a position
    // compatible with the LOOP type. Retry with different random
    // variations if the first attempt doesn't land at a valid position.
    const needsLoopTargeting = options.loop?.useTargetedGeneration;

    // Constrain start position for LOOP types that need vertical axis
    let effectiveStartPosition = options.startPosition;
    if (needsLoopTargeting && options.loop) {
      const constrainedStart = this.constrainStartForLoopType(
        options.loop.type,
        effectiveStartPosition
      );
      if (constrainedStart) {
        effectiveStartPosition = constrainedStart;
      }
    }

    // Compute required end positions for LOOP targeting.
    // When start position is known, we can compute them upfront.
    // When start position is unknown (random), we validate after each attempt.
    let requiredEndPositions: Set<string> | undefined;
    if (needsLoopTargeting && effectiveStartPosition && options.loop) {
      requiredEndPositions = this.getAllValidEndPositions(
        options.loop.type,
        effectiveStartPosition,
        options.loop.sliceSize,
      );
    }

    // Word-based LOOP needs more retries because the word constrains which
    // positions are reachable. Each retry picks different random variations
    // that may land on different end positions.
    const maxRetries = needsLoopTargeting ? 30 : 1;
    let searchResult: BeamSearchResult | undefined;
    let lastError: string | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const beamSearch = new BeamSearch(this.variationProvider, options.gridMode);
      const propContinuity = this.resolveEffectivePropContinuity(options);
      const result = beamSearch.search(
        letters,
        effectiveStartPosition,
        constraintSet,
        options.beamWidth ?? 10,
        requiredEndPositions,
        turnAllocation,
        propContinuity,
      );

      if (result.success || result.steps.length > 0) {
        // When LOOP is requested but start position was random (no
        // requiredEndPositions computed upfront), validate the result's
        // position pair after the fact. If invalid, retry.
        if (needsLoopTargeting && !requiredEndPositions && options.loop && result.steps.length >= 2) {
          const actualStart = result.steps[0]?.startPosition;
          const actualEnd = result.steps[result.steps.length - 1]?.endPosition;
          if (actualStart && actualEnd) {
            const validEnds = this.getAllValidEndPositions(
              options.loop.type,
              actualStart,
              options.loop.sliceSize,
            );
            if (validEnds.size > 0 && !validEnds.has(actualEnd)) {
              lastError = `Position pair ${actualStart} -> ${actualEnd} not valid for ${options.loop.type} LOOP`;
              continue; // retry
            }
          }
        }
        searchResult = result;
        break;
      }
      lastError = result.error;
    }

    if (!searchResult || (!searchResult.success && searchResult.steps.length === 0)) {
      throw new Error(
        lastError ?? `No valid sequence found for "${options.word}"`,
      );
    }

    // Stage 5: Post-process (convert PictographData to SequenceStep)
    const propContinuity = this.resolveEffectivePropContinuity(options);
    const result = this.postProcess(searchResult, turnAllocation, letters, propContinuity, {
      blueStartOrientation: options.blueStartOrientation,
      redStartOrientation: options.redStartOrientation,
    });

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

    // When the user wants smooth continuity, try promoting the constraint to
    // hard first (no reversals allowed). If the beam dies — which can happen
    // when all variations at a position reverse the established rotation —
    // fall back to soft continuity so the search still produces a result.
    const effectivePropContinuity = this.resolveEffectivePropContinuity(options);
    let promotedContinuity = false;
    if (effectivePropContinuity === "maximize") {
      constraintSet.soft = constraintSet.soft.filter(
        (c) => c.type !== ConstraintType.CONTINUITY,
      );
      constraintSet.hard.push(new ContinuityConstraint("enforce"));
      promotedContinuity = true;
    }

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

    // Some LOOP types require the start position to be on the vertical axis
    // (where vertical_mirror(pos) === pos). If no start position is specified,
    // pick a random valid one. If the user specified an incompatible position,
    // override it to a compatible one so the executor doesn't reject it.
    let effectiveStartPosition = options.startPosition;
    if (needsLoopTargeting && options.loop) {
      const constrainedStart = this.constrainStartForLoopType(
        options.loop.type,
        effectiveStartPosition
      );
      if (constrainedStart) {
        effectiveStartPosition = constrainedStart;
      }
    }

    // Build search options for filtering
    const searchOptions = {
      blockedStartPositions: options.blockedStartPositions
        ? new Set(options.blockedStartPositions)
        : undefined,
      mustNotContainLetters: options.mustNotContainLetters
        ? new Set(options.mustNotContainLetters)
        : undefined,
      mustContainLetters: options.mustContainLetters
        ? new Set(options.mustContainLetters)
        : undefined,
    };

    // Pre-filter variations by hard constraints for reachability analysis.
    // This only runs once (not per-retry) since hard constraints don't change.
    // Uses the same Type6 exclusion as BeamSearch (α, β, γ are start positions only).
    const allVariationsForReach = this.variationProvider.getAllVariations(options.gridMode);
    const TYPE_6_LETTERS = ["α", "β", "γ"];
    let nonType6ForReachability = allVariationsForReach.filter(
      (p) => !TYPE_6_LETTERS.includes(p.letter),
    );
    if (options.mustNotContainLetters && options.mustNotContainLetters.length > 0) {
      const excluded = new Set(options.mustNotContainLetters);
      nonType6ForReachability = nonType6ForReachability.filter(
        (p) => !excluded.has(p.letter),
      );
    }
    const hardConstraintFiltered = this.filterByHardConstraints(
      nonType6ForReachability, constraintSet.hard,
    );

    const maxRetries = needsLoopTargeting && !effectiveStartPosition ? 10 : 1;
    let searchResult: BeamSearchResult | undefined;
    let lastError: string | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // For LOOP generation, compute the required end position.
      // If startPosition is specified, compute upfront. If not,
      // the beam search picks a random start — we compute end position
      // from the actual start after the first beat is selected.
      let requiredEndPositions: Set<string> | undefined;
      let loopPositionMap: Record<string, string[]> | undefined;

      if (needsLoopTargeting && effectiveStartPosition) {
        requiredEndPositions = this.getAllValidEndPositions(
          options.loop!.type,
          effectiveStartPosition,
          options.loop!.sliceSize,
        );
      } else if (needsLoopTargeting) {
        // No start position specified — build a position map so the beam
        // search can compute the end position from the actual random start.
        loopPositionMap = this.buildLoopPositionMap(options.loop!);
      }

      // User-specified end position (non-LOOP) merges into requiredEndPositions
      if (options.endPosition && !needsLoopTargeting) {
        requiredEndPositions = new Set([options.endPosition]);
      }

      // Backward reachability analysis: when we have a goal (LOOP endpoint)
      // AND hard constraints that filter the variation space, pre-compute
      // which positions at each beat can participate in a valid path to the
      // goal. This prevents the beam search from wasting lanes on doomed paths
      // and fails fast when constraints are provably impossible.
      let reachability: ReachabilityResult | undefined;
      if (requiredEndPositions && requiredEndPositions.size > 0 && constraintSet.hard.length > 0) {
        const analyzer = new PositionReachabilityAnalyzer();
        reachability = analyzer.analyze(
          length,
          requiredEndPositions,
          hardConstraintFiltered,
          searchOptions.blockedStartPositions,
        );

        if (!reachability.feasible) {
          throw new Error(
            `No valid ${length}-beat path exists: beat ${reachability.emptyBeatIndex! + 1} ` +
            `has no reachable positions given the current constraints`,
          );
        }
      }

      const beamSearch = new BeamSearch(this.variationProvider, options.gridMode);
      const propContinuity = this.resolveEffectivePropContinuity(options);
      const result = beamSearch.searchByLength(
        length,
        effectiveStartPosition,
        constraintSet,
        options.beamWidth ?? 10,
        requiredEndPositions,
        loopPositionMap,
        searchOptions,
        turnAllocation,
        propContinuity,
        reachability,
      );

      if (result.success || result.steps.length > 0) {
        // Validate mustContainLetters if specified
        if (searchOptions.mustContainLetters && searchOptions.mustContainLetters.size > 0) {
          const presentLetters = new Set(result.steps.slice(1).map((s) => s.letter));
          const missing = [...searchOptions.mustContainLetters].filter((l) => !presentLetters.has(l));
          if (missing.length > 0) {
            lastError = `Required letters [${missing.join(", ")}] not present in generated sequence`;
            continue; // retry
          }
        }

        searchResult = result;
        break;
      }
      lastError = result.error;
    }

    // If hard continuity killed the beam, demote to soft and retry once.
    // Some positions only have variations that reverse the established rotation,
    // so enforcing continuity as a hard constraint is too strict.
    if (
      (!searchResult || (!searchResult.success && searchResult.steps.length === 0)) &&
      promotedContinuity
    ) {
      constraintSet.hard = constraintSet.hard.filter(
        (c) => c.type !== ConstraintType.CONTINUITY,
      );
      constraintSet.soft.push(new ContinuityConstraint("maximize"));

      // Recompute hard-constraint-filtered variations after removing continuity
      const demotedHardFiltered = this.filterByHardConstraints(
        nonType6ForReachability, constraintSet.hard,
      );

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        let requiredEndPositions: Set<string> | undefined;
        let loopPositionMap: Record<string, string[]> | undefined;

        if (needsLoopTargeting && effectiveStartPosition) {
          requiredEndPositions = this.getAllValidEndPositions(
            options.loop!.type,
            effectiveStartPosition,
            options.loop!.sliceSize,
          );
        } else if (needsLoopTargeting) {
          loopPositionMap = this.buildLoopPositionMap(options.loop!);
        }

        if (options.endPosition && !needsLoopTargeting) {
          requiredEndPositions = new Set([options.endPosition]);
        }

        // Recompute reachability with the demoted constraint set
        let reachabilityRetry: ReachabilityResult | undefined;
        if (requiredEndPositions && requiredEndPositions.size > 0 && constraintSet.hard.length > 0) {
          const analyzer = new PositionReachabilityAnalyzer();
          reachabilityRetry = analyzer.analyze(
            length,
            requiredEndPositions,
            demotedHardFiltered,
            searchOptions.blockedStartPositions,
          );

          if (!reachabilityRetry.feasible) {
            throw new Error(
              `No valid ${length}-beat path exists: beat ${reachabilityRetry.emptyBeatIndex! + 1} ` +
              `has no reachable positions given the current constraints`,
            );
          }
        }

        const beamSearch = new BeamSearch(this.variationProvider, options.gridMode);
        const propContinuity = this.resolveEffectivePropContinuity(options);
        const result = beamSearch.searchByLength(
          length,
          effectiveStartPosition,
          constraintSet,
          options.beamWidth ?? 10,
          requiredEndPositions,
          loopPositionMap,
          searchOptions,
          turnAllocation,
          propContinuity,
          reachabilityRetry,
        );

        if (result.success || result.steps.length > 0) {
          if (searchOptions.mustContainLetters && searchOptions.mustContainLetters.size > 0) {
            const presentLetters = new Set(result.steps.slice(1).map((s) => s.letter));
            const missing = [...searchOptions.mustContainLetters].filter((l) => !presentLetters.has(l));
            if (missing.length > 0) {
              lastError = `Required letters [${missing.join(", ")}] not present in generated sequence`;
              continue;
            }
          }
          searchResult = result;
          break;
        }
        lastError = result.error;
      }
    }

    if (!searchResult || (!searchResult.success && searchResult.steps.length === 0)) {
      throw new Error(
        lastError ?? "No valid sequence found for length-based generation",
      );
    }

    // Stage 5: Post-process
    const letters = searchResult.steps.slice(1).map((s) => s.letter);
    const propContinuity = this.resolveEffectivePropContinuity(options);
    const result = this.postProcess(searchResult, turnAllocation, letters, propContinuity, {
      blueStartOrientation: options.blueStartOrientation,
      redStartOrientation: options.redStartOrientation,
    });

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
   * Resolve the effective propContinuity setting from whichever input source
   * was used (constraintOptions, preset, or NL constraints). Without this,
   * preset-derived propContinuity was lost and postProcess defaulted to
   * random rotation direction assignment — producing prop reversals even
   * when the user selected "smooth".
   */
  private resolveEffectivePropContinuity(
    options: BuildOptions,
  ): "maximize" | "allow-reversals" | "force-reversals" | undefined {
    // Direct constraintOptions take highest priority
    if (options.constraintOptions?.propContinuity) {
      return options.constraintOptions.propContinuity;
    }

    // Named preset — look up the preset's propContinuity
    if (options.constraintPreset) {
      const presetOptions = getPresetOptions(options.constraintPreset);
      if (presetOptions?.propContinuity) {
        return presetOptions.propContinuity;
      }
    }

    return undefined;
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
    orientationOverrides?: { blueStartOrientation?: string; redStartOrientation?: string },
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

      // Float is a shift variant — the prop shifts to an adjacent point with
      // minimal rotation. The TurnAllocator may assign "fl" to any hand, but
      // float only applies when the underlying motion is a shift (pro or
      // anti). A dash or static that gets "fl" from the allocator keeps its
      // original motion type.
      const blueIsShift =
        pd.blueMotion.motionType === "pro" ||
        pd.blueMotion.motionType === "anti";
      const redIsShift =
        pd.redMotion.motionType === "pro" ||
        pd.redMotion.motionType === "anti";
      const blueIsFloat = blueTurns === "fl" && blueIsShift;
      const redIsFloat = redTurns === "fl" && redIsShift;
      const blueMotionType = blueIsFloat ? "float" as const : pd.blueMotion.motionType;
      const redMotionType = redIsFloat ? "float" as const : pd.redMotion.motionType;

      // Compute effective turns: float keeps "fl", non-shift "fl" becomes 0,
      // everything else passes through. We need this BEFORE resolving direction
      // because 0-turn motions must always be "noRotation".
      const effectiveBlueTurns = blueIsFloat ? blueTurns : (blueTurns === "fl" ? 0 : blueTurns);
      const effectiveRedTurns = redIsFloat ? redTurns : (redTurns === "fl" ? 0 : redTurns);

      sequence.push({
        letter: pd.letter,
        startPosition: pd.startPosition,
        endPosition: pd.endPosition,
        blueMotion: {
          motionType: blueMotionType,
          startLocation: pd.blueMotion.startLocation,
          endLocation: pd.blueMotion.endLocation,
          rotationDirection: blueIsFloat
            ? "noRotation"
            : resolveRotationDirection(pd.blueMotion.rotationDirection, effectiveBlueTurns, prevBlueRot, propContinuity),
          startOrientation: pd.blueMotion.startOrientation,
          endOrientation: pd.blueMotion.endOrientation,
          turns: effectiveBlueTurns,
        },
        redMotion: {
          motionType: redMotionType,
          startLocation: pd.redMotion.startLocation,
          endLocation: pd.redMotion.endLocation,
          rotationDirection: redIsFloat
            ? "noRotation"
            : resolveRotationDirection(pd.redMotion.rotationDirection, effectiveRedTurns, prevRedRot, propContinuity),
          startOrientation: pd.redMotion.startOrientation,
          endOrientation: pd.redMotion.endOrientation,
          turns: effectiveRedTurns,
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
    const blueStartOrientation = (orientationOverrides?.blueStartOrientation || sequence[0]?.blueMotion.endOrientation || "in") as Orientation;
    let propagated = propagator.propagateForColor(sequence, "blue", blueStartOrientation);
    const redStartOrientation = (orientationOverrides?.redStartOrientation || sequence[0]?.redMotion.endOrientation || "in") as Orientation;
    propagated = propagator.propagateForColor(propagated, "red", redStartOrientation);

    // Update beat 0 (start position) orientations when overrides are provided.
    // The propagator starts at i=1, so beat 0 retains its original CSV orientations.
    // The start position is a static hold, so start and end orientation are the same.
    if (orientationOverrides && propagated[0]) {
      const sp = propagated[0];
      if (orientationOverrides.blueStartOrientation) {
        const blueOri = orientationOverrides.blueStartOrientation as Orientation;
        propagated[0] = {
          ...sp,
          blueMotion: { ...sp.blueMotion, startOrientation: blueOri, endOrientation: blueOri },
        };
      }
      if (orientationOverrides.redStartOrientation) {
        const redOri = orientationOverrides.redStartOrientation as Orientation;
        propagated[0] = {
          ...propagated[0]!,
          redMotion: { ...propagated[0]!.redMotion, startOrientation: redOri, endOrientation: redOri },
        };
      }
    }

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
   * LOOP types that combine MIRRORED + ROTATED require the start position to
   * sit on the vertical axis (where vertical_mirror(pos) === pos).
   *
   * If the current position is already on the axis, returns undefined (no change needed).
   * If incompatible or unspecified, randomly picks a valid axis position.
   */
  private constrainStartForLoopType(
    loopType: LOOPType,
    currentStartPosition?: string
  ): string | undefined {
    const MIRRORED_ROTATED_TYPES = new Set([
      LOOPType.MIRRORED_ROTATED,
      LOOPType.MIRRORED_INVERTED_ROTATED,
      LOOPType.MIRRORED_ROTATED_INVERTED_SWAPPED,
    ]);

    if (!MIRRORED_ROTATED_TYPES.has(loopType)) return undefined;

    // If the user's position is already on the vertical axis, no override needed
    if (currentStartPosition) {
      const mirrored = VERTICAL_MIRROR_POSITION_MAP[currentStartPosition];
      if (mirrored === currentStartPosition) return undefined;
    }

    // Position is incompatible or unspecified — pick a random axis position
    const axisPositions = Object.entries(VERTICAL_MIRROR_POSITION_MAP)
      .filter(([pos, mirrored]) => pos === mirrored)
      .map(([pos]) => pos)
      // Only include alpha/beta/gamma (not zeta/eta/tau which are higher levels)
      .filter((pos) => pos.startsWith("alpha") || pos.startsWith("beta") || pos.startsWith("gamma"));

    if (axisPositions.length === 0) return undefined;
    return axisPositions[Math.floor(Math.random() * axisPositions.length)];
  }

  /**
   * Filter variations by hard constraints using the couldSatisfy() fast path.
   * Returns only variations that pass all hard constraint checks — the set of
   * transitions the beam search could actually use.
   */
  private filterByHardConstraints(
    variations: PictographData[],
    hardConstraints: IConstraint[],
  ): PictographData[] {
    if (hardConstraints.length === 0) return variations;

    return variations.filter((v) =>
      hardConstraints.every((c) => {
        const asVariation = c as IVariationConstraint;
        if (typeof asVariation.couldSatisfy === "function") {
          return asVariation.couldSatisfy(v);
        }
        // Constraints without couldSatisfy (e.g. PositionContinuityConstraint)
        // can't pre-filter individual variations — assume they pass.
        return true;
      }),
    );
  }

  /**
   * Get ALL valid end positions for a LOOP type + start position + slice size.
   * For quartered rotated LOOPs, returns both CW and CCW targets.
   * For other types, returns the single valid end position.
   */
  private getAllValidEndPositions(
    loopType: LOOPType,
    startPosition: string,
    sliceSize: SliceSize,
  ): Set<string> {
    const positions = new Set<string>();

    // For rotated LOOP types with quartered slice, both CW and CCW are valid
    if (sliceSize === SliceSize.QUARTERED && ROTATED_LOOP_TYPES.has(loopType)) {
      const cw = QUARTER_POSITION_MAP_CW[startPosition];
      const ccw = QUARTER_POSITION_MAP_CCW[startPosition];
      if (cw) positions.add(cw);
      if (ccw) positions.add(ccw);
    } else {
      // For all other types, delegate to the standard selector
      const endPos = loopEndPositionSelector.determineEndPosition(
        loopType,
        startPosition,
        sliceSize,
      );
      if (endPos) positions.add(endPos);
    }

    return positions;
  }

  /**
   * Build a position map for LOOP end-position targeting.
   * Maps each possible start position to ALL its valid end positions
   * for the given LOOP type. For quartered rotated LOOPs, each start
   * maps to both CW and CCW targets.
   */
  private buildLoopPositionMap(loopOptions: LoopOptions): Record<string, string[]> {
    const map: Record<string, string[]> = {};
    const positions = [
      ...Array.from({ length: 8 }, (_, i) => `alpha${i + 1}`),
      ...Array.from({ length: 8 }, (_, i) => `beta${i + 1}`),
      ...Array.from({ length: 16 }, (_, i) => `gamma${i + 1}`),
    ];
    for (const pos of positions) {
      const endPositions = this.getAllValidEndPositions(
        loopOptions.type,
        pos,
        loopOptions.sliceSize,
      );
      if (endPositions.size > 0) {
        map[pos] = Array.from(endPositions);
      }
    }
    return map;
  }
}
