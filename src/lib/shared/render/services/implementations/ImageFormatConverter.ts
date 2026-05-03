import type { FileDownloader } from "../../../foundation/services/implementations/FileDownloader";

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

export class ImageFormatConverter {
  constructor(private fileDownloadService: FileDownloader) {}

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

  canvasToDataURL(
    canvas: HTMLCanvasElement,
    options: ImageFormatOptions
  ): string {
    if (!canvas) throw new Error("Canvas is required");
    return canvas.toDataURL(this.getMimeType(options.format), options.quality);
  }

  async convertMultipleCanvasesToBlobs(
    canvases: HTMLCanvasElement[],
    options: ImageFormatOptions
  ): Promise<Blob[]> {
    return Promise.all(
      canvases.map((canvas) => this.canvasToBlob(canvas, options))
    );
  }

  async downloadBlob(blob: Blob, filename: string): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('downloadBlob is only available in browser context');
    }
    const { saveAs } = await import('file-saver');
    saveAs(blob, filename);
  }

  async optimizeForUseCase(
    blob: Blob,
    _optimization: OptimizationSettings
  ): Promise<Blob> {
    return blob;
  }

  getOptimalFormat(_canvas: HTMLCanvasElement): "PNG" | "JPEG" | "WEBP" {
    return "PNG";
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
    return 100000;
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

  generateVersionedFilename(
    word: string,
    format: string,
    timestamp?: Date
  ): string {
    const sanitizedWord = this.sanitizeForFilename(word) || "sequence";

    const date = timestamp || new Date();
    const dateString = date.toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD

    const version = 1;

    const extension = format.toLowerCase();

    return `${sanitizedWord}_v${version}_${dateString}.${extension}`;
  }

  private sanitizeForFilename(input: string): string {
    if (!input) return "";

    return input
      .replace(/[<>:"/\\|?*]/g, "_")
      .replace(/\s+/g, "_")
      .substring(0, 100);
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

import { fileDownloader } from "$lib/shared/foundation/services/implementations/FileDownloader";

export const imageFormatConverter = new ImageFormatConverter(fileDownloader);
