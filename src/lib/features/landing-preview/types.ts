/**
 * Shared types for the landing-preview feature
 */

export interface VideoPerformer {
  id: string;
  displayName: string;
  /** If true, this is an external performer not yet in the system */
  isExternal?: boolean;
  /** Instagram handle for external performers (without @) */
  instagramHandle?: string;
}

export interface VideoCategory {
  id: string;
  label: string;
  color: string;
}

export interface UserProfile {
  id: string;
  displayName: string;
  avatarUrl?: string;
}

export interface MatchedSequence {
  id: string;
  word: string;
  name: string;
  ownerId: string;
  ownerName: string;
  thumbnail: string | null;
  isPublic: boolean;
}

/**
 * A sequence linked to a video for curation
 */
export interface LinkedSequence {
  id: string;
  word: string;
  thumbnail: string | null;
  ownerName: string;
}

export type AspectRatioPreset =
  | "16:9"
  | "1:1"
  | "9:16"
  | "4:5"
  | "original";

export const ASPECT_RATIO_VALUES: Record<Exclude<AspectRatioPreset, "original">, number> = {
  "16:9": 16 / 9,
  "1:1": 1,
  "9:16": 9 / 16,
  "4:5": 4 / 5,
};

/**
 * Normalized crop data for video display
 * All position values are normalized (0-1) relative to video dimensions
 */
export interface VideoCropData {
  /** Normalized pan offset from center (-0.5 to 0.5) */
  position: { x: number; y: number };
  /** Zoom scale (1.0 = no zoom, 2.0 = 2x zoom) */
  scale: number;
  /** Target aspect ratio (e.g., 1.0 for 1:1, 1.777 for 16:9) */
  aspect: number;
  /** Human-readable aspect label */
  aspectLabel: AspectRatioPreset;
}

/**
 * Snip data for video timeline trimming
 * All times are in seconds (not normalized) for precision
 */
export interface VideoSnipData {
  /** Start time in seconds */
  inPoint: number;
  /** End time in seconds */
  outPoint: number;
  /** Original video duration (for validation) */
  duration: number;
}

export interface ShowcaseVideo {
  shortcode: string;
  videoUrl: string;
  instagramDate: Date | null;
  fileSize: number;
  category: string | null;
  tags: string[];
  featured: boolean;
  approved: boolean;
  linkedSequences: LinkedSequence[];
  title: string | null;
  description: string | null;
  performers: VideoPerformer[];
  excluded: boolean;
  crop?: VideoCropData;
  snip?: VideoSnipData;
}

export interface CurationProgress {
  current: number;
  total: number;
  done: number;
}

export interface LinkingProgress {
  current: number;
  total: number;
  linked: number;
}

export interface VideoStats {
  total: number;
  featured: number;
  categorized: number;
  uncategorized: number;
  withWord: number;
}

/**
 * Video editor overlay modes
 */
export type VideoEditorMode = "closed" | "browse" | "curate" | "link";
