/**
 * Contributor Domain Models
 *
 * A contributor is a registered user account credited on changelog entries.
 * The `contributors` Firestore collection stores lightweight references
 * to user documents in the `users` collection.
 */

/**
 * A curated developer contributor linked to a user account.
 * Stored in the `contributors` Firestore collection.
 *
 * `displayName` and `avatarUrl` are cached from the user's profile
 * at the time of creation for fast display without extra lookups.
 */
export interface Contributor {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl: string;
}
