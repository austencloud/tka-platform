/**
 * Audio Library Persistence
 *
 * Uses IndexedDB to cache audio files locally for instant playback.
 * Supports any audio source (uploads, etc.)
 */

const DB_NAME = "tka-audio-library";
const DB_VERSION = 1;
const STORE_NAME = "audio-tracks";

/**
 * Persisted audio data structure
 */
interface PersistedAudio {
  /** Unique track ID (primary key) */
  trackId: string;

  /** Audio file data */
  file: ArrayBuffer;

  /** MIME type (e.g., audio/mpeg, audio/wav) */
  mimeType: string;

  /** Track title for display */
  title: string;

  /** Duration in seconds */
  duration: number;

  /** Thumbnail URL (optional) */
  thumbnailUrl?: string;

  /** File size in bytes */
  fileSize: number;

  /** When this was cached */
  savedAt: number;
}

/**
 * Open the IndexedDB database
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "trackId" });
        store.createIndex("savedAt", "savedAt", { unique: false });
      }
    };
  });
}

/**
 * Save audio to IndexedDB
 */
export async function saveAudio(
  trackId: string,
  audioBlob: Blob,
  metadata: {
    title: string;
    duration: number;
    thumbnailUrl?: string;
  }
): Promise<void> {
  try {
    const db = await openDatabase();
    const arrayBuffer = await audioBlob.arrayBuffer();

    const data: PersistedAudio = {
      trackId,
      file: arrayBuffer,
      mimeType: audioBlob.type || "audio/mpeg",
      title: metadata.title,
      duration: metadata.duration,
      thumbnailUrl: metadata.thumbnailUrl,
      fileSize: arrayBuffer.byteLength,
      savedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(data);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        resolve();
      };
    });
  } catch (err) {
    console.warn("Failed to cache audio:", err);
    throw err;
  }
}

/**
 * Load audio from IndexedDB
 */
export async function loadAudio(trackId: string): Promise<{
  blob: Blob;
  metadata: { title: string; duration: number; thumbnailUrl?: string };
} | null> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(trackId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const data = request.result as PersistedAudio | undefined;
        if (!data) {
          resolve(null);
          return;
        }

        const blob = new Blob([data.file], { type: data.mimeType });
        resolve({
          blob,
          metadata: {
            title: data.title,
            duration: data.duration,
            thumbnailUrl: data.thumbnailUrl,
          },
        });
      };
    });
  } catch (err) {
    console.warn("Failed to load cached audio:", err);
    return null;
  }
}

/**
 * Check if audio is cached locally
 */
export async function hasAudio(trackId: string): Promise<boolean> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getKey(trackId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        resolve(request.result !== undefined);
      };
    });
  } catch (err) {
    console.warn("Failed to check audio cache:", err);
    return false;
  }
}

/**
 * Delete audio from IndexedDB
 */
export async function deleteAudio(trackId: string): Promise<void> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(trackId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        resolve();
      };
    });
  } catch (err) {
    console.warn("Failed to delete audio from cache:", err);
    throw err;
  }
}

/**
 * List all cached track IDs
 */
export async function listCachedTrackIds(): Promise<string[]> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAllKeys();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        resolve(request.result as string[]);
      };
    });
  } catch (err) {
    console.warn("Failed to list cached audio:", err);
    return [];
  }
}

/**
 * Get total storage used by cached audio
 */
export async function getAudioStorageSize(): Promise<number> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const items = request.result as PersistedAudio[];
        const totalSize = items.reduce((sum, item) => sum + item.fileSize, 0);
        resolve(totalSize);
      };
    });
  } catch (err) {
    console.warn("Failed to calculate audio storage:", err);
    return 0;
  }
}

/**
 * Clear all cached audio
 */
export async function clearAllAudio(): Promise<number> {
  try {
    const sizeBeforeClear = await getAudioStorageSize();
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        resolve(sizeBeforeClear);
      };
    });
  } catch (err) {
    console.warn("Failed to clear audio cache:", err);
    return 0;
  }
}
