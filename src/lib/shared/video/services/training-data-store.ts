import type { TrainingDataEntry, TrainingDataSource } from "./types";
const DB_NAME = "tka-training-data";
const DB_VERSION = 1;
const STORE_NAME = "entries";

export class TrainingDataStore {
	private dbPromise: Promise<IDBDatabase> | null = null;

	async save(entry: TrainingDataEntry): Promise<void> {
		const db = await this.getDb();
		return new Promise((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, "readwrite");
			tx.objectStore(STORE_NAME).put(entry);
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
	}

	async saveBatch(entries: TrainingDataEntry[]): Promise<void> {
		if (entries.length === 0) return;

		const db = await this.getDb();
		return new Promise((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, "readwrite");
			const store = tx.objectStore(STORE_NAME);
			for (const entry of entries) {
				store.put(entry);
			}
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
	}

	async getBySource(source: TrainingDataSource): Promise<TrainingDataEntry[]> {
		const db = await this.getDb();
		return new Promise((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, "readonly");
			const index = tx.objectStore(STORE_NAME).index("source");
			const req = index.getAll(source);
			req.onsuccess = () => resolve(req.result as TrainingDataEntry[]);
			req.onerror = () => reject(req.error);
		});
	}

	async getByFrame(
		frameIndex: number,
		videoUrl?: string,
	): Promise<TrainingDataEntry[]> {
		const db = await this.getDb();
		return new Promise((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, "readonly");
			const index = tx.objectStore(STORE_NAME).index("frameIndex");
			const req = index.getAll(frameIndex);
			req.onsuccess = () => {
				let results = req.result as TrainingDataEntry[];
				if (videoUrl) {
					results = results.filter((e) => e.videoUrl === videoUrl);
				}
				resolve(results);
			};
			req.onerror = () => reject(req.error);
		});
	}

	async getAll(): Promise<TrainingDataEntry[]> {
		const db = await this.getDb();
		return new Promise((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, "readonly");
			const req = tx.objectStore(STORE_NAME).getAll();
			req.onsuccess = () => resolve(req.result as TrainingDataEntry[]);
			req.onerror = () => reject(req.error);
		});
	}

	async count(source?: TrainingDataSource): Promise<number> {
		const db = await this.getDb();
		return new Promise((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, "readonly");
			let req: IDBRequest<number>;

			if (source) {
				const index = tx.objectStore(STORE_NAME).index("source");
				req = index.count(source);
			} else {
				req = tx.objectStore(STORE_NAME).count();
			}

			req.onsuccess = () => resolve(req.result);
			req.onerror = () => reject(req.error);
		});
	}

	async delete(id: string): Promise<void> {
		const db = await this.getDb();
		return new Promise((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, "readwrite");
			tx.objectStore(STORE_NAME).delete(id);
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
	}

	async clear(source?: TrainingDataSource): Promise<void> {
		if (!source) {
			const db = await this.getDb();
			return new Promise((resolve, reject) => {
				const tx = db.transaction(STORE_NAME, "readwrite");
				tx.objectStore(STORE_NAME).clear();
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
			});
		}

		// Source-scoped clear: delete only entries matching the source.
		const entries = await this.getBySource(source);
		if (entries.length === 0) return;

		const db = await this.getDb();
		return new Promise((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, "readwrite");
			const store = tx.objectStore(STORE_NAME);
			for (const entry of entries) {
				store.delete(entry.id);
			}
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
	}

	async exportAsJson(): Promise<string> {
		const entries = await this.getAll();
		return JSON.stringify(entries, null, 2);
	}

	private getDb(): Promise<IDBDatabase> {
		if (!this.dbPromise) {
			this.dbPromise = this.openDb();
		}
		return this.dbPromise;
	}

	private openDb(): Promise<IDBDatabase> {
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(DB_NAME, DB_VERSION);

			request.onupgradeneeded = () => {
				const db = request.result;
				if (!db.objectStoreNames.contains(STORE_NAME)) {
					const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
					store.createIndex("source", "source", { unique: false });
					store.createIndex("frameIndex", "frameIndex", { unique: false });
				}
			};

			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}
}
