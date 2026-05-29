
export class SvgImageConverter {
  private activeBlobUrls = new Set<string>();

  /**
   * Embeds width/height in SVG to ensure correct creation size of HTMLImageElement.
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

      img.onerror = (error) => {
        this.cleanupBlobUrl(blobUrl);
        reject(new Error(`Failed to load SVG image: ${error}`));
      };

      img.onload = () => {
        this.cleanupBlobUrl(blobUrl);
        resolve(img);
      };

      try {
        let modifiedSvg = svgString;

        if (modifiedSvg.includes("<svg")) {
          modifiedSvg = modifiedSvg.replace(/\s+width="[^"]*"/g, "");
          modifiedSvg = modifiedSvg.replace(/\s+height="[^"]*"/g, "");

          modifiedSvg = modifiedSvg.replace(
            /<svg/,
            `<svg width="${width}" height="${height}"`
          );
        }

        const blob = new Blob([modifiedSvg], { type: "image/svg+xml" });
        blobUrl = URL.createObjectURL(blob);
        this.activeBlobUrls.add(blobUrl);

        img.src = blobUrl;
      } catch (error) {
        this.cleanupBlobUrl(blobUrl);
        reject(new Error(`Failed to create blob URL: ${error}`));
      }
    });
  }

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
      this.cleanup();
      throw error;
    }
  }

  validateSvgString(svgString: string): boolean {
    if (!svgString || typeof svgString !== "string") {
      return false;
    }

    const trimmed = svgString.trim();
    if (!trimmed) {
      return false;
    }

    const hasSvgTag = trimmed.includes("<svg") && trimmed.includes("</svg>");
    if (!hasSvgTag) {
      return false;
    }

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(trimmed, "image/svg+xml");
      const parserError = doc.querySelector("parsererror");
      return !parserError;
    } catch {
      return false;
    }
  }

  private cleanupBlobUrl(blobUrl: string | null): void {
    if (blobUrl && this.activeBlobUrls.has(blobUrl)) {
      URL.revokeObjectURL(blobUrl);
      this.activeBlobUrls.delete(blobUrl);
    }
  }

  cleanup(): void {
    for (const blobUrl of this.activeBlobUrls) {
      URL.revokeObjectURL(blobUrl);
    }
    this.activeBlobUrls.clear();
  }
}
