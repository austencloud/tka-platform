/**
 * Interface for persisting video curator data to Firestore
 */
import type { VideoCategory, UserProfile, VideoPerformer, LinkedSequence, VideoCropData, VideoSnipData } from "../../types";

export interface VideoUpdateData {
  title?: string | null;
  category?: string | null;
  tags?: string[];
  featured?: boolean;
  performers?: VideoPerformer[];
  linkedSequences?: LinkedSequence[];
  excluded?: boolean;
  crop?: VideoCropData | null;
  snip?: VideoSnipData | null;
}

export interface IVideoCuratorPersister {
  /**
   * Save categories to config
   */
  saveCategories(categories: VideoCategory[]): Promise<void>;

  /**
   * Save quick performers to config
   */
  saveQuickPerformers(performers: UserProfile[]): Promise<void>;

  /**
   * Update a video's data
   */
  updateVideo(shortcode: string, updates: VideoUpdateData): Promise<void>;

  /**
   * Toggle a video's featured status
   */
  toggleFeatured(shortcode: string, newValue: boolean): Promise<void>;
}
