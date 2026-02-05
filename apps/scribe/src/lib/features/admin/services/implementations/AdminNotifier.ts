/**
 * AdminNotifier
 *
 * Handles notifications specifically for admin users.
 * Currently supports notifying admins when new users sign up.
 */

import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import type { AdminNotification } from "$lib/features/feedback/domain/models/notification-models";
import { getPreferenceKeyForType } from "$lib/features/feedback/domain/models/notification-models";
import { notificationPreferencesService } from "$lib/features/feedback/services/implementations/NotificationPreferencesManager";

const USERS_COLLECTION = "users";
const NOTIFICATIONS_SUBCOLLECTION = "notifications";

export class AdminNotifier {
  /**
   * Notify all admins when a new user signs up
   */
  async notifyNewUserSignup(
    newUserId: string,
    newUserEmail: string | null,
    newUserDisplayName: string
  ): Promise<void> {
    try {
      // Get all admin user IDs
      const adminIds = await this.getAdminUserIds();

      if (adminIds.length === 0) {
        return;
      }

      // Create notification for each admin (respecting preferences)
      const notificationPromises = adminIds.map((adminId) =>
        this.createAdminNotification(
          adminId,
          newUserId,
          newUserEmail,
          newUserDisplayName
        )
      );

      await Promise.all(notificationPromises);
    } catch (error) {
      console.error(
        "❌ [AdminNotifier] Failed to notify admins of new signup:",
        error
      );
      // Don't throw - notifications are non-critical
    }
  }

  /**
   * Get all admin user IDs
   */
  private async getAdminUserIds(): Promise<string[]> {
    const firestore = await getFirestoreInstance();
    const usersRef = collection(firestore, USERS_COLLECTION);

    // Query for users with admin role or isAdmin flag
    const roleQuery = query(usersRef, where("role", "==", "admin"));
    const isAdminQuery = query(usersRef, where("isAdmin", "==", true));

    const [roleSnapshot, isAdminSnapshot] = await Promise.all([
      getDocs(roleQuery),
      getDocs(isAdminQuery),
    ]);

    // Combine and dedupe admin IDs
    const adminIds = new Set<string>();
    roleSnapshot.docs.forEach((doc) => adminIds.add(doc.id));
    isAdminSnapshot.docs.forEach((doc) => adminIds.add(doc.id));

    return Array.from(adminIds);
  }

  /**
   * Create an admin notification (respecting user preferences)
   */
  private async createAdminNotification(
    adminId: string,
    newUserId: string,
    newUserEmail: string | null,
    newUserDisplayName: string
  ): Promise<string | null> {
    // Check admin's notification preferences
    const shouldNotify = await this.shouldNotify(adminId);
    if (!shouldNotify) {
      return null;
    }

    const message = newUserEmail
      ? `New user signed up: ${newUserDisplayName} (${newUserEmail})`
      : `New user signed up: ${newUserDisplayName}`;

    const notification: Omit<AdminNotification, "id"> = {
      userId: adminId,
      type: "admin-new-user-signup",
      message,
      createdAt: new Date(),
      read: false,
      newUserId,
      newUserEmail,
      newUserDisplayName,
    };

    const firestore = await getFirestoreInstance();
    const userNotificationsRef = collection(
      firestore,
      USERS_COLLECTION,
      adminId,
      NOTIFICATIONS_SUBCOLLECTION
    );

    const docRef = await addDoc(userNotificationsRef, {
      ...notification,
      createdAt: serverTimestamp(),
    });

    return docRef.id;
  }

  /**
   * Check if admin should receive new user signup notifications
   */
  private async shouldNotify(adminId: string): Promise<boolean> {
    try {
      const preferences =
        await notificationPreferencesService.getPreferences(adminId);
      const prefKey = getPreferenceKeyForType("admin-new-user-signup");

      if (!prefKey) {
        return true; // Default to notify
      }

      return preferences[prefKey];
    } catch (error) {
      console.error("Error checking admin notification preferences:", error);
      return true; // Fail open
    }
  }
}

// Export singleton instance
export const adminNotificationService = new AdminNotifier();
