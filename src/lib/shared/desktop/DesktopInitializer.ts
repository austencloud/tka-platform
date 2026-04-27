import { isDesktop } from "./isDesktop";

export class DesktopInitializer {
	async initialize(): Promise<void> {
		if (!isDesktop()) return;

		await Promise.all([this.initWindowState(), this.initUpdater()]);
	}

	private async initWindowState(): Promise<void> {
		// Window state plugin remembers size/position across launches — no code needed,
		// the Tauri plugin handles it automatically via the registration in lib.rs.
	}

	private async initUpdater(): Promise<void> {
		try {
			const { check } = await import("@tauri-apps/plugin-updater");
			const update = await check();
			if (update) {
				console.log(`[Desktop] Update available: ${update.version}`);
				await update.downloadAndInstall();
			}
		} catch (err) {
			console.warn("[Desktop] Update check skipped:", err);
		}
	}
}
