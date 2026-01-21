/**
 * Interface for persisting video curator data to Firestore
 */
import type { ShowcaseVideo, VideoCategory, UserProfile } from "../../types";

export interface VideoUpdateData {
  title?: string | null;
  category?: string | null;
  tags?: string[];
  featured?: boolean;
  performerId?: string | null;
  performerName?: string | null;
  sequenceId?: string | null;
  sequenceWord?: string | null;
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
