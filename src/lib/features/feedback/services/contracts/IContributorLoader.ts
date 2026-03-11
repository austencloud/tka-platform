/**
 * IContributorLoader
 *
 * Contract for loading and managing contributor records from Firestore.
 */

import type { Contributor } from "../../domain/models/contributor-models";

export interface IContributorLoader {
  getAll(): Promise<Contributor[]>;
  getById(id: string): Promise<Contributor | null>;
  getByIds(ids: string[]): Promise<Contributor[]>;
  add(contributor: Omit<Contributor, "id">): Promise<string>;
  update(id: string, data: Partial<Omit<Contributor, "id">>): Promise<void>;
  delete(id: string): Promise<void>;
}
