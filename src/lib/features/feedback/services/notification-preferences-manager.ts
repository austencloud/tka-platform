import { firestoreGet, firestoreSet } from "$lib/shared/firestore";
import type { NotificationPreferences } from "$lib/shared/feedback/domain/models/notification-models";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "$lib/shared/feedback/domain/models/notification-models";
import { NotificationPreferencesDocSchema } from "$lib/shared/feedback/domain/models/feedback-schemas";

const preferencesCollection = (userId: string) => `users/${userId}/settings`;
const PREFERENCES_DOCUMENT = "notificationPreferences";
const PREFERENCES_FIELD = "notificationPreferences";

/**
 * Get notification preferences for a user
 * Returns default preferences if none are set
 */
export async function getPreferences(
  userId: string
): Promise<NotificationPreferences> {
  try {
    const userDoc = await firestoreGet(
      preferencesCollection(userId),
      PREFERENCES_DOCUMENT,
      NotificationPreferencesDocSchema,
    );

    if (!userDoc) {
      return DEFAULT_NOTIFICATION_PREFERENCES;
    }

    const prefs = userDoc.notificationPreferences;

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
export async function savePreferences(
  userId: string,
  preferences: NotificationPreferences
): Promise<void> {
  try {
    await firestoreSet(
      preferencesCollection(userId),
      PREFERENCES_DOCUMENT,
      { [PREFERENCES_FIELD]: preferences } as Record<string, unknown>,
      { merge: true },
    );
  } catch (error) {
    console.error("Error saving notification preferences:", error);
    throw error;
  }
}

/**
 * Toggle a specific notification preference
 */
export async function togglePreference(
  userId: string,
  key: keyof NotificationPreferences
): Promise<void> {
  const current = await getPreferences(userId);
  const updated = {
    ...current,
    [key]: !current[key],
  };
  await savePreferences(userId, updated);
}

/**
 * Enable all notifications
 */
export async function enableAll(userId: string): Promise<void> {
  const allEnabled: NotificationPreferences = {
    pushEnabled: true,
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
    adminUserReturned: true,
    adminQrScan: true,
    adminContentCreated: true,
  };
  await savePreferences(userId, allEnabled);
}

/**
 * Disable all notifications (except system announcements)
 */
export async function disableAll(userId: string): Promise<void> {
  const allDisabled: NotificationPreferences = {
    pushEnabled: false,
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
    adminUserReturned: false,
    adminQrScan: false,
    adminContentCreated: false,
  };
  await savePreferences(userId, allDisabled);
}
