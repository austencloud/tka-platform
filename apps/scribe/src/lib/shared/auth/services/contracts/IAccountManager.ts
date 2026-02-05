/**
 * Manages user account operations (password changes, deletion, cache clearing)
 */
export interface IAccountManager {
  /**
   * Changes the user's password
   * @param currentPassword - Current password (for re-authentication)
   * @param newPassword - New password (min 8 characters)
   * @throws Error if password validation fails or update fails
   */
  changePassword(currentPassword: string, newPassword: string): Promise<void>;

  /**
   * Deletes the user's account permanently
   * @throws Error if deletion fails
   */
  deleteAccount(): Promise<void>;

  /**
   * Clears all cached data (IndexedDB, localStorage, cookies) and reloads the page
   * @throws Error if cache clearing fails
   */
  clearCache(): Promise<void>;
}
