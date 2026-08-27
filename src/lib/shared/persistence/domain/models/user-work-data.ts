/**
 * User Work Data Model
 *
 * Represents user's work-in-progress data including partially built sequences,
 * tab states, preferences, and other temporary user data.
 */

import type { UserWorkType } from "../enums/user-work-type";

/**
 * User's work-in-progress data
 *
 * This stores things like partially built sequences, tab states, user preferences,
 * Browse states, and other user-specific data that needs to persist across sessions.
 */
export interface UserWorkData {
  /**
   * Auto-increment primary key
   */
  id?: number;

  /**
   * Type of user work data
   */
  type: UserWorkType;

  /**
   * Which tab this belongs to (build, browse, learn, etc.)
   * Optional - some data may be global
   */
  tabId?: string;

  /**
   * User identifier for future multi-user support
   * Optional - defaults to single user for now
   */
  userId?: string;

  /**
   * The actual state data (flexible structure)
   * Can contain any JSON-serializable data
   */
  data: unknown;

  /**
   * When this data was last modified
   * Automatically updated by database hooks
   */
  lastModified: Date;

  /**
   * Data structure version for handling migrations
   * Allows us to evolve the data format over time
   */
  version: number;
}

/**
 * Type guard to check if an object is UserWorkData
 */
export function isUserWorkData(obj: unknown): obj is UserWorkData {
  if (!obj || typeof obj !== "object") return false;

  const data = obj as Record<string, unknown>;

  return (
    typeof data["type"] === "string" &&
    data["data"] !== undefined &&
    data["lastModified"] instanceof Date &&
    typeof data["version"] === "number"
  );
}

export function createUserWorkData(
  type: UserWorkType,
  data: unknown,
  options: {
    tabId?: string;
    userId?: string;
    version?: number;
  } = {}
): Omit<UserWorkData, "id"> {
  return {
    type,
    data,
    ...(options.tabId !== undefined && { tabId: options.tabId }),
    ...(options.userId !== undefined && { userId: options.userId }),
    version: options.version ?? 1,
    lastModified: new Date(),
  };
}
