/**
 * Broadcast Types
 *
 * TypeScript types for the live broadcast system.
 */

import { Timestamp } from "firebase-admin/firestore";

/**
 * LOOP types supported by the broadcast system.
 * Matches client-side LOOPType enum values.
 */
export const LOOPType = {
  ROTATED: "ROTATED",
  MIRRORED: "MIRRORED",
  SWAPPED: "SWAPPED",
  INVERTED: "INVERTED",
  ROTATED_SWAPPED: "ROTATED_SWAPPED",
  MIRRORED_SWAPPED: "MIRRORED_SWAPPED",
  ROTATED_INVERTED: "ROTATED_INVERTED",
  MIRRORED_INVERTED: "MIRRORED_INVERTED",
  MIRRORED_ROTATED: "MIRRORED_ROTATED",
  SWAPPED_INVERTED: "SWAPPED_INVERTED",
  MIRRORED_INVERTED_ROTATED: "MIRRORED_INVERTED_ROTATED",
} as const;

export type LOOPTypeValue = (typeof LOOPType)[keyof typeof LOOPType];

/**
 * Slice sizes for LOOP generation.
 */
export const SliceSize = {
  HALVED: "HALVED",
  QUARTERED: "QUARTERED",
} as const;

export type SliceSizeValue = (typeof SliceSize)[keyof typeof SliceSize];

/**
 * Motion types for props.
 */
export const MotionType = {
  PRO: "pro",
  ANTI: "anti",
  STATIC: "static",
  DASH: "dash",
} as const;

/**
 * Rotation directions.
 */
export const RotationDirection = {
  CW: "cw",
  CCW: "ccw",
  NO_ROT: "no_rot",
} as const;

/**
 * Grid positions (simplified for broadcast).
 */
export const GridPosition = {
  ALPHA1: "alpha1",
  ALPHA2: "alpha2",
  ALPHA3: "alpha3",
  ALPHA4: "alpha4",
  ALPHA5: "alpha5",
  ALPHA6: "alpha6",
  ALPHA7: "alpha7",
  ALPHA8: "alpha8",
  BETA1: "beta1",
  BETA2: "beta2",
  BETA3: "beta3",
  BETA4: "beta4",
  BETA5: "beta5",
  BETA6: "beta6",
  BETA7: "beta7",
  BETA8: "beta8",
  GAMMA1: "gamma1",
  GAMMA2: "gamma2",
  GAMMA3: "gamma3",
  GAMMA4: "gamma4",
  GAMMA5: "gamma5",
  GAMMA6: "gamma6",
  GAMMA7: "gamma7",
  GAMMA8: "gamma8",
} as const;

export type GridPositionValue = (typeof GridPosition)[keyof typeof GridPosition];

/**
 * A single pictograph from the CSV data.
 */
export interface Pictograph {
  letter: string;
  startPosition: string;
  endPosition: string;
  timing: string;
  direction: string;
  blue: {
    motionType: string;
    rotationDirection: string;
    startLocation: string;
    endLocation: string;
  };
  red: {
    motionType: string;
    rotationDirection: string;
    startLocation: string;
    endLocation: string;
  };
}

/**
 * Motion data for a single hand/prop.
 */
export interface MotionData {
  motionType: string;
  rotationDirection: string;
  startLocation: string;
  endLocation: string;
  startOrientation?: string;
  endOrientation?: string;
}

/**
 * A beat in a sequence (simplified for broadcast).
 */
export interface BeatData {
  id: string;
  letter: string;
  startPosition: string;
  endPosition: string;
  timing?: string;
  direction?: string;
  blue: MotionData;
  red: MotionData;
  beatNumber: number;
}

/**
 * A complete sequence for broadcast.
 */
export interface BroadcastSequence {
  id: string;
  word: string;
  beats: BeatData[];
  startPosition: string;
  gridMode: string;
  isCircular: boolean;
  loopType: LOOPTypeValue;
  sliceSize: SliceSizeValue;
  totalBeats: number;
}

/**
 * Current broadcast state stored in Firestore.
 */
export interface BroadcastState {
  currentSequence: BroadcastSequence;
  sequenceNumber: number;
  startedAt: Timestamp;
  endsAt: Timestamp;
  durationMs: number;
  beatsPerMinute: number;
  generatedAt: Timestamp;
}

/**
 * History entry for past broadcasts.
 */
export interface BroadcastHistoryEntry {
  sequence: BroadcastSequence;
  sequenceNumber: number;
  playedAt: Timestamp;
}

/**
 * Extracted pictograph data format.
 */
export interface PictographData {
  extractedAt: string;
  gridModes: {
    diamond: Pictograph[];
    box?: Pictograph[];
  };
}
