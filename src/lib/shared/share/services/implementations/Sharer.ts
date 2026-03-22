/**
 * Share Service Implementation
 *
 * Simple, focused service for sharing/downloading sequences.
 * Uses the render module for image generation.
 */

import type { ISequenceRenderer } from "../../../render/services/contracts/ISequenceRenderer";
import type { SequenceData } from "../../../foundation/domain/models/SequenceData";
import type { ShareOptions } from "../../domain/models/ShareOptions";
import type {
  ImageGenerationProgressCallback,
  ISharer,
} from "../contracts/ISharer";
import { PreviewCache } from "./PreviewCache";

export class Sharer implements ISharer {
  private previewCache = new PreviewCache();

  constructor(private renderService: ISequenceRenderer) {}

  async generatePreview(
    sequence: SequenceData,
    options: ShareOptions,
    forceRegenerate = false
  ): Promise<string> {
    // Check IndexedDB cache first (unless forcing regeneration)
    if (!forceRegenerate) {
      const cachedUrl = await this.previewCache.getCachedPreview(
        sequence,
        options
      );
      if (cachedUrl) {
        return cachedUrl;
      }
    }

    // Convert ShareOptions to SequenceExportOptions for render service
    // Use much smaller scale for thumbnail preview (faster loading)
    const renderOptions = this.convertToPreviewOptions(options);

    // Generate new preview
    const previewUrl = await this.renderService.generatePreview(
      sequence,
      renderOptions
    );

    // Convert data URL to blob and cache it
    try {
      const blob = await this.dataUrlToBlob(previewUrl);
      await this.previewCache.setCachedPreview(sequence, options, blob);
    } catch (error) {
      console.warn("Failed to cache preview:", error);
      // Continue anyway - preview generation succeeded
    }

    return previewUrl;
  }

  async downloadImage(
    sequence: SequenceData,
    options: ShareOptions,
    filename?: string
  ): Promise<void> {
    // Get image blob
    const blob = await this.getImageBlob(sequence, options);

    // Generate filename if not provided
    const finalFilename = filename || this.generateFilename(sequence, options);

    // Trigger download
    this.triggerDownload(blob, finalFilename);
  }

  async getImageBlob(
    sequence: SequenceData,
    options: ShareOptions,
    onProgress?: ImageGenerationProgressCallback
  ): Promise<Blob> {
    // Convert ShareOptions to SequenceExportOptions for render service
    // Pass sequence birth date so it appears on the exported image
    const renderOptions = this.convertToRenderOptions(options, sequence.dateAdded);

    // Use render service to generate blob (with progress callback)
    return await this.renderService.renderSequenceToBlob(
      sequence,
      renderOptions,
      onProgress
    );
  }

  generateFilename(sequence: SequenceData, options: ShareOptions): string {
    const sequenceName = sequence.word || sequence.name || "sequence";
    const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const extension = options.format.toLowerCase();

    // Clean filename
    const cleanName = sequenceName.replace(/[^a-zA-Z0-9-_]/g, "_");

    return `${cleanName}_${date}.${extension}`;
  }

  validateOptions(options: ShareOptions): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate format
    if (!["PNG", "JPEG", "WebP"].includes(options.format)) {
      errors.push(`Invalid format: ${options.format}`);
    }

    // Validate quality
    if (options.quality < 0 || options.quality > 1) {
      errors.push(`Quality must be between 0 and 1, got: ${options.quality}`);
    }

    // Validate beat size
    if (options.stepSize <= 0) {
      errors.push(`Beat size must be positive, got: ${options.stepSize}`);
    }

