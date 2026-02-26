/**
 * Push notification types for Cloud Functions
 *
 * Defines the data payload sent via FCM to client devices.
 * Uses data-only messages (no `notification` field) so the
 * service worker has full control over display and behavior.
 */

export interface PushPayload {
  /** Notification title shown to user */
  title: string;
  /** Notification body text */
  body: string;
  /** URL to navigate to when notification is clicked */
  url: string;
  /** Notification tag for collapsing duplicate notifications */
  tag: string;
  /** Notification type (maps to NotificationType on client) */
  type: string;
  /** Conversation ID for message notifications */
  conversationId?: string;
  /** Notification document ID for notification-type pushes */
  notificationId?: string;
}
