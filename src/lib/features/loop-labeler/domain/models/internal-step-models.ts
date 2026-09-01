import type { ComponentId } from "../constants/loop-components";
import type { TransformationIntervals } from "./label-models";

/**
 * Extracted step data normalized for comparison.
 */
export interface ExtractedStep {
  stepNumber: number;
  letter: string;
  startPos: string;
  endPos: string;
  left: {
    startLoc: string;
    endLoc: string;
    motionType: string;
    propRotDir: string;
  };
  right: {
    startLoc: string;
    endLoc: string;
    motionType: string;
    propRotDir: string;
  };
}

/**
 * Internal representation of a beat pair relationship.
 */
export interface InternalStepPair {
  keyStep: number;
  correspondingStep: number;
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
