/**
 * onNewNotification Cloud Function
 *
 * Firestore trigger that fires when a new notification is created
 * in a user's notifications subcollection. Sends a push notification
 * to the user's registered devices.
 *
 * Skips "message-received" type since that's handled by onNewMessage.
 *
 * Trigger path: users/{userId}/notifications/{notificationId}
 */

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import {
  sendPushToUser,
  shouldPushForType,
  getUnreadCount,
} from "./pushDispatcher";
import type { PushPayload } from "./types";

export const onNewNotification = onDocumentCreated(
  "users/{userId}/notifications/{notificationId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.warn("onNewNotification: No data in event");
      return;
    }

    const notificationData = snapshot.data();
    const { userId, notificationId } = event.params;

    const type: string = notificationData.type;
    const message: string = notificationData.message || "";
    const fromUserName: string | undefined = notificationData.fromUserName;

    // Skip message-received notifications - handled by onNewMessage
    if (type === "message-received") {
      return;
    }

    // Check user's preference for this notification type
    const shouldSend = await shouldPushForType(userId, type);
    if (!shouldSend) {
      return;
    }

    const unreadCount = await getUnreadCount(userId);

    // Build title from sender name or notification type
    const title = fromUserName || formatNotificationType(type);

    const payload: PushPayload = {
      title,
      body: message,
      url: "/app?tab=notifications",
      tag: `notification-${type}`,
      type,
      notificationId,
    };

    try {
      await sendPushToUser(userId, payload, unreadCount);
    } catch (error) {
      console.error(
        `onNewNotification: Failed to send push for ${type} to user ${userId}`,
        error
      );
    }
  }
);

/**
 * Convert a notification type slug to a readable title.
 * Used as fallback when fromUserName is not available.
 *
 * Examples:
 *   "feedback-resolved" -> "Feedback Resolved"
 *   "achievement-unlocked" -> "Achievement Unlocked"
 */
function formatNotificationType(type: string): string {
  return type
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
