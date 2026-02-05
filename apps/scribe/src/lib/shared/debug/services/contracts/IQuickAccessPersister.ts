/**
 * IQuickAccessPersister - Manages quick access user shortcuts for admin toolbar
 *
 * Persists and retrieves the list of users that admins have bookmarked
 * for quick preview access.
 */

export interface QuickAccessUser {
  uid: string;
  displayName: string;
  username?: string;
  photoURL?: string;
}

export interface IQuickAccessPersister {
  /**
   * Load all quick access users from storage
   */
  load(): QuickAccessUser[];

  /**
   * Save the complete list of quick access users
   */
  save(users: QuickAccessUser[]): void;

  /**
   * Add a user to quick access
   * Returns the updated list
   */
  add(user: QuickAccessUser): QuickAccessUser[];

  /**
   * Remove a user from quick access by UID
   * Returns the updated list
   */
  remove(uid: string): QuickAccessUser[];

  /**
   * Check if a user is in quick access
   */
  has(uid: string): boolean;
}
