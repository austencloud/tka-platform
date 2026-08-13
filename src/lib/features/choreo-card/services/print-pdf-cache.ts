// Prepared-PDF artifact cache for the deck print pipeline.
//
// Building a front-bearing PDF does more than assemble pages: it allocates one
// serialized identity for every printable card slot, stamps those identities
// into the fronts, and records a completed artwork run. Once that artifact is
// ready, printing or downloading the exact same deck/settings should reuse it.
// A different key means a genuinely new artifact and therefore a new run.

const DB_NAME = "deck-print-pdf-cache";
const STORE_NAME = "artifacts";
const DB_VERSION = 1;
const CACHE_LIMIT = 16;
const MAX_SIZE_BYTES = 256 * 1024 * 1024;

export interface PreparedPrintPDF {
  blob: Blob;
  printRunId: string | null;
}

interface PersistedPrintPDF extends PreparedPrintPDF {
  key: string;
  timestamp: number;
  sizeBytes: number;
}

const memoryCache = new Map<string, PreparedPrintPDF>();
const inFlightBuilds = new Map<string, Promise<PreparedPrintPDF>>();
let dbPromise: Promise<IDBDatabase> | null = null;
let prunePromise: Promise<void> | null = null;

function remember(key: string, artifact: PreparedPrintPDF): void {
  memoryCache.delete(key);
  memoryCache.set(key, artifact);
  while (memoryCache.size > CACHE_LIMIT) {
    const oldest = memoryCache.keys().next().value;
    if (oldest === undefined) break;
    memoryCache.delete(oldest);
  }
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is unavailable"));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, {
          keyPath: "key",
        });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        dbPromise = null;
      };
      resolve(database);
    };
  }).catch((error) => {
    dbPromise = null;
    throw error;
  });

  return dbPromise;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function readPersisted(key: string): Promise<PreparedPrintPDF | null> {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const completed = transactionComplete(transaction);
    const store = transaction.objectStore(STORE_NAME);
    const entry = (await requestResult(store.get(key))) as
      | PersistedPrintPDF
      | undefined;
    if (!entry?.blob || typeof entry.blob.size !== "number") {
      await completed;
      return null;
    }

    store.put({ ...entry, timestamp: Date.now() });
    await completed;
    return { blob: entry.blob, printRunId: entry.printRunId ?? null };
  } catch {
    // The prepared artifact is an optimization. Storage policy, private mode,
    // or quota pressure must never prevent the user from building a fresh PDF.
    return null;
  }
}

async function writePersisted(
  key: string,
  artifact: PreparedPrintPDF
): Promise<void> {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const completed = transactionComplete(transaction);
    transaction.objectStore(STORE_NAME).put({
      key,
      blob: artifact.blob,
      printRunId: artifact.printRunId,
      timestamp: Date.now(),
      sizeBytes: artifact.blob.size,
    } satisfies PersistedPrintPDF);
    await completed;
    await prunePersisted();
  } catch {
    // Memory reuse still works for this session, and the caller already owns a
    // valid artifact. Cache persistence is never a user-facing failure.
  }
}

async function listPersistedEntries(): Promise<
  { key: string; sizeBytes: number }[]
> {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, "readonly");
  const completed = transactionComplete(transaction);
  const index = transaction.objectStore(STORE_NAME).index("timestamp");
  const entries: { key: string; sizeBytes: number }[] = [];

  await new Promise<void>((resolve, reject) => {
    const request = index.openCursor();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve();
        return;
      }
      const entry = cursor.value as PersistedPrintPDF;
      entries.push({ key: entry.key, sizeBytes: entry.sizeBytes });
      cursor.continue();
    };
  });
  await completed;
  return entries;
}

async function prunePersisted(): Promise<void> {
  if (prunePromise) return prunePromise;
  prunePromise = (async () => {
    const entries = await listPersistedEntries();
    let totalSize = entries.reduce(
      (sum, entry) => sum + Math.max(0, entry.sizeBytes),
      0
    );
    const removeCount = Math.max(0, entries.length - CACHE_LIMIT);
    const keysToRemove: string[] = [];

    for (const [index, entry] of entries.entries()) {
      if (index < removeCount || totalSize > MAX_SIZE_BYTES) {
        keysToRemove.push(entry.key);
        totalSize -= Math.max(0, entry.sizeBytes);
      }
    }
    if (keysToRemove.length === 0) return;

    const database = await openDatabase();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const completed = transactionComplete(transaction);
    const store = transaction.objectStore(STORE_NAME);
    for (const key of keysToRemove) store.delete(key);
    await completed;
  })().finally(() => {
    prunePromise = null;
  });
  return prunePromise;
}

/**
 * Return the prepared artifact for `key`, or build it exactly once.
 *
 * The caller owns the key and must include every input that changes the PDF.
 * Failed builds are never retained. Concurrent print/download clicks share the
 * same promise so they cannot allocate duplicate serialized runs.
 */
export async function getOrBuildPrintPDF(
  key: string,
  build: () => Promise<PreparedPrintPDF>
): Promise<PreparedPrintPDF> {
  const memoryHit = memoryCache.get(key);
  if (memoryHit) {
    remember(key, memoryHit);
    return memoryHit;
  }

  const activeBuild = inFlightBuilds.get(key);
  if (activeBuild) return activeBuild;

  const request = (async () => {
    const persisted = await readPersisted(key);
    if (persisted) {
      remember(key, persisted);
      return persisted;
    }

    const artifact = await build();
    remember(key, artifact);
    await writePersisted(key, artifact);
    return artifact;
  })();
  inFlightBuilds.set(key, request);

  try {
    return await request;
  } finally {
    if (inFlightBuilds.get(key) === request) inFlightBuilds.delete(key);
  }
}

/** Clear prepared print artifacts. Used by cache-reset flows and focused tests. */
export async function clearPrintPDFCache(): Promise<void> {
  memoryCache.clear();
  inFlightBuilds.clear();
  try {
    const database = await openDatabase();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const completed = transactionComplete(transaction);
    transaction.objectStore(STORE_NAME).clear();
    await completed;
  } catch {
    // There is nothing else to clear when persistent storage is unavailable.
  }
}
