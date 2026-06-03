/**
 * Duet Sequence Domain Model
 *
 * Defines a pairing of two sequences for coordinated dual-avatar performance.
 * Does NOT modify SequenceData - references existing library sequences by ID.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

/**
 * Avatar positioning hint for duet performance
 */
export type DuetPositioning = "side-by-side" | "face-to-face" | "custom";

/**
 * Duet sequence definition - pairs two sequences for dual-avatar playback
 */
export interface DuetSequence {
  /** Unique identifier */
  id: string;

  /** Display name for the duet */
  name: string;

  /** Optional description */
  description?: string;

  /** Reference to avatar 1's sequence (by ID) */
  avatar1SequenceId: string;

  /** Reference to avatar 2's sequence (by ID) */
  avatar2SequenceId: string;

  /**
   * Beat offset applied to avatar 2.
   * Positive = avatar 2 starts later, negative = avatar 2 starts earlier.
   * In steps (e.g., 1 = one beat behind, -0.5 = half beat ahead)
   */
  stepOffset: number;

  /** Positioning hint for avatar placement */
  positioning: DuetPositioning;

  /** Creation timestamp */
  createdAt: Date;

  /** Creator user ID (optional) */
  createdBy?: string;

  /** Tags for organization */
  tags?: string[];
}

/**
 * Duet sequence with resolved sequence data
 * Used when loading a duet for playback
 */
export interface DuetSequenceWithData extends DuetSequence {
  /** Resolved sequence data for avatar 1 */
  avatar1Sequence: SequenceData;

  /** Resolved sequence data for avatar 2 */
  avatar2Sequence: SequenceData;
}

/**
 * Input for creating a new duet
 */
export interface CreateDuetInput {
  name: string;
  description?: string;
  avatar1SequenceId: string;
  avatar2SequenceId: string;
  stepOffset?: number;
  positioning?: DuetPositioning;
  tags?: string[];
}

/**
 * Create a new DuetSequence from input
 */
export function createDuetSequence(input: CreateDuetInput): DuetSequence {
  return {
    id: crypto.randomUUID(),
    name: input.name,
    description: input.description,
    avatar1SequenceId: input.avatar1SequenceId,
    avatar2SequenceId: input.avatar2SequenceId,
    stepOffset: input.stepOffset ?? 0,
    positioning: input.positioning ?? "side-by-side",
    createdAt: new Date(),
    tags: input.tags,
  };
}
