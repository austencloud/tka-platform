export interface IPlatformDetector {
	readonly isNative: boolean;
	readonly isDesktop: boolean;
	readonly isIOS: boolean;
	readonly isAndroid: boolean;
	readonly isWeb: boolean;
	readonly platform: "ios" | "android" | "web" | "desktop";
}
