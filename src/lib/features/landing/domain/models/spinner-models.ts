/**
 * Spinner Mode Types
 *
 * Defines the two operational modes for the endless spinner:
 * - library: Plays curated sequences from the public library
 * - infinite: Generates novel sequences algorithmically
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

/**
 * The two modes of endless spinner operation.
 */
export type SpinnerMode = "library" | "infinite";

/**
 * Information about a generated sequence in Infinite mode.
 * Includes metadata about when and where in the global count it was created.
 */
export interface GeneratedSequenceInfo {
  /** The generated sequence data */
  sequence: SequenceData;
  /** When this sequence was generated */
  generatedAt: Date;
  /** Position in the global generation count (e.g., 47291st sequence ever) */
  globalIndex: number;
}

/**
 * Global metrics for spinner generation, persisted to Firebase.
 */
export interface SpinnerMetrics {
  /** Total sequences ever generated across all users and sessions */
  totalGenerated: number;
  /** When the last sequence was generated */
  lastGeneratedAt: Date | null;
}
