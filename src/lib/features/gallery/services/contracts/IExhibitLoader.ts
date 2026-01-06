/**
 * IExhibitLoader
 *
 * Service contract for loading sequences and assigning them to exhibit slots.
 */

import type { GalleryLayout } from "../../domain/models/GalleryLayout";
import type { Exhibit, ExhibitLoadOptions } from "../../domain/models/Exhibit";

export interface IExhibitLoader {
  /**
   * Load sequences and assign them to layout slots
   * @param layout - Gallery layout with slots to fill
   * @param options - Loading options (source, user ID, etc.)
   * @returns Array of exhibits assigned to slots
   */
  loadExhibits(
    layout: GalleryLayout,
    options: ExhibitLoadOptions
  ): Promise<Exhibit[]>;

  /**
   * Preload thumbnails for nearby exhibits
   * @param exhibitIds - IDs of exhibits to preload
   */
  preloadThumbnails(exhibitIds: string[]): Promise<void>;
}
