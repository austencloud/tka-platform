/**
 * IScreenshotLoader
 *
 * Loads screenshot metadata from Firestore.
 * Replaces the manifest.json fetching approach.
 */

import type { ScreenshotMetadata } from "./IScreenshotUploader";

export interface IScreenshotLoader {
  /** Load all screenshots ordered by capturedAt desc */
  loadAll(): Promise<ScreenshotMetadata[]>;

  /** Subscribe to real-time screenshot updates */
  subscribeToScreenshots(
    callback: (screenshots: ScreenshotMetadata[]) => void
  ): () => void;

  /** Load screenshots for a specific module */
  loadByModule(module: string): Promise<ScreenshotMetadata[]>;

  /** Load screenshots matching any of the given tag IDs */
  loadByTags(tagIds: string[]): Promise<ScreenshotMetadata[]>;

  /** Delete a screenshot (Storage + Firestore) */
  deleteScreenshot(id: string): Promise<void>;
}
