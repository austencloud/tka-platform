/**
 * File Download Service Implementation
 *
 * Cross-browser utilities for downloading files from Blob objects.
 * Handles browser compatibility and provides progress feedback.
 */

import type {
  IFileDownloader,
  DownloadOptions,
  BatchDownloadOptions,
  DownloadResult,
} from "../contracts/IFileDownloader";

export class FileDownloader implements IFileDownloader {
  /**
   * Download a single file from a Blob
   */
  async downloadBlob(
    blob: Blob,
    filename: string,
    _options: DownloadOptions = {}
  ): Promise<DownloadResult> {
    return new Promise((resolve) => {
      try {
        // Create object URL for the blob
        const url = URL.createObjectURL(blob);

        // Create temporary anchor element
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        anchor.style.display = "none";

        // Add to DOM temporarily
        document.body.appendChild(anchor);

        // Trigger download
        anchor.click();

        // Cleanup
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);

        resolve({
          success: true,
          filename,
        });
      } catch (error) {
        resolve({
          success: false,
          filename,
          error: error as Error,
        });
      }
    });
  }

  /**
   * Download multiple files with delay to prevent browser blocking
   */
  async downloadBlobBatch(
    blobs: Array<{ blob: Blob; filename: string }>,
    options: BatchDownloadOptions = {}
  ): Promise<DownloadResult[]> {
    const results: DownloadResult[] = [];
    const delay = options.delay || 100; // Default 100ms delay

    for (let i = 0; i < blobs.length; i++) {
      const item = blobs[i];
      if (!item) continue;
      const { blob, filename } = item;

      // Download the file
      const result = await this.downloadBlob(blob, filename, options);
      results.push(result);

      // Add delay between downloads (except for the last one)
      if (i < blobs.length - 1 && delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return results;
  }

  /**
   * Generate a safe filename from a string.
   * Preserves Unicode letters and numbers (modern filesystems - NTFS, APFS, ext4 -
   * handle them fine). Strips only characters forbidden on Windows/macOS/Linux:
   * `< > : " / \ | ? *` and C0 control chars. Also trims trailing dots/spaces
   * (forbidden on Windows) and collapses any whitespace to single spaces.
   */
  sanitizeFilename(filename: string): string {
    return filename
      // eslint-disable-next-line no-control-regex
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
      .replace(/\s+/g, " ")
      .replace(/^[.\s]+|[.\s]+$/g, "")
      .substring(0, 200);
  }

  /**
   * Generate a timestamped filename
   */
  generateTimestampedFilename(
    baseName: string,
    extension: string,
    includeTime: boolean = true
  ): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const time = includeTime
      ? now.toISOString().slice(11, 19).replace(/:/g, "-") // HH-MM-SS
      : "";

    const timestamp = includeTime ? `${date}_${time}` : date;
    const sanitizedBaseName = this.sanitizeFilename(baseName);

    return `${sanitizedBaseName}_${timestamp}.${extension}`;
  }

  /**
   * Check if browser supports file downloads
   */
  supportsFileDownload(): boolean {
    try {
      // Check for required APIs
      return (
        typeof URL !== "undefined" &&
        typeof URL.createObjectURL === "function" &&
        typeof document.createElement === "function" &&
        "download" in document.createElement("a")
      );
    } catch {
      return false;
    }
  }

  /**
   * Get recommended file extension for a MIME type
   */
  getFileExtensionForMimeType(mimeType: string): string {
    const mimeTypeMap: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
      "application/pdf": "pdf",
      "text/plain": "txt",
      "application/json": "json",
    };

    return mimeTypeMap[mimeType.toLowerCase()] || "bin";
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const fileDownloader = new FileDownloader();
