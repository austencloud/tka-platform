import { Capacitor } from "@capacitor/core";
import type { IPlatformDetector } from "../contracts/IPlatformDetector";

export class PlatformDetector implements IPlatformDetector {
	get isNative(): boolean {
		return Capacitor.isNativePlatform();
	}

	get isIOS(): boolean {
		return Capacitor.getPlatform() === "ios";
	}

	get isAndroid(): boolean {
		return Capacitor.getPlatform() === "android";
	}

	get isWeb(): boolean {
		return Capacitor.getPlatform() === "web";
	}

	get platform(): "ios" | "android" | "web" {
		return Capacitor.getPlatform() as "ios" | "android" | "web";
	}
}
