/**
 * IScreenshotUploadOrchestrator
 *
 * Coordinates uploading captured PNGs from disk (via dev server)
 * to Firebase Storage + Firestore so the gallery can display them.
 */

export interface UploadProgress {
  phase: "deduplicating" | "uploading" | "completed" | "failed";
  total: number;
  uploaded: number;
  skipped: number;
  failed: number;
  errors: string[];
  currentFile: string | null;
}

export interface IScreenshotUploadOrchestrator {
  /**
   * Upload captured PNGs to Firebase.
   * Fetches each file from /screenshots/captures/{filename},
   * deduplicates against recent Firestore entries, and uploads via ScreenshotUploader.
   */
  uploadCaptures(
    filenames: string[],
    onProgress: (progress: UploadProgress) => void
  ): Promise<UploadProgress>;
}
