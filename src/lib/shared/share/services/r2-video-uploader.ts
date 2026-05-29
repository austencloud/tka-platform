import { getErrorHandler } from "$lib/shared/application/getErrorHandler";
import { getUploadUrl, startMultipart, getPartUrl, completeMultipart, listParts, deleteByPrefix } from "./r2-presigner";
import { getAuthSync } from "$lib/shared/auth/firebase";
import type { ErrorHandler } from '$lib/shared/application/services/implementations/ErrorHandler'
import type { VideoUploadResult, UploadOptions, MultipartUploadState } from "./types";

const MULTIPART_THRESHOLD = 100 * 1024 * 1024;
const PART_SIZE = 10 * 1024 * 1024;
const MAX_CONCURRENT_PARTS = 3;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;
const STORAGE_KEY = "tka-multipart-uploads";
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

async function computeFileFingerprint(file: File | Blob): Promise<string> {
  const SAMPLE_SIZE = 1024 * 1024;
  const head = file.slice(0, SAMPLE_SIZE);
  const tail = file.slice(Math.max(0, file.size - SAMPLE_SIZE));
  const combined = new Blob([head, tail]);
  const buffer = await combined.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return (
    hashArray.map((b) => b.toString(16).padStart(2, "0")).join("") +
    `-${file.size}`
  );
}

function loadMultipartState(): Record<string, MultipartUploadState & { startedAt: number; fileName: string; fileSize: number }> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveMultipartState(
  fingerprint: string,
  state: MultipartUploadState & { startedAt: number; fileName: string; fileSize: number }
): void {
  const all = loadMultipartState();
  all[fingerprint] = state;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

function removeMultipartState(fingerprint: string): void {
  const all = loadMultipartState();
  delete all[fingerprint];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

function purgeStaleEntries(): void {
  const all = loadMultipartState();
  const now = Date.now();
  let changed = false;
  for (const [key, entry] of Object.entries(all)) {
    if (now - entry.startedAt > STALE_THRESHOLD_MS) {
      delete all[key];
      changed = true;
    }
  }
  if (changed) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }
}

function xhrPutOnce(
  url: string,
  body: Blob,
  contentType: string,
  options?: {
    onProgress?: (loaded: number, total: number) => void;
    signal?: AbortSignal;
  }
): Promise<{ etag: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (options?.signal) {
      if (options.signal.aborted) {
        reject(new DOMException("Upload aborted", "AbortError"));
        return;
      }
      options.signal.addEventListener("abort", () => {
        xhr.abort();
        reject(new DOMException("Upload aborted", "AbortError"));
      });
    }

    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", contentType);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && options?.onProgress) {
        options.onProgress(event.loaded, event.total);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader("ETag") || "";
        resolve({ etag });
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => {
      let host = "unknown";
      try { host = new URL(url).host; } catch { /* ignore */ }
      const err = new Error(
        `Network error during upload to ${host}. ` +
        `This usually means CORS is not configured on the R2 bucket to allow PUT from ${location.origin}. ` +
        `Check the bucket's CORS settings in the Cloudflare dashboard.`
      );
      (err as unknown as Record<string, unknown>).isNetworkError = true;
      reject(err);
    };
    xhr.ontimeout = () => {
      const err = new Error("Upload timed out");
      (err as unknown as Record<string, unknown>).isNetworkError = true;
      reject(err);
    };

    xhr.send(body);
  });
}

