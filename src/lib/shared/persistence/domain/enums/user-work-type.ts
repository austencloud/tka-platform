/**
 * User Work Type Enumeration
 *
 * Defines the different types of user work data that can be stored
 * in the persistence layer. This provides type safety and prevents
 * typos in string literals.
 */

export enum UserWorkType {
  /**
   * Draft sequences being built by the user
   */
  SEQUENCE_DRAFT = "sequence-draft",

  /**
   * Active tab state for persistence across sessions
   */
  TAB_STATE = "tab-state",

  /**
   * User preferences and settings
   */
  USER_PREFERENCES = "user-preferences",

  /**
   * Browse view state (filters, sorts, scroll position)
   */
  BROWSE_STATE = "Browse-state",
}

/**
 * Type guard to check if a string is a valid UserWorkType
 */
export function isValidUserWorkType(value: string): value is UserWorkType {
  return Object.values(UserWorkType).includes(value as UserWorkType);
}

/**
 * Get all available user work types
 */
export function getAllUserWorkTypes(): UserWorkType[] {
  return Object.values(UserWorkType);
}
