import type { NotificationPreferences } from "$lib/features/feedback/domain/models/notification-models";

export interface INotificationPreferencesManager {
	getPreferences(userId: string): Promise<NotificationPreferences>;
	savePreferences(
		userId: string,
		preferences: NotificationPreferences,
	): Promise<void>;
	togglePreference(
		userId: string,
		key: keyof NotificationPreferences,
	): Promise<void>;
	enableAll(userId: string): Promise<void>;
	disableAll(userId: string): Promise<void>;
}
