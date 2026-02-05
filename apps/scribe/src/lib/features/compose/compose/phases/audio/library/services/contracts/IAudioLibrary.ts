/**
 * Audio Library Contract
 *
 * Manages user's audio library with local caching and cloud sync.
 */

import type { AudioTrackLocal } from "../../domain/models/AudioTrack";

export interface UploadResult {
  success: boolean;
  track?: AudioTrackLocal;
  error?: string;
}

export interface DownloadProgress {
  stage: "downloading" | "caching" | "complete" | "error";
  progress: number;
  message?: string;
}

export interface IAudioLibrary {
  /**
   * Upload and save an audio file to the library
   * @param file Audio file from user's device
   * @param metadata Optional metadata (title, artist)
   */
  uploadAudioFile(
    file: File,
    metadata?: {
      title?: string;
      artist?: string;
    }
  ): Promise<UploadResult>;

  /**
   * Get all tracks in the library
   */
  getLibrary(): Promise<AudioTrackLocal[]>;

  /**
   * Load audio blob from local cache
   */
  loadLocalAudio(trackId: string): Promise<Blob | null>;

  /**
   * Download audio from cloud and cache locally
   * @param trackId Track identifier
   * @param cloudUrl Cloud storage URL
   * @param onProgress Optional progress callback
   */
  downloadFromCloud(
    trackId: string,
    cloudUrl: string,
    metadata: { title: string; duration: number },
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<Blob | null>;

  /**
   * Check if audio is available locally
   */
  hasLocalAudio(trackId: string): Promise<boolean>;

  /**
   * Remove track from library (both local and cloud)
   */
  removeFromLibrary(trackId: string): Promise<void>;

  /**
   * Clear all local cached audio
   */
  clearLocalCache(): Promise<number>;

  /**
   * Get size of local audio cache in bytes
   */
  getLocalCacheSize(): Promise<number>;

  /**
   * Sync library metadata from Firestore
   */
  syncLibrary(): Promise<void>;

  /**
   * Mark track as played (updates last played timestamp)
   */
  markAsPlayed(trackId: string): Promise<void>;
}
