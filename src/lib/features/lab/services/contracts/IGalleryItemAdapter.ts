/**
 * IGalleryItemAdapter
 *
 * Converts TKA GalleryItem (uses tagIds: string[]) to the shared
 * MediaItem type (uses tags: string[]) expected by @austencloud/media-tagging-* components.
 */

import type { MediaItem } from "@austencloud/media-tagging-types";

export interface GalleryItem {
  id: string;
  filename: string;
  routeLabel: string;
  module: string;
  deviceSlug: string;
  deviceCategory: string;
  deviceName: string;
  width: number;
  height: number;
  imageUrl: string;
  tagIds: string[];
  capturedAt: Date | null;
}

export interface IGalleryItemAdapter {
  /** Convert a single GalleryItem to a shared MediaItem */
  toMediaItem(item: GalleryItem): MediaItem;

  /** Convert an array of GalleryItems to shared MediaItems */
  toMediaItems(items: GalleryItem[]): MediaItem[];
}
