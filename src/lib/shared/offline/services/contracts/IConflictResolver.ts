/**
 * IConflictResolver - Interface for detecting and resolving
 * version conflicts when the same sequence is edited on multiple devices.
 */

import type { LibrarySequence } from "$lib/features/library/domain/models/LibrarySequence";

/**
 * Represents a detected version conflict between local and server state
 */
export interface VersionConflict {
  /** The sequence ID with conflicting versions */
  readonly sequenceId: string;
  /** The local version of the sequence (user's pending changes) */
  readonly localVersion: LibrarySequence;
  /** The server version of the sequence (from another device) */
  readonly serverVersion: LibrarySequence;
}

/**
 * User's choice for resolving a conflict
 */
export type ConflictResolution = "keep-local" | "use-server";

/**
 * Callback invoked when a conflict is detected and needs user input
 */
export type ConflictPromptCallback = (
  conflict: VersionConflict
) => Promise<ConflictResolution>;

export interface IConflictResolver {
  /**
   * Record that we just wrote a local version of a sequence.
   * Called by the repository after a non-blocking write.
   */
  trackLocalWrite(sequenceId: string, version: number): void;

  /**
   * Clear local write tracking for a sequence.
   * Called when the server confirms our write.
   */
  confirmServerSync(sequenceId: string): void;

  /**
   * Check if an incoming server snapshot conflicts with local state.
   * Returns the conflict if detected, null otherwise.
   */
  detectConflict(
    localSequence: LibrarySequence,
    serverSequence: LibrarySequence
  ): VersionConflict | null;

  /**
   * Register a callback to prompt the user when conflicts occur.
   */
  onConflict(callback: ConflictPromptCallback): void;

  /**
   * Resolve a detected conflict by applying the user's choice.
   */
  resolveConflict(
    conflict: VersionConflict,
    resolution: ConflictResolution
  ): Promise<void>;

  /**
   * Prompt the user to resolve a conflict.
   * Returns the resolution, or defaults to "use-server" if no prompt is registered.
   */
  promptForResolution(conflict: VersionConflict): Promise<ConflictResolution>;
}
