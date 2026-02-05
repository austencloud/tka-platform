/**
 * LibraryCollection - Named folder for organizing sequences
 *
 * Collections allow users to organize their library sequences into
 * named groups (e.g., "Teaching Material", "Poi Combos", "Favorites").
 *
 * System collections (like Favorites) are auto-created and cannot be deleted.
 *
 * Stored at: users/{userId}/library/collections/{collectionId}
 */

/**
 * System collection types - auto-created, cannot be deleted
 */
export type SystemCollectionType = "favorites";

/**
 * Well-known system collection IDs
 * Using deterministic IDs so we can reference them without querying
 */
export const SYSTEM_COLLECTION_IDS = {
  favorites: "system_favorites",
} as const;

/**
 * System collection configurations
 */
export const SYSTEM_COLLECTION_CONFIG: Record<
  SystemCollectionType,
  {
    name: string;
    icon: string;
    color: string;
    description: string;
    sortOrder: number;
  }
> = {
  favorites: {
    name: "Favorites",
    icon: "fa-heart",
    color: "#ef4444",
    description: "Your favorited sequences",
    sortOrder: -1000, // Always first
  },
};

/**
 * LibraryCollection - A named collection of sequences
 */
export interface LibraryCollection {
  /** Unique collection ID */
  readonly id: string;

  /** Collection name (user-defined, or system-defined for system collections) */
  readonly name: string;

  /** Optional description */
  readonly description?: string;

  /** Owner user ID */
  readonly ownerId: string;

  /** Sequence IDs in this collection (references, not embedded) */
  readonly sequenceIds: readonly string[];

  /** Sequence count (denormalized for display without loading sequences) */
  readonly sequenceCount: number;

  /** Cover image URL (first sequence thumbnail or custom upload) */
  readonly coverImageUrl?: string;

  /** Collection color theme (hex color) */
  readonly color?: string;

  /** Collection icon (emoji or FontAwesome icon name) */
  readonly icon?: string;

  /** Whether this collection is visible to others */
  readonly isPublic: boolean;

  /** Sort order within user's collections list */
  readonly sortOrder: number;

  /**
   * System collection type - if set, this is a system-managed collection
   * System collections cannot be deleted or renamed
   */
  readonly systemType?: SystemCollectionType;

  /** When created */
  readonly createdAt: Date;

  /** When last modified */
  readonly updatedAt: Date;
}

/**
 * Check if a collection is a system collection
 */
export function isSystemCollection(collection: LibraryCollection): boolean {
  return collection.systemType !== undefined;
}

/**
 * Check if a collection is the favorites collection
 */
export function isFavoritesCollection(collection: LibraryCollection): boolean {
  return collection.systemType === "favorites";
}

/**
 * Options for creating a new collection
 */
export interface CreateCollectionOptions {
  description?: string;
  coverImageUrl?: string;
  color?: string;
  icon?: string;
  isPublic?: boolean;
  sortOrder?: number;
}

/**
 * Create a new collection
 */
export function createCollection(
  name: string,
  ownerId: string,
  options: CreateCollectionOptions = {}
): Omit<LibraryCollection, "id"> {
  const now = new Date();

  return {
    name,
    ownerId,
    description: options.description,
    sequenceIds: [],
    sequenceCount: 0,
    coverImageUrl: options.coverImageUrl,
    color: options.color,
    icon: options.icon ?? "fa-folder",
    isPublic: options.isPublic ?? false,
    sortOrder: options.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Update a collection immutably
 */
export function updateCollection(
  collection: LibraryCollection,
  updates: Partial<LibraryCollection>
): LibraryCollection {
  return {
    ...collection,
    ...updates,
    updatedAt: new Date(),
  };
}

/**
 * Add a sequence to a collection
 */
export function addSequenceToCollection(
  collection: LibraryCollection,
  sequenceId: string
): LibraryCollection {
  if (collection.sequenceIds.includes(sequenceId)) {
    return collection; // Already in collection
  }

  return updateCollection(collection, {
    sequenceIds: [...collection.sequenceIds, sequenceId],
    sequenceCount: collection.sequenceCount + 1,
  });
}

/**
 * Remove a sequence from a collection
 */
export function removeSequenceFromCollection(
  collection: LibraryCollection,
  sequenceId: string
): LibraryCollection {
  if (!collection.sequenceIds.includes(sequenceId)) {
    return collection; // Not in collection
  }

  return updateCollection(collection, {
    sequenceIds: collection.sequenceIds.filter((id) => id !== sequenceId),
    sequenceCount: Math.max(0, collection.sequenceCount - 1),
  });
}

/**
 * Create a system collection (e.g., Favorites)
 * Uses deterministic ID and pre-configured settings
 */
export function createSystemCollection(
  type: SystemCollectionType,
  ownerId: string
): LibraryCollection {
  const config = SYSTEM_COLLECTION_CONFIG[type];
  const now = new Date();

  return {
    id: SYSTEM_COLLECTION_IDS[type],
    name: config.name,
    description: config.description,
    ownerId,
    sequenceIds: [],
    sequenceCount: 0,
    icon: config.icon,
    color: config.color,
    isPublic: false, // System collections default to private
    sortOrder: config.sortOrder,
    systemType: type,
    createdAt: now,
    updatedAt: now,
  };
}
