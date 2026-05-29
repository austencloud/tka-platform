/**
 * TrainingDataPersister - IndexedDB storage for verified training pairs
 *
 * Stores training pairs locally in IndexedDB for fast access.
 * Provides CRUD operations, statistics, and bulk export.
 * Firebase sync is a planned feature (interface defined, not implemented yet).
 *
 * Follows the same IndexedDB pattern as MLTrainingStorageManager.
 */

import type {
  TrainingPair,
  TrainingDataStats,
} from "../domain/training-models";
const DB_NAME = "skel2tka-training";
const DB_VERSION = 1;

const STORES = {
  PAIRS: "training-pairs",
} as const;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORES.PAIRS)) {
        const store = db.createObjectStore(STORES.PAIRS, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("synced", "synced", { unique: false });
        store.createIndex("phase", "input.phase", { unique: false });
      }
    };
  });
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function promisifyTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export class TrainingDataPersister {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.db) return;
    if (!this.initPromise) {
      this.initPromise = openDatabase().then((db) => {
        this.db = db;
      });
    }
    await this.initPromise;
  }

  private getDb(): IDBDatabase {
    if (!this.db) {
      throw new Error(
        "TrainingDataPersister not initialized. Call initialize() first."
      );
    }
    return this.db;
  }

  async save(pair: TrainingPair): Promise<void> {
    const db = this.getDb();
    const tx = db.transaction(STORES.PAIRS, "readwrite");
    const store = tx.objectStore(STORES.PAIRS);
    store.put(pair);
    await promisifyTransaction(tx);
  }

  async get(id: string): Promise<TrainingPair | null> {
    const db = this.getDb();
    const tx = db.transaction(STORES.PAIRS, "readonly");
    const store = tx.objectStore(STORES.PAIRS);
    const result = await promisifyRequest(store.get(id));
    return (result as TrainingPair) ?? null;
  }

  async list(): Promise<TrainingPair[]> {
    const db = this.getDb();
    const tx = db.transaction(STORES.PAIRS, "readonly");
    const store = tx.objectStore(STORES.PAIRS);
    const index = store.index("createdAt");

    const pairs: TrainingPair[] = [];
    const request = index.openCursor(null, "prev"); // newest first

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          pairs.push(cursor.value as TrainingPair);
          cursor.continue();
        } else {
          resolve(pairs);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async listByPhase(phase: number): Promise<TrainingPair[]> {
    const all = await this.list();
    return all.filter((p) => p.input.phase === phase);
  }

  async delete(id: string): Promise<void> {
    const db = this.getDb();
    const tx = db.transaction(STORES.PAIRS, "readwrite");
    const store = tx.objectStore(STORES.PAIRS);
    store.delete(id);
    await promisifyTransaction(tx);
  }

  async getStats(): Promise<TrainingDataStats> {
    const pairs = await this.list();

    const stats: TrainingDataStats = {
      totalPairs: pairs.length,
      acceptedPairs: 0,
      correctedPairs: 0,
      syncedPairs: 0,
      unsyncedPairs: 0,
      byPhase: {},
    };

    for (const pair of pairs) {
      if (pair.output.verificationMethod === "accepted") {
        stats.acceptedPairs++;
      } else {
        stats.correctedPairs++;
      }

      if (pair.synced) {
        stats.syncedPairs++;
      } else {
        stats.unsyncedPairs++;
      }

      const phase = pair.input.phase;
      stats.byPhase[phase] = (stats.byPhase[phase] ?? 0) + 1;
    }

    return stats;
  }

  async syncToFirebase(): Promise<number> {
    // Firebase sync is a planned feature.
    // For now, return 0 to indicate no pairs synced.
    // Implementation will follow the R2VideoUploader pattern
    // when Firebase storage for training data is set up.
    console.warn(
      "[TrainingDataPersister] Firebase sync not yet implemented"
    );
    return 0;
  }

  async exportAll(): Promise<TrainingPair[]> {
    return this.list();
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
    }
  }
}
