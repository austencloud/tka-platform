/**
 * IGalleryLayoutGenerator
 *
 * Service contract for generating gallery layouts.
 * Different implementations can provide different layout strategies
 * (hallway, procedural rooms, custom, etc.)
 */

import type {
  GalleryLayout,
  LayoutGenerationOptions,
} from "../../domain/models/GalleryLayout";

export interface IGalleryLayoutGenerator {
  /**
   * Generate a gallery layout for the given number of exhibits
   * @param options - Layout generation options
   * @returns Complete gallery layout
   */
  generate(options: LayoutGenerationOptions): GalleryLayout;

  /**
   * Get the name of this layout generator
   */
  readonly name: string;
}
