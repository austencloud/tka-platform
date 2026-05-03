import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import {
  GridLocation,
  GridPosition,
  GridMode,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  MotionColor,
  MotionType,
  Orientation,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { RawStepData, SequenceEntry } from "../contracts/types";

/**
 * Service for converting raw sequence data to StepData for rendering
 */
export class StepDataConverter {
  parseMotionType(value: string | undefined): MotionType {
    const str = String(value || "").toLowerCase();
    switch (str) {
      case "pro":
        return MotionType.PRO;
      case "anti":
        return MotionType.ANTI;
      case "float":
        return MotionType.FLOAT;
      case "dash":
        return MotionType.DASH;
      case "static":
        return MotionType.STATIC;
      default:
        return MotionType.STATIC;
    }
  }

  parseLocation(value: string | undefined): GridLocation {
    const str = String(value || "").toUpperCase();
    const locationMap: Record<string, GridLocation> = {
      N: GridLocation.NORTH,
      NORTH: GridLocation.NORTH,
      E: GridLocation.EAST,
      EAST: GridLocation.EAST,
      S: GridLocation.SOUTH,
      SOUTH: GridLocation.SOUTH,
      W: GridLocation.WEST,
      WEST: GridLocation.WEST,
      NE: GridLocation.NORTHEAST,
      NORTHEAST: GridLocation.NORTHEAST,
      SE: GridLocation.SOUTHEAST,
      SOUTHEAST: GridLocation.SOUTHEAST,
      SW: GridLocation.SOUTHWEST,
      SOUTHWEST: GridLocation.SOUTHWEST,
      NW: GridLocation.NORTHWEST,
      NORTHWEST: GridLocation.NORTHWEST,
    };
    return locationMap[str] ?? GridLocation.NORTH;
  }

  parseGridPosition(value: string | undefined): GridPosition | null {
    if (!value) return null;
    const str = String(value).toLowerCase();
    const enumKey = str.toUpperCase();
    const positionValue = GridPosition[enumKey as keyof typeof GridPosition];
    if (positionValue) return positionValue;
    for (const key in GridPosition) {
      if (GridPosition[key as keyof typeof GridPosition] === str) {
        return str as GridPosition;
      }
    }
    return null;
  }

  parseOrientation(value: string | undefined): Orientation {
    const str = String(value || "").toLowerCase();
    switch (str) {
      case "in":
        return Orientation.IN;
      case "out":
        return Orientation.OUT;
      case "clock":
      case "clockwise":
        return Orientation.CLOCK;
      case "counter":
      case "counterclockwise":
        return Orientation.COUNTER;
      default:
        return Orientation.IN;
    }
  }

  parseRotationDirection(value: string | undefined): RotationDirection {
    const str = String(value || "").toLowerCase();
    switch (str) {
      case "cw":
      case "clockwise":
        return RotationDirection.CLOCKWISE;
      case "ccw":
      case "counterclockwise":
      case "counter_clockwise":
        return RotationDirection.COUNTER_CLOCKWISE;
      case "no_rotation":
      case "norotation":
        return RotationDirection.NO_ROTATION;
      default:
        return RotationDirection.NO_ROTATION;
    }
  }

  parseTurns(value: string | number | undefined): number | "fl" {
    if (value === "fl" || value === "float") return "fl";
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  }

  convertRawToBeats(
    sequenceName: string,
    rawSequence: RawStepData[],
    gridMode: GridMode
  ): {
    steps: StepData[];
    startPosition:
      | (StartPositionData & { stepNumber: number; isBlank: boolean })
      | null;
  } {
    if (!rawSequence || rawSequence.length === 0) {
      return { steps: [], startPosition: null };
    }

    // JSON structure:
    // - Element 0: Metadata (word, author, level, etc.) - no sequenceStartPosition, no blue/red attributes
    // - Element 1: Start position with beat=0, sequenceStartPosition, blue/red attributes
    // - Element 2+: Actual steps with beat>=1

    // Find the start position element (has sequenceStartPosition AND beat === 0)
    const startPosElement = rawSequence.find(
      (el) => "sequenceStartPosition" in el && el.beat === 0
    );

    // Parse start position if found
    // NOTE: We add stepNumber: 0 and isBlank: false so StepGrid/StepCell
    // properly recognize and render this as the start position with "Start" label
    // Using type assertion because StartPositionData doesn't include these runtime fields
    let startPosition:
      | (StartPositionData & {
          stepNumber: number;
          isBlank: boolean;
        })
      | null = null;

    if (startPosElement) {
      const blueAttrs = startPosElement.blueAttributes;
      const redAttrs = startPosElement.redAttributes;
      const gridPosition = this.parseGridPosition(
        startPosElement.sequenceStartPosition
      );

      startPosition = {
        id: `start-${sequenceName}`,
        isStartPosition: true as const,
        stepNumber: 0, // Required for StepCell to identify as start position
        isBlank: false, // Required for StepGrid to show start position
        letter: (startPosElement.letter as Letter | null) ?? null,
        gridPosition,
        startPosition: gridPosition,
        endPosition: null,
        motions: {
          [MotionColor.BLUE]: blueAttrs
            ? createMotionData({
                color: MotionColor.BLUE,
                motionType: this.parseMotionType(blueAttrs.motionType),
                startLocation: this.parseLocation(blueAttrs.startLoc),
                endLocation: this.parseLocation(blueAttrs.endLoc),
                startOrientation: this.parseOrientation(blueAttrs.startOri),
                endOrientation: this.parseOrientation(blueAttrs.endOri),
                rotationDirection: this.parseRotationDirection(
                  blueAttrs.propRotDir
                ),
                turns: this.parseTurns(blueAttrs.turns),
                isVisible: true,
                propType: PropType.STAFF,
                arrowLocation:
                  this.parseLocation(blueAttrs.startLoc) || GridLocation.NORTH,
                gridMode,
              })
            : undefined,
          [MotionColor.RED]: redAttrs
            ? createMotionData({
                color: MotionColor.RED,
                motionType: this.parseMotionType(redAttrs.motionType),
                startLocation: this.parseLocation(redAttrs.startLoc),
                endLocation: this.parseLocation(redAttrs.endLoc),
                startOrientation: this.parseOrientation(redAttrs.startOri),
                endOrientation: this.parseOrientation(redAttrs.endOri),
                rotationDirection: this.parseRotationDirection(
                  redAttrs.propRotDir
                ),
                turns: this.parseTurns(redAttrs.turns),
                isVisible: true,
                propType: PropType.STAFF,
                arrowLocation:
                  this.parseLocation(redAttrs.startLoc) || GridLocation.SOUTH,
                gridMode,
              })
            : undefined,
        },
      };
    }

    // Filter to only actual steps: must have blue/red attributes AND beat >= 1
    // This excludes: metadata elements (no attributes) AND start position (beat === 0)
    const actualSteps = rawSequence.filter(
      (el) =>
        (el.blueAttributes || el.redAttributes) &&
        el.beat !== undefined &&
        el.beat >= 1
    );

    const steps: StepData[] = actualSteps.map((step, index) => {
      const blueAttrs = step.blueAttributes;
      const redAttrs = step.redAttributes;

      return {
        id: `step-${sequenceName}-${index + 1}`,
        letter: (step.letter as Letter) ?? null,
        startPosition:
          this.parseGridPosition(step.startPos) ||
          this.parseGridPosition(step.sequenceStartPosition),
        endPosition: this.parseGridPosition(step.endPos),
        motions: {
          [MotionColor.BLUE]: blueAttrs
            ? createMotionData({
                color: MotionColor.BLUE,
                motionType: this.parseMotionType(blueAttrs.motionType),
                startLocation: this.parseLocation(blueAttrs.startLoc),
                endLocation: this.parseLocation(blueAttrs.endLoc),
                startOrientation: this.parseOrientation(blueAttrs.startOri),
                endOrientation: this.parseOrientation(blueAttrs.endOri),
                rotationDirection: this.parseRotationDirection(
                  blueAttrs.propRotDir
                ),
                turns: this.parseTurns(blueAttrs.turns),
                isVisible: true,
                propType: PropType.STAFF,
                arrowLocation:
                  this.parseLocation(blueAttrs.startLoc) || GridLocation.NORTH,
                gridMode,
              })
            : undefined,
          [MotionColor.RED]: redAttrs
            ? createMotionData({
                color: MotionColor.RED,
                motionType: this.parseMotionType(redAttrs.motionType),
                startLocation: this.parseLocation(redAttrs.startLoc),
                endLocation: this.parseLocation(redAttrs.endLoc),
                startOrientation: this.parseOrientation(redAttrs.startOri),
                endOrientation: this.parseOrientation(redAttrs.endOri),
                rotationDirection: this.parseRotationDirection(
                  redAttrs.propRotDir
                ),
                turns: this.parseTurns(redAttrs.turns),
                isVisible: true,
                propType: PropType.STAFF,
                arrowLocation:
                  this.parseLocation(redAttrs.startLoc) || GridLocation.SOUTH,
                gridMode,
              })
            : undefined,
        },
        // Use step.beat directly (it's guaranteed >= 1 from filter)
        stepNumber: step.beat!,
        duration: 1.0,
        blueReversal: false,
        redReversal: false,
        isBlank: false,
      } as StepData;
    });

    return { steps, startPosition };
  }

  getAuthoritativeGridMode(seq: SequenceEntry): GridMode {
    const metadataGridMode = seq.fullMetadata?.sequence?.[0]?.gridMode;
    const rawGridMode = metadataGridMode ?? seq.gridMode;
    return rawGridMode === "box" ? GridMode.BOX : GridMode.DIAMOND;
  }
}
