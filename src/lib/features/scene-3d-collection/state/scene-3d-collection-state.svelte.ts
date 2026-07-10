import type { Collected3DScene } from "../domain/scene-3d-collection-types";
import { LocalScene3DCollectionRepository } from "../services/local-scene-3d-collection-repository";
import { loadScenes, saveScene, removeScene } from "../services/firebase-scene-3d-collection-repository";

const localRepo = new LocalScene3DCollectionRepository();

export class Scene3DCollectionState {
  collection = $state<Collected3DScene[]>([]);
  // True while Firestore hydration is in flight, so the gallery shows a loading
  // indicator instead of mistaking "not loaded yet" for "empty".
  loading = $state(false);
  private userId: string | null = null;
  private initialized = false;

  async init(userId: string): Promise<void> {
    this.userId = userId;
    this.loading = true;
    try {
      const firebaseEntries = await loadScenes(userId);
      this.collection = firebaseEntries;
      await this.migrateFromLocalStorage(userId, firebaseEntries);
      this.initialized = true;
    } finally {
      this.loading = false;
    }
  }

  teardown(): void {
    this.collection = [];
    this.loading = false;
    this.userId = null;
    this.initialized = false;
  }

  async add(scene: Omit<Collected3DScene, "id" | "createdAt">): Promise<Collected3DScene> {
    const entry: Collected3DScene = {
      ...scene,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    this.collection.unshift(entry);

    if (this.userId) {
      await saveScene(this.userId, entry);
    } else {
      // Not signed in — persist to localStorage so the save survives a reload
      // and migrates to Firestore on sign-in.
      localRepo.save(this.collection);
    }
    return entry;
  }

  async remove(id: string): Promise<void> {
    const idx = this.collection.findIndex((s) => s.id === id);
    if (idx === -1) return;
    // Optimistic removal with rollback: re-insert at the same position if the
    // Firestore delete fails, so the UI never diverges from the store.
    const [removed] = this.collection.splice(idx, 1);
    if (this.userId) {
      try {
        await removeScene(this.userId, id);
      } catch (error) {
        if (removed) this.collection.splice(idx, 0, removed);
        throw error;
      }
    } else {
      localRepo.save(this.collection);
    }
  }

  /** Rename a saved scene (immutable entry swap so $derived consumers re-run).
   *  Rolls the name back if the Firestore write fails. */
  async rename(id: string, name: string): Promise<Collected3DScene | null> {
    const trimmed = name.trim();
    const idx = this.collection.findIndex((s) => s.id === id);
    if (idx === -1 || !trimmed) return null;
    const prev = this.collection[idx]!;
    if (prev.name === trimmed) return prev;
    const next: Collected3DScene = { ...prev, name: trimmed };
    this.collection[idx] = next;
    if (this.userId) {
      try {
        await saveScene(this.userId, next);
      } catch (error) {
        this.collection[idx] = prev;
        throw error;
      }
    } else {
      localRepo.save(this.collection);
    }
    return next;
  }

  get count(): number {
    return this.collection.length;
  }

  private async migrateFromLocalStorage(
    userId: string,
    existing: Collected3DScene[],
  ): Promise<void> {
    const localEntries = localRepo.load();
    if (localEntries.length === 0) return;

    const existingIds = new Set(existing.map((s) => s.id));
    const toMigrate = localEntries.filter((s) => !existingIds.has(s.id));

    for (const entry of toMigrate) {
      await saveScene(userId, entry);
      this.collection.push(entry);
    }

    localRepo.clear();
  }
}

export const scene3dCollectionState = new Scene3DCollectionState();
