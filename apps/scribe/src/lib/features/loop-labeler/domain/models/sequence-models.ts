/**
 * Domain models for sequence data structures
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
    sequence?: RawStepData[];
  };
}

// Raw beat data from sequence-index.json (camelCase format)
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
