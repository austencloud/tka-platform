/**
 * Gallery Writer
 *
 * Writes rendered images to static/gallery/ via the gallery-write API endpoint.
 * Supports prop-specific subfolders: /gallery/{propType}/{sequence}.webp
 */

import type { IGalleryWriter } from "../contracts/IGalleryWriter";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

export class GalleryWriter implements IGalleryWriter {
  /**
   * Write image to gallery, optionally in a prop-specific subfolder
   * @param word - The sequence word/name
   * @param blob - The image blob
   * @param propType - Optional prop type for subfolder organization
   * @param lightMode - Optional light/dark mode indicator
   */
  async writeToGallery(
    word: string,
    blob: Blob,
    propType?: PropType,
    lightMode?: boolean
  ): Promise<string> {
    const formData = new FormData();

    // Build filename with optional mode suffix
    const modeSuffix =
      lightMode !== undefined ? (lightMode ? "_light" : "_dark") : "";
    const filename = `${word}${modeSuffix}.webp`;

    formData.append("image", blob, filename);
    formData.append("word", word);

    // Add prop type for subfolder organization
    if (propType) {
      formData.append("propType", propType);
    }

    // Add light mode flag
    if (lightMode !== undefined) {
      formData.append("lightMode", String(lightMode));
    }

    const response = await fetch("/api/gallery-write", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to write to gallery");
    }

    const data = await response.json();
    return data.path;
  }
}
