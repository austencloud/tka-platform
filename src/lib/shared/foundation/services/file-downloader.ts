import type { DownloadOptions, BatchDownloadOptions, DownloadResult } from "./types";

export async function downloadBlob(
  blob: Blob,
  filename: string,
  _options: DownloadOptions = {}
): Promise<DownloadResult> {
  // Try Web Share API first (mobile native share sheet)
  if (navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: blob.type });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        return { success: true, filename };
      }
    } catch (error) {
      // AbortError = user dismissed share sheet — not an error
      if (error instanceof DOMException && error.name === "AbortError") {
        return { success: true, filename };
      }
      // Other errors: fall through to anchor download
    }
  }

  // Fallback: anchor download
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
      resolve({ success: true, filename });
    } catch (error) {
      resolve({ success: false, filename, error: error as Error });
    }
  });
}

/**
 * Prevents browser blocking multiple parallel downloads.
 */
export async function downloadBlobBatch(
  blobs: Array<{ blob: Blob; filename: string }>,
  options: BatchDownloadOptions = {}
): Promise<DownloadResult[]> {
  const results: DownloadResult[] = [];
  const delay = options.delay || 100;

  for (let i = 0; i < blobs.length; i++) {
    const item = blobs[i];
    if (!item) continue;
    const { blob, filename } = item;

    const result = await downloadBlob(blob, filename, options);
    results.push(result);

    if (i < blobs.length - 1 && delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return results;
}

/**
 * Preserves Unicode, strips < > : " / \ | ? * and C0 control chars.
 */
export function sanitizeFilename(filename: string): string {
  return filename
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .substring(0, 200);
}

export function generateTimestampedFilename(
  baseName: string,
  extension: string,
  includeTime: boolean = true
): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = includeTime
    ? now.toISOString().slice(11, 19).replace(/:/g, "-")
    : "";

  const timestamp = includeTime ? `${date}_${time}` : date;
  const sanitizedBaseName = sanitizeFilename(baseName);

  return `${sanitizedBaseName}_${timestamp}.${extension}`;
}

export function supportsFileDownload(): boolean {
  try {
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

export function getFileExtensionForMimeType(mimeType: string): string {
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
