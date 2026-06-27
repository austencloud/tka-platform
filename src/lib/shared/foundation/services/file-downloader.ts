import type { DownloadOptions, BatchDownloadOptions, DownloadResult } from "./types";
import { detectPlatform } from "$lib/shared/mobile/services/platform-detector";

/** Anchor (<a download>) to disk. The terminal fallback for every path here. */
function anchorDownload(blob: Blob, filename: string): Promise<DownloadResult> {
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
 * Device-gated save: native share sheet on mobile, straight-to-disk on desktop.
 *
 * Thin alias over {@link shareOrDownloadBlob} (the single source of the platform
 * gate). The gate is load-bearing: desktop Chrome/Edge DO implement
 * `navigator.share`/`canShare`, so feature-detecting share alone pops the OS
 * (Windows/macOS) share sheet on desktop — which nobody wants for a file that
 * should just download. Gate on the DEVICE, not the capability.
 */
export async function downloadBlob(
  blob: Blob,
  filename: string,
  _options: DownloadOptions = {}
): Promise<DownloadResult> {
  return shareOrDownloadBlob(blob, filename);
}

/**
 * Share-first on mobile, download on desktop.
 *
 * On a mobile platform (`detectPlatform() !== "desktop"`) this opens the native
 * share sheet so the user chooses where the file lands (Files, Photos, AirDrop,
 * a message…) instead of a blind background download. On desktop the share sheet
 * is intrusive and the download location is known, so it goes straight to disk.
 *
 * The platform gate is deliberate: desktop Chrome DOES implement
 * `navigator.share`/`canShare`, so feature detection alone would pop the share
 * sheet on desktop too. Gate on the device, not the capability.
 *
 * Falls back to anchor download when share is unavailable, the file isn't
 * shareable, or share fails for any reason other than the user dismissing it
 * (e.g. transient-activation loss after a long export → just download).
 */
export async function shareOrDownloadBlob(
  blob: Blob,
  filename: string,
  options: { title?: string; text?: string } = {}
): Promise<DownloadResult> {
  const isMobile = detectPlatform() !== "desktop";
  if (isMobile && navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: blob.type });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: options.title, text: options.text });
        return { success: true, filename };
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return { success: true, filename };
      }
      // fall through to anchor download
    }
  }

  return anchorDownload(blob, filename);
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
