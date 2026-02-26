import { createContainer } from "iti";
import { FCMTokenManager } from "$lib/shared/push/services/implementations/FCMTokenManager";
import { NotificationPreferencesManager } from "$lib/features/feedback/services/implementations/NotificationPreferencesManager";

export function createPushContainer() {
	return createContainer().add({
		fcmTokenManager: () => new FCMTokenManager(),
		notificationPreferencesManager: () =>
			new NotificationPreferencesManager(),
	});
}

export type PushContainer = ReturnType<typeof createPushContainer>;
