/**
 * Announcement Manager Contract
 *
 * CRUD operations for system announcements.
 */

import type { Announcement } from "../../domain/models/announcement-models";

export interface IAnnouncementManager {
  /**
   * Create a new announcement
   */
  createAnnouncement(
    announcement: Omit<Announcement, "id" | "createdAt">
  ): Promise<string>;

  /**
   * Update an existing announcement
   */
  updateAnnouncement(id: string, updates: Partial<Announcement>): Promise<void>;

  /**
   * Delete an announcement
   */
  deleteAnnouncement(id: string): Promise<void>;

  /**
   * Get all announcements (admin view)
   */
  getAllAnnouncements(): Promise<Announcement[]>;

  /**
   * Get active announcements for a user (excludes expired, applies targeting)
   */
  getActiveAnnouncementsForUser(userId: string): Promise<Announcement[]>;

  /**
   * Check if user has dismissed an announcement
   */
  hasUserDismissed(userId: string, announcementId: string): Promise<boolean>;

  /**
   * Mark announcement as dismissed for a user
   */
  dismissAnnouncement(userId: string, announcementId: string): Promise<void>;

  /**
   * Get undismissed modal announcements for a user
   */
  getUndismissedModalAnnouncements(userId: string): Promise<Announcement[]>;
}
