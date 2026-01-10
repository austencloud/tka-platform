/**
 * Partial Sequence Generator Implementation
 *
 * Generates partial sequences for circular mode (LOOP preparation).
 * Extracted from SequenceGenerationService - EXACT original logic preserved.
 */
import type { IGridPositionDeriver } from "$lib/shared/pictograph/grid/services/contracts/IGridPositionDeriver";
import type { ILetterQueryHandler } from "$lib/shared/foundation/services/contracts/data/data-contracts";
import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
import type {
  GridPosition,
  GridMode,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { GenerationOptions } from "$lib/features/create/generate/shared/domain/models/generate-models";
import { PropContinuity } from "$lib/features/create/generate/shared/domain/models/generate-models";
import type { IOrientationCalculator } from "$lib/shared/pictograph/prop/services/contracts/IOrientationCalculator";
import type { IBeatConverter } from "$lib/features/create/generate/shared/services/contracts/IBeatConverter";
import type { ILOOPParameterProvider } from "$lib/features/create/generate/shared/services/contracts/ILOOPParameterProvider";
import type { IPictographFilter } from "$lib/features/create/generate/shared/services/contracts/IPictographFilter";
import type { ISequenceMetadataManager } from "$lib/features/create/generate/shared/services/contracts/ISequenceMetadataManager";
import type { ITurnManager } from "$lib/features/create/generate/shared/services/contracts/ITurnManager";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { SliceSize } from "../../domain/models/circular-models";
import { LOOPType } from "../../domain/models/circular-models";
import type { IPartialSequenceGenerator } from "../contracts/IPartialSequenceGenerator";
import type { IArrowPositioningOrchestrator } from "../../../../../../shared/pictograph/arrow/positioning/services/contracts/IArrowPositioningOrchestrator";

export class PartialSequenceGenerator implements IPartialSequenceGenerator {
  constructor(
    private letterQueryHandler: ILetterQueryHandler,
    private PictographFilter: IPictographFilter,
    private BeatConverter: IBeatConverter,
    private TurnManager: ITurnManager,
    private metadataService: ISequenceMetadataManager,
    private gridPositionDeriver: IGridPositionDeriver,
    private OrientationCalculator: IOrientationCalculator,
    private arrowPositioningOrchestrator: IArrowPositioningOrchestrator,
    private loopParams: ILOOPParameterProvider
  ) {}

  /**
   * Generate a partial sequence ending at a specific position
   * Implements WordLengthCalculator logic from legacy system
   *
   * EXACT ORIGINAL LOGIC FROM SequenceGenerationService._generatePartialSequenceToPosition
   */
  async generatePartialSequence(
    startPos: GridPosition,
    endPos: GridPosition,
    sliceSize: SliceSize,
    options: GenerationOptions
  ): Promise<BeatData[]> {
    // Step 1: Create Type 6 static start position beat (beat 0)
    // Use the same approach as StartPositionManager to create a proper Type 6 motion
    const { MotionType, MotionColor, Orientation, RotationDirection } =
      await import("$lib/shared/pictograph/shared/domain/enums/pictograph-enums");
    const { Letter } =
      await import("$lib/shared/foundation/domain/models/Letter");
    const { createMotionData } =
      await import("$lib/shared/pictograph/shared/domain/models/MotionData");
    const { createPictographData } =
      await import("$lib/shared/pictograph/shared/domain/factories/createPictographData");
    const { SliceSize } = await import("../../domain/models/circular-models");

    // Get hand locations for this start position
    const [blueLocation, redLocation] =
      this.gridPositionDeriver.getGridLocationsFromPosition(startPos);

    // Determine the letter based on the position prefix
    // All positions starting with "alpha" get Letter.ALPHA, etc.
    let letter: (typeof Letter)[keyof typeof Letter];
    const positionName = startPos.toLowerCase();
    if (positionName.startsWith("alpha")) {
      letter = Letter.ALPHA;
    } else if (positionName.startsWith("beta")) {
      letter = Letter.BETA;
    } else {
      letter = Letter.GAMMA;
    }

    // Create Type 6 static motions (both hands stay in place)
    const blueMotion = createMotionData({
      motionType: MotionType.STATIC,
      startLocation: blueLocation,
      endLocation: blueLocation,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
      rotationDirection: RotationDirection.NO_ROTATION,
      turns: 0,
      color: MotionColor.BLUE,
      isVisible: true,
      propType: options.propType,
      arrowLocation: blueLocation,
      gridMode: options.gridMode, // Pass grid mode from options
    });

    const redMotion = createMotionData({
      motionType: MotionType.STATIC,
      startLocation: redLocation,
      endLocation: redLocation,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
      rotationDirection: RotationDirection.NO_ROTATION,
      turns: 0,
      color: MotionColor.RED,
      isVisible: true,
      propType: options.propType,
      arrowLocation: redLocation,
      gridMode: options.gridMode, // Pass grid mode from options
    });

    // Create the start position pictograph
    const startPictograph = createPictographData({
      id: `start-${startPos}`,
      letter,
      startPosition: startPos,
      endPosition: startPos,
      motions: {
        [MotionColor.BLUE]: blueMotion,
        [MotionColor.RED]: redMotion,
      },
    });

    let startBeat = this.BeatConverter.convertToBeat(
      startPictograph,
      0,
      options.gridMode
    );

    // 🎯 CRITICAL FIX: Calculate arrow placements for start beat
    const startPictographData =
      await this.arrowPositioningOrchestrator.calculateAllArrowPoints(
        startBeat
      );
    startBeat = { ...startBeat, ...startPictographData };

    const sequence: BeatData[] = [startBeat];

    // Now get all options for generating the rest of the sequence
    // NOTE: We do NOT filter by prop type here - prop type is a rendering concern,
    // not a motion pattern concern. The same motion patterns apply regardless of
    // whether you're holding a staff, fan, or club.
    const allOptions = await this.letterQueryHandler.getAllPictographVariations(
      options.gridMode
    );

    // Step 2: Calculate word length (legacy formula)
    // This is the total REAL BEATS we need in the partial sequence (excluding start position)
    // The start position (beatNumber 0) is not counted toward the user's requested length
    //
    // SPECIAL CASE: MIRRORED_ROTATED applies TWO doubling steps sequentially:
    // 1. Rotation step: ×2 (halved) or ×4 (quartered)
    // 2. Mirroring step: ×2 (always)
    // Total multiplier: halved = ×4, quartered = ×8
    let wordLength: number;

    if (
      options.loopType === LOOPType.MIRRORED_ROTATED ||
      options.loopType === LOOPType.MIRRORED_INVERTED_ROTATED ||
      options.loopType === LOOPType.MIRRORED_ROTATED_INVERTED_SWAPPED
    ) {
      // MIRRORED_ROTATED, MIRRORED_INVERTED_ROTATED, or MIRRORED_ROTATED_INVERTED_SWAPPED:
      // Account for both rotation AND mirroring (or mirrored+swapped+inverted)
      wordLength =
        sliceSize === SliceSize.HALVED
          ? Math.floor(options.length / 4) // 16 → 4 (rotation ×2, then mirror ×2)
          : Math.floor(options.length / 8); // 16 → 2 (rotation ×4, then mirror ×2)
    } else {
      // Regular LOOP types: Only account for rotation/mirroring (not both)
      wordLength =
        sliceSize === SliceSize.HALVED
          ? Math.floor(options.length / 2) // Standard halved
          : Math.floor(options.length / 4); // Standard quartered
    }

    // Step 3: Generate beats to fill the partial sequence
    // Total REAL BEATS needed: wordLength
    // We already have the start position (beatNumber 0) which is NOT counted
    // We need to generate: wordLength total beats
    // But the last beat must end at the required position, so:
    // - Generate (wordLength - 1) intermediate beats freely
    // - Generate 1 final beat that ends at required position
    const intermediateBeatsCount = Math.max(0, wordLength - 1); // Can be 0 if wordLength is 1
    const beatsToGenerate = intermediateBeatsCount;
    const level = this.metadataService.mapDifficultyToLevel(options.difficulty);
    const turnIntensity = options.turnIntensity ?? 1;

    // Calculate turn allocation for ALL beats we're generating (intermediate + final)
    // We need at least 1 turn allocation for the final beat, even if beatsToGenerate is 0
    const totalBeatsNeedingTurns = Math.max(1, beatsToGenerate + 1);
    const turnAllocation = await this._allocateTurns(
      totalBeatsNeedingTurns,
      level,
      turnIntensity
    );

    // Determine rotation directions
    const { blueRotationDirection, redRotationDirection } =
      this._determineRotationDirections(options.propContinuity);

    // Generate intermediate beats (not constrained to end position)
    for (let i = 0; i < beatsToGenerate; i++) {
      const blueRotation = turnAllocation.blue[i];
      const redRotation = turnAllocation.red[i];

      // Add null checks for array access
      if (blueRotation === undefined || redRotation === undefined) {
        throw new Error(`Missing rotation direction at index ${i}`);
      }

      // Only avoid endPos on the LAST intermediate beat (penultimate beat of the sequence)
      // This prevents situations where the only path to endPos is a Type 6 static move
      // Earlier beats can land on endPos freely since there's still time to move away
      const isPenultimateBeat = i === beatsToGenerate - 1;
      const avoidPosition = isPenultimateBeat ? endPos : undefined;

      const nextBeat = await this._generateNextBeat(
        sequence,
        level,
        blueRotation,
        redRotation,
        options.propContinuity ?? PropContinuity.CONTINUOUS,
        blueRotationDirection,
        redRotationDirection,
        options.gridMode,
        options.propType,
        avoidPosition
      );
      sequence.push(nextBeat);
    }

    // Step 4: Add final beat that must end at required endPos
    const lastBeat = sequence[sequence.length - 1];
    if (!lastBeat) {
      throw new Error("No beats in sequence to generate final beat from");
    }

    let finalMoves = allOptions.filter(
      (p) =>
        p.startPosition === lastBeat.endPosition && p.endPosition === endPos
    );

    // Apply the same filters as intermediate beats to respect continuity setting
    finalMoves = this.PictographFilter.filterByContinuity(finalMoves, lastBeat);

    // Filter out static Type 6 pictographs based on level
    // Level 1: No Type 6 allowed (no turns), Level 2+: Only Type 6 with turns
    finalMoves = this.PictographFilter.filterStaticType6(finalMoves, level);

    if (options.propContinuity === PropContinuity.CONTINUOUS) {
      finalMoves = this.PictographFilter.filterByRotation(
        finalMoves,
        blueRotationDirection,
        redRotationDirection
      );
    }

    if (finalMoves.length === 0) {
      throw new Error(
        `No valid move from ${lastBeat.endPosition} to required end position ${endPos} ` +
          `that respects continuity=${options.propContinuity}. ` +
          `This combination may not be possible with the current settings.`
      );
    }

    const finalPictograph = this.PictographFilter.selectRandom(finalMoves);
    let finalBeat = this.BeatConverter.convertToBeat(
      finalPictograph,
      sequence.length,
      options.gridMode
    );

    // Set turns if level 2 or 3
    // The final beat uses the last turn allocation (index = beatsToGenerate, since we allocated beatsToGenerate + 1 turns)
    if (level === 2 || level === 3) {
      const finalTurnIndex = beatsToGenerate;
      const blueTurn = turnAllocation.blue[finalTurnIndex];
      const redTurn = turnAllocation.red[finalTurnIndex];

      if (blueTurn === undefined || redTurn === undefined) {
        throw new Error(
          `Missing turn allocation at final index ${finalTurnIndex}. ` +
            `beatsToGenerate=${beatsToGenerate}, turnAllocation.length=${turnAllocation.blue.length}`
        );
      }

      this.TurnManager.setTurns(finalBeat, blueTurn, redTurn);
    }

    // Update orientations
    finalBeat = this.OrientationCalculator.updateStartOrientations(
      finalBeat,
      lastBeat
    );
    this.TurnManager.updateDashStaticRotationDirections(
      finalBeat,
      options.propContinuity ?? PropContinuity.CONTINUOUS,
      blueRotationDirection,
      redRotationDirection
    );
    finalBeat = this.OrientationCalculator.updateEndOrientations(finalBeat);

    // 🎯 CRITICAL FIX: Calculate arrow placements for final beat
    const finalPictographData =
      await this.arrowPositioningOrchestrator.calculateAllArrowPoints(
        finalBeat
      );
    finalBeat = { ...finalBeat, ...finalPictographData };

    sequence.push(finalBeat);

    return sequence;
  }

  /**
   * Allocate turns for the sequence
   * EXACT ORIGINAL LOGIC FROM SequenceGenerationService._allocateTurns
   */
  private _allocateTurns(
    beatsToGenerate: number,
    level: number,
    turnIntensity: number
  ): { blue: (number | "fl")[]; red: (number | "fl")[] } {
    return this.loopParams.allocateTurns(beatsToGenerate, level, turnIntensity);
  }

  /**
   * Determine rotation directions based on prop continuity
   * EXACT ORIGINAL LOGIC FROM SequenceGenerationService._determineRotationDirections
   */
  private _determineRotationDirections(propContinuity?: PropContinuity): {
    blueRotationDirection: string;
    redRotationDirection: string;
  } {
    return this.loopParams.determineRotationDirections(propContinuity);
  }

  /**
   * Generate next beat - orchestrates filtering and conversion
   * EXACT ORIGINAL LOGIC FROM SequenceGenerationService._generateNextBeat
   *
   * @param avoidEndPosition - Optional position to avoid landing on (used to prevent
   *   landing on the required final position during intermediate beats, which would
   *   force a Type 6 static move on the final beat)
   */
  private async _generateNextBeat(
    sequence: BeatData[],
    level: number,
    turnBlue: number | "fl",
    turnRed: number | "fl",
    propContinuity: PropContinuity,
    blueRotationDirection: string,
    redRotationDirection: string,
    gridMode: GridMode,
    propType: PropType,
    avoidEndPosition?: GridPosition
  ): Promise<BeatData> {
    // Get all options
    // NOTE: We do NOT filter by prop type - it's a rendering concern, not a motion concern
    const allOptions =
      await this.letterQueryHandler.getAllPictographVariations(gridMode);

    // Apply filters - track counts at each step for diagnostics
    let filteredOptions = allOptions;
    const lastBeat = sequence.length > 0 ? sequence[sequence.length - 1] : null;
    const lastBeatSafe = lastBeat ?? null;
    const lastPos = lastBeatSafe?.endPosition ?? "start";

    // Track filter results for diagnostics
    const filterCounts = {
      total: allOptions.length,
      afterContinuity: 0,
      afterType6: 0,
      afterRotation: 0,
      afterAvoidPos: 0,
    };

    filteredOptions = this.PictographFilter.filterByContinuity(
      filteredOptions,
      lastBeatSafe
    );
    filterCounts.afterContinuity = filteredOptions.length;

    // Filter out static Type 6 pictographs based on level
    // Level 1: No Type 6 allowed (no turns), Level 2+: Only Type 6 with turns
    filteredOptions = this.PictographFilter.filterStaticType6(
      filteredOptions,
      level
    );
    filterCounts.afterType6 = filteredOptions.length;

    if (propContinuity === PropContinuity.CONTINUOUS) {
      filteredOptions = this.PictographFilter.filterByRotation(
        filteredOptions,
        blueRotationDirection,
        redRotationDirection
      );
    }
    filterCounts.afterRotation = filteredOptions.length;

    // Avoid landing on the required end position during intermediate beats
    // This prevents situations where the only path to the end position is a Type 6 static move
    if (avoidEndPosition) {
      filteredOptions = filteredOptions.filter(
        (p) => p.endPosition !== avoidEndPosition
      );
    }
    filterCounts.afterAvoidPos = filteredOptions.length;

    if (filteredOptions.length === 0) {
      // Provide detailed diagnostic info to understand what caused the failure
      console.error("🔴 GENERATION FAILURE DIAGNOSTIC:");
      console.error(`  Current position: ${lastPos}`);
      console.error(`  Level: ${level}`);
      console.error(`  PropContinuity: ${propContinuity}`);
      console.error(`  BlueRotationDir: ${blueRotationDirection}`);
      console.error(`  RedRotationDir: ${redRotationDirection}`);
      console.error(`  AvoidEndPosition: ${avoidEndPosition ?? "none"}`);
      console.error(`  GridMode: ${gridMode}`);
      console.error(
        `  Sequence so far: ${sequence.map((b) => b.endPosition).join(" → ")}`
      );
      console.error(`  Filter chain breakdown:`);
      console.error(`    Total loaded: ${filterCounts.total}`);
      console.error(
        `    After continuity filter (start=${lastPos}): ${filterCounts.afterContinuity}`
      );
      console.error(
        `    After Type6 filter (level=${level}): ${filterCounts.afterType6}`
      );
      console.error(`    After rotation filter: ${filterCounts.afterRotation}`);
      console.error(
        `    After avoidPos filter (avoid=${avoidEndPosition}): ${filterCounts.afterAvoidPos}`
      );

      throw new Error(
        `No valid options available after filtering. ` +
          `Position: ${lastPos}, Level: ${level}, Continuity: ${propContinuity}, ` +
          `AvoidPos: ${avoidEndPosition ?? "none"}`
      );
    }

    // Random selection
    const selectedOption = this.PictographFilter.selectRandom(filteredOptions);

    // Convert to beat
    let nextBeat = this.BeatConverter.convertToBeat(
      selectedOption,
      sequence.length,
      gridMode
    );

    // Set turns if level 2 or 3
    if (level === 2 || level === 3) {
      this.TurnManager.setTurns(nextBeat, turnBlue, turnRed);
    }

    // Update orientations
    if (sequence.length > 0) {
      const previousBeat = sequence[sequence.length - 1];
      if (!previousBeat) {
        throw new Error("Expected previous beat but found undefined");
      }

      nextBeat = this.OrientationCalculator.updateStartOrientations(
        nextBeat,
        previousBeat
      );
    }

    this.TurnManager.updateDashStaticRotationDirections(
      nextBeat,
      propContinuity,
      blueRotationDirection,
      redRotationDirection
    );

    nextBeat = this.OrientationCalculator.updateEndOrientations(nextBeat);

    // 🎯 CRITICAL FIX: Calculate arrow placements before returning
    const nextPictographData =
      await this.arrowPositioningOrchestrator.calculateAllArrowPoints(nextBeat);
    nextBeat = { ...nextBeat, ...nextPictographData };

    return nextBeat;
  }
}
