/**
 * Fuel Source Loader - Firestore Collection Implementation
 *
 * Loads fuel source configurations from the Firestore collection
 * `config/fuelSources`, merging with baked-in defaults from
 * BuiltInFuelSources.ts.
 *
 * Merge strategy:
 *   - Firestore documents override built-in params for matching IDs
 *   - Custom (non-built-in) fuels from Firestore are added to the list
 *   - If Firestore is empty or offline, built-in defaults are used
 *
 * Offline resilience:
 *   - localStorage is used as a write-through cache
 *   - On load, Firestore is tried first; localStorage is the fallback
 *   - On snapshot updates, localStorage is kept in sync
 */

import {
	collection,
	getDocs,
	onSnapshot,
	type Unsubscribe,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import type { FuelSourceDocument } from "../../domain/types/FuelSourceTypes";
import { BUILT_IN_FUEL_SOURCES } from "../../domain/types/BuiltInFuelSources";
import type { IFuelSourceLoader } from "../contracts/IFuelSourceLoader";

const LOG_PREFIX = "[FuelSourceLoader]";
const FIRESTORE_COLLECTION_PATH = "config/fuelSources";
const LOCAL_CACHE_KEY = "tka-fuel-sources-cache";

export class FuelSourceLoader implements IFuelSourceLoader {
	private unsubscribe: Unsubscribe | null = null;
	private loaded = false;
	private fuelSources: Map<string, FuelSourceDocument> = new Map();
	private observers: Array<() => void> = [];

	// ------------------------------------------------------------------
	// Firestore collection reference
	// ------------------------------------------------------------------

	private async getCollectionRef() {
		const firestore = await getFirestoreInstance();
		return collection(firestore, FIRESTORE_COLLECTION_PATH);
	}

	// ------------------------------------------------------------------
	// load()
	// ------------------------------------------------------------------

	async load(): Promise<void> {
		try {
			const collectionRef = await this.getCollectionRef();
			const snapshot = await getDocs(collectionRef);

			if (!snapshot.empty) {
				const firestoreDocs: FuelSourceDocument[] = [];
				for (const docSnap of snapshot.docs) {
					const parsed = this.parseDocument(docSnap.id, docSnap.data());
					if (parsed) {
						firestoreDocs.push(parsed);
					}
				}

				this.mergeWithBuiltIns(firestoreDocs);
				this.writeLocalStorage();
				this.loaded = true;
				return;
			}

			// Collection empty -- try localStorage, then fall back to built-ins
			if (!this.readLocalStorage()) {
				this.applyBuiltInsOnly();
			}
			this.loaded = true;
		} catch (error) {
			console.warn(`${LOG_PREFIX} Firestore load failed, falling back:`, error);
			if (!this.readLocalStorage()) {
				this.applyBuiltInsOnly();
			}
			this.loaded = true;
		}
	}

	// ------------------------------------------------------------------
	// getAll()
	// ------------------------------------------------------------------

	getAll(): FuelSourceDocument[] {
		return Array.from(this.fuelSources.values()).sort(
			(a, b) => a.sortOrder - b.sortOrder
		);
	}

	// ------------------------------------------------------------------
	// get()
	// ------------------------------------------------------------------

	get(id: string): FuelSourceDocument | undefined {
		return this.fuelSources.get(id);
	}

	// ------------------------------------------------------------------
	// subscribe()
	// ------------------------------------------------------------------

	subscribe(callback: () => void): void {
		this.observers.push(callback);

		// Set up Firestore listener on first subscriber (idempotent)
		if (!this.unsubscribe) {
			this.startSnapshotListener();
		}
	}

	// ------------------------------------------------------------------
	// dispose()
	// ------------------------------------------------------------------

	dispose(): void {
		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = null;
		}
		this.observers = [];
	}

	// ------------------------------------------------------------------
	// Private: Firestore snapshot listener
	// ------------------------------------------------------------------

	private startSnapshotListener(): void {
		this.getCollectionRef()
			.then((collectionRef) => {
				this.unsubscribe = onSnapshot(
					collectionRef,
					(snapshot) => {
						const firestoreDocs: FuelSourceDocument[] = [];
						for (const docSnap of snapshot.docs) {
							const parsed = this.parseDocument(docSnap.id, docSnap.data());
							if (parsed) {
								firestoreDocs.push(parsed);
							}
						}

						if (firestoreDocs.length > 0) {
							this.mergeWithBuiltIns(firestoreDocs);
						} else {
							this.applyBuiltInsOnly();
						}

						// Keep localStorage in sync
						this.writeLocalStorage();

						this.loaded = true;
						this.notifyObservers();
					},
					(error) => {
						console.error(`${LOG_PREFIX} Snapshot listener error:`, error);
					}
				);
			})
			.catch((error) => {
				console.error(`${LOG_PREFIX} Failed to set up snapshot listener:`, error);
			});
	}

	// ------------------------------------------------------------------
	// Private: Parse a single Firestore document into FuelSourceDocument
	// ------------------------------------------------------------------

	private parseDocument(
		docId: string,
		data: Record<string, unknown>
	): FuelSourceDocument | null {
		if (typeof data !== "object" || data === null) return null;

		const id = typeof data.id === "string" ? data.id : docId;
		const name = typeof data.name === "string" ? data.name : "";
		const description = typeof data.description === "string" ? data.description : "";
		const rendererType = data.rendererType === "particle" ? "particle" as const : "fluid" as const;
		const builtIn = typeof data.builtIn === "boolean" ? data.builtIn : false;
		const sortOrder = typeof data.sortOrder === "number" ? data.sortOrder : 999;

		if (!name) return null;

		const doc: FuelSourceDocument = {
			id,
			name,
			description,
			rendererType,
			builtIn,
			sortOrder,
		};

		if (rendererType === "fluid") {
			const fluidParams = this.parseFluidParams(data.fluidParams);
			const colorCurve = this.parseColorCurve(data.colorCurve);
			if (fluidParams) doc.fluidParams = fluidParams;
			if (colorCurve) doc.colorCurve = colorCurve;
		} else {
			const particleParams = this.parseCharcoalParams(data.particleParams);
			if (particleParams) doc.particleParams = particleParams;
		}

		return doc;
	}

	// ------------------------------------------------------------------
	// Private: Parse fluid physics params (same fields as FirePhysicsParams)
	// ------------------------------------------------------------------

	private parseFluidParams(raw: unknown): FuelSourceDocument["fluidParams"] {
		if (typeof raw !== "object" || raw === null) return undefined;

		const obj = raw as Record<string, unknown>;
		const fields = [
			"splatRadius",
			"fuelAmount",
			"velocityInjectScale",
			"velocityDissipation",
			"temperatureDissipation",
			"fuelDissipation",
			"vorticityStrength",
			"buoyancyStrength",
			"burnRate",
			"fuelEfficiency",
			"coolingRate",
			"pressureDissipation",
			"temperatureInjection",
			"upwardBias",
		] as const;

		for (const field of fields) {
			if (typeof obj[field] !== "number") return undefined;
		}

		return {
			splatRadius: obj.splatRadius as number,
			fuelAmount: obj.fuelAmount as number,
			velocityInjectScale: obj.velocityInjectScale as number,
			velocityDissipation: obj.velocityDissipation as number,
			temperatureDissipation: obj.temperatureDissipation as number,
			fuelDissipation: obj.fuelDissipation as number,
			vorticityStrength: obj.vorticityStrength as number,
			buoyancyStrength: obj.buoyancyStrength as number,
			burnRate: obj.burnRate as number,
			fuelEfficiency: obj.fuelEfficiency as number,
			coolingRate: obj.coolingRate as number,
			pressureDissipation: obj.pressureDissipation as number,
			temperatureInjection: obj.temperatureInjection as number,
			upwardBias: obj.upwardBias as number,
			sootYield: (obj.sootYield as number) ?? 0.04,
			sootCoolThreshold: (obj.sootCoolThreshold as number) ?? 0.3,
			sootCoolRate: (obj.sootCoolRate as number) ?? 0.8,
			sootDissipation: (obj.sootDissipation as number) ?? 2.5,
			sootAdvectionDissipation: (obj.sootAdvectionDissipation as number) ?? 0.97,
		};
	}

	// ------------------------------------------------------------------
	// Private: Parse color curve
	// ------------------------------------------------------------------

	private parseColorCurve(raw: unknown): FuelSourceDocument["colorCurve"] {
		if (typeof raw !== "object" || raw === null) return undefined;

		const obj = raw as Record<string, unknown>;
		const coldColor = this.parseRgbTuple(obj.coldColor);
		const midColor = this.parseRgbTuple(obj.midColor);
		const hotColor = this.parseRgbTuple(obj.hotColor);
		const coreColor = this.parseRgbTuple(obj.coreColor);

		if (!coldColor || !midColor || !hotColor || !coreColor) return undefined;

		return { coldColor, midColor, hotColor, coreColor };
	}

	private parseRgbTuple(raw: unknown): [number, number, number] | null {
		if (!Array.isArray(raw) || raw.length !== 3) return null;
		if (raw.some((v) => typeof v !== "number")) return null;
		return [raw[0], raw[1], raw[2]];
	}

	// ------------------------------------------------------------------
	// Private: Parse charcoal particle params
	// ------------------------------------------------------------------

	private parseCharcoalParams(raw: unknown): FuelSourceDocument["particleParams"] {
		if (typeof raw !== "object" || raw === null) return undefined;

		const obj = raw as Record<string, unknown>;
		const fields = [
			"sparkRate",
			"sparkLifetime",
			"sparkInitialSpeed",
			"sparkScatter",
			"sparkSize",
			"sparkSizeVariance",
			"gravity",
			"dragCoefficient",
			"secondarySparkChance",
			"emberGlowDuration",
			"coolingRate",
			"initialTemperature",
		] as const;

		for (const field of fields) {
			if (typeof obj[field] !== "number") return undefined;
		}

		return {
			sparkRate: obj.sparkRate as number,
			sparkLifetime: obj.sparkLifetime as number,
			sparkInitialSpeed: obj.sparkInitialSpeed as number,
			sparkScatter: obj.sparkScatter as number,
			sparkSize: obj.sparkSize as number,
			sparkSizeVariance: obj.sparkSizeVariance as number,
			gravity: obj.gravity as number,
			dragCoefficient: obj.dragCoefficient as number,
			secondarySparkChance: obj.secondarySparkChance as number,
			emberGlowDuration: obj.emberGlowDuration as number,
			coolingRate: obj.coolingRate as number,
			initialTemperature: obj.initialTemperature as number,
		};
	}

	// ------------------------------------------------------------------
	// Private: Merge Firestore docs with built-in defaults
	// ------------------------------------------------------------------

	private mergeWithBuiltIns(firestoreDocs: FuelSourceDocument[]): void {
		this.fuelSources.clear();

		// Start with built-in defaults
		for (const builtIn of BUILT_IN_FUEL_SOURCES) {
			this.fuelSources.set(builtIn.id, { ...builtIn });
		}

		// Firestore overrides built-in params for matching IDs,
		// and adds any custom (non-built-in) fuels
		for (const fsDoc of firestoreDocs) {
			this.fuelSources.set(fsDoc.id, fsDoc);
		}
	}

	// ------------------------------------------------------------------
	// Private: Apply built-ins only (no Firestore data available)
	// ------------------------------------------------------------------

	private applyBuiltInsOnly(): void {
		this.fuelSources.clear();
		for (const builtIn of BUILT_IN_FUEL_SOURCES) {
			this.fuelSources.set(builtIn.id, { ...builtIn });
		}
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
	// Private: localStorage read/write (cache layer)
	// ------------------------------------------------------------------

	private readLocalStorage(): boolean {
		try {
			const raw = localStorage.getItem(LOCAL_CACHE_KEY);
			if (!raw) return false;

			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) return false;

			const docs: FuelSourceDocument[] = [];
			for (const item of parsed) {
				const doc = this.parseDocument(item.id ?? "", item);
				if (doc) {
					docs.push(doc);
				}
			}

			if (docs.length === 0) return false;

			this.mergeWithBuiltIns(docs);
			return true;
		} catch {
			// Ignore parse errors -- cache is best-effort
			return false;
		}
	}

	private writeLocalStorage(): void {
		try {
			const docs = this.getAll();
			localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(docs));
		} catch {
			// localStorage might be full or unavailable
		}
	}
}
