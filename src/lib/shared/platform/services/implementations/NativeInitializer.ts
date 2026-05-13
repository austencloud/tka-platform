import { isNative, isAndroid } from "../platform-detector";

export class NativeInitializer {
	async initialize(): Promise<void> {
		if (!isNative()) return;

		await Promise.allSettled([
			this.initStatusBar(),
			this.initKeyboard(),
			this.initSplashScreen(),
			this.initAppLifecycle(),
		]);
	}

	private async initStatusBar(): Promise<void> {
		const { StatusBar, Style } = await import("@capacitor/status-bar");
		await StatusBar.setStyle({ style: Style.Dark });

		if (isAndroid()) {
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

		if (isAndroid()) {
			await App.addListener("backButton", ({ canGoBack }) => {
				if (canGoBack) {
					window.history.back();
				} else {
					App.exitApp();
				}
			});
		}

		// Handle deep links from both cold start and warm resume.
		// Cold start: getLaunchUrl() returns the URL that opened the app.
		// Warm resume: appUrlOpen fires when a new URL arrives while running.
		const launchUrl = await App.getLaunchUrl();
		if (launchUrl?.url) {
			await this.handleDeepLink(launchUrl.url);
		}

		await App.addListener("appUrlOpen", async ({ url }) => {
			await this.handleDeepLink(url);
		});
	}

	private async handleDeepLink(url: string): Promise<void> {
		try {
			const parsed = new URL(url);
			let target = parsed.pathname + parsed.search + parsed.hash;
			if (!target || target === "/") return;

			// /q/{code} = QR scan. Open in-app sequence viewer, not landing page.
			const qMatch = parsed.pathname.match(/^\/q\/([^/?#]+)/);
			if (qMatch?.[1]) {
				target = `/browse/gallery?v=${encodeURIComponent(qMatch[1])}`;
			}

			const { goto } = await import("$app/navigation");
			await goto(target);
		} catch {
			// Malformed URL — ignore.
		}
	}
}
