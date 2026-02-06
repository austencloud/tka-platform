/**
 * Helper to create a CollaborativeVideo from an upload result
 *
 * Bridges the gap between FirebaseVideoUploader (raw upload)
 * and CollaborativeVideoManager (collaborative metadata).
 */

import type { VideoUploadResult } from "$lib/shared/share/services/contracts/IFirebaseVideoUploader";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import {
  createCollaborativeVideo,
  type CollaborativeVideo,
  type VideoVisibility,
} from "../domain/CollaborativeVideo";

export interface CreateVideoFromUploadOptions {
  /** The upload result from FirebaseVideoUploader */
  uploadResult: VideoUploadResult;
  /** The sequence this video performs */
  sequence: SequenceData;
  /** Video duration in seconds */
  duration: number;
  /** Video file size in bytes */
  fileSize: number;
  /** Video MIME type */
  mimeType: string;
  /** Creator's user ID */
  creatorId: string;
  /** Creator's display name (for quick display) */
  creatorDisplayName?: string;
  /** Creator's avatar URL */
  creatorAvatarUrl?: string;
  /** Initial visibility */
  visibility?: VideoVisibility;
  /** Optional description */
  description?: string;
  /** Optional thumbnail URL */
  thumbnailUrl?: string;
}

/**
 * Create a CollaborativeVideo from upload results
 *
 * Use this after uploading a video with FirebaseVideoUploader
 * to create the collaborative metadata structure.
 *
 * @example
 * ```ts
 * // 1. Upload the video file
 * const uploadResult = await videoUploadService.uploadPerformanceVideo(
 *   sequence.id,
 *   videoFile
 * );
 *
 * // 2. Create collaborative video metadata
 * const video = createVideoFromUpload({
 *   uploadResult,
 *   sequence,
 *   duration: 30,
 *   fileSize: videoFile.size,
 *   mimeType: videoFile.type,
 *   creatorId: currentUser.uid,
 *   creatorDisplayName: currentUser.displayName,
 * });
 *
 * // 3. Save to Firestore
 * await collaborativeVideoService.saveVideo(video);
 * ```
 */
export function createVideoFromUpload(
  options: CreateVideoFromUploadOptions
): CollaborativeVideo {
  const {
    uploadResult,
    sequence,
    duration,
    fileSize,
    mimeType,
    creatorId,
    creatorDisplayName,
    creatorAvatarUrl,
    visibility = "public",
    description,
    thumbnailUrl,
  } = options;

  return createCollaborativeVideo(
    {
      videoUrl: uploadResult.url,
      storagePath: uploadResult.storagePath,
      thumbnailUrl,
      duration,
      fileSize,
      mimeType,
      sequenceId: sequence.id,
      sequenceName: sequence.name || sequence.word,
      sequenceOwnerId: sequence.ownerId,
      creatorId,
      visibility,
      description,
    },
    creatorDisplayName,
    creatorAvatarUrl
  );
}

/**
 * Get video metadata from a File object
 *
 * Extracts duration using video element.
 * Useful before calling createVideoFromUpload.
 */
export async function getVideoFileMetadata(
  file: File
): Promise<{ duration: number; fileSize: number; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve({
        duration: video.duration,
        fileSize: file.size,
        mimeType: file.type || "video/mp4",
      });
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error("Failed to load video metadata"));
    };

    video.src = URL.createObjectURL(file);
  });
}
