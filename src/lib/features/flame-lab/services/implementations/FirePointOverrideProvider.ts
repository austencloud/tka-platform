import type { PropFirePointConfig } from "$lib/shared/animation-engine/domain/types/PropFirePoints";
import type { IFirePointOverrideProvider } from "../contracts/IFirePointOverrideProvider";

const STORAGE_KEY = "fire-point-overrides";
const DEFAULTS_STORAGE_KEY = "fire-point-user-defaults";

/** Deep-copy that works on Svelte 5 $state proxies (deepCopy cannot clone them). */
function deepCopy<T>(value: T): T {
	return JSON.parse(JSON.stringify(value));
}

/**
 * localStorage-backed fire point override provider.
 * Maintains in-memory caches for fast lookups during animation frames.
 *
 * Three-tier fallback chain (highest to lowest priority):
 * 1. `cache` = working state (auto-saved on every edit in Flame Lab)
 * 2. `defaultsCache` = user-defined baselines ("Set as Default")
 * 3. `publishedDefaults` = admin-published Firestore defaults (loaded at startup)
 */
export class FirePointOverrideProvider implements IFirePointOverrideProvider {
	private cache: Map<string, PropFirePointConfig>;
	private defaultsCache: Map<string, PropFirePointConfig>;
	private publishedDefaults: Map<string, PropFirePointConfig>;

	constructor() {
		this.cache = this.loadFromStorage(STORAGE_KEY);
		this.defaultsCache = this.loadFromStorage(DEFAULTS_STORAGE_KEY);
		this.publishedDefaults = new Map();
	}

	getOverride(propType: string): PropFirePointConfig | null {
		const key = propType.toLowerCase();
		// Fallback chain: local working edits -> user defaults -> admin-published defaults
		return (
			this.cache.get(key) ??
			this.defaultsCache.get(key) ??
			this.publishedDefaults.get(key) ??
			null
		);
	}

	saveOverride(propType: string, config: PropFirePointConfig): void {
		const key = propType.toLowerCase();
		this.cache.set(key, deepCopy(config));
		this.persistCache(STORAGE_KEY, this.cache);
	}

	clearOverride(propType: string): void {
		const key = propType.toLowerCase();
		if (this.cache.delete(key)) {
			this.persistCache(STORAGE_KEY, this.cache);
		}
	}

	hasOverride(propType: string): boolean {
		return this.cache.has(propType.toLowerCase());
	}

	getOverriddenTypes(): string[] {
		return Array.from(this.cache.keys());
	}

	exportAll(): Record<string, PropFirePointConfig> {
		const result: Record<string, PropFirePointConfig> = {};
		for (const [key, config] of this.cache) {
			result[key] = deepCopy(config);
		}
		return result;
	}

	importAll(overrides: Record<string, PropFirePointConfig>): void {
		for (const [key, config] of Object.entries(overrides)) {
			if (this.isValidConfig(config)) {
				this.cache.set(key.toLowerCase(), deepCopy(config));
			}
		}
		this.persistCache(STORAGE_KEY, this.cache);
	}

	// --- Published defaults (admin-tuned, from Firestore) ---

	loadPublishedDefaults(defaults: Record<string, PropFirePointConfig>): void {
		this.publishedDefaults.clear();
		for (const [key, config] of Object.entries(defaults)) {
			this.publishedDefaults.set(key.toLowerCase(), deepCopy(config));
		}
	}

	// --- User-defined defaults ---

	saveUserDefault(propType: string, config: PropFirePointConfig): void {
		const key = propType.toLowerCase();
		this.defaultsCache.set(key, deepCopy(config));
		this.persistCache(DEFAULTS_STORAGE_KEY, this.defaultsCache);
	}

	getUserDefault(propType: string): PropFirePointConfig | null {
		return this.defaultsCache.get(propType.toLowerCase()) ?? null;
	}

	hasUserDefault(propType: string): boolean {
		return this.defaultsCache.has(propType.toLowerCase());
	}

	clearUserDefault(propType: string): void {
		const key = propType.toLowerCase();
		if (this.defaultsCache.delete(key)) {
			this.persistCache(DEFAULTS_STORAGE_KEY, this.defaultsCache);
		}
	}

	getUserDefaultTypes(): string[] {
		return Array.from(this.defaultsCache.keys());
	}

	// --- Private helpers ---

	private loadFromStorage(storageKey: string): Map<string, PropFirePointConfig> {
		const map = new Map<string, PropFirePointConfig>();
		try {
			const raw = localStorage.getItem(storageKey);
			if (!raw) return map;
			const parsed = JSON.parse(raw) as Record<string, PropFirePointConfig>;
			for (const [key, config] of Object.entries(parsed)) {
				if (this.isValidConfig(config)) {
					map.set(key, config);
				}
			}
		} catch {
			// Corrupted data — start fresh
		}
		return map;
	}

	private persistCache(storageKey: string, cache: Map<string, PropFirePointConfig>): void {
		try {
			const obj: Record<string, PropFirePointConfig> = {};
			for (const [key, config] of cache) {
				obj[key] = config;
			}
			localStorage.setItem(storageKey, JSON.stringify(obj));
		} catch {
			// Storage full or unavailable — silent fail
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
