/**
 * IConnectionManager
 *
 * Service contract for managing user-to-user connection data.
 * Connections are private notes and relationship info about other users.
 *
 * Data stored in: users/{myId}/connections/{theirId}
 */

import type { Timestamp } from "firebase/firestore";

/**
 * Mutual follow relationship data
 */
export interface MutualFollowInfo {
  /** True if both users follow each other */
  isMutual: boolean;
  /** True if I follow them */
  iFollowThem: boolean;
  /** True if they follow me */
  theyFollowMe: boolean;
  /** When mutual follow was established (whichever was later) */
  mutualSince?: Date;
  /** When I followed them */
  iFollowedAt?: Date;
  /** When they followed me */
  theyFollowedAt?: Date;
}

/**
 * Summary of a shared sequence (same canonical signature)
 */
export interface SharedSequenceSummary {
  /** The canonical signature that matches */
  canonicalSignature: string;
  /** My sequence with this signature */
  mySequence: {
    id: string;
    name: string;
    word: string;
    thumbnailUrl?: string;
  };
  /** Their sequence with this signature */
  theirSequence: {
    id: string;
    name: string;
    word: string;
    thumbnailUrl?: string;
  };
}

/**
 * Complete connection info for displaying in profile
 */
export interface ConnectionInfo {
  /** Private notes about this user (only I can see) */
  notes: string;
  /** When I first created notes about this user */
  notesCreatedAt?: Date;
  /** When I last updated notes */
  notesUpdatedAt?: Date;
  /** Mutual follow relationship data */
  mutualFollow: MutualFollowInfo;
  /** Sequences we both have (by canonical signature) */
  sharedSequences: SharedSequenceSummary[];
  /** Total count of shared sequences */
  sharedSequenceCount: number;
}

/**
 * Raw connection document stored in Firestore
 */
export interface ConnectionDocument {
  notes: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface IConnectionManager {
  /**
   * Get full connection info for a user
   * Includes notes, mutual follow status, and shared sequences
   * @param targetUserId - The user I'm viewing
   */
  getConnectionInfo(targetUserId: string): Promise<ConnectionInfo>;

  /**
   * Save private notes about a user
   * @param targetUserId - The user I'm noting
   * @param notes - The note content
   */
  saveNotes(targetUserId: string, notes: string): Promise<void>;

  /**
   * Get only the notes for a user (faster than full connection info)
   * @param targetUserId - The user to get notes for
   */
  getNotes(targetUserId: string): Promise<string>;

  /**
   * Check mutual follow status between current user and target
   * @param targetUserId - The user to check relationship with
   */
  getMutualFollowInfo(targetUserId: string): Promise<MutualFollowInfo>;

  /**
   * Find sequences we both have (matching canonical signatures)
   * @param targetUserId - The user to compare libraries with
   * @param limit - Maximum number of shared sequences to return
   */
  getSharedSequences(
    targetUserId: string,
    limit?: number
  ): Promise<SharedSequenceSummary[]>;
}
