import type { PropTrailPointConfig } from "$lib/shared/animation-engine/domain/types/PropTrailPoints";
import type { IEffectPointOverrideProvider } from "../contracts/IEffectPointOverrideProvider";

const STORAGE_KEY = "trail-point-overrides";
const DEFAULTS_STORAGE_KEY = "trail-point-user-defaults";

/** Deep-copy that works on Svelte 5 $state proxies (deepCopy cannot clone them). */
function deepCopy<T>(value: T): T {
	return JSON.parse(JSON.stringify(value));
}

/**
 * localStorage-backed trail point override provider.
 * Maintains in-memory caches for fast lookups during animation frames.
 *
 * Two-tier fallback chain (highest to lowest priority):
 * 1. `cache` = working state (auto-saved on every edit in Trail Lab)
 * 2. `defaultsCache` = user-defined baselines ("Set as Default")
 */
export class TrailPointOverrideProvider implements IEffectPointOverrideProvider {
	private cache: Map<string, PropTrailPointConfig>;
	private defaultsCache: Map<string, PropTrailPointConfig>;

	constructor() {
		this.cache = this.loadFromStorage(STORAGE_KEY);
		this.defaultsCache = this.loadFromStorage(DEFAULTS_STORAGE_KEY);
	}

	getOverride(propType: string): PropTrailPointConfig | null {
		const key = propType.toLowerCase();
		return (
			this.cache.get(key) ??
			this.defaultsCache.get(key) ??
			null
		);
	}

	saveOverride(propType: string, config: PropTrailPointConfig): void {
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

	exportAll(): Record<string, PropTrailPointConfig> {
		const result: Record<string, PropTrailPointConfig> = {};
		for (const [key, config] of this.cache) {
			result[key] = deepCopy(config);
		}
		return result;
	}

	importAll(overrides: Record<string, PropTrailPointConfig>): void {
		for (const [key, config] of Object.entries(overrides)) {
			if (this.isValidConfig(config)) {
				this.cache.set(key.toLowerCase(), deepCopy(config));
			}
		}
		this.persistCache(STORAGE_KEY, this.cache);
	}

	// --- Published defaults (no Firestore for trails currently) ---

	loadPublishedDefaults(_defaults: Record<string, PropTrailPointConfig>): void {
		// No-op for trails — no admin-published defaults yet
	}

	// --- User-defined defaults ---

	saveUserDefault(propType: string, config: PropTrailPointConfig): void {
		const key = propType.toLowerCase();
		this.defaultsCache.set(key, deepCopy(config));
		this.persistCache(DEFAULTS_STORAGE_KEY, this.defaultsCache);
	}

	getUserDefault(propType: string): PropTrailPointConfig | null {
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

	private loadFromStorage(storageKey: string): Map<string, PropTrailPointConfig> {
		const map = new Map<string, PropTrailPointConfig>();
		try {
			const raw = localStorage.getItem(storageKey);
			if (!raw) return map;
			const parsed = JSON.parse(raw) as Record<string, PropTrailPointConfig>;
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

	private persistCache(storageKey: string, cache: Map<string, PropTrailPointConfig>): void {
		try {
			const obj: Record<string, PropTrailPointConfig> = {};
			for (const [key, config] of cache) {
				obj[key] = config;
			}
			localStorage.setItem(storageKey, JSON.stringify(obj));
		} catch {
			// Storage full or unavailable — silent fail
		}
	}

	private isValidConfig(config: unknown): config is PropTrailPointConfig {
		if (!config || typeof config !== "object") return false;
		const c = config as Record<string, unknown>;
		if (!Array.isArray(c.points)) return false;
		return c.points.every(
			(p: unknown) =>
				p !== null &&
				typeof p === "object" &&
				typeof (p as Record<string, unknown>).dx === "number" &&
				typeof (p as Record<string, unknown>).dy === "number" &&
				typeof (p as Record<string, unknown>).trailWidth === "number"
		);
	}
}
