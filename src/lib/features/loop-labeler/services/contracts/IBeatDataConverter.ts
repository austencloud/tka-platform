import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
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
 * Raw beat data from sequence-index.json (camelCase format)
 */
export interface RawBeatData {
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
  fullMetadata?: {
    sequence?: RawBeatData[];
  };
}

/**
 * Service for converting raw sequence data to BeatData for rendering
 */
export interface IBeatDataConverter {
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
   * Convert raw sequence data to BeatData array and start position
   */
  convertRawToBeats(
    sequenceName: string,
    rawSequence: RawBeatData[],
    gridMode: GridMode
  ): {
    beats: BeatData[];
    startPosition:
      | (StartPositionData & { beatNumber: number; isBlank: boolean })
      | null;
  };

  /**
   * Get the authoritative grid mode for a sequence
   * Prefers fullMetadata.sequence[0].gridMode over top-level gridMode
   */
  getAuthoritativeGridMode(sequence: SequenceEntry): GridMode;
}
