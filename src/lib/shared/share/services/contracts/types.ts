/**
 * Co-exported types from retired interface contracts.
 */


// === From ISharer ===

export type ImageGenerationProgressCallback = (progress: {
  current: number;
  total: number;
  stage: "preparing" | "rendering" | "finalizing";
}) => void;

// === From ISequenceImageSharer ===

export interface ShareResult {
  success: boolean;
  error?: Error;
}

// === From IVideoUploader ===

export interface VideoUploadResult {
  /** Public CDN URL for the uploaded file */
  url: string;
  /** R2 object key (for deletion) */
  key: string;
}
export interface UploadOptions {
  /** Progress callback, 0-100 */
  onProgress?: (percent: number) => void;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}
export interface MultipartUploadState {
  uploadId: string;
  key: string;
  completedParts: Array<{ ETag: string; PartNumber: number }>;
  totalParts: number;
  partSize: number;
}

