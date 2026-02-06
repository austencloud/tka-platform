/**
 * Audio Persistence Service
 *
 * Uses IndexedDB to persist audio files across page refreshes.
 * This allows developers to reload the page without re-uploading audio.
 */

const DB_NAME = "tka-audio-cache";
const DB_VERSION = 1;
const STORE_NAME = "audio-files";
const AUDIO_KEY = "current-audio";

interface PersistedAudio {
  key: string;
  file: ArrayBuffer;
  fileName: string;
  mimeType: string;
  duration: number;
  detectedBpm: number | null;
  manualBpm: number | null;
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
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
  });
}

/**
 * Save audio file to IndexedDB
 */
export async function saveAudioToCache(
  file: File,
  duration: number,
  detectedBpm: number | null,
  manualBpm: number | null
): Promise<void> {
  try {
    const db = await openDatabase();
    const arrayBuffer = await file.arrayBuffer();

    const data: PersistedAudio = {
      key: AUDIO_KEY,
      file: arrayBuffer,
      fileName: file.name,
      mimeType: file.type,
      duration,
      detectedBpm,
      manualBpm,
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
  }
}

/**
 * Load audio file from IndexedDB
 */
export async function loadAudioFromCache(): Promise<{
  file: File;
  duration: number;
  detectedBpm: number | null;
  manualBpm: number | null;
} | null> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(AUDIO_KEY);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const data = request.result as PersistedAudio | undefined;
        if (!data) {
          resolve(null);
          return;
        }

        // Convert ArrayBuffer back to File
        const blob = new Blob([data.file], { type: data.mimeType });
        const file = new File([blob], data.fileName, { type: data.mimeType });

        resolve({
          file,
          duration: data.duration,
          detectedBpm: data.detectedBpm,
          manualBpm: data.manualBpm,
        });
      };
    });
  } catch (err) {
    console.warn("Failed to load cached audio:", err);
    return null;
  }
}

/**
 * Clear cached audio from IndexedDB
 */
export async function clearAudioCache(): Promise<void> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(AUDIO_KEY);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        resolve();
      };
    });
  } catch (err) {
    console.warn("Failed to clear audio cache:", err);
  }
}

/**
 * Update cached audio metadata (BPM, duration) without re-saving the file
 */
export async function updateAudioCacheMetadata(
  duration?: number,
  detectedBpm?: number | null,
  manualBpm?: number | null
): Promise<void> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(AUDIO_KEY);

      getRequest.onerror = () => reject(getRequest.error);
      getRequest.onsuccess = () => {
        const data = getRequest.result as PersistedAudio | undefined;
        if (!data) {
          resolve();
          return;
        }

        // Update metadata
        if (duration !== undefined) data.duration = duration;
        if (detectedBpm !== undefined) data.detectedBpm = detectedBpm;
        if (manualBpm !== undefined) data.manualBpm = manualBpm;

        const putRequest = store.put(data);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      };
    });
  } catch (err) {
    console.warn("Failed to update audio cache metadata:", err);
  }
}
