/**
 * Broadcast Models
 *
 * Types for the live broadcast system that synchronizes all viewers
 * to the same sequence at the same time.
 */

import type { Timestamp } from "firebase/firestore";
import type { LOOPType, Period } from "$lib/features/create/generate/circular/domain/models/circular-models";

/**
 * A beat in a broadcast sequence.
 */
export interface BroadcastStepData {
  id: string;
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
    startOrientation?: string;
    endOrientation?: string;
  };
  red: {
    motionType: string;
    rotationDirection: string;
    startLocation: string;
    endLocation: string;
    startOrientation?: string;
    endOrientation?: string;
  };
  stepNumber?: number;
}

/**
 * A complete sequence in the broadcast.
 */
export interface BroadcastSequence {
  id: string;
  word: string;
  steps: BroadcastStepData[];
  startPosition: string;
  gridMode: string;
  isCircular: boolean;
  loopType: LOOPType;
  period: Period;
  totalSteps: number;
}

/**
 * Current broadcast state from Firestore.
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
 * Broadcast state with converted timestamps for easier use.
 */
export interface BroadcastStateClient {
  currentSequence: BroadcastSequence;
  sequenceNumber: number;
  startedAtMs: number;
  endsAtMs: number;
  durationMs: number;
  beatsPerMinute: number;
  generatedAtMs: number;
}

/**
 * History entry for past broadcasts.
 */
export interface BroadcastHistoryEntry {
  sequence: BroadcastSequence;
  sequenceNumber: number;
  playedAtMs: number;
}

/**
 * Server time response from Cloud Function.
 */
export interface ServerTimeResponse {
  serverTime: number;
  timestamp: number;
}
