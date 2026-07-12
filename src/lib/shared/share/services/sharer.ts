import type { SequenceRenderer } from "$lib/shared/render/services/sequence-renderer";
import type { SequenceData } from "../../foundation/domain/models/sequence-data";
import type { ShareOptions } from "../domain/models/share-options";
import { PreviewCache } from "./preview-cache";
import { sanitizeFilename } from "$lib/shared/foundation/services/file-downloader";
import { buildCardRenderOptions } from "./card-render-options";

export class Sharer {
  private previewCache = new PreviewCache();

  constructor(private renderService: SequenceRenderer) {}

  async generatePreview(
    sequence: SequenceData,
    options: ShareOptions,
    forceRegenerate = false
  ): Promise<string> {
    if (!forceRegenerate) {
      const cachedUrl = await this.previewCache.getCachedPreview(
        sequence,
        options
      );
      if (cachedUrl) {
        return cachedUrl;
      }
    }

    const renderOptions = this.convertToPreviewOptions(options);

    const previewUrl = await this.renderService.generatePreview(
      sequence,
      renderOptions
    );

    try {
      const blob = await this.dataUrlToBlob(previewUrl);
      await this.previewCache.setCachedPreview(sequence, options, blob);
    } catch (error) {
      console.warn("Failed to cache preview:", error);
    }

    return previewUrl;
  }

  async downloadImage(
    sequence: SequenceData,
    options: ShareOptions,
    filename?: string
  ): Promise<void> {
    const blob = await this.getImageBlob(sequence, options);

    const finalFilename = filename || this.generateFilename(sequence, options);

    this.triggerDownload(blob, finalFilename);
  }

  async getImageBlob(
    sequence: SequenceData,
    options: ShareOptions,
    onProgress?: ImageGenerationProgressCallback
  ): Promise<Blob> {
    const renderOptions = this.convertToRenderOptions(options, sequence.dateAdded);

    return await this.renderService.renderSequenceToBlob(
      sequence,
      renderOptions,
      onProgress
    );
  }

  /**
   * Render the user's CARD (front) as a blob, funnelled through
   * buildCardRenderOptions — the single source of truth shared with the viewer
   * export, the QR scan page, copy/download/share, and the save-panel preview.
   * Unlike getImageBlob (the legacy ShareOptions path) this honors every card
   * toggle: prop type, QR, mandala, LOOP glyph, grid, columns, start-layout and
   * footer. Used by the library save thumbnail so the saved PNG matches what the
   * preview shows.
   */
  async getCardImageBlob(
    sequence: SequenceData,
    opts: { darkMode: boolean; userName: string },
    onProgress?: ImageGenerationProgressCallback
  ): Promise<Blob> {
    const renderOptions = {
      stepSize: 240,
      format: "PNG" as const,
      quality: 1.0,
      ...buildCardRenderOptions(sequence, {
        darkMode: opts.darkMode,
        userName: opts.userName,
        isHandPath: !!sequence.metadata?.isHandPathVisualization,
      }),
    };

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

    // Keep the real Greek glyphs (Σ, Φ, Λ…). sanitizeFilename preserves Unicode
    // and strips only illegal path chars — the old [^a-zA-Z0-9-_] regex turned
    // every Greek letter into "_".
    const cleanName = sanitizeFilename(sequenceName) || "sequence";

    return `${cleanName}_${date}.${extension}`;
  }

