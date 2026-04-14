import type { IPlatformDetector } from "../contracts/IPlatformDetector";
import type { INativeInitializer } from "../contracts/INativeInitializer";

export class NativeInitializer implements INativeInitializer {
	constructor(private readonly platformDetector: IPlatformDetector) {}

	async initialize(): Promise<void> {
		if (!this.platformDetector.isNative) return;

		await Promise.all([
			this.initStatusBar(),
			this.initKeyboard(),
			this.initSplashScreen(),
			this.initAppLifecycle(),
		]);
	}

	private async initStatusBar(): Promise<void> {
		const { StatusBar, Style } = await import("@capacitor/status-bar");
		await StatusBar.setStyle({ style: Style.Dark });

		if (this.platformDetector.isAndroid) {
			// Don't overlay on Android — let the system handle status bar space.
			// The WebView's env(safe-area-inset-top) isn't reliable in Android WebView.
			await StatusBar.setOverlaysWebView({ overlay: false });
			await StatusBar.setBackgroundColor({ color: "#0b1d2a" });
		} else {
			// iOS handles safe area insets natively via env() — overlay is safe
			await StatusBar.setOverlaysWebView({ overlay: true });
		}
	}

	private async initKeyboard(): Promise<void> {
		const { Keyboard, KeyboardResize } = await import("@capacitor/keyboard");
		await Keyboard.setResizeMode({ mode: KeyboardResize.None });
		await Keyboard.setScroll({ isDisabled: true });
	}

	private async initSplashScreen(): Promise<void> {
		const { SplashScreen } = await import("@capacitor/splash-screen");
		await SplashScreen.hide({ fadeOutDuration: 300 });
	}

	private async initAppLifecycle(): Promise<void> {
		const { App } = await import("@capacitor/app");

		if (this.platformDetector.isAndroid) {
			await App.addListener("backButton", ({ canGoBack }) => {
				if (canGoBack) {
					window.history.back();
				} else {
					App.exitApp();
				}
			});
		}

		await App.addListener("appUrlOpen", ({ url }) => {
			const path = new URL(url).pathname;
			if (path) {
				window.location.href = path;
			}
		});
	}
}