    // Validate margin
    if (options.margin < 0) {
      errors.push(`Margin must be non-negative, got: ${options.margin}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async getCachedBlobIfAvailable(
    sequence: SequenceData,
    options: ShareOptions
  ): Promise<Blob | null> {
    // Check IndexedDB cache for a matching preview
    // This allows reusing already-generated images without re-composition
    return await this.previewCache.getCachedBlob(sequence, options);
  }

  async shareViaDevice(
    sequence: SequenceData,
    options: ShareOptions
  ): Promise<void> {
    // Check if Web Share API is available
    if (!navigator.share || !navigator.canShare) {
      throw new Error(
        "Sharing not available on this device. Use the download button to save the image."
      );
    }

    // Get the image blob
    const blob = await this.getImageBlob(sequence, options);

    // Create a File object with optimal metadata for sharing
    const filename = this.generateFilename(sequence, options);
    const mimeType = this.getMimeType(options.format);

    const file = new File([blob], filename, {
      type: mimeType,
      lastModified: Date.now(),
    });

    // Prepare share data
    const shareData: ShareData = {
      title: "TKA Sequence",
      text: `Check out this TKA sequence: ${sequence.name || "Untitled"}`,
      files: [file],
    };

    // Try to share with files
    if (navigator.canShare(shareData)) {
      await navigator.share(shareData);
    } else {
      // Fallback to URL sharing if file sharing not supported
      await navigator.share({
        title: "TKA Sequence",
        text: `Check out this TKA sequence: ${sequence.name || "Untitled"}`,
        url: window.location.href,
      });
    }
  }

  // Private helper methods

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

  private convertToRenderOptions(shareOptions: ShareOptions, sequenceBirthDate?: Date) {
    // Convert our simple ShareOptions to the render service's SequenceExportOptions
    // Use sequence birth date for the footer, falling back to current date
    const rawDate = sequenceBirthDate ?? new Date();
    // Firestore Timestamps and IndexedDB serialized dates aren't real Date objects
    const dateToUse = rawDate instanceof Date ? rawDate : new Date(rawDate as any);

    return {
      // Core export settings
      includeStartPosition: shareOptions.includeStartPosition,
      addStepNumbers: shareOptions.addStepNumbers,
      addReversalSymbols: true, // Always include for completeness
      addUserInfo: shareOptions.addUserInfo,
      addWord: shareOptions.addWord,
      combinedGrids: false,
      addDifficultyLevel: shareOptions.addDifficultyLevel,

      // Scaling and sizing
      stepScale: 1.0,
      stepSize: shareOptions.stepSize,
      margin: shareOptions.margin,

      // Visibility settings
      redVisible: true,
      blueVisible: true,
      visibilityOverrides: {
        darkMode: shareOptions.darkMode,
      },

      // User information
      userName: shareOptions.userName || "TKA Composer User",
      exportDate: dateToUse
        .toLocaleDateString("en-US", {
          year: "numeric",
          month: "numeric",
          day: "numeric",
        })
        .replace(/\//g, "-"),
      notes: shareOptions.customNotesText || shareOptions.notes || "Created with TKA Composer",

      // Granular footer controls
      showCreatorName: shareOptions.showCreatorName,
      showNotes: shareOptions.showNotes,
      showBirthday: shareOptions.showBirthday,

      // Output format
      format: shareOptions.format,
      quality: shareOptions.quality,
      scale: 1.0,
      backgroundColor: shareOptions.backgroundColor,
    };
  }

  private convertToPreviewOptions(shareOptions: ShareOptions) {
    // Convert ShareOptions for thumbnail preview (MAXIMUM SPEED)
    return {
      // Core export settings - same as full export
      includeStartPosition: shareOptions.includeStartPosition,
      addStepNumbers: shareOptions.addStepNumbers,
      addReversalSymbols: true,
      addUserInfo: shareOptions.addUserInfo,
      addWord: shareOptions.addWord,
      combinedGrids: false,
      addDifficultyLevel: shareOptions.addDifficultyLevel,

      // Scaling and sizing - MINIMAL SIZE for instant generation
      stepScale: 0.15, // Tiny thumbnail (15% of full size) - lightning fast
      stepSize: shareOptions.stepSize,
      margin: shareOptions.margin,

      // Visibility settings
      redVisible: true,
      blueVisible: true,
      visibilityOverrides: {
        darkMode: shareOptions.darkMode,
      },

      // User information
      userName: shareOptions.userName || "TKA Composer User",
      exportDate: new Date()
        .toLocaleDateString("en-US", {
          year: "numeric",
          month: "numeric",
          day: "numeric",
        })
        .replace(/\//g, "-"),
      notes: shareOptions.customNotesText || shareOptions.notes || "Created with TKA Composer",

      // Granular footer controls
      showCreatorName: shareOptions.showCreatorName,
      showNotes: shareOptions.showNotes,
      showBirthday: shareOptions.showBirthday,

      // Output format - Maximum speed optimization
      format: "JPEG" as const, // JPEG encodes much faster than PNG
      quality: 0.4, // Minimum acceptable quality for instant speed
      scale: 0.15, // Match stepScale for consistency
      backgroundColor: shareOptions.backgroundColor,
    };
  }

  private triggerDownload(blob: Blob, filename: string): void {
    // Create download link and trigger it
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
    const response = await fetch(dataUrl);
    return await response.blob();
  };
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
import { sequenceRenderer } from "$lib/shared/render/services/implementations/SequenceRenderer";

export const sharer = new Sharer(sequenceRenderer);
