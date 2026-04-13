export interface IPlatformDetector {
	readonly isNative: boolean;
	readonly isIOS: boolean;
	readonly isAndroid: boolean;
	readonly isWeb: boolean;
	readonly platform: "ios" | "android" | "web";
}
