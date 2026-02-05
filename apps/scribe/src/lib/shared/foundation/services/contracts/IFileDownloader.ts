/**
 * File Download Service Contract
 *
 * Handles file download operations for the browser environment.
 * Provides cross-browser utilities for downloading files from Blob objects.
 */

export interface DownloadOptions {
  filename?: string;
  mimeType?: string;
  showSaveDialog?: boolean;
}

export interface BatchDownloadOptions extends DownloadOptions {
  delay?: number; // Delay between downloads to prevent browser blocking
  zipFiles?: boolean; // Future enhancement: zip multiple files
}

export interface DownloadResult {
  success: boolean;
  filename: string;
  error?: Error;
}

export interface IFileDownloader {
  /**
   * Download a single file from a Blob
   * @param blob - The blob to download
   * @param filename - The filename for the download
   * @param options - Additional download options
   * @returns Promise that resolves to download result
   */
  downloadBlob(
    blob: Blob,
    filename: string,
    options?: DownloadOptions
  ): Promise<DownloadResult>;

  /**
   * Download multiple files with delay to prevent browser blocking
   * @param blobs - Array of blobs with filenames
   * @param options - Batch download options
   * @returns Promise that resolves to array of download results
   */
  downloadBlobBatch(
    blobs: Array<{ blob: Blob; filename: string }>,
    options?: BatchDownloadOptions
  ): Promise<DownloadResult[]>;

  /**
   * Generate a safe filename from a string
   * @param filename - The original filename
   * @returns Sanitized filename safe for download
   */
  sanitizeFilename(filename: string): string;

  /**
   * Generate a timestamped filename
   * @param baseName - Base name for the file
   * @param extension - File extension
   * @param includeTime - Whether to include time in timestamp
   * @returns Timestamped filename
   */
  generateTimestampedFilename(
    baseName: string,
    extension: string,
    includeTime?: boolean
  ): string;

  /**
   * Check if browser supports file downloads
   * @returns true if browser supports downloads
   */
  supportsFileDownload(): boolean;

  /**
   * Get recommended file extension for a MIME type
   * @param mimeType - The MIME type
   * @returns Recommended file extension
   */
  getFileExtensionForMimeType(mimeType: string): string;
}
