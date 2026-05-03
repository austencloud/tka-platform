import type { DownloadOptions, BatchDownloadOptions, DownloadResult } from "../contracts/types";

export class FileDownloader {
  async downloadBlob(
    blob: Blob,
    filename: string,
    _options: DownloadOptions = {}
  ): Promise<DownloadResult> {
    return new Promise((resolve) => {
      try {
        const url = URL.createObjectURL(blob);

        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        anchor.style.display = "none";

        document.body.appendChild(anchor);
        anchor.click();

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
   * Prevents browser blocking multiple parallel downloads.
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
   * Preserves Unicode, strips < > : " / \ | ? * and C0 control chars.
   */
  sanitizeFilename(filename: string): string {
    return filename
      // eslint-disable-next-line no-control-regex
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
      .replace(/\s+/g, " ")
      .replace(/^[.\s]+|[.\s]+$/g, "")
      .substring(0, 200);
  }

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

export const fileDownloader = new FileDownloader();
