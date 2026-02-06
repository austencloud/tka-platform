/**
 * Firebase Video Upload Service
 *
 * Purpose: Upload user performance videos and animated sequences to Firebase Storage.
 * Handles:
 * - Uploading performance videos from user's device to Firebase Storage
 * - Uploading animated WebP/GIF sequences generated from notation data
 * - Managing storage paths: users/{userId}/recordings|animations/{sequenceId}/
 * - Progress callbacks for upload UI
 * - Cleanup of orphaned files
 *
 * Why Firebase Storage:
 * - Already using Firebase/Firestore
 * - Cost-effective for video hosting (~$0.026/GB/month)
 * - Integrates with Firestore security rules
 * - CDN built-in
 *
 * Integration points:
 * - Call from SequencePersister when user saves sequence
 * - Call from Share flow before exporting to Instagram
 * - Referenced in SequenceData.performanceVideoUrl / animatedSequenceUrl
 */

/**
 * Result of a video upload operation
 */
export interface VideoUploadResult {
  /** Public download URL for the video */
  url: string;
  /** Firebase Storage path (for deletion) */
  storagePath: string;
}

export interface IFirebaseVideoUploader {
  /**
   * Upload a user's performance video to Firebase Storage
   *
   * @param sequenceId - The sequence this video belongs to
   * @param videoFile - The video file from user's device (via input[type=file])
   * @param onProgress - Optional callback for upload progress (0-100)
   * @returns Promise resolving to upload result with URL and storage path
   *
   * Storage path: users/{userId}/recordings/{sequenceId}/{timestamp}.mp4
   */
  uploadPerformanceVideo(
    sequenceId: string,
    videoFile: File | Blob,
    onProgress?: (percent: number) => void
  ): Promise<VideoUploadResult>;

  /**
   * Upload animated sequence (WebP or GIF) to Firebase Storage
   *
   * @param sequenceId - The sequence ID
   * @param animationBlob - The rendered animation blob (from canvas.toBlob)
   * @param format - 'webp' or 'gif'
   * @returns Promise resolving to upload result with URL and storage path
   *
   * Storage path: users/{userId}/animations/{sequenceId}/sequence.{format}
   */
  uploadAnimatedSequence(
    sequenceId: string,
    animationBlob: Blob,
    format: "webp" | "gif"
  ): Promise<VideoUploadResult>;

  /**
   * Delete all assets for a sequence (cleanup when sequence is deleted)
   *
   * @param sequenceId - The sequence ID to clean up
   *
   * TODO: Recursively delete folder: sequences/{userId}/{sequenceId}/
   */
  deleteSequenceAssets(sequenceId: string): Promise<void>;

  /**
   * Get a public download URL for a storage path
   * Needed for displaying videos in the app
   */
  getPublicUrl(storagePath: string): Promise<string>;

  /**
   * Upload a video thumbnail to Firebase Storage
   *
   * @param sequenceId - The sequence this thumbnail belongs to
   * @param thumbnailBlob - The thumbnail image blob (JPEG)
   * @param videoTimestamp - Timestamp of the video this thumbnail belongs to
   * @returns Promise resolving to upload result with URL and storage path
   *
   * Storage path: users/{userId}/recordings/{sequenceId}/{videoTimestamp}_thumb.jpg
   */
  uploadVideoThumbnail(
    sequenceId: string,
    thumbnailBlob: Blob,
    videoTimestamp: number
  ): Promise<VideoUploadResult>;

  /**
   * Upload a sequence thumbnail (static image) to Firebase Storage
   *
   * @param sequenceId - The sequence this thumbnail belongs to
   * @param thumbnailBlob - The thumbnail image blob (PNG or JPEG)
   * @param format - Image format ('png' or 'jpeg')
   * @returns Promise resolving to upload result with URL and storage path
   *
   * Storage path: users/{userId}/thumbnails/{sequenceId}/thumbnail.{format}
   */
  uploadSequenceThumbnail(
    sequenceId: string,
    thumbnailBlob: Blob,
    format?: "png" | "jpeg" | "webp"
  ): Promise<VideoUploadResult>;
}
