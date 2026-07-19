import { isNative, isAndroid } from "./platform-detector";

export class NativeInitializer {
	async initialize(): Promise<void> {
		if (!isNative()) return;

		// initAppLifecycle navigates off the marketing landing (the native shell
		// loads "/") into the app. Hide the splash only AFTER that navigation so
		// the landing never flashes behind the splash on a cold start.
		await Promise.allSettled([
			this.initStatusBar(),
			this.initKeyboard(),
			this.initAppLifecycle(),
		]);

		await this.initSplashScreen();
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
		const openedViaDeepLink = launchUrl?.url
			? await this.handleDeepLink(launchUrl.url)
			: false;

		// Normal cold start (tapped the app icon, no deep link): the native shell
		// loads "/", which is the marketing landing. This is a standalone app, so
		// boot straight into the Composer instead of showing the landing page.
		if (!openedViaDeepLink) {
			await this.bootIntoApp();
		}

		await App.addListener("appUrlOpen", async ({ url }) => {
			await this.handleDeepLink(url);
		});
	}

	// Navigate off the "/" landing into the app's front page. replaceState so the
	// Android back button from the app entry exits the app (via the backButton
	// handler) rather than returning to the landing page.
	private async bootIntoApp(): Promise<void> {
		const { goto } = await import("$app/navigation");
		await goto("/create", { replaceState: true });
	}

	// Returns true if the URL was a real deep link that navigated the app.
	private async handleDeepLink(url: string): Promise<boolean> {
		try {
			const parsed = new URL(url);
			let target = parsed.pathname + parsed.search + parsed.hash;
			if (!target || target === "/") return false;

			// /q/{code} = QR scan. Open in-app sequence viewer, not landing page.
			const qMatch = parsed.pathname.match(/^\/q\/([^/?#]+)/);
			if (qMatch?.[1]) {
				target = `/browse/gallery?v=${encodeURIComponent(qMatch[1])}`;
			}

			const { goto } = await import("$app/navigation");
			await goto(target);
			return true;
		} catch {
			// Malformed URL — ignore.
			return false;
		}
	}
}
