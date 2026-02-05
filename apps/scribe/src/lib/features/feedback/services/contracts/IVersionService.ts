/**
 * IVersionService
 *
 * Contract for app version tracking and release management.
 */

import type {
  AppVersion,
  VersionFeedbackItem,
  ChangelogEntry,
} from "../../domain/models/version-models";

export interface IVersionService {
  /**
   * Get all app versions (newest first)
   */
  getVersions(): Promise<AppVersion[]>;

  /**
   * Get feedback items resolved in a specific version
   */
  getVersionFeedback(version: string): Promise<VersionFeedbackItem[]>;

  /**
   * Get the latest version number
   */
  getLatestVersion(): Promise<string | null>;

  /**
   * Prepare a new release:
   * - Tags all completed feedback with the new version and archives them
   * - Creates a version record with summary and changelog entries
   */
  prepareRelease(
    version: string,
    changelogEntries?: ChangelogEntry[]
  ): Promise<void>;

  /**
   * Update release notes for an existing version
   */
  updateReleaseNotes(version: string, releaseNotes: string): Promise<void>;

  /**
   * Update changelog entries for an existing version
   */
  updateChangelogEntries(
    version: string,
    changelogEntries: ChangelogEntry[]
  ): Promise<void>;

  /**
   * Update a single changelog entry within a version
   */
  updateChangelogEntry(
    version: string,
    index: number,
    updatedEntry: ChangelogEntry
  ): Promise<void>;

  /**
   * Add a new changelog entry to a version
   */
  addChangelogEntry(version: string, entry: ChangelogEntry): Promise<void>;

  /**
   * Delete a changelog entry from a version
   */
  deleteChangelogEntry(version: string, index: number): Promise<void>;

  /**
   * Get count of completed feedback ready for release
   */
  getCompletedCount(): Promise<number>;

  /**
   * Get completed feedback items (for changelog generation)
   */
  getCompletedFeedback(): Promise<VersionFeedbackItem[]>;

  /**
   * Tag existing archived feedback as pre-release (0.0.0)
   * Used for initial migration
   */
  tagExistingAsPreRelease(): Promise<number>;

  // Legacy alias - deprecated, use getCompletedCount
  getUnversionedArchivedCount(): Promise<number>;
}
