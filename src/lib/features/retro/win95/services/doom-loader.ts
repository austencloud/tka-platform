/**
 * DoomLoader - Lazily loads js-dos v8 from CDN and launches DOOM shareware.
 *
 * js-dos v8 uses a div container (not a canvas). The loader injects the
 * required CSS and JS from the js-dos CDN on first use, then creates a
 * Dos instance pointing at the DOOM shareware bundle hosted on dos.zone.
 *
 * The DOOM shareware WAD (Episode 1: Knee Deep in the Dead) is freely
 * distributable per id Software's original shareware license.
 *
 * Domain: Retro Easter Eggs
 */

/** CDN endpoints for js-dos v8. */
const JSDOS_CSS_URL = "https://v8.js-dos.com/latest/js-dos.css";
const JSDOS_JS_URL = "https://v8.js-dos.com/latest/js-dos.js";

/** DOOM shareware bundle from dos.zone CDN. */
const DOOM_BUNDLE_URL = "https://cdn.dos.zone/custom/dos/doom.jsdos";

// js-dos v8 exposes a global `Dos` function after the script loads.
// We declare the shape we need so TypeScript doesn't complain.
declare global {
	 
	var Dos: ((
		element: HTMLDivElement,
		options: { url: string },
	) => { stop: () => void }) | undefined;
}

export class DoomLoader {
	private loading = false;
	private cssInjected = false;
	private scriptLoaded = false;

	/** Only works in browser environments. */
	isAvailable(): boolean {
		return typeof window !== "undefined";
	}

	/**
	 * Launch DOOM inside the given container div.
	 *
	 * First call downloads js-dos from CDN (~2 MB). Subsequent calls
	 * reuse the cached script. Returns a stop function that tears down
	 * the emulator when the window closes.
	 */
	async launch(
		containerEl: HTMLDivElement,
	): Promise<{ stop: () => void }> {
		if (this.loading) throw new Error("Already loading DOOM");
		this.loading = true;

		try {
			this.injectCss();
			await this.loadScript();

			if (typeof globalThis.Dos !== "function") {
				throw new Error(
					"js-dos failed to initialize - Dos() not found on window",
				);
			}

			const instance = globalThis.Dos(containerEl, {
				url: DOOM_BUNDLE_URL,
			});

			return {
				stop: () => {
					try {
						instance.stop();
					} catch {
						// Best-effort cleanup - the emulator may already be gone
						// if the user closed the window mid-load.
					}
				},
			};
		} finally {
			this.loading = false;
		}
	}

	// ── Private helpers ──────────────────────────────────────

	/** Inject the js-dos stylesheet once. */
	private injectCss(): void {
		if (this.cssInjected) return;

		const link = document.createElement("link");
		link.rel = "stylesheet";
		link.href = JSDOS_CSS_URL;
		document.head.appendChild(link);
		this.cssInjected = true;
	}

	/** Load the js-dos script once, resolving when it's ready. */
	private loadScript(): Promise<void> {
		if (this.scriptLoaded) return Promise.resolve();

		return new Promise<void>((resolve, reject) => {
			const script = document.createElement("script");
			script.src = JSDOS_JS_URL;
			script.async = true;

			script.onload = () => {
				this.scriptLoaded = true;
				resolve();
			};

			script.onerror = () => {
				reject(
					new Error(
						"Failed to load js-dos from CDN. Check your network connection.",
					),
				);
			};

			document.head.appendChild(script);
		});
	}
}
