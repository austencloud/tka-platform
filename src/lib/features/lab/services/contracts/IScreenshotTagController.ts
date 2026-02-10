/**
 * IScreenshotTagController
 *
 * Manages screenshot tagging via the shared @austencloud/media-tagging-* packages.
 * Provides tag CRUD, screenshot tag assignment, and tag filtering for the gallery.
 */

import type { MediaTag, TagColor } from "@austencloud/media-tagging-types";

export interface IScreenshotTagController {
  /** Load all tags for the current user */
  loadTags(): Promise<MediaTag[]>;

  /** Subscribe to real-time tag updates. Returns unsubscribe function. */
  subscribeTags(callback: (tags: MediaTag[]) => void): () => void;

  /** Create a new tag */
  createTag(name: string, color: TagColor, category: string): Promise<void>;

  /** Delete a tag and remove it from all screenshots */
  deleteTag(tagId: string): Promise<void>;

  /** Add a tag to one or more screenshots */
  addTagToScreenshots(tagId: string, screenshotIds: string[]): Promise<void>;

  /** Remove a tag from one or more screenshots */
  removeTagFromScreenshots(
    tagId: string,
    screenshotIds: string[]
  ): Promise<void>;

  /** Toggle a tag on a screenshot (add if missing, remove if present) */
  toggleTagOnScreenshot(tagId: string, screenshotId: string): Promise<void>;
}