  validateOptions(options: ShareOptions): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!["PNG", "JPEG", "WebP"].includes(options.format)) {
      errors.push(`Invalid format: ${options.format}`);
    }

    if (options.quality < 0 || options.quality > 1) {
      errors.push(`Quality must be between 0 and 1, got: ${options.quality}`);
    }

    if (options.stepSize <= 0) {
      errors.push(`Beat size must be positive, got: ${options.stepSize}`);
    }

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
    return await this.previewCache.getCachedBlob(sequence, options);
  }

  async shareViaDevice(
    sequence: SequenceData,
    options: ShareOptions
  ): Promise<void> {
    if (!navigator.share || !navigator.canShare) {
      throw new Error(
        "Sharing not available on this device. Use the download button to save the image."
      );
    }

    const blob = await this.getImageBlob(sequence, options);

    const filename = this.generateFilename(sequence, options);
    const mimeType = this.getMimeType(options.format);

    const file = new File([blob], filename, {
      type: mimeType,
      lastModified: Date.now(),
    });

    const shareData: ShareData = {
      title: "TKA Sequence",
      text: `Check out this TKA sequence: ${sequence.name || "Untitled"}`,
      files: [file],
    };

    if (navigator.canShare(shareData)) {
      await navigator.share(shareData);
    } else {
      await navigator.share({
        title: "TKA Sequence",
        text: `Check out this TKA sequence: ${sequence.name || "Untitled"}`,
        url: window.location.href,
      });
    }
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

  private convertToRenderOptions(shareOptions: ShareOptions, sequenceBirthDate?: Date) {
    const dateToUse = sequenceBirthDate ?? new Date();

    return {
      includeStartPosition: shareOptions.includeStartPosition,
      addStepNumbers: shareOptions.addStepNumbers,
      addReversalSymbols: true, 
      addUserInfo: shareOptions.addUserInfo,
      addWord: shareOptions.addWord,
      combinedGrids: false,
      addDifficultyLevel: shareOptions.addDifficultyLevel,

      stepScale: 1.0,
      stepSize: shareOptions.stepSize,
      margin: shareOptions.margin,

      redVisible: true,
      blueVisible: true,
      visibilityOverrides: {
        darkMode: shareOptions.darkMode,
      },

      userName: shareOptions.userName || "Flow Arts Composer User",
      exportDate: dateToUse
        .toLocaleDateString("en-US", {
          year: "numeric",
          month: "numeric",
          day: "numeric",
        })
        .replace(/\//g, "-"),
      notes: shareOptions.customNotesText || shareOptions.notes || "Created with Flow Arts Composer",

      showCreatorName: shareOptions.showCreatorName,
      showNotes: shareOptions.showNotes,
      showBirthday: shareOptions.showBirthday,

      format: shareOptions.format,
      quality: shareOptions.quality,
      scale: 1.0,
      backgroundColor: shareOptions.backgroundColor,
    };
  }

  private convertToPreviewOptions(shareOptions: ShareOptions) {
    return {
      includeStartPosition: shareOptions.includeStartPosition,
      addStepNumbers: shareOptions.addStepNumbers,
      addReversalSymbols: true, 
      addUserInfo: shareOptions.addUserInfo,
      addWord: shareOptions.addWord,
      combinedGrids: false,
      addDifficultyLevel: shareOptions.addDifficultyLevel,

      stepScale: 0.15, 
      stepSize: shareOptions.stepSize,
      margin: shareOptions.margin,

      redVisible: true,
      blueVisible: true,
      visibilityOverrides: {
        darkMode: shareOptions.darkMode,
      },

      userName: shareOptions.userName || "Flow Arts Composer User",
      exportDate: new Date()
        .toLocaleDateString("en-US", {
          year: "numeric",
          month: "numeric",
          day: "numeric",
        })
        .replace(/\//g, "-"),
      notes: shareOptions.customNotesText || shareOptions.notes || "Created with Flow Arts Composer",

      showCreatorName: shareOptions.showCreatorName,
      showNotes: shareOptions.showNotes,
      showBirthday: shareOptions.showBirthday,

      format: "JPEG" as const, 
      quality: 0.4, 
      scale: 0.15, 
      backgroundColor: shareOptions.backgroundColor,
    };
  }

  private triggerDownload(blob: Blob, filename: string): void {
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

import type { ImageGenerationProgressCallback } from "./types";
