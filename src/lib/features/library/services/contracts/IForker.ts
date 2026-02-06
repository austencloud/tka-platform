/**
 * IForkService - Forking Sequences from Other Users
 *
 * Service for creating personal copies of sequences with attribution.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { LibrarySequence } from "../../domain/models/LibrarySequence";

/**
 * Result of a fork operation
 */
export interface ForkResult {
  /** Whether the fork succeeded */
  success: boolean;
  /** The forked sequence (if successful) */
  forkedSequence?: LibrarySequence;
  /** Error message (if failed) */
  error?: string;
  /** Error code for programmatic handling */
  errorCode?:
    | "ALREADY_FORKED"
    | "NOT_FOUND"
    | "PERMISSION_DENIED"
    | "QUOTA_EXCEEDED";
}

/**
 * IForkService - Fork operations
 */
export interface IForkService {
  /**
   * Fork a sequence into the current user's library
   * Creates a copy with attribution to the original creator
   * @param sourceSequence The sequence to fork
   * @param sourceUserId The owner of the source sequence
   * @returns Fork result with the new sequence or error
   */
  forkSequence(
    sourceSequence: SequenceData,
    sourceUserId: string
  ): Promise<ForkResult>;

  /**
   * Fork from browse/public feed
   * Handles lookup of the source sequence and user
   * @param publicSequenceId The public sequence ID
   * @returns Fork result
   */
  forkFromPublic(publicSequenceId: string): Promise<ForkResult>;

  /**
   * Check if a sequence can be forked by the current user
   * Returns false if: private, already forked, own sequence
   * @param sequenceId The sequence ID to check
   * @param ownerId The owner of the sequence
   * @returns Whether the sequence can be forked
   */
  canFork(sequenceId: string, ownerId: string): Promise<boolean>;

  /**
   * Check if current user has already forked a specific sequence
   * @param originalSequenceId The original sequence ID
   * @returns Whether the sequence was already forked
   */
  hasForked(originalSequenceId: string): Promise<boolean>;

  /**
   * Get fork count for a sequence
   * (how many times others have forked it)
   * @param sequenceId The sequence ID
   * @returns Number of forks
   */
  getForkCount(sequenceId: string): Promise<number>;

  /**
   * Get all forks of a sequence (for original author)
   * Only works for sequences owned by current user
   * @param sequenceId The original sequence ID
   * @returns Array of forked sequences
   */
  getForksOfSequence(sequenceId: string): Promise<LibrarySequence[]>;

  /**
   * Get the original sequence for a fork
   * Returns null if original was deleted
   * @param forkId The forked sequence ID
   * @returns Original sequence or null
   */
  getOriginalSequence(forkId: string): Promise<LibrarySequence | null>;

  /**
   * Get all sequences the current user has forked
   * @returns Array of forked sequences
   */
  getMyForks(): Promise<LibrarySequence[]>;
}
