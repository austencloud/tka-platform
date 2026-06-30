/**
 * Build Result Transformer
 *
 * Converts the sequence engine's BuildResult into the app's SequenceData.
 *
 * The engine operates on minimal string-typed SequenceStep objects for
 * platform portability. The app needs rich PictographData with enum-typed
 * fields, embedded placement data (arrow positions, prop positions), and
 * additional step context (duration, reversals, etc.).
 *
 * This transformer bridges that gap by:
 * 1. Mapping each SequenceStep's string fields back to the app's enum types
 * 2. Creating full MotionData with placement data via createMotionData()
 * 3. Wrapping steps in StepData with beat context
 * 4. Extracting StartPositionData from step 0
 * 5. Delegating metadata, reversal detection, and cycle detection to existing services
 */

import type { BuildResult } from "@tka/sequence-engine/generation";
import type {
  SequenceStep,
  MotionData as EngineMotionData,
} from "@tka/sequence-engine/core";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";
import type { GenerationOptions } from "$lib/shared/foundation/domain/models/generation/generate-models";
import type { sequenceMetadataManager as SequenceMetadataManagerSingleton } from "$lib/shared/create/services/sequence-metadata-manager";
type SequenceMetadataManager = typeof SequenceMetadataManagerSingleton;
import type { ReversalDetector } from "$lib/shared/create/services/reversal-detector";
import { detectOrientationCycle } from "$lib/shared/create/services/orientation-cycle-detector";
import { PropContinuity } from "$lib/shared/foundation/domain/models/generation/generate-models";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import {
  MotionType,
  RotationDirection,
  Orientation,
  MotionColor,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  GridLocation,
  type GridPosition,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { Letter } from "$lib/shared/foundation/domain/models/letter";
import type { MotionData as AppMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import type { LOOPType as AppLOOPType } from "$lib/shared/foundation/domain/models/generation/circular-models";

export class BuildResultTransformer {
  constructor(
    private readonly metadataManager: SequenceMetadataManager,
    private readonly reversalDetector: ReversalDetector
  ) {}

  async convertToSequenceData(
    result: BuildResult,
    options: GenerationOptions
  ): Promise<SequenceData> {
    const isCircular = !!result.loop;

    // The engine's sequence[0] is the start position, sequence[1..n] are steps
    const startPositionStep = result.sequence[0];
    if (!startPositionStep) {
      throw new Error("BuildResult has empty sequence - no start position");
    }

    const startPosition = this.mapStartPosition(startPositionStep);
    const steps = this.mapSteps(result.sequence.slice(1), options);

    // Calculate word from the mapped steps
    const word = steps
      .filter((s) => s.letter)
      .map((s) => s.letter)
      .join("");

    const level = this.metadataManager.mapDifficultyToLevel(options.difficulty);

    const metadata = this.metadataManager.createGenerationMetadata({
      stepsGenerated: steps.length,
      propContinuity:
        options.propContinuity ?? PropContinuity.CONTINUOUS,
      blueRotationDirection: "",
      redRotationDirection: "",
      turnIntensity: options.turnIntensity ?? 1,
      level,
    });

    // Determine LOOP type for the sequence data - map engine enum to app enum
    const appLoopType: AppLOOPType | undefined = isCircular
      ? this.mapLoopTypeToApp(options)
      : undefined;

    const tags: string[] = isCircular
      ? ["circular", "cap", ...(appLoopType ? [appLoopType.replace(/_/g, "-")] : [])]
      : ["generated", "freeform"];

    const { createSequenceData } = await import(
      "$lib/shared/foundation/domain/models/sequence-data"
    );

    const sequenceData = createSequenceData({
      name: word || "",
      word,
      steps,
      startingPosition: startPosition,
      startPosition,
      gridMode: options.gridMode,
      difficultyLevel: options.difficulty,
      isFavorite: false,
      isCircular,
      ...(appLoopType && { loopType: appLoopType }),
      tags,
      metadata,
    });

    // Apply reversal detection
    const withReversals =
      this.reversalDetector.processReversals(sequenceData);

    // For circular sequences, detect orientation cycle count
    if (isCircular) {
      const cycleResult = detectOrientationCycle(withReversals);

      if (cycleResult.cycleCount > 1) {
        const { updateSequenceData } = await import(
          "$lib/shared/foundation/domain/models/sequence-data"
        );
        return updateSequenceData(withReversals, {
          orientationCycleCount: cycleResult.cycleCount as 1 | 2 | 4,
        });
      }
    }

    return withReversals;
  }

  /**
   * Map engine SequenceSteps (steps only, not start position) to app StepData[].
   */
  private mapSteps(
    engineSteps: SequenceStep[],
    options: GenerationOptions
  ): StepData[] {
    return engineSteps.map((step, index) => this.mapStep(step, index + 1, options));
  }

  /**
   * Map a single engine SequenceStep to app StepData.
   *
   * StepData extends PictographData, so we need to build the full
   * PictographData shape (id, letter, positions, motions map) plus
   * the step-specific fields (stepNumber, duration, reversals, isBlank).
   */
  private mapStep(
    step: SequenceStep,
    stepNumber: number,
    options: GenerationOptions
  ): StepData {
    const blueMotion = this.mapMotion(step.motions.blue, MotionColor.BLUE, options);
    const redMotion = this.mapMotion(step.motions.red, MotionColor.RED, options);

    return {
      id: `step-${stepNumber}-${Date.now()}`,
      letter: (step.letter || null) as Letter | null,
      startPosition: (step.startPosition || null) as GridPosition | null,
      endPosition: (step.endPosition || null) as GridPosition | null,
      motions: {
        [MotionColor.BLUE]: blueMotion,
        [MotionColor.RED]: redMotion,
      },
      gridMode: options.gridMode,
      isStep: true as const,
      stepNumber,
      duration: 1,
      blueReversal: false, // Set by ReversalDetector later
      redReversal: false,
      isBlank: false,
    };
  }

  /**
   * Map the engine's start position step to the app's StartPositionData.
   *
   * The engine treats the start position as sequence[0] with letter = start
   * position name, motionType = "static" for both hands. We extract position
   * and orientation info to build the app's rich type.
   */
  private mapStartPosition(step: SequenceStep): StartPositionData {
    const gridPosition = (step.endPosition || step.startPosition || null) as GridPosition | null;

    // For start positions, motions should be static (props are held in place)
    const blueMotion = createMotionData({
      motionType: this.toMotionType(step.motions.blue.motionType),
      rotationDirection: this.toRotationDirection(step.motions.blue.rotationDirection),
      startLocation: this.toGridLocation(step.motions.blue.startLocation),
      endLocation: this.toGridLocation(step.motions.blue.endLocation),
      startOrientation: this.toOrientation(step.motions.blue.startOrientation),
      endOrientation: this.toOrientation(step.motions.blue.endOrientation),
      turns: step.motions.blue.turns ?? 0,
      color: MotionColor.BLUE,
    });

    const redMotion = createMotionData({
      motionType: this.toMotionType(step.motions.red.motionType),
      rotationDirection: this.toRotationDirection(step.motions.red.rotationDirection),
      startLocation: this.toGridLocation(step.motions.red.startLocation),
      endLocation: this.toGridLocation(step.motions.red.endLocation),
      startOrientation: this.toOrientation(step.motions.red.startOrientation),
      endOrientation: this.toOrientation(step.motions.red.endOrientation),
      turns: step.motions.red.turns ?? 0,
      color: MotionColor.RED,
    });

    return {
      isStartPosition: true as const,
      id: `start-${Date.now()}`,
      gridPosition,
      letter: (step.letter || null) as Letter | null,
      startPosition: gridPosition,
      endPosition: gridPosition,
      motions: {
        [MotionColor.BLUE]: blueMotion,
        [MotionColor.RED]: redMotion,
      },
    };
  }

  /**
   * Map an engine MotionData (string fields) to a full app MotionData (enum fields + placement).
   * createMotionData() fills in sensible defaults for placement data.
   */
  private mapMotion(
    engineMotion: EngineMotionData,
    color: MotionColor,
    options: GenerationOptions
  ): AppMotionData {
    return createMotionData({
      motionType: this.toMotionType(engineMotion.motionType),
      rotationDirection: this.toRotationDirection(engineMotion.rotationDirection),
      startLocation: this.toGridLocation(engineMotion.startLocation),
      endLocation: this.toGridLocation(engineMotion.endLocation),
      startOrientation: this.toOrientation(engineMotion.startOrientation),
      endOrientation: this.toOrientation(engineMotion.endOrientation),
      turns: engineMotion.turns ?? 0,
      color,
      gridMode: options.gridMode,
      ...(engineMotion.prefloatMotionType && {
        prefloatMotionType: this.toMotionType(engineMotion.prefloatMotionType),
      }),
      ...(engineMotion.prefloatRotationDirection && {
        prefloatRotationDirection: this.toRotationDirection(engineMotion.prefloatRotationDirection),
      }),
    });
  }

  // ─── Enum conversion helpers ────────────────────────────────────────────────
  // The engine uses plain strings for portability. The app uses TypeScript enums.
  // The enum values match the string values (e.g. MotionType.PRO = "pro"),
  // so we cast after looking up. If a string doesn't match, we fall back to
  // a sensible default.

  private toMotionType(value: string): MotionType {
    const map: Record<string, MotionType> = {
      pro: MotionType.PRO,
      anti: MotionType.ANTI,
      float: MotionType.FLOAT,
      dash: MotionType.DASH,
      static: MotionType.STATIC,
    };
    return map[value] ?? MotionType.STATIC;
  }

  private toRotationDirection(value: string): RotationDirection {
    const map: Record<string, RotationDirection> = {
      cw: RotationDirection.CLOCKWISE,
      ccw: RotationDirection.COUNTER_CLOCKWISE,
      noRotation: RotationDirection.NO_ROTATION,
    };
    return map[value] ?? RotationDirection.NO_ROTATION;
  }

  private toGridLocation(value: string): GridLocation {
    const map: Record<string, GridLocation> = {
      n: GridLocation.NORTH,
      e: GridLocation.EAST,
      s: GridLocation.SOUTH,
      w: GridLocation.WEST,
      ne: GridLocation.NORTHEAST,
      se: GridLocation.SOUTHEAST,
      sw: GridLocation.SOUTHWEST,
      nw: GridLocation.NORTHWEST,
      c: GridLocation.CENTER,
    };
    return map[value] ?? GridLocation.NORTH;
  }

  private toOrientation(value: string | undefined): Orientation {
    if (!value) return Orientation.IN;
    const map: Record<string, Orientation> = {
      in: Orientation.IN,
      out: Orientation.OUT,
      clock: Orientation.CLOCK,
      counter: Orientation.COUNTER,
      clockIn: Orientation.CLOCK_IN,
      clockOut: Orientation.CLOCK_OUT,
      counterIn: Orientation.COUNTER_IN,
      counterOut: Orientation.COUNTER_OUT,
      centerN: Orientation.CENTER_N,
      centerNE: Orientation.CENTER_NE,
      centerE: Orientation.CENTER_E,
      centerSE: Orientation.CENTER_SE,
      centerS: Orientation.CENTER_S,
      centerSW: Orientation.CENTER_SW,
      centerW: Orientation.CENTER_W,
      centerNW: Orientation.CENTER_NW,
    };
    return map[value] ?? Orientation.IN;
  }

  /**
   * Map LOOP info from the engine result back to the app's LOOPType enum.
   * The app stores loopType on the SequenceData so the glyph can display
   * the pattern type without re-detecting it.
   */
  private mapLoopTypeToApp(
    options: GenerationOptions
  ): AppLOOPType | undefined {
    // The app's GenerationOptions already carries the LOOPType from the UI
    // as the app's own enum value. Pass it through directly.
    return options.loopType ?? undefined;
  }
}
