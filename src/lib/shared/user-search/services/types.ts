

/**
 * IUserSearcher - Interface for searching users
 *
 * Lightweight user search for autocomplete and selection.
 * Returns minimal user data (uid, displayName, email, photoURL) for efficiency.
 */

export interface UserSearchResult {
  uid: string;
  displayName: string;
  username?: string;
  photoURL?: string;
}

export interface UserSearchOptions {
  /** User IDs to exclude from results */
  excludeUserIds?: string[];
  /** Maximum results to return (default: 10) */
  limit?: number;
}
