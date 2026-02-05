/**
 * Announcement Domain Models
 *
 * System announcements that admins can broadcast to users.
 */

/**
 * Target audience for announcements
 */
export type AnnouncementAudience =
  | "all" // All users
  | "beta" // Beta testers only
  | "new" // New users (< 30 days)
  | "active" // Active users (logged in within 7 days)
  | "creators" // Users who have created sequences
  | "admins" // Admin users only
  | "specific-user"; // Specific user by ID

/**
 * Announcement severity level
 */
export type AnnouncementSeverity = "info" | "warning" | "critical";

/**
 * System announcement
 * Stored in announcements/{announcementId}
 */
export interface Announcement {
  id: string;
  title: string; // Short title (e.g., "New Feature: Dark Mode")
  message: string; // Full message (supports markdown)
  severity: AnnouncementSeverity;
  targetAudience: AnnouncementAudience;

  // Display settings
  showAsModal: boolean; // Force modal display on first view

  // Timing
  createdAt: Date;
  createdBy: string; // Admin user ID
  expiresAt?: Date; // Optional expiration (auto-hide after this date)

  // Targeting
  targetUserId?: string; // Specific user ID (when targetAudience is "specific-user")

  // Metadata
  actionUrl?: string; // Optional link for "Learn More" button
  actionLabel?: string; // Custom label for action button (default: "Learn More")
}

/**
 * User's announcement dismissal tracking
 * Stored in users/{userId}/dismissedAnnouncements/{announcementId}
 */
export interface AnnouncementDismissal {
  announcementId: string;
  dismissedAt: Date;
}

/**
 * Default announcement for creation
 */
export const DEFAULT_ANNOUNCEMENT: Omit<
  Announcement,
  "id" | "createdAt" | "createdBy"
> = {
  title: "",
  message: "",
  severity: "info",
  targetAudience: "all",
  showAsModal: true,
};
