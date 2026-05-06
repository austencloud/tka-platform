import type { MandalaPaths } from "$lib/shared/mandala/domain/mandala-types";

const DB_NAME = "tka-shape-catalog";
const DB_VERSION = 1;
const STORE_SHAPES = "shapes";
const STORE_META = "meta";

export interface StoredShapeGroup {
  fingerprint: string;
  repPaths: MandalaPaths;
  entries: StoredShapeEntry[];
}

export interface StoredShapeEntry {
  id: string;
  word: string;
  deckId: string;
  deckName: string;
  loopType: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_SHAPES)) {
        db.createObjectStore(STORE_SHAPES, { keyPath: "fingerprint" });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadCachedShapes(): Promise<StoredShapeGroup[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SHAPES, "readonly");
      const store = tx.objectStore(STORE_SHAPES);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as StoredShapeGroup[]);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function saveShapeGroups(groups: StoredShapeGroup[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_SHAPES, "readwrite");
    const store = tx.objectStore(STORE_SHAPES);
    for (const group of groups) {
      store.put(group);
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Silent fail — cache is optional
  }
}

export async function getProcessedDeckIds(): Promise<Set<string>> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_META, "readonly");
      const store = tx.objectStore(STORE_META);
      const req = store.get("processedDecks");
      req.onsuccess = () => {
        const val = req.result as { key: string; deckIds: string[] } | undefined;
        resolve(new Set(val?.deckIds ?? []));
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return new Set();
  }
}

export async function markDecksProcessed(deckIds: string[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_META, "readwrite");
    const store = tx.objectStore(STORE_META);

    const existing = await new Promise<Set<string>>((resolve) => {
      const req = store.get("processedDecks");
      req.onsuccess = () => {
        const val = req.result as { key: string; deckIds: string[] } | undefined;
        resolve(new Set(val?.deckIds ?? []));
      };
      req.onerror = () => resolve(new Set());
    });

    for (const id of deckIds) existing.add(id);
    store.put({ key: "processedDecks", deckIds: [...existing] });

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Silent
  }
}

export async function clearShapeCatalog(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction([STORE_SHAPES, STORE_META], "readwrite");
    tx.objectStore(STORE_SHAPES).clear();
    tx.objectStore(STORE_META).clear();
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Silent
  }
}
