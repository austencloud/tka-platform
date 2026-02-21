import type { PropFirePointConfig } from "$lib/shared/animation-engine/domain/types/PropFirePoints";
import type { IFirePointOverrideProvider } from "../contracts/IFirePointOverrideProvider";

const STORAGE_KEY = "fire-point-overrides";

/** Deep-copy that works on Svelte 5 $state proxies (deepCopy cannot clone them). */
function deepCopy<T>(value: T): T {
	return JSON.parse(JSON.stringify(value));
}

/**
 * localStorage-backed fire point override provider.
 * Maintains an in-memory cache for fast lookups during animation frames.
 */
export class FirePointOverrideProvider implements IFirePointOverrideProvider {
	private cache: Map<string, PropFirePointConfig>;

	constructor() {
		this.cache = this.loadFromStorage();
	}

	getOverride(propType: string): PropFirePointConfig | null {
		return this.cache.get(propType.toLowerCase()) ?? null;
	}

	saveOverride(propType: string, config: PropFirePointConfig): void {
		const key = propType.toLowerCase();
		this.cache.set(key, deepCopy(config));
		this.persistToStorage();
	}

	clearOverride(propType: string): void {
		const key = propType.toLowerCase();
		if (this.cache.delete(key)) {
			this.persistToStorage();
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
		this.persistToStorage();
	}

	private loadFromStorage(): Map<string, PropFirePointConfig> {
		const map = new Map<string, PropFirePointConfig>();
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
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

	private persistToStorage(): void {
		try {
			const obj: Record<string, PropFirePointConfig> = {};
			for (const [key, config] of this.cache) {
				obj[key] = config;
			}
			localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
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
