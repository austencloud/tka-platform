/**
 * Manages user account operations (password changes, deletion, cache clearing)
 */
export interface IAccountManager {
  /**
   * Changes the user's password.
   * Re-authenticates with current password, then updates to new password.
   * @param currentPassword - Current password for re-authentication
   * @param newPassword - New password (min 8 characters)
   */
  changePassword(currentPassword: string, newPassword: string): Promise<void>;

  /**
   * Deletes the user's account permanently.
   * Re-authenticates with password, cleans up Firestore user doc, then deletes Firebase auth account.
   * @param currentPassword - Current password for re-authentication
   */
  deleteAccount(currentPassword: string): Promise<void>;

  /**
   * Clears all cached data (IndexedDB, localStorage, cookies) and reloads the page
   */
  clearCache(): Promise<void>;
}
