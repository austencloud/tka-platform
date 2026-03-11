/**
 * IContributorLoader
 *
 * Contract for loading contributor records and adding new contributors
 * by linking to existing user accounts in the `users` collection.
 */

import type { Contributor } from "../../domain/models/contributor-models";

export interface IContributorLoader {
  /** Get all curated contributors, ordered by display name. */
  getAll(): Promise<Contributor[]>;

  /** Get a single contributor by their contributor doc ID. */
  getById(id: string): Promise<Contributor | null>;

  /** Batch-fetch contributors by their doc IDs. */
  getByIds(ids: string[]): Promise<Contributor[]>;

  /**
   * Add a contributor by referencing an existing user account.
   * Looks up the user's displayName and avatar from the `users` collection
   * and caches them in the contributor document.
   * @returns The new contributor document ID.
   */
  addByUserId(userId: string): Promise<string>;

  /** Remove a contributor from the curated list. */
  delete(id: string): Promise<void>;
}
