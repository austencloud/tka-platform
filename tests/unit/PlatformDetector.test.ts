import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@capacitor/core", () => ({
	Capacitor: {
		isNativePlatform: vi.fn(() => false),
		getPlatform: vi.fn(() => "web"),
	},
}));

import { PlatformDetector } from "$lib/shared/platform/services/implementations/PlatformDetector";
import { Capacitor } from "@capacitor/core";

describe("PlatformDetector", () => {
	let detector: PlatformDetector;

	beforeEach(() => {
		vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
		vi.mocked(Capacitor.getPlatform).mockReturnValue("web");
		detector = new PlatformDetector();
	});

	it("reports web platform when not in native shell", () => {
		expect(detector.isNative).toBe(false);
		expect(detector.isWeb).toBe(true);
		expect(detector.isIOS).toBe(false);
		expect(detector.isAndroid).toBe(false);
		expect(detector.platform).toBe("web");
	});

	it("reports iOS when running in iOS native shell", () => {
		vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
		vi.mocked(Capacitor.getPlatform).mockReturnValue("ios");

		expect(detector.isNative).toBe(true);
		expect(detector.isIOS).toBe(true);
		expect(detector.isAndroid).toBe(false);
		expect(detector.isWeb).toBe(false);
		expect(detector.platform).toBe("ios");
	});

	it("reports Android when running in Android native shell", () => {
		vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
		vi.mocked(Capacitor.getPlatform).mockReturnValue("android");

		expect(detector.isNative).toBe(true);
		expect(detector.isAndroid).toBe(true);
		expect(detector.isIOS).toBe(false);
		expect(detector.platform).toBe("android");
	});
});
