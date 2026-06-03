import { isDesktop } from "./is-desktop";
import { DesktopDataSeeder } from "./desktop-data-seeder";

export class DesktopInitializer {
	private seeder = new DesktopDataSeeder();

	async initialize(): Promise<void> {
		if (!isDesktop()) return;

		await Promise.all([
			this.initWindowState(),
			this.initUpdater(),
			this.initDataSeeder(),
		]);
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

	private async initDataSeeder(): Promise<void> {
		try {
			const appVersion = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "0.0.0";
			await this.seeder.seedIfNeeded(appVersion);
		} catch (err) {
			console.error("[Desktop] Data seeding failed:", err);
		}
	}
}
