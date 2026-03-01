/**
 * Shared Effect Points Persister — Firebase + localStorage
 *
 * Stores position-only point data ({dx, dy}) for all prop types in a single
 * Firestore document (`config/effectPoints`). Both fire and LED providers
 * read from this shared source and enrich with their own intensity defaults.
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
	EffectPosition,
} from "../contracts/IEffectPointsPersister";

const LOG_PREFIX = "[EffectPointsPersister]";
const FIRESTORE_DOC_PATH = "config/effectPoints";
const LOCAL_CACHE_KEY = "tka-effect-points-cache";
const DEBOUNCE_MS = 1000;

export class EffectPointsPersister implements IEffectPointsPersister {
	private positions: Record<string, EffectPosition[]> = {};
	private observers: Array<() => void> = [];
	private unsubscribe: Unsubscribe | null = null;
	private debounceTimer: ReturnType<typeof setTimeout> | null = null;
	private pendingWrites: Set<string> = new Set();

	// ------------------------------------------------------------------
	// load()
	// ------------------------------------------------------------------

	async load(): Promise<void> {
		if (!auth.currentUser) {
			this.readLocalStorage();
			return;
		}

		try {
			const docRef = await this.getDocRef();
			const snap = await getDoc(docRef);

			if (snap.exists()) {
				this.applyFirestoreData(snap.data());
				this.writeLocalStorage();
			} else {
				this.readLocalStorage();
			}
		} catch (error) {
			console.warn(
				`${LOG_PREFIX} Firestore load failed, falling back to localStorage:`,
				error
			);
			this.readLocalStorage();
		}

		this.startSnapshotListener();
	}

	// ------------------------------------------------------------------
	// save()
	// ------------------------------------------------------------------

	save(propType: string, points: EffectPosition[]): void {
		const key = propType.toLowerCase();
		this.positions[key] = points.map((p) => ({ dx: p.dx, dy: p.dy }));

		this.writeLocalStorage();

		this.pendingWrites.add(key);
		this.scheduleDebouncedWrite();
	}

	// ------------------------------------------------------------------
	// getPositions()
	// ------------------------------------------------------------------

	getPositions(propType: string): EffectPosition[] | null {
		const key = propType.toLowerCase();
		const points = this.positions[key];
		if (!points || points.length === 0) return null;
		return points.map((p) => ({ dx: p.dx, dy: p.dy }));
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
				const points = this.positions[key];
				if (points) {
					update[key] = points;
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
		if (!auth.currentUser) return;

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
						console.error(
							`${LOG_PREFIX} Snapshot listener error:`,
							error
						);
					}
				);
			})
			.catch((error) => {
				console.error(
					`${LOG_PREFIX} Failed to set up snapshot listener:`,
					error
				);
			});
	}

	// ------------------------------------------------------------------
	// Private: Parse Firestore data
	// ------------------------------------------------------------------

	private applyFirestoreData(data: Record<string, unknown>): void {
		const newPositions: Record<string, EffectPosition[]> = {};

		for (const [key, value] of Object.entries(data)) {
			if (key === "updatedAt" || key === "updatedBy") continue;

			const points = this.parsePointsArray(value);
			if (points) {
				newPositions[key.toLowerCase()] = points;
			}
		}

		this.positions = newPositions;
	}

	private parsePointsArray(raw: unknown): EffectPosition[] | null {
		if (!Array.isArray(raw)) return null;

		const valid: EffectPosition[] = [];
		for (const item of raw) {
			if (
				item !== null &&
				typeof item === "object" &&
				typeof (item as Record<string, unknown>).dx === "number" &&
				typeof (item as Record<string, unknown>).dy === "number"
			) {
				const obj = item as { dx: number; dy: number };
				valid.push({ dx: obj.dx, dy: obj.dy });
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

			const result: Record<string, EffectPosition[]> = {};
			for (const [key, value] of Object.entries(parsed)) {
				const points = this.parsePointsArray(value);
				if (points) {
					result[key] = points;
				}
			}

			this.positions = result;
		} catch {
			// Corrupted cache — start fresh
		}
	}

	private writeLocalStorage(): void {
		try {
			localStorage.setItem(
				LOCAL_CACHE_KEY,
				JSON.stringify(this.positions)
			);
		} catch {
			// localStorage might be full or unavailable
		}
	}
}
