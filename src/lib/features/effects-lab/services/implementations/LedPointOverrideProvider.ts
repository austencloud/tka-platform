import type { PropLedConfig } from "$lib/shared/animation-engine/domain/types/LedTypes";
import type { IEffectPointOverrideProvider } from "../contracts/IEffectPointOverrideProvider";
import type { IEffectPointsPersister, EffectPoint } from "../contracts/IEffectPointsPersister";

const DEFAULT_BRIGHTNESS = 0.8;

/** Deep-copy that works on Svelte 5 $state proxies (structuredClone cannot clone them). */
function deepCopy<T>(value: T): T {
	return JSON.parse(JSON.stringify(value));
}

/**
 * LED point override provider backed by shared EffectPointsPersister.
 *
 * Full LED point configs (positions + brightness) are stored in Firestore
 * via the persister. All users read from the same document.
 *
 * Fallback chain (highest to lowest priority):
 * 1. Points from EffectPointsPersister (Firebase-backed)
 * 2. Admin-published defaults (when added)
 */
export class LedPointOverrideProvider implements IEffectPointOverrideProvider {
	private publishedDefaults: Map<string, PropLedConfig>;

	constructor(private readonly persister: IEffectPointsPersister) {
		this.publishedDefaults = new Map();
	}

	getOverride(propType: string): PropLedConfig | null {
		const key = propType.toLowerCase();

		const stored = this.persister.getPoints(key);
		if (stored) {
			return {
				points: stored.map((p) => ({
					dx: p.dx,
					dy: p.dy,
					brightness: p.brightness ?? DEFAULT_BRIGHTNESS,
				})),
			};
		}

		return this.publishedDefaults.get(key) ?? null;
	}

	saveOverride(propType: string, config: PropLedConfig): void {
		const key = propType.toLowerCase();

		// Store full LED point data (positions + brightness) to Firestore
		const points: EffectPoint[] = config.points.map((p) => ({
			dx: p.dx,
			dy: p.dy,
			brightness: p.brightness,
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
		const candidates = [
			"staff", "fan", "club", "buugeng", "triad", "minipoi",
			"doublestaff", "sword", "bigstaff", "bigfan", "bigclub",
			"minihoop", "bighoop", "bigbuugeng", "fractalgeng", "trigeng",
			"triquetra", "chicken", "guitar", "ukulele", "doublestar",
			"eightrings", "quiad", "torch", "poi",
		];
		const types: string[] = [];
		for (const key of candidates) {
			if (this.persister.getPoints(key) !== null) {
				types.push(key);
			}
		}
		return types;
	}

	exportAll(): Record<string, PropLedConfig> {
		const result: Record<string, PropLedConfig> = {};
		for (const key of this.getOverriddenTypes()) {
			const override = this.getOverride(key);
			if (override) {
				result[key] = deepCopy(override);
			}
		}
		return result;
	}

	importAll(overrides: Record<string, PropLedConfig>): void {
		for (const [key, config] of Object.entries(overrides)) {
			if (this.isValidConfig(config)) {
				this.saveOverride(key, config);
			}
		}
	}

	// --- Published defaults (admin-tuned, from Firestore) ---

	loadPublishedDefaults(defaults: Record<string, PropLedConfig>): void {
		this.publishedDefaults.clear();
		for (const [key, config] of Object.entries(defaults)) {
			this.publishedDefaults.set(key.toLowerCase(), deepCopy(config));
		}
	}

	// --- User defaults: collapsed into single tier (every edit auto-persists) ---

	saveUserDefault(propType: string, config: PropLedConfig): void {
		this.saveOverride(propType, config);
	}

	getUserDefault(propType: string): PropLedConfig | null {
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

	private isValidConfig(config: unknown): config is PropLedConfig {
		if (!config || typeof config !== "object") return false;
		const c = config as Record<string, unknown>;
		if (!Array.isArray(c.points)) return false;
		return c.points.every(
			(p: unknown) =>
				p !== null &&
				typeof p === "object" &&
				typeof (p as Record<string, unknown>).dx === "number" &&
				typeof (p as Record<string, unknown>).dy === "number" &&
				typeof (p as Record<string, unknown>).brightness === "number"
		);
	}
}
