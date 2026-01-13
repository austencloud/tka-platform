/**
 * Image Format Converter Service - CONSOLIDATED
 *
 * Uses native browser APIs + file-saver for clean, simple image conversion.
 * Consolidates functionality from FileExportService to eliminate redundancy.
 * Provides both format conversion and file download capabilities.
 */

import type { IFileDownloader } from "../../../foundation/services/contracts/IFileDownloader";
import type { IImageFormatConverter } from "../contracts/IImageFormatConverter";

// Define missing types locally for now
interface ImageFormatOptions {
  format: "png" | "jpeg" | "webp";
  quality?: number;
  compression?: number;
}

interface OptimizationSettings {
  enableCompression: boolean;
  quality: number;
  progressive?: boolean;
}

export class ImageFormatConverter implements IImageFormatConverter {
  constructor(private fileDownloadService: IFileDownloader) {}
  /**
   * Convert Canvas to Blob using native browser API
   */
  async canvasToBlob(
    canvas: HTMLCanvasElement,
    options: ImageFormatOptions
  ): Promise<Blob> {
    if (!canvas) throw new Error("Canvas is required");

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("Conversion failed")),
        this.getMimeType(options.format),
        options.quality
      );
    });
  }

  /**
   * Convert Canvas to Data URL using native browser API
   */
  canvasToDataURL(
    canvas: HTMLCanvasElement,
    options: ImageFormatOptions
  ): string {
    if (!canvas) throw new Error("Canvas is required");
    return canvas.toDataURL(this.getMimeType(options.format), options.quality);
  }

  /**
   * Batch convert multiple canvases
   */
  async convertMultipleCanvasesToBlobs(
    canvases: HTMLCanvasElement[],
    options: ImageFormatOptions
  ): Promise<Blob[]> {
    return Promise.all(
      canvases.map((canvas) => this.canvasToBlob(canvas, options))
    );
  }

  /**
   * Download blob as file using file-saver
   * Only works in browser context
   */
  async downloadBlob(blob: Blob, filename: string): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('downloadBlob is only available in browser context');
    }
    const { saveAs } = await import('file-saver');
    saveAs(blob, filename);
  }

  // Simple implementations for interface compatibility
  async optimizeForUseCase(
    blob: Blob,
    _optimization: OptimizationSettings
  ): Promise<Blob> {
    return blob; // No optimization needed for dance notation
  }

  getOptimalFormat(_canvas: HTMLCanvasElement): "PNG" | "JPEG" | "WEBP" {
    return "PNG"; // PNG is fine for dance diagrams
  }

  validateFormatOptions(options: ImageFormatOptions): boolean {
    return options && ["PNG", "JPEG", "WEBP"].includes(options.format);
  }

  getSupportedFormats(): string[] {
    return ["PNG", "JPEG", "WEBP"];
  }

  estimateFileSize(
    _canvas: HTMLCanvasElement,
    _options: ImageFormatOptions
  ): number {
    return 100000; // Rough estimate - not critical for this app
  }

  getConversionStats() {
    return {
      totalConversions: 0,
      totalBytesProcessed: 0,
      averageCompressionRatio: 0,
      formatUsage: {},
    };
  }

  cleanup(): void {
    // No cleanup needed
  }

  /**
   * Download canvas as file (consolidated from FileExportService)
   * Handles canvas-to-blob conversion and browser downloads
   */
  async downloadCanvas(
    canvas: HTMLCanvasElement,
    filename: string,
    format: "PNG" | "JPEG" = "PNG",
    quality: number = 1.0
  ): Promise<void> {
    try {
      const blob = await this.canvasToBlob(canvas, {
        format: format.toLowerCase() as "png" | "jpeg",
        quality,
      });

      await this.fileDownloadService.downloadBlob(blob, filename);
    } catch (error) {
      throw new Error(
        `Download failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Generate versioned filename (consolidated from FileExportService)
   * Matches desktop filename generation with versioning
   */
  generateVersionedFilename(
    word: string,
    format: string,
    timestamp?: Date
  ): string {
    // Sanitize word for filename use
    const sanitizedWord = this.sanitizeForFilename(word) || "sequence";

    // Use provided timestamp or current time
    const date = timestamp || new Date();
    const dateString = date.toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD

    // Generate version number (in real implementation, this would check for existing files)
    const version = 1;

    // Format extension
    const extension = format.toLowerCase();

    return `${sanitizedWord}_v${version}_${dateString}.${extension}`;
  }

  /**
   * Sanitize string for filename use
   */
  private sanitizeForFilename(input: string): string {
    if (!input) return "";

    // Replace invalid filename characters with underscores
    return input
      .replace(/[<>:"/\\|?*]/g, "_")
      .replace(/\s+/g, "_")
      .substring(0, 100); // Reasonable length limit
  }

  private getMimeType(format: string): string {
    const mimeTypes: Record<string, string> = {
      png: "image/png",
      jpeg: "image/jpeg",
      webp: "image/webp",
      PNG: "image/png",
      JPEG: "image/jpeg",
      WEBP: "image/webp",
    };
    return mimeTypes[format] || "image/png";
  }
}
