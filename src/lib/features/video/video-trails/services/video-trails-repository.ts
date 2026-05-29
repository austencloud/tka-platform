import type { VideoTrailsProject } from "../domain/types";

const DB_NAME = "tka-video-trails";
const DB_VERSION = 1;
const STORE_NAME = "projects";
const INDEX_KEY = "video-trails-project-index";

export class VideoTrailsRepository {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  async save(project: VideoTrailsProject): Promise<void> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(project);
      tx.oncomplete = () => {
        this.updateIndex(project);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  async load(id: string): Promise<VideoTrailsProject | null> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(id);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async list(): Promise<VideoTrailsProject[]> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(id: string): Promise<void> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => {
        this.removeFromIndex(id);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  private updateIndex(project: VideoTrailsProject): void {
    const index = this.getIndex();
    const existing = index.findIndex((e) => e.id === project.id);
    const entry = { id: project.id, title: project.title, updatedAt: project.updatedAt };
    if (existing >= 0) index[existing] = entry;
    else index.push(entry);
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  }

  private removeFromIndex(id: string): void {
    const index = this.getIndex().filter((e) => e.id !== id);
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  }

  private getIndex(): { id: string; title: string; updatedAt: string }[] {
    try {
      return JSON.parse(localStorage.getItem(INDEX_KEY) || "[]");
    } catch {
      return [];
    }
  }
}
