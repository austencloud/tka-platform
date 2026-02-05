/**
 * LibraryTag - User-defined tag for categorizing sequences
 *
 * Tags provide flexible cross-cutting categorization for sequences,
 * allowing users to filter and organize beyond hierarchical collections.
 *
 * Stored at: users/{userId}/library/tags/{tagId}
 */

/**
 * LibraryTag - A user-defined tag
 */
export interface LibraryTag {
  /** Unique tag ID */
  readonly id: string;

  /** Tag name (user-defined, e.g., "beginner", "fire", "poi") */
  readonly name: string;

  /** Owner user ID */
  readonly ownerId: string;

  /** Tag color (hex color for display) */
  readonly color?: string;

  /** Tag icon (emoji or FontAwesome icon name) */
  readonly icon?: string;

  /** Number of sequences with this tag (denormalized for display) */
  readonly useCount: number;

  /** When created */
  readonly createdAt: Date;
}

/**
 * Options for creating a new tag
 */
export interface CreateTagOptions {
  color?: string;
  icon?: string;
}

/**
 * Create a new tag
 */
export function createTag(
  name: string,
  ownerId: string,
  options: CreateTagOptions = {}
): Omit<LibraryTag, "id"> {
  return {
    name: name.toLowerCase().trim(),
    ownerId,
    color: options.color,
    icon: options.icon,
    useCount: 0,
    createdAt: new Date(),
  };
}

/**
 * Update a tag's use count
 */
export function updateTagUseCount(tag: LibraryTag, delta: number): LibraryTag {
  return {
    ...tag,
    useCount: Math.max(0, tag.useCount + delta),
  };
}

/**
 * Predefined tag colors for quick selection
 */
export const TAG_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#6b7280", // gray
] as const;

/**
 * Default tag suggestions for new users
 */
export const DEFAULT_TAG_SUGGESTIONS = [
  "beginner",
  "intermediate",
  "advanced",
  "teaching",
  "performance",
  "practice",
  "favorite",
  "work-in-progress",
] as const;
