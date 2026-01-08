/**
 * Write Tab Domain Types
 *
 * Types and utilities for the Write/Act management feature.
 * Acts are collections of sequences that can be performed together with music.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

// ============================================================================
// ACT TYPES
// ============================================================================

/**
 * Music file metadata for an act
 */
export interface MusicFile {
  name: string;
  path: string;
  duration?: number;
  format?: string;
}

/**
 * Full act data including sequences and metadata
 */
export interface ActData {
  id: string;
  name: string;
  description?: string;
  sequences: SequenceData[];
  musicFile?: MusicFile;
  metadata: {
    created: Date;
    modified: Date;
  };
  filePath?: string;
}

/**
 * Thumbnail/preview info for displaying act in lists
 */
export interface ActThumbnailInfo {
  id: string;
  name: string;
  description?: string;
  filePath: string;
  sequenceCount: number;
  hasMusic: boolean;
  lastModified: Date;
}

// ============================================================================
// MUSIC PLAYER TYPES
// ============================================================================

/**
 * State for the music player component
 */
export interface MusicPlayerState {
  isLoaded: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  filename?: string;
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a new empty act with default values
 */
export function createEmptyAct(): ActData {
  return {
    id: crypto.randomUUID(),
    name: "",
    description: "",
    sequences: [],
    metadata: {
      created: new Date(),
      modified: new Date(),
    },
  };
}

/**
 * Create default music player state
 */
export function createDefaultMusicPlayerState(): MusicPlayerState {
  return {
    isLoaded: false,
    isPlaying: false,
    isPaused: false,
    currentTime: 0,
    duration: 0,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format time in seconds to MM:SS format
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

/**
 * Generate a placeholder thumbnail for a sequence
 * Returns a data URL or placeholder path
 */
export function generateSequenceThumbnail(sequence: SequenceData): string {
  const DEFAULT_THUMBNAIL = "/static/thumbnails/default-sequence.png";
  // Return the first existing thumbnail if available
  if (sequence.thumbnails && sequence.thumbnails.length > 0) {
    return sequence.thumbnails[0] ?? DEFAULT_THUMBNAIL;
  }
  // Return a default placeholder
  return DEFAULT_THUMBNAIL;
}
