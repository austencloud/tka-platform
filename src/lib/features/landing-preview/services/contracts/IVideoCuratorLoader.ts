/**
 * Interface for loading video curator data from Firestore
 */
import type { ShowcaseVideo, VideoCategory, UserProfile } from "../../types";

export interface IVideoCuratorLoader {
  /**
   * Load all showcase videos ordered by Instagram date
   */
  loadVideos(): Promise<ShowcaseVideo[]>;

  /**
   * Load video categories from config
   */
  loadCategories(): Promise<VideoCategory[]>;

  /**
   * Load quick performers from config
   */
  loadQuickPerformers(): Promise<UserProfile[]>;
}
