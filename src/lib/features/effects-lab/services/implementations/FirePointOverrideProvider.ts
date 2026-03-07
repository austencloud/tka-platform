import type { PropFirePointConfig } from "$lib/shared/animation-engine/domain/types/PropFirePoints";
import type { IEffectPointOverrideProvider } from "../contracts/IEffectPointOverrideProvider";
import type { IEffectPointsPersister, EffectPoint } from "../contracts/IEffectPointsPersister";

const DEFAULT_FLAME_SCALE = 0.8;

/** Deep-copy that works on Svelte 5 $state proxies (structuredClone cannot clone them). */
function deepCopy<T>(value: T): T {
	return JSON.parse(JSON.stringify(value));
}

/**
 * Fire point override provider backed by shared EffectPointsPersister.
 *
 * Full fire point configs (positions + flameScale) are stored in Firestore
 * via the persister. All users read from the same document, so admin edits
 * propagate globally in real time.
 *
 * Fallback chain (highest to lowest priority):
 * 1. Points from EffectPointsPersister (Firebase-backed)
 * 2. Admin-published defaults from FireDefaultsLoader
 */
export class FirePointOverrideProvider implements IEffectPointOverrideProvider {
	private publishedDefaults: Map<string, PropFirePointConfig>;

	constructor(private readonly persister: IEffectPointsPersister) {
		this.publishedDefaults = new Map();
	}

	getOverride(propType: string): PropFirePointConfig | null {
		const key = propType.toLowerCase();

		const stored = this.persister.getPoints(key);
		if (stored) {
			return {
				points: stored.map((p) => ({
					dx: p.dx,
					dy: p.dy,
					flameScale: p.flameScale ?? DEFAULT_FLAME_SCALE,
				})),
			};
		}

		return this.publishedDefaults.get(key) ?? null;
	}

	saveOverride(propType: string, config: PropFirePointConfig): void {
		const key = propType.toLowerCase();

		// Store full fire point data (positions + flameScale) to Firestore
		const points: EffectPoint[] = config.points.map((p) => ({
			dx: p.dx,
			dy: p.dy,
			flameScale: p.flameScale,
		}));
		this.persister.save(key, points);
	}

	clearOverride(propType: string): void {
		const key = propType.toLowerCase();
		this.persister.save(key, []);
	}

	hasOverride(propType: string): boolean {
		const key = propType.toLowerCase();
		return this.persister.getPoints(key) !== null;
	}

	getOverriddenTypes(): string[] {
		// We can't enumerate persister keys directly, but we can check
		// common prop types. The persister stores data per prop type key.
		const types: string[] = [];
		const candidates = [
			"staff", "fan", "club", "buugeng", "triad", "minipoi",
			"doublestaff", "sword", "bigstaff", "bigfan", "bigclub",
			"minihoop", "bighoop", "bigbuugeng", "fractalgeng", "trigeng",
			"triquetra", "chicken", "guitar", "ukulele", "doublestar",
			"eightrings", "quiad", "torch", "poi",
		];
		for (const key of candidates) {
			if (this.persister.getPoints(key) !== null) {
				types.push(key);
			}
		}
		return types;
	}

	exportAll(): Record<string, PropFirePointConfig> {
		const result: Record<string, PropFirePointConfig> = {};
		for (const key of this.getOverriddenTypes()) {
			const override = this.getOverride(key);
			if (override) {
				result[key] = deepCopy(override);
			}
		}
		return result;
	}

	importAll(overrides: Record<string, PropFirePointConfig>): void {
		for (const [key, config] of Object.entries(overrides)) {
			if (this.isValidConfig(config)) {
				this.saveOverride(key, config);
			}
		}
	}

	// --- Published defaults (admin-tuned, from Firestore) ---

	loadPublishedDefaults(defaults: Record<string, PropFirePointConfig>): void {
		this.publishedDefaults.clear();
		for (const [key, config] of Object.entries(defaults)) {
			this.publishedDefaults.set(key.toLowerCase(), deepCopy(config));
		}
	}

	// --- User defaults: collapsed into single tier (every edit auto-persists) ---

	saveUserDefault(propType: string, config: PropFirePointConfig): void {
		this.saveOverride(propType, config);
	}

	getUserDefault(propType: string): PropFirePointConfig | null {
		return this.getOverride(propType);
	}

	hasUserDefault(propType: string): boolean {
		return this.hasOverride(propType);
	}

	clearUserDefault(propType: string): void {
		this.clearOverride(propType);
	}

	getUserDefaultTypes(): string[] {
		return this.getOverriddenTypes();
	}

	// --- Private helpers ---

	private isValidConfig(config: unknown): config is PropFirePointConfig {
		if (!config || typeof config !== "object") return false;
		const c = config as Record<string, unknown>;
		if (!Array.isArray(c.points)) return false;
		return c.points.every(
			(p: unknown) =>
				p !== null &&
				typeof p === "object" &&
				typeof (p as Record<string, unknown>).dx === "number" &&
				typeof (p as Record<string, unknown>).dy === "number" &&
				typeof (p as Record<string, unknown>).flameScale === "number"
		);
	}
}
