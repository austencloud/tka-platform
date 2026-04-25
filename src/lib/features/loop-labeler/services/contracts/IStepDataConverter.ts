import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
import type {
  GridLocation,
  GridPosition,
  GridMode,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type {
  MotionType,
  Orientation,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

/**
 * Raw step data from sequence-index.json (camelCase format)
 */
export interface RawStepData {
  beat?: number;
  letter?: string;
  startPos?: string;
  endPos?: string;
  sequenceStartPosition?: string;
  blueAttributes?: RawMotionAttributes;
  redAttributes?: RawMotionAttributes;
  // Metadata object (first item in sequence array) fields
  word?: string;
  author?: string;
  level?: number;
  propType?: string;
  isCircular?: boolean;
  gridMode?: string; // Authoritative grid mode
  [key: string]: unknown;
}

export interface RawMotionAttributes {
  motionType?: string;
  startLoc?: string;
  endLoc?: string;
  startOri?: string;
  endOri?: string;
  propRotDir?: string;
  turns?: number | string;
}

/**
 * Sequence entry from sequence-index.json
 */
export interface SequenceEntry {
  id: string; // Unique sequence identifier
  word: string;
  isCircular: boolean;
  loopType: string | null;
  thumbnails: string[];
  sequenceLength: number;
  gridMode: string;
  /** Firestore path to full sequence data: "users/{ownerId}/sequences/{id}" */
  sourceRef?: string;
  fullMetadata?: {
    sequence?: RawStepData[];
  };
}

/**
 * Service for converting raw sequence data to StepData for rendering
 */
export interface IStepDataConverter {
  /**
   * Parse motion type from string
   */
  parseMotionType(raw: string | undefined): MotionType;

  /**
   * Parse grid location from string
   */
  parseLocation(raw: string | undefined): GridLocation;

  /**
   * Parse grid position from string
   */
  parseGridPosition(raw: string | undefined): GridPosition | null;

  /**
   * Parse orientation from string
   */
  parseOrientation(raw: string | undefined): Orientation;

  /**
   * Parse rotation direction from string
   */
  parseRotationDirection(raw: string | undefined): RotationDirection;

  /**
   * Parse turns value (number or "fl" for float)
   */
  parseTurns(raw: string | number | undefined): number | "fl";

  /**
   * Convert raw sequence data to StepData array and start position
   */
  convertRawToBeats(
    sequenceName: string,
    rawSequence: RawStepData[],
    gridMode: GridMode
  ): {
    steps: StepData[];
    startPosition:
      | (StartPositionData & { stepNumber: number; isBlank: boolean })
      | null;
  };

  /**
   * Get the authoritative grid mode for a sequence
   * Prefers fullMetadata.sequence[0].gridMode over top-level gridMode
   */
  getAuthoritativeGridMode(sequence: SequenceEntry): GridMode;
}
