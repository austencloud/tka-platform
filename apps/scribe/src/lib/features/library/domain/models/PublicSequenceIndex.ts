/**
 * PublicSequenceIndex - Denormalized document for efficient public browsing
 *
 * This is a subset of LibrarySequence fields optimized for:
 * - Fast queries on the global public sequence feed (Browse)
 * - Reducing document reads when browsing
 * - Supporting search and filtering without reading full sequence data
 *
 * Stored at: publicSequences/{sequenceId}
 *
 * Sync Strategy:
 * - Created when a sequence's visibility is set to "public"
 * - Deleted when visibility changes away from "public"
 * - Updated when relevant sequence fields change
 */

/**
 * PublicSequenceIndex - Denormalized public sequence for Browse
 */
export interface PublicSequenceIndex {
  /** Sequence ID (same as document ID and source sequence ID) */
  readonly id: string;

  /** Reference path to source: users/{ownerId}/sequences/{id} */
  readonly sourceRef: string;

  // ============================================================
  // OWNER INFO (denormalized)
  // ============================================================

  /** Owner user ID */
  readonly ownerId: string;

  /** Owner display name (denormalized from user profile) */
  readonly ownerDisplayName: string;

  /** Owner avatar URL (denormalized from user profile) */
  readonly ownerAvatarUrl?: string;

  // ============================================================
  // SEQUENCE DISPLAY FIELDS
  // ============================================================

  /** Sequence name */
  readonly name: string;

  /** Word/phrase the sequence represents */
  readonly word: string;

  /** Thumbnail URLs (first 1-3 for preview) */
  readonly thumbnails: readonly string[];

  /** Total beat count */
  readonly sequenceLength?: number;

  /** Difficulty level (e.g., "beginner", "intermediate", "advanced") */
  readonly difficultyLevel?: string;

  /** Numeric difficulty level (1-5). Preferred over difficultyLevel string. */
  readonly level?: number;

  /** LOOP type label (e.g., "rotated", "mirrored+swapped", "freeform", null for non-LOOP) */
  readonly loopType?: string | null;

  // ============================================================
  // ENGAGEMENT METRICS
  // ============================================================

  /** Number of times this has been forked */
  readonly forkCount: number;

  /** Number of times this has been viewed */
  readonly viewCount: number;

  /** Number of users who starred/liked this */
  readonly starCount: number;

  // ============================================================
  // CATEGORIZATION
  // ============================================================

  /** Denormalized tag names (not IDs) for filtering */
  readonly tags: readonly string[];

  // ============================================================
  // FORK INFO
  // ============================================================

  /** Whether this is a forked sequence */
  readonly isForked: boolean;

  /** Original creator ID (if forked) */
  readonly originalCreatorId?: string;

  /** Original creator name (if forked) */
  readonly originalCreatorName?: string;

  // ============================================================
  // TIMESTAMPS
  // ============================================================

  /** When published to public feed */
  readonly publishedAt: Date;

  /** When last updated */
  readonly updatedAt: Date;
}

/**
 * Create a public sequence index from a LibrarySequence
 */
export function createPublicSequenceIndex(
  sequence: {
    id: string;
    ownerId: string;
    name: string;
    word: string;
    thumbnails: readonly string[];
    sequenceLength?: number;
    difficultyLevel?: string;
    forkCount: number;
    viewCount: number;
    starCount: number;
    source: string;
    forkAttribution?: {
      originalCreatorId: string;
      originalCreatorName: string;
    };
  },
  owner: {
    displayName: string;
    avatarUrl?: string;
  },
  tagNames: readonly string[]
): PublicSequenceIndex {
  const now = new Date();

  return {
    id: sequence.id,
    sourceRef: `users/${sequence.ownerId}/sequences/${sequence.id}`,
    ownerId: sequence.ownerId,
    ownerDisplayName: owner.displayName,
    ownerAvatarUrl: owner.avatarUrl,
    name: sequence.name,
    word: sequence.word,
    thumbnails: sequence.thumbnails.slice(0, 3),
    sequenceLength: sequence.sequenceLength,
    difficultyLevel: sequence.difficultyLevel,
    forkCount: sequence.forkCount,
    viewCount: sequence.viewCount,
    starCount: sequence.starCount,
    tags: tagNames,
    isForked: sequence.source === "forked",
    originalCreatorId: sequence.forkAttribution?.originalCreatorId,
    originalCreatorName: sequence.forkAttribution?.originalCreatorName,
    publishedAt: now,
    updatedAt: now,
  };
}
