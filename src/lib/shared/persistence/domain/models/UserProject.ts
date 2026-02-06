/**
 * User Project Model
 *
 * Represents a collection of sequences organized by the user.
 * Projects allow users to group related sequences together.
 */

/**
 * User projects - collections of sequences
 *
 * Projects are user-created collections that can contain multiple sequences.
 * They can be private or public, tagged for organization, and shared with others.
 */
export interface UserProject {
  /**
   * Auto-increment primary key
   */
  id?: number;

  /**
   * Project name (required)
   */
  name: string;

  /**
   * Optional project description
   */
  description?: string;

  /**
   * Array of sequence IDs included in this project
   * References sequences in the sequences table
   */
  sequenceIds: string[];

  /**
   * User identifier for future multi-user support
   * Optional - defaults to single user for now
   */
  userId?: string;

  /**
   * When this project was created
   */
  createdAt: Date;

  /**
   * When this project was last modified
   */
  lastModified: Date;

  /**
   * Whether this project is visible to other users
   */
  isPublic: boolean;

  /**
   * Tags for organizing and searching projects
   */
  tags: string[];

  /**
   * Data structure version for handling migrations
   */
  version?: number;
}

/**
 * Type guard to check if an object is UserProject
 */
export function isUserProject(obj: unknown): obj is UserProject {
  if (!obj || typeof obj !== "object") return false;

  const project = obj as Record<string, unknown>;

  return (
    typeof project["name"] === "string" &&
    Array.isArray(project["sequenceIds"]) &&
    project["createdAt"] instanceof Date &&
    project["lastModified"] instanceof Date &&
    typeof project["isPublic"] === "boolean" &&
    Array.isArray(project["tags"])
  );
}

/**
 * Create a new UserProject instance with defaults
 */
export function createUserProject(
  name: string,
  options: {
    description?: string;
    sequenceIds?: string[];
    userId?: string;
    isPublic?: boolean;
    tags?: string[];
    version?: number;
  } = {}
): Omit<UserProject, "id"> {
  const now = new Date();

  return {
    name,
    ...(options.description !== undefined && {
      description: options.description,
    }),
    sequenceIds: options.sequenceIds ?? [],
    ...(options.userId !== undefined && { userId: options.userId }),
    createdAt: now,
    lastModified: now,
    isPublic: options.isPublic ?? false,
    tags: options.tags ?? [],
    ...(options.version !== undefined && { version: options.version }),
  };
}
