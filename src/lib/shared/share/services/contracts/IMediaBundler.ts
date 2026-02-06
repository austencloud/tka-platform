/**
 * Media Bundler Service Contract
 *
 * Service for bundling sequence media (image + GIF + video) into Instagram carousel items.
 */

import type { SequenceData } from "../../../foundation/domain/models/SequenceData";
import type { InstagramMediaItem } from "../../domain/models/InstagramMedia";
import type { ShareOptions } from "../../domain/models/ShareOptions";

export interface IMediaBundler {
  /**
   * Bundle sequence into Instagram media items
   * Creates static image and animated GIF from sequence
   *
   * @param sequence - Sequence data to convert
   * @param options - Share options (background, layout, etc.)
   * @returns Array of media items (image + GIF)
   */
  bundleSequenceMedia(
    sequence: SequenceData,
    options: ShareOptions
  ): Promise<InstagramMediaItem[]>;

  /**
   * Create media item from user-selected video file
   *
   * @param videoFile - Video file from user's device
   * @param order - Order in carousel (typically 0 for first item)
   * @returns Media item for the video
   */
  createVideoMediaItem(
    videoFile: File,
    order: number
  ): Promise<InstagramMediaItem>;

  /**
   * Create complete carousel media bundle
   * Combines user video + sequence image + sequence GIF
   *
   * @param sequence - Sequence data
   * @param videoFile - User-selected video file
   * @param options - Share options
   * @param layout - How to arrange items: 'video-first' | 'sequence-first'
   * @returns Array of media items ready for Instagram carousel
   */
  createCarouselBundle(
    sequence: SequenceData,
    videoFile: File,
    options: ShareOptions,
    layout?: "video-first" | "sequence-first"
  ): Promise<InstagramMediaItem[]>;

  /**
   * Reorder media items
   *
   * @param items - Current media items
   * @param fromIndex - Source index
   * @param toIndex - Destination index
   * @returns Reordered media items with updated order property
   */
  reorderMediaItems(
    items: InstagramMediaItem[],
    fromIndex: number,
    toIndex: number
  ): InstagramMediaItem[];

  /**
   * Remove media item
   *
   * @param items - Current media items
   * @param index - Index to remove
   * @returns Updated array with item removed and orders adjusted
   */
  removeMediaItem(
    items: InstagramMediaItem[],
    index: number
  ): InstagramMediaItem[];

  /**
   * Validate media bundle for Instagram
   *
   * @param items - Media items to validate
   * @returns Validation result
   */
  validateBundle(items: InstagramMediaItem[]): {
    isValid: boolean;
    errors: string[];
  };
}
