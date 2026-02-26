import { createContainer } from "iti";
import { FCMTokenManager } from "$lib/shared/push/services/implementations/FCMTokenManager";

export function createPushContainer() {
	return createContainer().add({
		fcmTokenManager: () => new FCMTokenManager(),
	});
}

export type PushContainer = ReturnType<typeof createPushContainer>;
