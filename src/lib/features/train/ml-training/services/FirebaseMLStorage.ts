/**
 * Firebase ML Storage Service
 *
 * Syncs ML training data to Firebase Storage for:
 * - Cross-device access
 * - Colab training notebook integration
 * - Persistent backup
 *
 * Uses hybrid approach:
 * - IndexedDB for fast local capture
 * - Background sync to Firebase after capture
 */

import { getStorageInstance, getAuthSync } from "$lib/shared/auth/firebase";
import type { FirebaseStorage } from "firebase/storage";
import type { CaptureSession, CapturedFrame } from "../domain/models";

// Storage paths
const ML_TRAINING_ROOT = "ml-training";

export type SyncStatus = "pending" | "syncing" | "synced" | "error";

export interface SyncProgress {
  sessionId: string;
  status: SyncStatus;
  progress: number; // 0-100
  totalFrames: number;
  syncedFrames: number;
  error?: string;
}

export interface FirebaseMLStorageManager {
  /**
   * Upload a complete session with all frames to Firebase Storage
   */
  uploadSession(
    session: CaptureSession,
    frames: CapturedFrame[],
    getImageBlob: (imageKey: string) => Promise<Blob | null>,
    onProgress?: (progress: SyncProgress) => void
  ): Promise<string>;

  /**
   * Download a session from Firebase Storage
   */
  downloadSession(sessionId: string): Promise<{
    session: CaptureSession;
    frames: CapturedFrame[];
    images: Map<string, Blob>;
  } | null>;

  /**
   * List all sessions in Firebase Storage
   */
  listCloudSessions(): Promise<
    Array<{
      sessionId: string;
      name: string;
      createdAt: Date;
      frameCount: number;
      propType: string;
    }>
  >;

  /**
   * Delete a session from Firebase Storage
   */
  deleteCloudSession(sessionId: string): Promise<void>;

  /**
   * Check if session exists in cloud
   */
  isSessionSynced(sessionId: string): Promise<boolean>;

  /**
   * Get sync status for a session
   */
  getSyncStatus(sessionId: string): Promise<SyncStatus>;
}

/**
 * Create the Firebase ML Storage Service
 */
