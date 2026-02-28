import type { PropFirePointConfig } from "$lib/shared/animation-engine/domain/types/PropFirePoints";
import type { IEffectPointOverrideProvider } from "../contracts/IEffectPointOverrideProvider";
import type { IEffectPointsPersister } from "../contracts/IEffectPointsPersister";

const INTENSITY_STORAGE_KEY = "fire-point-intensity-overrides";
const DEFAULT_FLAME_SCALE = 0.8;

/** Deep-copy that works on Svelte 5 $state proxies (structuredClone cannot clone them). */
function deepCopy<T>(value: T): T {
	return JSON.parse(JSON.stringify(value));
}

/**
 * Fire point override provider backed by shared EffectPointsPersister.
 *
 * Positions are shared across all effects (fire, LED) via the persister.
 * This provider enriches shared positions with fire-specific intensity
 * (flameScale) and caches the full typed config to localStorage for
 * fast animation-frame reads.
 *
 * Fallback chain (highest to lowest priority):
 * 1. Shared positions from EffectPointsPersister (Firebase-backed)
 * 2. Admin-published defaults from FireDefaultsLoader
 */
export class FirePointOverrideProvider implements IEffectPointOverrideProvider {
	private publishedDefaults: Map<string, PropFirePointConfig>;
	private intensityOverrides: Map<string, Record<number, number>>;

	constructor(private readonly persister: IEffectPointsPersister) {
		this.publishedDefaults = new Map();
		this.intensityOverrides = this.loadIntensityOverrides();
	}

	getOverride(propType: string): PropFirePointConfig | null {
		const key = propType.toLowerCase();

		const sharedPositions = this.persister.getPositions(key);
		if (sharedPositions) {
			const intensities = this.intensityOverrides.get(key);
			return {
				points: sharedPositions.map((p, i) => ({
					dx: p.dx,
					dy: p.dy,
					flameScale: intensities?.[i] ?? DEFAULT_FLAME_SCALE,
				})),
			};
		}

		return this.publishedDefaults.get(key) ?? null;
	}

	saveOverride(propType: string, config: PropFirePointConfig): void {
		const key = propType.toLowerCase();

		// Extract position-only data and persist to shared store (Firebase)
		const positions = config.points.map((p) => ({ dx: p.dx, dy: p.dy }));
		this.persister.save(key, positions);

		// Cache per-point flameScale overrides locally
		const intensities: Record<number, number> = {};
		config.points.forEach((p, i) => {
			intensities[i] = p.flameScale;
		});
		this.intensityOverrides.set(key, intensities);
		this.persistIntensityOverrides();
	}

	clearOverride(propType: string): void {
		const key = propType.toLowerCase();
		// Clear from shared persister — positions gone for all effects
		this.persister.save(key, []);
		if (this.intensityOverrides.delete(key)) {
			this.persistIntensityOverrides();
		}
	}

	hasOverride(propType: string): boolean {
		const key = propType.toLowerCase();
		return this.persister.getPositions(key) !== null;
	}

	getOverriddenTypes(): string[] {
		// Scan all known types — persister doesn't expose a keys list,
		// but we can check via intensity overrides + published defaults
		const types = new Set<string>();
		for (const key of this.intensityOverrides.keys()) {
			if (this.persister.getPositions(key) !== null) {
				types.add(key);
			}
		}
		return Array.from(types);
	}

	exportAll(): Record<string, PropFirePointConfig> {
		const result: Record<string, PropFirePointConfig> = {};
		for (const key of this.intensityOverrides.keys()) {
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

	private loadIntensityOverrides(): Map<string, Record<number, number>> {
		const map = new Map<string, Record<number, number>>();
		try {
			const raw = localStorage.getItem(INTENSITY_STORAGE_KEY);
			if (!raw) return map;
			const parsed = JSON.parse(raw) as Record<string, Record<number, number>>;
			for (const [key, intensities] of Object.entries(parsed)) {
				if (typeof intensities === "object" && intensities !== null) {
					map.set(key, intensities);
				}
			}
		} catch {
			// Corrupted data — start fresh
		}
		return map;
	}

	private persistIntensityOverrides(): void {
		try {
			const obj: Record<string, Record<number, number>> = {};
			for (const [key, intensities] of this.intensityOverrides) {
				obj[key] = intensities;
			}
			localStorage.setItem(INTENSITY_STORAGE_KEY, JSON.stringify(obj));
		} catch {
			// Storage full or unavailable
		}
	}

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
