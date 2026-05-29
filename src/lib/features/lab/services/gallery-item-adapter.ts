/**
 * gallery-item-adapter
 *
 * Bridges the TKA GalleryItem model (tagIds field) to the shared
 * MediaItem model (tags field) used by @austencloud/media-tagging-* components.
 */

import type { MediaItem } from "@austencloud/media-tagging-types";
import type { GalleryItem } from "./types";

export function toMediaItem(item: GalleryItem): MediaItem {
  return {
    id: item.id,
    url: item.imageUrl,
    type: "image",
    name: `${item.deviceName} - ${item.routeLabel}`,
    tags: item.tagIds,
    metadata: {
      module: item.module,
      deviceSlug: item.deviceSlug,
      deviceCategory: item.deviceCategory,
      width: item.width,
      height: item.height,
    },
    createdAt: item.capturedAt ?? new Date(),
    updatedAt: item.capturedAt ?? new Date(),
  };
}

export function toMediaItems(items: GalleryItem[]): MediaItem[] {
  return items.map(toMediaItem);
}
