import {
	getMessaging,
	getToken,
	deleteToken,
	isSupported as fcmIsSupported,
} from "firebase/messaging";
import {
	collection,
	doc,
	setDoc,
	deleteDoc,
	serverTimestamp,
} from "firebase/firestore";
import { getFirestoreInstance, app } from "$lib/shared/auth/firebase";
import { VAPID_KEY } from "../config/vapid";

const FCM_TOKENS_COLLECTION = "fcmTokens";

export class FCMTokenManager {
	private currentToken: string | null = null;

	async registerToken(userId: string): Promise<string | null> {
		try {
			const supported = await this.isSupported();
			if (!supported) {
				console.warn("[FCMTokenManager] Push not supported in this browser");
				return null;
			}

			if (this.getPermissionState() !== "granted") {
				console.warn("[FCMTokenManager] Notification permission not granted");
				return null;
			}

			const messaging = getMessaging(app);

			const swRegistration =
				await navigator.serviceWorker.getRegistration("/");
			if (!swRegistration) {
				console.debug(
					"[FCMTokenManager] No service worker registered - push notifications unavailable (expected in dev)",
				);
				return null;
			}

			const token = await getToken(messaging, {
				vapidKey: VAPID_KEY,
				serviceWorkerRegistration: swRegistration,
			});

			if (!token) {
				console.warn("[FCMTokenManager] Failed to get FCM token");
				return null;
			}

			await this.storeToken(userId, token);
			this.currentToken = token;

			return token;
		} catch (error) {
			console.error("[FCMTokenManager] Token registration failed:", error);
			return null;
		}
	}

	async unregisterToken(userId: string): Promise<void> {
		try {
			if (this.currentToken) {
				await this.removeToken(userId, this.currentToken);

				const messaging = getMessaging(app);
				await deleteToken(messaging);

				this.currentToken = null;
			}
		} catch (error) {
			console.error("[FCMTokenManager] Token unregistration failed:", error);
		}
	}

	async isSupported(): Promise<boolean> {
		if (!("Notification" in window)) return false;
		if (!("serviceWorker" in navigator)) return false;

		try {
			return await fcmIsSupported();
		} catch {
			return false;
		}
	}

	getPermissionState(): NotificationPermission {
		if (!("Notification" in window)) return "denied";
		return Notification.permission;
	}

	async requestPermission(): Promise<NotificationPermission> {
		if (!("Notification" in window)) return "denied";
		return Notification.requestPermission();
	}

	private async storeToken(userId: string, token: string): Promise<void> {
		const firestore = await getFirestoreInstance();
		const tokenHash = await this.hashToken(token);
		const tokenRef = doc(
			collection(firestore, "users", userId, FCM_TOKENS_COLLECTION),
			tokenHash,
		);

		await setDoc(tokenRef, {
			token,
			createdAt: serverTimestamp(),
			lastRefreshed: serverTimestamp(),
			device: this.getDeviceLabel(),
			userAgent: navigator.userAgent,
		});
	}

	private async removeToken(userId: string, token: string): Promise<void> {
		const firestore = await getFirestoreInstance();
		const tokenHash = await this.hashToken(token);
		const tokenRef = doc(
			collection(firestore, "users", userId, FCM_TOKENS_COLLECTION),
			tokenHash,
		);
		await deleteDoc(tokenRef);
	}

	private async hashToken(token: string): Promise<string> {
		const encoder = new TextEncoder();
		const data = encoder.encode(token);
		const hash = await crypto.subtle.digest("SHA-256", data);
		const hashArray = Array.from(new Uint8Array(hash));
		return hashArray
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("")
			.slice(0, 32);
	}

	private getDeviceLabel(): string {
		const ua = navigator.userAgent;
		if (ua.includes("Android")) return "Android";
		if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
		if (ua.includes("Windows")) return "Windows";
		if (ua.includes("Mac")) return "macOS";
		if (ua.includes("Linux")) return "Linux";
		return "Unknown";
	}
}
