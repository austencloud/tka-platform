/**
 * NotificationPreferencesService
 *
 * Manages user notification preferences in Firestore.
 */

import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import type { NotificationPreferences } from "../../domain/models/notification-models";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "../../domain/models/notification-models";

const USERS_COLLECTION = "users";
const PREFERENCES_FIELD = "notificationPreferences";

export class NotificationPreferencesService {
  /**
   * Get notification preferences for a user
   * Returns default preferences if none are set
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      const firestore = await getFirestoreInstance();
      const userRef = doc(firestore, USERS_COLLECTION, userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        return DEFAULT_NOTIFICATION_PREFERENCES;
      }

      const data = userDoc.data();
      const prefs = data[PREFERENCES_FIELD];

      if (!prefs) {
        return DEFAULT_NOTIFICATION_PREFERENCES;
      }

      // Merge with defaults to ensure all fields are present
      return {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        ...prefs,
      };
    } catch (error) {
      console.error("Error loading notification preferences:", error);
      return DEFAULT_NOTIFICATION_PREFERENCES;
    }
  }

  /**
   * Save notification preferences for a user
   */
  async savePreferences(
    userId: string,
    preferences: NotificationPreferences
  ): Promise<void> {
    try {
      const firestore = await getFirestoreInstance();
      const userRef = doc(firestore, USERS_COLLECTION, userId);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        // Update existing document
        await updateDoc(userRef, {
          [PREFERENCES_FIELD]: preferences,
        });
      } else {
        // Create new document
        await setDoc(userRef, {
          [PREFERENCES_FIELD]: preferences,
        });
      }
    } catch (error) {
      console.error("Error saving notification preferences:", error);
      throw error;
    }
  }

  /**
   * Toggle a specific notification preference
   */
  async togglePreference(
    userId: string,
    key: keyof NotificationPreferences
  ): Promise<void> {
    const current = await this.getPreferences(userId);
    const updated = {
      ...current,
      [key]: !current[key],
    };
    await this.savePreferences(userId, updated);
  }

  /**
   * Enable all notifications
   */
  async enableAll(userId: string): Promise<void> {
    const allEnabled: NotificationPreferences = {
      feedbackResolved: true,
      feedbackInProgress: true,
      feedbackNeedsInfo: true,
      feedbackResponse: true,
      sequenceSaved: true,
      sequenceVideoSubmitted: true,
      sequenceLiked: true,
      sequenceCommented: true,
      userFollowed: true,
      achievementUnlocked: true,
      messageReceived: true,
      adminNewUserSignup: true,
    };
    await this.savePreferences(userId, allEnabled);
  }

  /**
   * Disable all notifications (except system announcements)
   */
  async disableAll(userId: string): Promise<void> {
    const allDisabled: NotificationPreferences = {
      feedbackResolved: false,
      feedbackInProgress: false,
      feedbackNeedsInfo: false,
      feedbackResponse: false,
      sequenceSaved: false,
      sequenceVideoSubmitted: false,
      sequenceLiked: false,
      sequenceCommented: false,
      userFollowed: false,
      achievementUnlocked: false,
      messageReceived: false,
      adminNewUserSignup: false,
    };
    await this.savePreferences(userId, allDisabled);
  }
}

// Export singleton instance
export const notificationPreferencesService =
  new NotificationPreferencesService();
