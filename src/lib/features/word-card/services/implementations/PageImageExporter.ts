/**
 * Page Image Export Service Implementation
 *
 * Handles exporting page elements as images using html2canvas.
 * Supports PNG, JPEG, and WebP formats with quality and scaling options.
 */

import type {
  ExportResult,
  Html2CanvasFunction,
} from "$lib/shared/foundation/ui/UITypes";
import { injectable } from "inversify";
import { getUser } from "$lib/shared/auth/state/authState.svelte";

import type {
  ExportProgress,
  SequenceExportOptions,
} from "$lib/shared/render/domain/models/SequenceExportOptions";
import type { Page } from "../../domain/models/PageLayout";
import type {
  BatchExportResult,
  WordCardExportOptions,
  WordCardExportResultWithMetadata,
} from "../../domain/models/word-card-export";
import type { IPageImageExportService } from "../contracts/word-card-contracts";

@injectable()
export class PageImageExportService implements IPageImageExportService {
  exportPage(_page: Page, _options: WordCardExportOptions): Promise<Blob> {
    throw new Error("Method not implemented.");
  }
  exportPages(
    _pages: Page[],
    _options: WordCardExportOptions
  ): Promise<Blob[]> {
    throw new Error("Method not implemented.");
  }
  private abortController: AbortController | null = null;
  private currentProgress: ExportProgress | null = null;

