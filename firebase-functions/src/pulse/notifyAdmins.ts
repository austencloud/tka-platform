/**
 * notifyAdmins — shared helper for Pulse activity alerts.
 *
 * Writes a notification doc to every admin's users/{uid}/notifications
 * subcollection via the Admin SDK. The existing onNewNotification trigger
 * then delivers FCM push to their devices.
 *
 * Why server-side: the old client-side admin-notifier ran in the ACTING
 * user's browser, and firestore.rules correctly denies a non-admin writing
 * into another user's notifications subcollection — so every signup
 * notification since launch was silently swallowed. The Admin SDK bypasses
 * rules, which is exactly right here.
 */

import * as admin from "firebase-admin";

const db = admin.firestore();

/** Pulse notification type → preference key on users/{uid}.notificationPreferences */
const PULSE_PREF_KEYS: Record<string, string> = {
  "admin-new-user-signup": "adminNewUserSignup",
  "admin-user-returned": "adminUserReturned",
  "admin-qr-scan": "adminQrScan",
  "admin-content-created": "adminContentCreated",
};

export interface AdminNotificationInput {
  type: string;
  message: string;
  /** The user who caused the event — admins never get pinged by themselves. */
  fromUserId?: string | null;
  fromUserName?: string | null;
  /** Extra fields merged into the notification doc (sequenceId, shortCode, …). */
  data?: Record<string, unknown>;
}

/** True when a user doc carries admin privileges. */
export function isAdminData(
  d: FirebaseFirestore.DocumentData | undefined | null
): boolean {
  return !!d && (d.isAdmin === true || d.role === "admin");
}

/**
 * Fan a Pulse notification out to all admins.
 *
 * Mute semantics: a muted type skips the DOC write, not just the push —
 * otherwise muted high-volume types (scans, returns) would still pile
 * unread docs into the admin's inbox and inflate the badge count.
 *
 * Returns the number of notification docs written.
 */
export async function notifyAdmins(
  input: AdminNotificationInput
): Promise<number> {
  const [roleSnap, flagSnap] = await Promise.all([
    db.collection("users").where("role", "==", "admin").get(),
    db.collection("users").where("isAdmin", "==", true).get(),
  ]);

  const admins = new Map<string, FirebaseFirestore.DocumentData>();
  for (const doc of [...roleSnap.docs, ...flagSnap.docs]) {
    admins.set(doc.id, doc.data());
  }

  const prefKey = PULSE_PREF_KEYS[input.type];
  let written = 0;

  await Promise.all(
    [...admins.entries()].map(async ([adminId, adminData]) => {
      // No self-noise: the admin's own actions never ping them.
      if (input.fromUserId && adminId === input.fromUserId) return;

      const prefs = adminData.notificationPreferences as
        | Record<string, boolean>
        | undefined;
      if (prefs && prefKey && prefs[prefKey] === false) return;

      await db
        .collection("users")
        .doc(adminId)
        .collection("notifications")
        .add({
          userId: adminId,
          type: input.type,
          message: input.message,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          read: false,
          ...(input.fromUserId ? { fromUserId: input.fromUserId } : {}),
          ...(input.fromUserName ? { fromUserName: input.fromUserName } : {}),
          ...(input.data ?? {}),
        });
      written++;
    })
  );

  return written;
}
