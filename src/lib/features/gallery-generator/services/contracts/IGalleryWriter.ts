/**
 * Gallery Writer Contract
 *
 * Writes rendered images to the gallery via API.
 */

export interface IGalleryWriter {
  /**
   * Write a blob to the gallery
   * @returns The path where the file was written
   */
  writeToGallery(word: string, blob: Blob): Promise<string>;
}