export function createFirebaseMLStorageManager(): FirebaseMLStorageManager {
  let storage: FirebaseStorage | null = null;

  async function getStorage(): Promise<FirebaseStorage> {
    if (!storage) {
      storage = await getStorageInstance();
    }
    return storage;
  }

  function getUserId(): string {
    const user = getAuthSync().currentUser;
    if (!user) {
      throw new Error("User must be authenticated to sync ML training data");
    }
    return user.uid;
  }

  function getSessionPath(sessionId: string): string {
    return `${ML_TRAINING_ROOT}/${getUserId()}/sessions/${sessionId}`;
  }

  return {
    async uploadSession(
      session: CaptureSession,
      frames: CapturedFrame[],
      getImageBlob: (imageKey: string) => Promise<Blob | null>,
      onProgress?: (progress: SyncProgress) => void
    ): Promise<string> {
      const { ref, uploadBytes, getDownloadURL } =
        await import("firebase/storage");
      const firebaseStorage = await getStorage();
      const basePath = getSessionPath(session.id);

      const progress: SyncProgress = {
        sessionId: session.id,
        status: "syncing",
        progress: 0,
        totalFrames: frames.length,
        syncedFrames: 0,
      };

      onProgress?.(progress);

      try {
        // Upload session metadata
        const sessionMetadata = {
          ...session,
          syncedAt: new Date().toISOString(),
          frameCount: frames.length,
        };
        const metadataRef = ref(firebaseStorage, `${basePath}/metadata.json`);
        const metadataBlob = new Blob([JSON.stringify(sessionMetadata)], {
          type: "application/json",
        });
        await uploadBytes(metadataRef, metadataBlob);

        // Upload frames metadata
        const framesMetadataRef = ref(
          firebaseStorage,
          `${basePath}/frames.json`
        );
        const framesBlob = new Blob([JSON.stringify(frames)], {
          type: "application/json",
        });
        await uploadBytes(framesMetadataRef, framesBlob);

        // Upload frame images
        for (let i = 0; i < frames.length; i++) {
          const frame = frames[i];
          if (!frame?.imageKey) continue;

          const imageBlob = await getImageBlob(frame.imageKey);
          if (!imageBlob) continue;

          const imageRef = ref(
            firebaseStorage,
            `${basePath}/images/${frame.id}.jpg`
          );
          await uploadBytes(imageRef, imageBlob, { contentType: "image/jpeg" });

          progress.syncedFrames = i + 1;
          progress.progress = Math.round(((i + 1) / frames.length) * 100);
          onProgress?.(progress);
        }

        progress.status = "synced";
        progress.progress = 100;
        onProgress?.(progress);

        // Return the download URL for the session
        return await getDownloadURL(metadataRef);
      } catch (error) {
        progress.status = "error";
        progress.error =
          error instanceof Error ? error.message : "Upload failed";
        onProgress?.(progress);
        throw error;
      }
    },

    async downloadSession(sessionId: string): Promise<{
      session: CaptureSession;
      frames: CapturedFrame[];
      images: Map<string, Blob>;
    } | null> {
      const { ref, getBlob, listAll } = await import("firebase/storage");
      const firebaseStorage = await getStorage();
      const basePath = getSessionPath(sessionId);

      try {
        // Download metadata
        const metadataRef = ref(firebaseStorage, `${basePath}/metadata.json`);
        const metadataBlob = await getBlob(metadataRef);
        const session: CaptureSession = JSON.parse(await metadataBlob.text());

        // Download frames metadata
        const framesRef = ref(firebaseStorage, `${basePath}/frames.json`);
        const framesBlob = await getBlob(framesRef);
        const frames: CapturedFrame[] = JSON.parse(await framesBlob.text());

        // Download images
        const imagesRef = ref(firebaseStorage, `${basePath}/images`);
        const imagesList = await listAll(imagesRef);
        const images = new Map<string, Blob>();

        for (const imageItemRef of imagesList.items) {
          const imageBlob = await getBlob(imageItemRef);
          const frameId = imageItemRef.name.replace(".jpg", "");
          images.set(frameId, imageBlob);
        }

        return { session, frames, images };
      } catch (error) {
        console.error("Failed to download session:", error);
        return null;
      }
    },

    async listCloudSessions(): Promise<
      Array<{
        sessionId: string;
        name: string;
        createdAt: Date;
        frameCount: number;
        propType: string;
      }>
    > {
      const { ref, listAll, getBlob } = await import("firebase/storage");
      const firebaseStorage = await getStorage();
      const sessionsPath = `${ML_TRAINING_ROOT}/${getUserId()}/sessions`;
      const sessionsRef = ref(firebaseStorage, sessionsPath);

      try {
        const result = await listAll(sessionsRef);
        const sessions: Array<{
          sessionId: string;
          name: string;
          createdAt: Date;
          frameCount: number;
          propType: string;
        }> = [];

        for (const folder of result.prefixes) {
          try {
            const metadataRef = ref(
              firebaseStorage,
              `${folder.fullPath}/metadata.json`
            );
            const metadataBlob = await getBlob(metadataRef);
            const metadata = JSON.parse(await metadataBlob.text());

            sessions.push({
              sessionId: folder.name,
              name: metadata.name || folder.name,
              createdAt: new Date(metadata.createdAt),
              frameCount: metadata.frameCount || 0,
              propType: metadata.propType || "unknown",
            });
          } catch {
            // Skip sessions with missing metadata
            console.warn(`Skipping session ${folder.name} - missing metadata`);
          }
        }

        return sessions.sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        );
      } catch (error) {
        console.error("Failed to list cloud sessions:", error);
        return [];
      }
    },

    async deleteCloudSession(sessionId: string): Promise<void> {
      const { ref, listAll, deleteObject } = await import("firebase/storage");
      const firebaseStorage = await getStorage();
      const basePath = getSessionPath(sessionId);

      try {
        // Delete all files in the session folder
        const folderRef = ref(firebaseStorage, basePath);
        const result = await listAll(folderRef);

        // Delete files
        for (const item of result.items) {
          await deleteObject(item);
        }

        // Delete images subfolder
        const imagesRef = ref(firebaseStorage, `${basePath}/images`);
        const imagesResult = await listAll(imagesRef);
        for (const item of imagesResult.items) {
          await deleteObject(item);
        }
      } catch (error) {
        console.error("Failed to delete cloud session:", error);
        throw error;
      }
    },

    async isSessionSynced(sessionId: string): Promise<boolean> {
      const { ref, getMetadata } = await import("firebase/storage");
      const firebaseStorage = await getStorage();
      const metadataPath = `${getSessionPath(sessionId)}/metadata.json`;

      try {
        const metadataRef = ref(firebaseStorage, metadataPath);
        await getMetadata(metadataRef);
        return true;
      } catch {
        return false;
      }
    },

    async getSyncStatus(sessionId: string): Promise<SyncStatus> {
      const isSynced = await this.isSessionSynced(sessionId);
      return isSynced ? "synced" : "pending";
    },
  };
}

// Singleton instance
let serviceInstance: FirebaseMLStorageManager | null = null;

export function getFirebaseMLStorageManager(): FirebaseMLStorageManager {
  if (!serviceInstance) {
    serviceInstance = createFirebaseMLStorageManager();
  }
  return serviceInstance;
}
