/**
 * Shared Effect Points Persister — Firebase + localStorage
 *
 * Stores full point data (position + effect-specific properties) for all
 * prop types in a single Firestore document (`config/effectPoints`). All
 * users read from this document, so admin edits propagate globally.
 *
 * Persistence strategy:
 *   - Save: localStorage (instant) + Firestore (debounced 1s)
 *   - Load: Firestore first, localStorage fallback
 *   - Sync: onSnapshot listener pushes updates to in-memory cache + localStorage
 */

import {
	doc,
	getDoc,
	setDoc,
	onSnapshot,
	serverTimestamp,
	type Unsubscribe,
} from "firebase/firestore";
import { auth, getFirestoreInstance } from "$lib/shared/auth/firebase";
import { trackWrite } from "$lib/shared/offline/state/sync-status-state.svelte";
import type {
	IEffectPointsPersister,
	EffectPoint,
} from "../contracts/IEffectPointsPersister";

const LOG_PREFIX = "[EffectPointsPersister]";
const FIRESTORE_DOC_PATH = "config/effectPoints";
const LOCAL_CACHE_KEY = "tka-effect-points-cache";
const DEBOUNCE_MS = 1000;

function isPermissionError(error: unknown): boolean {
	return error instanceof Error && error.message.includes("Missing or insufficient permissions");
}

export class EffectPointsPersister implements IEffectPointsPersister {
	private points: Record<string, EffectPoint[]> = {};
	private observers: Array<() => void> = [];
	private unsubscribe: Unsubscribe | null = null;
	private debounceTimer: ReturnType<typeof setTimeout> | null = null;
	private pendingWrites: Set<string> = new Set();
	private loaded = false;

	// ------------------------------------------------------------------
	// load()
	// ------------------------------------------------------------------

	async load(): Promise<void> {
		// Always read localStorage first as an immediate cache
		this.readLocalStorage();

		try {
			const docRef = await this.getDocRef();
			const snap = await getDoc(docRef);

			if (snap.exists()) {
				this.applyFirestoreData(snap.data());
				this.writeLocalStorage();
			}
		} catch (error) {
			if (!isPermissionError(error)) {
				console.warn(
					`${LOG_PREFIX} Firestore load failed, using localStorage cache:`,
					error
				);
			}
		}

		this.loaded = true;
		this.notifyObservers();
		this.startSnapshotListener();
	}

	// ------------------------------------------------------------------
	// isLoaded()
	// ------------------------------------------------------------------

	isLoaded(): boolean {
		return this.loaded;
	}

	// ------------------------------------------------------------------
	// save()
	// ------------------------------------------------------------------

	save(propType: string, points: EffectPoint[]): void {
		const key = propType.toLowerCase();
		this.points[key] = points.map((p) => ({ ...p }));

		this.writeLocalStorage();

		this.pendingWrites.add(key);
		this.scheduleDebouncedWrite();
	}

	// ------------------------------------------------------------------
	// getPoints()
	// ------------------------------------------------------------------

	getPoints(propType: string): EffectPoint[] | null {
		const key = propType.toLowerCase();
		const pts = this.points[key];
		if (!pts || pts.length === 0) return null;
		return pts.map((p) => ({ ...p }));
	}

	// ------------------------------------------------------------------
	// subscribe()
	// ------------------------------------------------------------------

	subscribe(callback: () => void): () => void {
		this.observers.push(callback);
		return () => {
			this.observers = this.observers.filter((cb) => cb !== callback);
		};
	}

	// ------------------------------------------------------------------
	// dispose()
	// ------------------------------------------------------------------

