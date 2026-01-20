/**
 * Shared types for the landing-preview feature
 */

export interface ShowcaseVideo {
  shortcode: string;
  videoUrl: string;
  instagramDate: Date | null;
  fileSize: number;
  category: string | null;
  tags: string[];
  featured: boolean;
  approved: boolean;
  sequenceId: string | null;
  sequenceWord: string | null;
  title: string | null;
  description: string | null;
  performerId: string | null;
  performerName: string | null;
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
