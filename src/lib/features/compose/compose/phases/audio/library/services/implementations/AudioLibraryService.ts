/**
 * Audio Library Service Implementation
 *
 * Handles audio file uploads, local caching (IndexedDB), cloud storage, and Firestore sync.
 */

import { injectable, inject } from "inversify";
import type {
  IAudioLibrary,
  UploadResult,
  DownloadProgress,
} from "../contracts/IAudioLibrary";
import type { AudioTrackLocal } from "../../domain/models/AudioTrack";
import {
  saveAudio,
  loadAudio,
  hasAudio,
  deleteAudio,
  clearAllAudio,
  getAudioStorageSize,
} from "../../persistence/audio-library-persistence";
import {
  saveTrackMetadata,
  loadLibraryFromFirestore,
  deleteTrackMetadata,
  updateLastPlayed,
  updateTrackMetadata,
} from "../../persistence/audio-library-metadata-sync";
import type { IAudioStorageManager } from "../contracts/IAudioStorageManager";
import { AudioTypes } from "../../../../../../../../shared/inversify/types/audio.types";

/**
 * Generate unique track ID
 */
function generateTrackId(): string {
  return `upload-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Extract metadata from audio file
 */
async function extractAudioMetadata(file: File): Promise<{ duration: number }> {
  return new Promise((resolve) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);

    audio.addEventListener("loadedmetadata", () => {
      URL.revokeObjectURL(url);
      resolve({ duration: audio.duration || 0 });
    });

    audio.addEventListener("error", () => {
      URL.revokeObjectURL(url);
      // Default to 0 if can't read metadata
      resolve({ duration: 0 });
    });

    audio.src = url;
  });
}

@injectable()
export class AudioLibrary implements IAudioLibrary {
  private library: AudioTrackLocal[] = [];
  private libraryLoaded = false;

  constructor(
    @inject(AudioTypes.IAudioStorageManager)
    private audioStorage: IAudioStorageManager
  ) {}

  async uploadAudioFile(
    file: File,
    metadata?: { title?: string; artist?: string }
  ): Promise<UploadResult> {
    try {
      // Generate unique track ID
      const trackId = generateTrackId();

      // Extract duration from audio file
      const { duration } = await extractAudioMetadata(file);

      // Use provided metadata or extract from filename
      const title = metadata?.title || file.name.replace(/\.[^/.]+$/, ""); // Remove extension
      const artist = metadata?.artist || "Unknown Artist";

      // Save to IndexedDB first (fast, local)
      await saveAudio(trackId, file, {
        title,
        duration,
      });

      // Save metadata to Firestore (without cloudUrl yet)
      await saveTrackMetadata(trackId, {
        title,
        artist,
        duration,
        source: "upload",
        fileSize: file.size,
        originalFilename: file.name,
      });

      const track: AudioTrackLocal = {
        trackId,
        title,
        artist,
        duration,
        source: "upload",
        addedAt: new Date(),
        downloadCount: 1,
        fileSize: file.size,
        originalFilename: file.name,
        isLocallyAvailable: true,
      };

      // Update local library
      this.library = [
        track,
        ...this.library.filter((t) => t.trackId !== trackId),
      ];

      // Upload to cloud storage in the background (non-blocking)
      this.uploadToCloudBackground(trackId, file, title);

      return { success: true, track };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Upload failed:", error);
      return { success: false, error: message };
    }
  }

  /**
   * Upload to cloud storage in the background (non-blocking)
   */
  private async uploadToCloudBackground(
    trackId: string,
    file: File,
    _title: string
  ): Promise<void> {
    try {
      const cloudUrl = await this.audioStorage.uploadAudioFile(trackId, file);

      // Update Firestore metadata with cloudUrl
      await updateTrackMetadata(trackId, { cloudUrl });

      // Update local library
      const track = this.library.find((t) => t.trackId === trackId);
      if (track) {
        track.cloudUrl = cloudUrl;
      }
    } catch (error) {
      console.warn(
        "☁️ Background upload failed (local copy still available):",
        error
      );
      // Don't throw - local copy is still usable
    }
  }

  async getLibrary(): Promise<AudioTrackLocal[]> {
    if (!this.libraryLoaded) {
      await this.syncLibrary();
    }
    return this.library;
  }

  async loadLocalAudio(trackId: string): Promise<Blob | null> {
    const cached = await loadAudio(trackId);
    if (cached) {
      // Update last played in Firestore
      await updateLastPlayed(trackId).catch(() => {});
      return cached.blob;
    }
    return null;
  }

  async downloadFromCloud(
    trackId: string,
    cloudUrl: string,
    metadata: { title: string; duration: number },
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<Blob | null> {
    try {
      onProgress?.({
        stage: "downloading",
        progress: 10,
        message: "Downloading from cloud...",
      });

      // Download from cloud storage
      const audioBlob = await this.audioStorage.downloadAudioFile(cloudUrl);

      onProgress?.({
        stage: "caching",
        progress: 80,
        message: "Saving to local cache...",
      });

      // Save to IndexedDB for future instant access
      await saveAudio(trackId, audioBlob, {
        title: metadata.title,
        duration: metadata.duration,
      });

      onProgress?.({
        stage: "complete",
        progress: 100,
        message: "Ready to play!",
      });

      // Update local library availability
      const track = this.library.find((t) => t.trackId === trackId);
      if (track) {
        track.isLocallyAvailable = true;
      }

      return audioBlob;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Download failed";
      onProgress?.({
        stage: "error",
        progress: 0,
        message,
      });
      console.error("Download from cloud failed:", error);
      return null;
    }
  }

  async hasLocalAudio(trackId: string): Promise<boolean> {
    return hasAudio(trackId);
  }

  async removeFromLibrary(trackId: string): Promise<void> {
    // Delete from IndexedDB
    await deleteAudio(trackId).catch(() => {});

    // Delete from Firestore
    await deleteTrackMetadata(trackId);

    // Update local library
    this.library = this.library.filter((t) => t.trackId !== trackId);
  }

  async clearLocalCache(): Promise<number> {
    const freedBytes = await clearAllAudio();

    // Update local availability in library
    this.library = this.library.map((t) => ({
      ...t,
      isLocallyAvailable: false,
    }));

    return freedBytes;
  }

  async getLocalCacheSize(): Promise<number> {
    return getAudioStorageSize();
  }

  async syncLibrary(): Promise<void> {
    try {
      this.library = await loadLibraryFromFirestore();
      this.libraryLoaded = true;
    } catch (error) {
      console.warn("Failed to sync audio library:", error);
      // Keep existing library if sync fails
      this.libraryLoaded = true;
    }
  }

  async markAsPlayed(trackId: string): Promise<void> {
    await updateLastPlayed(trackId);

    // Update local library
    const track = this.library.find((t) => t.trackId === trackId);
    if (track) {
      track.lastPlayedAt = new Date();
    }
  }
}