	dispose(): void {
		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = null;
		}
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}
		this.observers = [];
	}

	// ------------------------------------------------------------------
	// Private: Firestore doc reference
	// ------------------------------------------------------------------

	private async getDocRef() {
		const firestore = await getFirestoreInstance();
		return doc(firestore, FIRESTORE_DOC_PATH);
	}

	// ------------------------------------------------------------------
	// Private: Debounced Firestore write
	// ------------------------------------------------------------------

	private scheduleDebouncedWrite(): void {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
		}
		this.debounceTimer = setTimeout(() => {
			this.debounceTimer = null;
			this.flushToFirestore();
		}, DEBOUNCE_MS);
	}

	private async flushToFirestore(): Promise<void> {
		if (this.pendingWrites.size === 0) return;

		const uid = auth.currentUser?.uid;
		if (!uid) {
			console.warn(`${LOG_PREFIX} Not authenticated, skipping Firestore write`);
			return;
		}

		const keysToWrite = new Set(this.pendingWrites);
		this.pendingWrites.clear();

		try {
			const docRef = await this.getDocRef();

			const update: Record<string, unknown> = {
				updatedAt: serverTimestamp(),
				updatedBy: uid,
			};

			for (const key of keysToWrite) {
				const pts = this.points[key];
				if (pts) {
					update[key] = pts;
				}
			}

			await trackWrite(() => setDoc(docRef, update, { merge: true }));
		} catch (error) {
			console.error(`${LOG_PREFIX} Firestore write failed:`, error);
			// Re-queue failed keys for next attempt
			for (const key of keysToWrite) {
				this.pendingWrites.add(key);
			}
		}
	}

	// ------------------------------------------------------------------
	// Private: Snapshot listener
	// ------------------------------------------------------------------

	private startSnapshotListener(): void {
		this.getDocRef()
			.then((docRef) => {
				this.unsubscribe = onSnapshot(
					docRef,
					(snap) => {
						if (snap.exists()) {
							this.applyFirestoreData(snap.data());
							this.writeLocalStorage();
							this.notifyObservers();
						}
					},
					(error) => {
						if (!isPermissionError(error)) {
							console.error(
								`${LOG_PREFIX} Snapshot listener error:`,
								error
							);
						}
					}
				);
			})
			.catch((error) => {
				if (!isPermissionError(error)) {
					console.error(
						`${LOG_PREFIX} Failed to set up snapshot listener:`,
						error
					);
				}
			});
	}

	// ------------------------------------------------------------------
	// Private: Parse Firestore data
	// ------------------------------------------------------------------

	private applyFirestoreData(data: Record<string, unknown>): void {
		const newPoints: Record<string, EffectPoint[]> = {};

		for (const [key, value] of Object.entries(data)) {
			if (key === "updatedAt" || key === "updatedBy") continue;

			const pts = this.parsePointsArray(value);
			if (pts) {
				newPoints[key.toLowerCase()] = pts;
			}
		}

		this.points = newPoints;
	}

	private parsePointsArray(raw: unknown): EffectPoint[] | null {
		if (!Array.isArray(raw)) return null;

		const valid: EffectPoint[] = [];
		for (const item of raw) {
			if (
				item !== null &&
				typeof item === "object" &&
				typeof (item as Record<string, unknown>).dx === "number" &&
				typeof (item as Record<string, unknown>).dy === "number"
			) {
				const obj = item as Record<string, unknown>;
				const point: EffectPoint = { dx: obj.dx as number, dy: obj.dy as number };

				// Preserve all additional numeric properties (flameScale, brightness, etc.)
				for (const [prop, val] of Object.entries(obj)) {
					if (prop !== "dx" && prop !== "dy" && typeof val === "number") {
						point[prop] = val;
					}
				}

				valid.push(point);
			}
		}

		return valid.length > 0 ? valid : null;
	}

	// ------------------------------------------------------------------
	// Private: Notify observers
	// ------------------------------------------------------------------

	private notifyObservers(): void {
		for (const callback of this.observers) {
			try {
				callback();
			} catch (error) {
				console.error(`${LOG_PREFIX} Observer callback error:`, error);
			}
		}
	}

	// ------------------------------------------------------------------
	// Private: localStorage cache
	// ------------------------------------------------------------------

	private readLocalStorage(): void {
		try {
			const raw = localStorage.getItem(LOCAL_CACHE_KEY);
			if (!raw) return;

			const parsed = JSON.parse(raw);
			if (typeof parsed !== "object" || parsed === null) return;

			const result: Record<string, EffectPoint[]> = {};
			for (const [key, value] of Object.entries(parsed)) {
				const pts = this.parsePointsArray(value);
				if (pts) {
					result[key] = pts;
				}
			}

			this.points = result;
		} catch {
			// Corrupted cache — start fresh
		}
	}

	private writeLocalStorage(): void {
		try {
			localStorage.setItem(
				LOCAL_CACHE_KEY,
				JSON.stringify(this.points)
			);
		} catch {
			// localStorage might be full or unavailable
		}
	}
}
