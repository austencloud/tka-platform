/**
 * Audio Storage Service Implementation
 *
 * Uploads and downloads audio files to/from Firebase Storage.
 */

import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  getMetadata,
} from "firebase/storage";
import { getAuth } from "firebase/auth";
import type { UploadProgress } from "./types";

/**
 * Get storage path for audio file
 */
function getStoragePath(trackId: string): string {
  const auth = getAuth();
  const userId = auth.currentUser?.uid;
  if (!userId) {
    throw new Error("User must be authenticated to upload audio");
  }
  return `users/${userId}/audio/${trackId}.mp3`;
}

export async function uploadAudioFile(
  trackId: string,
  audioBlob: Blob,
  onProgress?: (progress: UploadProgress) => void
): Promise<string> {
  try {
    const storage = getStorage();
    const storagePath = getStoragePath(trackId);
    const storageRef = ref(storage, storagePath);

    // Create upload task
    const uploadTask = uploadBytesResumable(storageRef, audioBlob, {
      contentType: audioBlob.type || "audio/mpeg",
      cacheControl: "public, max-age=31536000", // 1 year cache
    });

    return new Promise((resolve, reject) => {
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          // Progress updates
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          onProgress?.({
            progress,
            stage: "uploading",
            message: `Uploading to cloud... ${Math.round(progress)}%`,
          });
        },
        (error) => {
          // Error
          console.error("Upload failed:", error);
          onProgress?.({
            progress: 0,
            stage: "error",
            message: "Upload failed",
          });
          reject(error);
        },
        async () => {
          // Success
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            onProgress?.({
              progress: 100,
              stage: "complete",
              message: "Upload complete!",
            });
            resolve(downloadURL);
          } catch (err) {
            reject(err);
          }
        }
      );
    });
  } catch (error) {
    console.error("Upload error:", error);
    throw error;
  }
}

export async function downloadAudioFile(cloudUrl: string): Promise<Blob> {
  try {
    const response = await fetch(cloudUrl);

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    const blob = await response.blob();
    return blob;
  } catch (error) {
    console.error("Download error:", error);
    throw error;
  }
}

export async function deleteAudioFile(cloudUrl: string): Promise<void> {
  try {
    // Extract path from URL
    const storage = getStorage();
    const urlObj = new URL(cloudUrl);
    const pathMatch = urlObj.pathname.match(/\/o\/(.+?)(\?|$)/);

    if (!pathMatch) {
      throw new Error("Invalid storage URL");
    }

    const rawPath = pathMatch[1];
    if (!rawPath) {
      throw new Error("Invalid storage URL");
    }
    const path = decodeURIComponent(rawPath);
    const storageRef = ref(storage, path);

    await deleteObject(storageRef);
  } catch (error) {
    console.error("Delete error:", error);
    throw error;
  }
}

export async function hasAudioFile(trackId: string): Promise<boolean> {
  try {
    const storage = getStorage();
    const storagePath = getStoragePath(trackId);
    const storageRef = ref(storage, storagePath);

    await getMetadata(storageRef);
    return true;
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "storage/object-not-found"
    ) {
      return false;
    }
    throw error;
  }
}