  async exportPageAsImage(
    pageElement: HTMLElement,
    options: SequenceExportOptions
  ): Promise<ExportResult> {
    const startTime = performance.now();

    try {
      // Validate options
      const validation = this.validateExportOptions(options);
      if (!validation) {
        throw new Error(`Invalid export options`);
      }

      // Dynamic import of html2canvas (only load when needed)
      const html2canvas = await this.loadHtml2Canvas();

      // Prepare element for capture
      const preparedElement = this.prepareElementForCapture(pageElement);

      // Calculate dimensions
      const dimensions = this.calculateCaptureDimensions(
        preparedElement,
        options
      );

      // Capture the element
      const canvas = await html2canvas(preparedElement, {
        width: dimensions.width,
        height: dimensions.height,
        scale: options.scale,
        backgroundColor: options.backgroundColor ?? "#ffffff",
        useCORS: true,
        allowTaint: false,
        removeContainer: true,
        logging: false,
        // High quality rendering
        scrollX: 0,
        scrollY: 0,
        windowWidth: dimensions.width,
        windowHeight: dimensions.height,
      });

      // Convert canvas to blob
      const blob = await this.canvasToBlob(canvas, options);

      const processingTime = performance.now() - startTime;

      return {
        success: true,
        data: blob,
        filename: "page-export.png",
        metadata: {
          format: options.format,
          size: blob.size,
          dimensions: { width: canvas.width, height: canvas.height },
          beatCount: 0,
          processingTime,
        },
      };
    } catch (error) {
      const processingTime = performance.now() - startTime;

      return {
        success: false,
        filename: "page-export.png",
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          format: options.format,
          size: 0,
          dimensions: { width: 0, height: 0 },
          beatCount: 0,
          processingTime,
        },
      };
    }
  }

  async exportPagesAsImages(
    pageElements: HTMLElement[],
    options: SequenceExportOptions,
    onProgress?: (progress: ExportProgress) => void
  ): Promise<BatchExportResult> {
    const startTime = performance.now();
    const results: ExportResult[] = [];
    const errors: Error[] = [];
    let successCount = 0;
    let failureCount = 0;

    // Create abort controller for cancellation
    this.abortController = new AbortController();

    try {
      // Load html2canvas once for batch operation
      const html2canvas = await this.loadHtml2Canvas();

      for (let i = 0; i < pageElements.length; i++) {
        // Check for cancellation
        if (this.abortController.signal.aborted) {
          break;
        }

        // Update progress
        const progress: ExportProgress = {
          stage: "share",
          progress: ((i + 1) / pageElements.length) * 100,
          message: `Exporting page ${i + 1} of ${pageElements.length}`,
        };

        this.currentProgress = progress;
        onProgress?.(progress);

        try {
          const pageElement = pageElements[i];
          if (!pageElement) continue;
          const result = await this.exportSinglePageWithCanvas(
            pageElement,
            html2canvas,
            options,
            i + 1
          );

          results.push(result);

          if (result.success) {
            successCount++;
          } else {
            failureCount++;
            if (result.error) {
              errors.push(new Error(result.error));
            }
          }
        } catch (error) {
          failureCount++;
          const err = error as Error;
          errors.push(err);

          results.push({
            success: false,
            filename: `page-${i + 1}.png`,
            error: err instanceof Error ? err.message : String(err),
            metadata: {
              format: options.format,
              size: 0,
              dimensions: { width: 0, height: 0 },
              beatCount: 0,
              processingTime: 0,
            },
          });
        }

        // Brief pause to allow UI updates and prevent blocking
        await this.pauseForUI();
      }
    } catch (error) {
      errors.push(error as Error);
    } finally {
      this.abortController = null;
      this.currentProgress = null;
    }

    const totalProcessingTime = performance.now() - startTime;

    // Map ExportResult[] to WordCardExportResultWithMetadata[]
    const mappedResults: WordCardExportResultWithMetadata[] = results.map(
      (result, index) => {
        // Extract error separately and convert string to Error object
        const { error, ...restResult } = result;

        const baseResult: WordCardExportResultWithMetadata = {
          ...restResult,
          sequenceId: `page-${index}`, // Add required sequenceId property
          success: result.success,
        };

        // Only add error if it exists, and ensure it's an Error object
        if (error) {
          baseResult.error =
            typeof error === "string" ? new Error(error) : error;
        }

        return baseResult;
      }
    );

    return {
      success: errors.length === 0,
      totalPages: pageElements.length,
      successCount,
      failureCount,
      results: mappedResults,
      totalProcessingTime,
      errors,
    };
  }

  calculateOptimalDimensions(
    pageElement: HTMLElement,
    targetDPI: number
  ): { width: number; height: number } {
    const rect = pageElement.getBoundingClientRect();
    const scaleFactor = targetDPI / 96; // 96 DPI is standard screen DPI

    return {
      width: Math.round(rect.width * scaleFactor),
      height: Math.round(rect.height * scaleFactor),
    };
  }

  validateExportOptions(options: SequenceExportOptions): boolean {
    // Validate format
    if (!["PNG", "JPEG", "WebP"].includes(options.format)) {
      return false;
    }

    // Validate quality
    if (options.quality < 0 || options.quality > 1) {
      return false;
    }

    // Validate scale
    if (options.scale <= 0) {
      return false;
    }

    // Validate dimensions if provided
    if (options.width && options.width <= 0) {
      return false;
    }

    if (options.height && options.height <= 0) {
      return false;
    }

    return true;
  }

  getSupportedFormats(): string[] {
    return ["PNG", "JPEG", "WebP"];
  }

  getRecommendedSettings(
    useCase: "print" | "web" | "archive"
  ): SequenceExportOptions {
    // Get the authenticated user's display name
    const user = getUser();
    const userName = user?.displayName || "TKA Scribe User";

    const baseOptions: SequenceExportOptions = {
      // Core export settings
      includeStartPosition: true,
      addBeatNumbers: true,
      addReversalSymbols: true,
      addUserInfo: true,
      addWord: true,
      combinedGrids: false,
      addDifficultyLevel: true,

      // Scaling and sizing
      beatScale: 1.0,
      beatSize: 100,
      margin: 20,

      // Visibility settings
      redVisible: true,
      blueVisible: true,

      // User information
      userName,
      exportDate: new Date().toISOString().split("T")[0] ?? "",
      notes: "Exported from TKA",

      // Output format (will be overridden)
      format: "PNG",
      quality: 0.9,
      scale: 1.0,
      backgroundColor: "#ffffff",
    };

    switch (useCase) {
      case "print":
        return {
          ...baseOptions,
          format: "PNG" as const,
          scale: 2.0,
          quality: 1.0,
        };
      case "web":
        return {
          ...baseOptions,
          format: "JPEG" as const,
          scale: 1.0,
          quality: 0.8,
        };
      case "archive":
        return {
          ...baseOptions,
          format: "PNG" as const,
          scale: 1.5,
          quality: 1.0,
        };
      default:
        return {
          ...baseOptions,
          format: "PNG" as const,
        };
    }
  }

  // Cancel ongoing export
  cancelExport(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  // Get current progress
  getCurrentProgress(): ExportProgress | null {
    return this.currentProgress;
  }

  // Private helper methods

  private async loadHtml2Canvas(): Promise<Html2CanvasFunction> {
    try {
      // Check if html2canvas is already loaded
      const windowAny = window as { html2canvas?: Html2CanvasFunction };

      if (!windowAny.html2canvas) {
        // Dynamically load html2canvas from CDN
        const script = document.createElement("script");
        script.src =
          "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";

        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      // Access html2canvas after it's been loaded
      const html2canvas = (window as { html2canvas?: Html2CanvasFunction })
        .html2canvas;
      if (!html2canvas) {
        throw new Error("html2canvas failed to load");
      }

      return html2canvas;
    } catch {
      throw new Error(
        "Failed to load html2canvas library. Check internet connection."
      );
    }
  }

  private prepareElementForCapture(element: HTMLElement): HTMLElement {
    // Clone the element to avoid modifying the original
    const clonedElement = element.cloneNode(true) as HTMLElement;

    // Apply capture-specific styles
    clonedElement.style.position = "static";
    clonedElement.style.transform = "none";
    clonedElement.style.margin = "0";
    clonedElement.style.padding = "0";

    // Ensure all images are loaded
    const images = clonedElement.querySelectorAll("img");
    images.forEach((img) => {
      if (!img.complete) {
        // Replace with placeholder if image not loaded
        img.src =
          "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+SW1hZ2U8L3RleHQ+PC9zdmc+";
      }
    });

    return clonedElement;
  }

  private calculateCaptureDimensions(
    element: HTMLElement,
    options: SequenceExportOptions
  ): { width: number; height: number } {
    const rect = element.getBoundingClientRect();

    if (options.width && options.height) {
      return { width: options.width, height: options.height };
    }

    if (options.width) {
      const aspectRatio = rect.height / rect.width;
      return { width: options.width, height: options.width * aspectRatio };
    }

    if (options.height) {
      const aspectRatio = rect.width / rect.height;
      return { width: options.height * aspectRatio, height: options.height };
    }

    return { width: rect.width, height: rect.height };
  }

  private async canvasToBlob(
    canvas: HTMLCanvasElement,
    options: SequenceExportOptions
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const mimeType = this.getMimeType(options.format);
      const quality = options.format === "PNG" ? undefined : options.quality;

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to create blob from canvas"));
          }
        },
        mimeType,
        quality
      );
    });
  }

  private getMimeType(format: string): string {
    switch (format) {
      case "PNG":
        return "image/png";
      case "JPEG":
        return "image/jpeg";
      case "WebP":
        return "image/webp";
      default:
        return "image/png";
    }
  }

  private async exportSinglePageWithCanvas(
    pageElement: HTMLElement,
    html2canvas: Html2CanvasFunction,
    options: SequenceExportOptions,
    pageNumber: number
  ): Promise<ExportResult> {
    const startTime = performance.now();

    try {
      const preparedElement = this.prepareElementForCapture(pageElement);
      const dimensions = this.calculateCaptureDimensions(
        preparedElement,
        options
      );

      const canvas = await html2canvas(preparedElement, {
        width: dimensions.width,
        height: dimensions.height,
        scale: options.scale,
        backgroundColor: options.backgroundColor ?? "#ffffff",
        useCORS: true,
        allowTaint: false,
        removeContainer: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: dimensions.width,
        windowHeight: dimensions.height,
      });

      const blob = await this.canvasToBlob(canvas, options);
      const processingTime = performance.now() - startTime;

      return {
        success: true,
        data: blob,
        filename: `page-${pageNumber}.png`,
        metadata: {
          format: "PNG",
          size: blob.size,
          dimensions: { width: canvas.width, height: canvas.height },
          beatCount: 0,
          processingTime,
        },
      };
    } catch (error) {
      const processingTime = performance.now() - startTime;

      return {
        success: false,
        filename: `page-${pageNumber}.png`,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          format: "PNG",
          size: 0,
          dimensions: { width: 0, height: 0 },
          beatCount: 0,
          processingTime,
        },
      };
    }
  }

  private async pauseForUI(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 10));
  }
}
