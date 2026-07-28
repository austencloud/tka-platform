/**
 * Type interfaces for sequence chaining dependencies.
 *
 * Defines the structural contracts that SequenceChainingOrchestrator
 * needs from landing-feature services, avoiding shared/ → features/ imports.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { EndState } from "$lib/shared/landing/domain/types";
import type {
  BroadcastSequence,
  BroadcastStateClient,
} from "$lib/shared/landing/domain/broadcast-models";

export type SourceMode = "pick" | "library" | "infinite" | "live";

export interface IBroadcastProvider {
  subscribeToBroadcast(
    callback: (state: BroadcastStateClient | null) => void
  ): () => void;
  calculateServerTimeOffset(): Promise<number>;
  getCurrentStepPosition(
    startedAtMs: number,
    durationMs: number,
    totalSteps: number,
    beatsPerMinute: number
  ): number;
}

export type BroadcastSequenceConverter = (
  sequence: BroadcastSequence
) => SequenceData;

export interface PlaybackHistoryEntry {
  sequence: SequenceData;
  timestamp: number;
  sourceMode: SourceMode;
  word?: string;
}

/**
 * A fully loaded sequence that can replace the current one at its natural
 * playback boundary. The provider keeps ownership until the animation engine
 * accepts the sequence; `accept` then commits the matching host state in the
 * same frame.
 */
export interface PreparedSequenceHandoff {
  sequence: SequenceData;
  accept: () => void;
}

export type SequenceBoundaryProvider = () => PreparedSequenceHandoff | null;

/**
 * Minimal result shape returned by the infinite generator.
 * The full GeneratedSequenceInfo lives in features/landing.
 */
export interface GeneratedSequenceResult {
  sequence: SequenceData;
}

/**
 * Interface for an infinite sequence generator as consumed by the chaining orchestrator.
 */
export interface IInfiniteSequenceGenerator {
  generateInitial(): Promise<GeneratedSequenceResult | null>;
  generateFromEndState(
    endState: EndState
  ): Promise<GeneratedSequenceResult | null>;
  getSessionCount(): number;
}

/**
 * Interface for an endless spinner orchestrator as consumed by the chaining orchestrator.
 */
export interface IEndlessSpinnerOrchestrator {
  initialize(): Promise<void>;
  getInitialSequence(): Promise<SequenceData | null>;
  getNextSequence(endState: EndState): Promise<SequenceData | null>;
}
