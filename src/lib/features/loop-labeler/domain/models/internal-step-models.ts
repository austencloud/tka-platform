import type { ComponentId } from "../constants/loop-components";
import type { TransformationIntervals } from "./label-models";

/**
 * Extracted beat data normalized for comparison.
 */
export interface ExtractedBeat {
  beatNumber: number;
  letter: string;
  startPos: string;
  endPos: string;
  blue: {
    startLoc: string;
    endLoc: string;
    motionType: string;
    propRotDir: string;
  };
  red: {
    startLoc: string;
    endLoc: string;
    motionType: string;
    propRotDir: string;
  };
}

/**
 * Internal representation of a beat pair relationship.
 */
export interface InternalBeatPair {
  keyBeat: number;
  correspondingBeat: number;
  rawTransformations: string[];
  detectedTransformations: string[];
  allValidTransformations: string[]; // All formatted transformations before priority filtering
}

/**
 * Internal candidate information before conversion to public format.
 */
export interface CandidateInfo {
  transformation: string;
  components: ComponentId[];
  intervals: TransformationIntervals;
  rotationDirection: "cw" | "ccw" | null;
  label: string;
  description: string;
}

/**
 * Color-specific position and motion data for comparison.
 */
export interface ColorData {
  startLoc: string;
  endLoc: string;
  motionType: string;
  propRotDir: string;
}

/**
 * Result from a single transformation type comparison.
 */
export interface TransformationCheckResult {
  transformations: string[];
}
