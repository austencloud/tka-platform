/**
 * Gallery Persistence
 *
 * Persists rendered gallery images to IndexedDB so they survive page refresh.
 */

import type { RenderedImage } from "../../domain/gallery-models";

const DB_NAME = "gallery-generator";
const DB_VERSION = 1;
const STORE_NAME = "rendered-images";

interface StoredImage {
  name: string;
  blob: Blob;
  written: boolean;
  timestamp: number;
}

class GalleryPersistence {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the IndexedDB database
   */
  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error("Failed to open gallery database:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "name" });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Store a rendered image
   */
  async store(name: string, blob: Blob, written: boolean): Promise<void> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      const data: StoredImage = {
        name,
        blob,
        written,
        timestamp: Date.now(),
      };

      const request = store.put(data);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Update written status for an image
   */
  async markWritten(name: string): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      const getRequest = store.get(name);
      getRequest.onsuccess = () => {
        const data = getRequest.result as StoredImage | undefined;
        if (data) {
          data.written = true;
          const putRequest = store.put(data);
          putRequest.onerror = () => reject(putRequest.error);
          putRequest.onsuccess = () => resolve();
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Load all stored images
   */
  async loadAll(): Promise<{
    images: RenderedImage[];
    blobs: Map<string, Blob>;
  }> {
    await this.init();
    if (!this.db) return { images: [], blobs: new Map() };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const stored = request.result as StoredImage[];
        const images: RenderedImage[] = [];
        const blobs = new Map<string, Blob>();

        for (const item of stored) {
          const imageUrl = URL.createObjectURL(item.blob);
          images.push({
            name: item.name,
            imageUrl,
            written: item.written,
          });
          blobs.set(item.name, item.blob);
        }

        resolve({ images, blobs });
      };
    });
  }

  /**
   * Clear all stored images
   */
  async clear(): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Get count of stored images
   */
  async count(): Promise<number> {
    await this.init();
    if (!this.db) return 0;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.count();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }
}

// Singleton instance
export const galleryPersistence = new GalleryPersistence();
