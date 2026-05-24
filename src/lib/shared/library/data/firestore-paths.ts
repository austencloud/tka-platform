/**
 * Firestore Collection Paths for Library Module
 *
 * Centralized path definitions for all Library-related Firestore collections.
 * Following the pattern from gamification module.
 */

// ============================================================================
// USER LIBRARY PATHS
// ============================================================================
// Firestore paths must have odd segments for collections, even for documents.
// Structure: users/{userId}/sequences (3 segments = collection)

/**
 * Path to a user's sequences collection
 * @example "users/abc123/sequences"
 */
export function getUserSequencesPath(userId: string): string {
  return `users/${userId}/sequences`;
}

/**
 * Path to a specific sequence in a user's library
 * @example "users/abc123/sequences/seq456"
 */
export function getUserSequencePath(
  userId: string,
  sequenceId: string
): string {
  return `users/${userId}/sequences/${sequenceId}`;
}

/**
 * Path to a user's collections (folders)
 * @example "users/abc123/collections"
 */
export function getUserCollectionsPath(userId: string): string {
  return `users/${userId}/collections`;
}

/**
 * Path to a specific collection
 * @example "users/abc123/collections/col789"
 */
export function getUserCollectionPath(
  userId: string,
  collectionId: string
): string {
  return `users/${userId}/collections/${collectionId}`;
}

/**
 * Path to a user's acts (playlists)
 * @example "users/abc123/acts"
 */
export function getUserActsPath(userId: string): string {
  return `users/${userId}/acts`;
}

/**
 * Path to a specific act
 * @example "users/abc123/acts/act012"
 */
export function getUserActPath(userId: string, actId: string): string {
  return `users/${userId}/acts/${actId}`;
}

/**
 * Path to a user's tags
 * @example "users/abc123/tags"
 */
export function getUserTagsPath(userId: string): string {
  return `users/${userId}/tags`;
}

/**
 * Path to a specific tag
 * @example "users/abc123/tags/tag345"
 */
export function getUserTagPath(userId: string, tagId: string): string {
  return `users/${userId}/tags/${tagId}`;
}

// ============================================================================
// GLOBAL PATHS (Public sequences)
// ============================================================================

/**
 * Path to the public sequences collection (denormalized for Browse)
 * @example "publicSequences"
 */
export function getPublicSequencesPath(): string {
  return "publicSequences";
}

/**
 * Path to a specific public sequence
 * @example "publicSequences/seq456"
 */
export function getPublicSequencePath(sequenceId: string): string {
  return `publicSequences/${sequenceId}`;
}

// ============================================================================
// METADATA PATHS (Immutable fork lineage)
// ============================================================================

/**
 * Path to sequence metadata collection (immutable fork chain)
 * @example "sequenceMetadata"
 */
export function getSequenceMetadataCollectionPath(): string {
  return "sequenceMetadata";
}

/**
 * Path to a specific sequence's metadata
 * @example "sequenceMetadata/seq456"
 */
export function getSequenceMetadataPath(sequenceId: string): string {
  return `sequenceMetadata/${sequenceId}`;
}

// ============================================================================
// SYSTEM DECK PATHS
// ============================================================================

/**
 * Path to the system decks collection
 * @example "decks"
 */
export function getSystemDecksPath(): string {
  return "decks";
}

/**
 * Path to a specific system deck
 * @example "decks/l1-quartered-loop"
 */
export function getSystemDeckPath(deckId: string): string {
  return `decks/${deckId}`;
}

/**
 * Path to sequences within a system deck
 * @example "decks/l1-quartered-loop/sequences"
 */
export function getSystemDeckSequencesPath(deckId: string): string {
  return `decks/${deckId}/sequences`;
}

/**
 * Path to a specific sequence within a system deck
 * @example "decks/l1-quartered-loop/sequences/alpha1-AB"
 */
export function getSystemDeckSequencePath(
  deckId: string,
  sequenceId: string
): string {
  return `decks/${deckId}/sequences/${sequenceId}`;
}

// ============================================================================
// DECK RELEASE PATHS
// ============================================================================

export function getDeckReleasesPath(): string {
  return "deckReleases";
}

export function getDeckReleaseCounterPath(): string {
  return "deckReleases/counter";
}

export function getDeckReleaseManifestsPath(): string {
  return "deckReleases/counter/manifests";
}

export function getDeckReleaseManifestPath(deckNumber: number): string {
  return `deckReleases/counter/manifests/${String(deckNumber).padStart(3, "0")}`;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Firestore collection names used by the Library module
 */
export const LIBRARY_COLLECTIONS = {
  /** User's library sequences */
  SEQUENCES: "sequences",
  /** User's collections (folders) */
  COLLECTIONS: "collections",
  /** User's acts (playlists) */
  ACTS: "acts",
  /** User's custom tags */
  TAGS: "tags",
  /** Global public sequences index */
  PUBLIC_SEQUENCES: "publicSequences",
  /** Global sequence metadata (fork lineage) */
  SEQUENCE_METADATA: "sequenceMetadata",
} as const;

/**
 * Maximum limits for library operations
 */
export const LIBRARY_LIMITS = {
  /** Max sequences per user */
  MAX_SEQUENCES_PER_USER: 1000,
  /** Max collections per user */
  MAX_COLLECTIONS_PER_USER: 100,
  /** Max acts per user */
  MAX_ACTS_PER_USER: 50,
  /** Max tags per user */
  MAX_TAGS_PER_USER: 100,
  /** Max sequences per collection */
  MAX_SEQUENCES_PER_COLLECTION: 500,
  /** Max sequences per act */
  MAX_SEQUENCES_PER_ACT: 100,
  /** Max tags per sequence */
  MAX_TAGS_PER_SEQUENCE: 20,
  /** Default query limit */
  DEFAULT_QUERY_LIMIT: 50,
} as const;
