/**
 * onNotificationSync Cloud Function
 *
 * Keeps notification state in sync across a user's installed PWAs (prod +
 * dev + desktop). Every device receives its own FCM copy of each push, so
 * reading/clearing the inbox on one device used to leave stale shade
 * notifications and a stale badge on the others until they were opened.
 *
 * Fires on notification doc updates/deletes. When the user's unread
 * notification count reaches ZERO (inbox cleared), sends a data-only
 * "dismiss-all" push so every device closes its shade copies and syncs its
 * badge immediately. Only the zero transition sends — partial reads stay
 * quiet to preserve Chrome's silent-push budget (a non-displaying push is
 * only tolerated in limited quantity before Chrome shows a generic
 * "site updated in background" notification).
 *
 * Trigger path: users/{userId}/notifications/{notificationId}
 */

import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { sendDataToUser, getUnreadCount } from "./pushDispatcher";

const db = admin.firestore();

export const onNotificationSync = onDocumentWritten(
  "users/{userId}/notifications/{notificationId}",
  async (event) => {
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;

    // Creations are onNewNotification's job.
    if (!before) return;

    const wasRead = before.read === true;
    const isReadNow = after ? after.read === true : true; // deletion counts as read
    if (wasRead || !isReadNow) return; // only unread -> read/deleted transitions

    const { userId } = event.params;

    const unreadNotifications = await db
      .collection("users")
      .doc(userId)
      .collection("notifications")
      .where("read", "==", false)
      .count()
      .get()
      .then((s) => s.data().count);

    // Only the transition to a fully-cleared inbox broadcasts.
    if (unreadNotifications > 0) return;

    const totalUnread = await getUnreadCount(userId); // includes unread DMs
    await sendDataToUser(userId, {
      action: "dismiss-notifications",
      unreadCount: String(totalUnread),
    });
  }
);