async function xhrPut(
  url: string,
  body: Blob,
  contentType: string,
  options?: {
    onProgress?: (loaded: number, total: number) => void;
    signal?: AbortSignal;
  }
): Promise<{ etag: string }> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await xhrPutOnce(url, body, contentType, options);
    } catch (error: unknown) {
      const errRecord = error as Record<string, unknown> | null;
      const isAbort = errRecord?.name === "AbortError";
      const isNetworkError = errRecord?.isNetworkError === true;
      const isLastAttempt = attempt === MAX_RETRIES - 1;

      if (isAbort || !isNetworkError || isLastAttempt) {
        throw error;
      }

      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
      console.warn(
        `R2 upload attempt ${attempt + 1}/${MAX_RETRIES} failed (network error), retrying in ${delay}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error("Upload failed after retries");
}

export class R2VideoUploader {
  constructor() {
    if (typeof window !== "undefined") {
      purgeStaleEntries();
    }
  }

  private getUserId(): string {
    const user = getAuthSync().currentUser;
    if (!user) {
      throw new Error("User must be authenticated to upload");
    }
    return user.uid;
  }

  private handleError(error: unknown, action: string, additionalData?: Record<string, unknown>): never {
    console.error(`R2VideoUploader: Failed to ${action}:`, error);
    const errorHandler = getErrorHandler() as ErrorHandler;
    errorHandler.showUserError({
      message: `Couldn't ${action.replace(/-/g, " ")}`,
      technicalDetails: error instanceof Error ? error.message : String(error),
      error: error instanceof Error ? error : new Error(String(error)),
      severity: "error",
      context: {
        module: "share",
        action,
        additionalData,
      },
    });
    throw error;
  }

  private async uploadSingle(
    fileName: string,
    contentType: string,
    file: File | Blob,
    userId: string,
    category: string,
    sequenceId: string,
    options?: UploadOptions
  ): Promise<VideoUploadResult> {
    const { presignedUrl, publicUrl, key } = await getUploadUrl({
      fileName,
      contentType,
      contentLength: file.size,
      userId,
      category,
      sequenceId,
    });

    await xhrPut(presignedUrl, file, contentType, {
      onProgress: (loaded, total) => {
        options?.onProgress?.(Math.round((loaded / total) * 100));
      },
      signal: options?.signal,
    });

    return { url: publicUrl, key };
  }

  private async uploadMultipart(
    fileName: string,
    contentType: string,
    file: File | Blob,
    userId: string,
    category: string,
    sequenceId: string,
    options?: UploadOptions
  ): Promise<VideoUploadResult> {
    const totalParts = Math.ceil(file.size / PART_SIZE);
    const fingerprint = await computeFileFingerprint(file instanceof File ? file : new File([file], "blob"));

    let savedState = loadMultipartState()[fingerprint] as (MultipartUploadState & { startedAt: number; fileName: string; fileSize: number }) | undefined;
    let uploadId: string;
    let key: string;
    let completedParts: Array<{ ETag: string; PartNumber: number }> = [];

    if (savedState && !savedState.startedAt) {
      removeMultipartState(fingerprint);
      savedState = undefined;
    }

    if (savedState) {
      const { parts: confirmedParts, expired } = await listParts({
        key: savedState.key,
        uploadId: savedState.uploadId,
      });

      if (expired) {
        removeMultipartState(fingerprint);
        const startResult = await startMultipart({ fileName, contentType, userId, category, sequenceId });
        uploadId = startResult.uploadId;
        key = startResult.key;
      } else {
        uploadId = savedState.uploadId;
        key = savedState.key;
        completedParts = confirmedParts.map((p) => ({
          ETag: p.ETag,
          PartNumber: p.PartNumber,
        }));
      }
    } else {
      const startResult = await startMultipart({
        fileName,
        contentType,
        userId,
        category,
        sequenceId,
      });
      uploadId = startResult.uploadId;
      key = startResult.key;
    }

    const completedPartNumbers = new Set(completedParts.map((p) => p.PartNumber));
    const missingParts: number[] = [];
    for (let i = 1; i <= totalParts; i++) {
      if (!completedPartNumbers.has(i)) {
        missingParts.push(i);
      }
    }

    const partProgress = new Map<number, number>();
    const totalBytes = file.size;
    let completedBytes = 0;
    for (const pn of completedPartNumbers) {
      const start = (pn - 1) * PART_SIZE;
      const end = Math.min(start + PART_SIZE, file.size);
      completedBytes += end - start;
    }

    const updateOverallProgress = () => {
      let current = completedBytes;
      for (const bytes of partProgress.values()) {
        current += bytes;
      }
      options?.onProgress?.(Math.round((current / totalBytes) * 100));
    };

    const uploadPart = async (partNumber: number) => {
      const start = (partNumber - 1) * PART_SIZE;
      const end = Math.min(start + PART_SIZE, file.size);
      const chunk = file.slice(start, end);

      const { presignedUrl } = await getPartUrl({
        key,
        uploadId,
        partNumber,
      });

      const { etag } = await xhrPut(presignedUrl, chunk, contentType, {
        onProgress: (loaded) => {
          partProgress.set(partNumber, loaded);
          updateOverallProgress();
        },
        signal: options?.signal,
      });

      partProgress.delete(partNumber);
      completedBytes += end - start;

      const part = { ETag: etag, PartNumber: partNumber };
      completedParts.push(part);

      saveMultipartState(fingerprint, {
        uploadId,
        key,
        completedParts,
        totalParts,
        partSize: PART_SIZE,
        startedAt: savedState?.startedAt ?? Date.now(),
        fileName: file instanceof File ? file.name : "blob",
        fileSize: file.size,
      });
    };

    const queue = [...missingParts];
    const workers: Promise<void>[] = [];

    for (let i = 0; i < Math.min(MAX_CONCURRENT_PARTS, queue.length); i++) {
      workers.push(
        (async () => {
          while (queue.length > 0) {
            const partNumber = queue.shift()!;
            await uploadPart(partNumber);
          }
        })()
      );
    }

    await Promise.all(workers);

    completedParts.sort((a, b) => a.PartNumber - b.PartNumber);

    const { publicUrl } = await completeMultipart({
      key,
      uploadId,
      parts: completedParts,
    });

    removeMultipartState(fingerprint);

    return { url: publicUrl, key };
  }

  async uploadPerformanceVideo(
    sequenceId: string,
    videoFile: File | Blob,
    options?: UploadOptions
  ): Promise<VideoUploadResult> {
    try {
      const userId = this.getUserId();
      const timestamp = Date.now();
      const extension =
        videoFile instanceof File
          ? videoFile.name.split(".").pop() || "mp4"
          : "mp4";
      const fileName = `${timestamp}.${extension}`;
      const contentType = videoFile.type || "video/mp4";

      if (videoFile.size >= MULTIPART_THRESHOLD) {
        return await this.uploadMultipart(
          fileName, contentType, videoFile, userId, "recordings", sequenceId, options
        );
      }
      return await this.uploadSingle(
        fileName, contentType, videoFile, userId, "recordings", sequenceId, options
      );
    } catch (error) {
      if ((error as Error).name === "AbortError") throw error;
      return this.handleError(error, "upload-video", { sequenceId });
    }
  }

  async uploadAnimatedSequence(
    sequenceId: string,
    animationBlob: Blob,
    format: "webp" | "gif",
    options?: UploadOptions
  ): Promise<VideoUploadResult> {
    try {
      const userId = this.getUserId();
      const fileName = `sequence.${format}`;
      const contentType = format === "webp" ? "image/webp" : "image/gif";

      return await this.uploadSingle(
        fileName, contentType, animationBlob, userId, "animations", sequenceId, options
      );
    } catch (error) {
      if ((error as Error).name === "AbortError") throw error;
      return this.handleError(error, "upload-animation", { sequenceId, format });
    }
  }

  async deleteSequenceAssets(sequenceId: string): Promise<void> {
    try {
      const userId = this.getUserId();
      const prefixes = [
        `users/${userId}/recordings/${sequenceId}/`,
        `users/${userId}/animations/${sequenceId}/`,
        `users/${userId}/thumbnails/${sequenceId}/`,
      ];
      await Promise.all(
        prefixes.map((prefix) => deleteByPrefix(prefix))
      );
    } catch (error) {
      return this.handleError(error, "delete-assets", { sequenceId });
    }
  }

  getPublicUrl(key: string): string {
    const baseUrl = import.meta.env.VITE_R2_PUBLIC_URL || "";
    return `${baseUrl}/${key}`;
  }

  async uploadVideoThumbnail(
    sequenceId: string,
    thumbnailBlob: Blob,
    videoTimestamp: number,
    options?: UploadOptions
  ): Promise<VideoUploadResult> {
    try {
      const userId = this.getUserId();
      const fileName = `${videoTimestamp}_thumb.jpg`;
      const contentType = "image/jpeg";

      return await this.uploadSingle(
        fileName, contentType, thumbnailBlob, userId, "thumbnails", sequenceId, options
      );
    } catch (error) {
      if ((error as Error).name === "AbortError") throw error;
      return this.handleError(error, "upload-thumbnail", { sequenceId });
    }
  }

  async uploadSequenceThumbnail(
    sequenceId: string,
    thumbnailBlob: Blob,
    format: "png" | "jpeg" | "webp" = "png",
    options?: UploadOptions
  ): Promise<VideoUploadResult> {
    try {
      const userId = this.getUserId();
      const fileName = `thumbnail.${format}`;
      const contentTypeMap: Record<string, string> = {
        png: "image/png",
        jpeg: "image/jpeg",
        webp: "image/webp",
      };
      const contentType = contentTypeMap[format] ?? "image/png";

      return await this.uploadSingle(
        fileName, contentType, thumbnailBlob, userId, "thumbnails", sequenceId, options
      );
    } catch (error) {
      if ((error as Error).name === "AbortError") throw error;
      console.error("R2VideoUploader: Failed to upload-thumbnail:", error);
      throw error;
    }
  }
}
