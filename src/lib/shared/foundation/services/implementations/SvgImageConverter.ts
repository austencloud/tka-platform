/**
 * SVG Image Service Implementation
 *
 * Converts SVG strings to HTMLImageElement for canvas rendering.
 * Handles blob URL creation, cleanup, and error handling.
 */

import type { ISvgImageConverter } from "../contracts/ISvgImageConverter";

export class SvgImageConverter implements ISvgImageConverter {
  private activeBlobUrls = new Set<string>();

  /**
   * Convert SVG string to HTMLImageElement
   * IMPORTANT: Actually respects width/height by embedding them in the SVG
   */
  async convertSvgStringToImage(
    svgString: string,
    width: number,
    height: number
  ): Promise<HTMLImageElement> {
    if (!this.validateSvgString(svgString)) {
      throw new Error("Invalid SVG string provided");
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      let blobUrl: string | null = null;

      // Set up error handler
      img.onerror = (error) => {
        this.cleanupBlobUrl(blobUrl);
        reject(new Error(`Failed to load SVG image: ${error}`));
      };

      // Set up success handler
      img.onload = () => {
        // Image loaded successfully - silently resolve
        // Debug logging (disabled):
        // console.log('[SvgImageConverter] Image loaded:', {
        //   naturalWidth: img.naturalWidth,
        //   naturalHeight: img.naturalHeight,
        //   width: img.width,
        //   height: img.height,
        //   complete: img.complete
        // });
        this.cleanupBlobUrl(blobUrl);
        resolve(img);
      };

      try {
        // Embed width and height attributes in SVG to ensure correct rendering size
        // This ensures the HTMLImageElement is created at the requested dimensions
        let modifiedSvg = svgString;

        // Add or update width/height attributes on the <svg> element
        if (modifiedSvg.includes("<svg")) {
          // Remove existing width/height if present
          modifiedSvg = modifiedSvg.replace(/\s+width="[^"]*"/g, "");
          modifiedSvg = modifiedSvg.replace(/\s+height="[^"]*"/g, "");

          // Add new width/height right after <svg
          modifiedSvg = modifiedSvg.replace(
            /<svg/,
            `<svg width="${width}" height="${height}"`
          );
        }

        // Create blob URL from modified SVG string
        const blob = new Blob([modifiedSvg], { type: "image/svg+xml" });
        blobUrl = URL.createObjectURL(blob);
        this.activeBlobUrls.add(blobUrl);

        // Set image source to trigger loading
        img.src = blobUrl;
      } catch (error) {
        this.cleanupBlobUrl(blobUrl);
        reject(new Error(`Failed to create blob URL: ${error}`));
      }
    });
  }

  /**
   * Convert multiple SVG strings to images in parallel
   */
  async convertMultipleSvgStringsToImages(
    svgData: Array<{
      svgString: string;
      width: number;
      height: number;
    }>
  ): Promise<HTMLImageElement[]> {
    const conversions = svgData.map(({ svgString, width, height }) =>
      this.convertSvgStringToImage(svgString, width, height)
    );

    try {
      return await Promise.all(conversions);
    } catch (error) {
      // If any conversion fails, clean up and re-throw
      this.cleanup();
      throw error;
    }
  }

  /**
   * Validate SVG string before conversion
   */
  validateSvgString(svgString: string): boolean {
    if (!svgString || typeof svgString !== "string") {
      return false;
    }

    const trimmed = svgString.trim();
    if (!trimmed) {
      return false;
    }

    // Basic SVG validation - check for SVG tags
    const hasSvgTag = trimmed.includes("<svg") && trimmed.includes("</svg>");
    if (!hasSvgTag) {
      return false;
    }

    // Check for basic XML structure
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(trimmed, "image/svg+xml");
      const parserError = doc.querySelector("parsererror");
      return !parserError;
    } catch {
      return false;
    }
  }

  /**
   * Clean up a specific blob URL
   */
  private cleanupBlobUrl(blobUrl: string | null): void {
    if (blobUrl && this.activeBlobUrls.has(blobUrl)) {
      URL.revokeObjectURL(blobUrl);
      this.activeBlobUrls.delete(blobUrl);
    }
  }

  /**
   * Clean up all cached resources
   */
  cleanup(): void {
    // Clean up all active blob URLs
    for (const blobUrl of this.activeBlobUrls) {
      URL.revokeObjectURL(blobUrl);
    }
    this.activeBlobUrls.clear();
  }
}
