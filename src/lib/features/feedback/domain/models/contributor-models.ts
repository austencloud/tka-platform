/**
 * Contributor Domain Models
 *
 * Type definitions for developer contributors who can be credited
 * on changelog entries.
 */

/**
 * A curated developer contributor who can be credited on changelog entries.
 * Stored in the `contributors` Firestore collection.
 */
export interface Contributor {
  id: string;
  displayName: string;
  avatarUrl: string;
  userId?: string;
}
