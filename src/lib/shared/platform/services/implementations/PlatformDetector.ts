import { Capacitor } from "@capacitor/core";
import { isDesktop } from "../../../desktop/isDesktop";

export class PlatformDetector {
	get isNative(): boolean {
		return Capacitor.isNativePlatform();
	}

	get isDesktop(): boolean {
		return isDesktop();
	}

	get isIOS(): boolean {
		return Capacitor.getPlatform() === "ios";
	}

	get isAndroid(): boolean {
		return Capacitor.getPlatform() === "android";
	}

	get isWeb(): boolean {
		return !this.isDesktop && Capacitor.getPlatform() === "web";
	}

	get platform(): "ios" | "android" | "web" | "desktop" {
		if (this.isDesktop) return "desktop";
		return Capacitor.getPlatform() as "ios" | "android" | "web";
	}
}
