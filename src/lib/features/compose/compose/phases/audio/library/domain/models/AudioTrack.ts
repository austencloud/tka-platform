/**
 * Audio Track Models
 *
 * Represents audio files in the user's library.
 */

export type AudioSource = "upload" | "spotify";

/**
 * Audio track stored in Firestore (without local availability info)
 */
export interface AudioTrack {
  /** Unique track ID (generated UUID for uploads) */
  trackId: string;

  /** Display title */
  title: string;

  /** Artist or channel name */
  artist: string;

  /** Thumbnail/album art URL (optional) */
  thumbnailUrl?: string;

  /** Duration in seconds */
  duration: number;

  /** File size in bytes (if known) */
  fileSize?: number;

  /** Audio source */
  source: AudioSource;

  /** When added to library */
  addedAt: Date;

  /** Last time this track was played */
  lastPlayedAt?: Date;

  /** How many times downloaded/loaded */
  downloadCount?: number;

  /** BPM (if analyzed) */
  bpm?: number;

  /** Original filename (for uploads) */
  originalFilename?: string;

  /** Cloud storage URL (Firebase Storage) */
  cloudUrl?: string;
}

/**
 * Audio track with local availability status
 */
export interface AudioTrackLocal extends AudioTrack {
  /** Whether the audio file is cached locally in IndexedDB */
  isLocallyAvailable: boolean;
}

/**
 * Convert Firestore track to local track with availability check
 */
export function toLocalTrack(
  track: AudioTrack,
  isLocallyAvailable: boolean
): AudioTrackLocal {
  return {
    ...track,
    isLocallyAvailable,
  };
}
