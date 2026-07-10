/**
 * ForegroundMessageHandler
 *
 * Listens for FCM messages while the app is in the foreground.
 * Displays incoming notifications as toast messages since the browser
 * suppresses native notifications when the page is focused.
 */
import { getMessaging, onMessage } from "firebase/messaging";
import { app } from "$lib/shared/auth/firebase";
import { toast } from "$lib/shared/toast/state/toast-state.svelte";

let unsubscribe: (() => void) | null = null;

export function startForegroundMessageListener(): void {
	if (unsubscribe) return;

	try {
		const messaging = getMessaging(app);

		unsubscribe = onMessage(messaging, (payload) => {
			const data = payload.data || {};
			// State-sync messages (badge/dismiss) are not user-facing.
			if (data.action) return;
			const title = data.title || "New notification";
			const body = data.body || "";

			toast.info(`${title}: ${body}`, 5000);
		});
	} catch (error) {
		console.error(
			"[ForegroundMessageHandler] Failed to start listener:",
			error,
		);
	}
}

export function stopForegroundMessageListener(): void {
	if (unsubscribe) {
		unsubscribe();
		unsubscribe = null;
	}
}
