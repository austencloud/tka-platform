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
			// Don't overlay on Android - let the system handle status bar space.
			// The WebView's env(safe-area-inset-top) isn't reliable in Android WebView.
			await StatusBar.setOverlaysWebView({ overlay: false });
			await StatusBar.setBackgroundColor({ color: "#0b1d2a" });
		} else {
			// iOS handles safe area insets natively via env() - overlay is safe
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

		// When a user taps an App Link / Universal Link (e.g. a QR code targeting
		// tkaflowarts.com/q/ABC123), Android hands us the full URL. Route to
		// the matching in-app path via SvelteKit's client navigation so we keep the
		// app alive - a full reload would drop state and flash the splash screen.
		await App.addListener("appUrlOpen", async ({ url }) => {
			try {
				const parsed = new URL(url);
				const target = parsed.pathname + parsed.search + parsed.hash;
				if (!target || target === "/") return;
				const { goto } = await import("$app/navigation");
				await goto(target);
			} catch {
				// Malformed URL - ignore. The OS shouldn't hand us one, but don't crash.
			}
		});
	}
}
