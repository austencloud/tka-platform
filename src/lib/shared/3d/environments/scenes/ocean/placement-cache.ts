const DB_NAME = 'tka-placement-cache';
const DB_VERSION = 1;
const STORE_NAME = 'placements';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CachedRecord {
  hash: string;
  data: string; // JSON-serialized ScenePlacements
  timestamp: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'hash' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function djb2(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

export function hashPlacementInputs(
  configSubset: Record<string, unknown>,
): string {
  return 'placement-v1-' + djb2(JSON.stringify(configSubset));
}

export async function loadCachedPlacements<T>(hash: string): Promise<T | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve) => {
      const req = store.get(hash);
      req.onsuccess = () => {
        const record = req.result as CachedRecord | undefined;
        if (!record) { resolve(null); return; }
        if (Date.now() - record.timestamp > MAX_AGE_MS) { resolve(null); return; }
        try {
          resolve(JSON.parse(record.data) as T);
        } catch {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function storePlacements<T>(hash: string, data: T): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({
      hash,
      data: JSON.stringify(data),
      timestamp: Date.now(),
    } satisfies CachedRecord);
  } catch {
    // Non-fatal
  }
}
