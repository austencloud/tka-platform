/**
 * Firebase Video Upload Service
 *
 * Handles uploading user performance videos to Firebase Storage.
 * Videos are stored at: users/{userId}/recordings/{sequenceId}/{timestamp}.mp4
 */

import type {
  IFirebaseVideoUploader,
  VideoUploadResult,
} from "../contracts/IFirebaseVideoUploader";
import { getStorageInstance, getAuthSync } from "$lib/shared/auth/firebase";
import { container } from "$lib/shared/di";
import type { IErrorHandler } from "$lib/shared/application/services/contracts/IErrorHandler";

export class FirebaseVideoUploader implements IFirebaseVideoUploader {
  /**
   * Get current user ID
   */
  private getUserId(): string {
    const user = getAuthSync().currentUser;
    if (!user) {
      throw new Error("User must be authenticated to upload videos");
    }
    return user.uid;
  }

  /**
   * Upload a performance video for a sequence
   */
  async uploadPerformanceVideo(
    sequenceId: string,
    videoFile: File | Blob,
    onProgress?: (percent: number) => void
  ): Promise<VideoUploadResult> {
    try {
      const { ref, uploadBytesResumable, getDownloadURL } =
        await import("firebase/storage");
      const storage = await getStorageInstance();
      const userId = this.getUserId();

      // Generate storage path: users/{userId}/recordings/{sequenceId}/{timestamp}.mp4
      const timestamp = Date.now();
      const extension =
        videoFile instanceof File
          ? videoFile.name.split(".").pop() || "mp4"
          : "mp4";
      const storagePath = `users/${userId}/recordings/${sequenceId}/${timestamp}.${extension}`;

      // Create storage reference
      const storageRef = ref(storage, storagePath);

      // Upload with progress tracking
      const uploadTask = uploadBytesResumable(storageRef, videoFile, {
        contentType: videoFile.type || "video/mp4",
        customMetadata: {
          sequenceId,
          userId,
          uploadedAt: new Date().toISOString(),
        },
      });

      // Return promise that resolves when upload completes
      return await new Promise((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            // Calculate progress percentage
            const progress =
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            onProgress?.(Math.round(progress));
          },
          (error) => {
            console.error("❌ Upload failed:", error);
            reject(error);
          },
          async () => {
            // Upload completed successfully
            try {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              resolve({ url, storagePath });
            } catch (error) {
              reject(error);
            }
          }
        );
      });
    } catch (error) {
      console.error("❌ FirebaseVideoUploader: Failed to upload video:", error);
      const errorHandler = container.items.errorHandler as IErrorHandler;
      errorHandler.showUserError({
        message: "Couldn't upload your video",
        technicalDetails: error instanceof Error ? error.message : String(error),
        error: error instanceof Error ? error : new Error(String(error)),
        severity: "error",
        context: {
          module: "share",
          action: "upload-video",
          additionalData: { sequenceId },
        },
      });
      throw error;
    }
  }

  /**
   * Upload animated sequence (WebP or GIF)
   */
  async uploadAnimatedSequence(
    sequenceId: string,
    animationBlob: Blob,
    format: "webp" | "gif"
  ): Promise<VideoUploadResult> {
    try {
      const { ref, uploadBytes, getDownloadURL } =
        await import("firebase/storage");
      const storage = await getStorageInstance();
      const userId = this.getUserId();

      // Storage path: users/{userId}/animations/{sequenceId}/sequence.{format}
      const storagePath = `users/${userId}/animations/${sequenceId}/sequence.${format}`;

      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, animationBlob, {
        contentType: format === "webp" ? "image/webp" : "image/gif",
        customMetadata: {
          sequenceId,
          userId,
          uploadedAt: new Date().toISOString(),
        },
      });

      const url = await getDownloadURL(storageRef);
      return { url, storagePath };
    } catch (error) {
      console.error("❌ FirebaseVideoUploader: Failed to upload animation:", error);
      const errorHandler = container.items.errorHandler as IErrorHandler;
      errorHandler.showUserError({
        message: "Couldn't upload your video",
        technicalDetails: error instanceof Error ? error.message : String(error),
        error: error instanceof Error ? error : new Error(String(error)),
        severity: "error",
        context: {
          module: "share",
          action: "upload-video",
          additionalData: { sequenceId, format },
        },
      });
      throw error;
    }
  }

  /**
   * Delete all assets for a sequence
   */
  async deleteSequenceAssets(sequenceId: string): Promise<void> {
    const { ref, listAll, deleteObject } = await import("firebase/storage");
    const storage = await getStorageInstance();
    const userId = this.getUserId();

    // Delete recordings
    const recordingsPath = `users/${userId}/recordings/${sequenceId}`;
    const recordingsRef = ref(storage, recordingsPath);

    try {
      const recordingsList = await listAll(recordingsRef);
      await Promise.all(recordingsList.items.map((item) => deleteObject(item)));
    } catch (error) {
      console.warn("Failed to delete recordings:", error);
    }

    // Delete animations
    const animationsPath = `users/${userId}/animations/${sequenceId}`;
    const animationsRef = ref(storage, animationsPath);

    try {
      const animationsList = await listAll(animationsRef);
      await Promise.all(animationsList.items.map((item) => deleteObject(item)));
    } catch (error) {
      console.warn("Failed to delete animations:", error);
    }
  }

  /**
   * Get public download URL for a storage path
   */
  async getPublicUrl(storagePath: string): Promise<string> {
    const { ref, getDownloadURL } = await import("firebase/storage");
    const storage = await getStorageInstance();
    const storageRef = ref(storage, storagePath);
    return getDownloadURL(storageRef);
  }

  /**
   * Upload a video thumbnail to Firebase Storage
   */
  async uploadVideoThumbnail(
    sequenceId: string,
    thumbnailBlob: Blob,
    videoTimestamp: number
  ): Promise<VideoUploadResult> {
    const { ref, uploadBytes, getDownloadURL } =
      await import("firebase/storage");
    const storage = await getStorageInstance();
    const userId = this.getUserId();

    // Storage path matches video path with _thumb suffix
    const storagePath = `users/${userId}/recordings/${sequenceId}/${videoTimestamp}_thumb.jpg`;

    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, thumbnailBlob, {
      contentType: "image/jpeg",
      customMetadata: {
        sequenceId,
        userId,
        videoTimestamp: videoTimestamp.toString(),
        uploadedAt: new Date().toISOString(),
      },
    });

    const url = await getDownloadURL(storageRef);
    return { url, storagePath };
  }

  /**
   * Upload a sequence thumbnail (static image) to Firebase Storage
   */
  async uploadSequenceThumbnail(
    sequenceId: string,
    thumbnailBlob: Blob,
    format: "png" | "jpeg" | "webp" = "png"
  ): Promise<VideoUploadResult> {
    try {
      const { ref, uploadBytes, getDownloadURL } =
        await import("firebase/storage");
      const storage = await getStorageInstance();
      const userId = this.getUserId();

      // Storage path: users/{userId}/thumbnails/{sequenceId}/thumbnail.{format}
      const storagePath = `users/${userId}/thumbnails/${sequenceId}/thumbnail.${format}`;

      const contentTypeMap = {
        png: "image/png",
        jpeg: "image/jpeg",
        webp: "image/webp",
      };

      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, thumbnailBlob, {
        contentType: contentTypeMap[format],
        customMetadata: {
          sequenceId,
          userId,
          uploadedAt: new Date().toISOString(),
        },
      });

      const url = await getDownloadURL(storageRef);
      return { url, storagePath };
    } catch (error) {
      console.error("❌ FirebaseVideoUploader: Failed to upload thumbnail:", error);
      const errorHandler = container.items.errorHandler as IErrorHandler;
      errorHandler.showUserError({
        message: "Couldn't upload your video",
        technicalDetails: error instanceof Error ? error.message : String(error),
        error: error instanceof Error ? error : new Error(String(error)),
        severity: "error",
        context: {
          module: "share",
          action: "upload-video",
          additionalData: { sequenceId, format },
        },
      });
      throw error;
    }
  }
}
