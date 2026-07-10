import type { CollectionEntry } from "./collection-entry";
import type { FirebaseCollectionRepository } from "./firebase-collection-repository";
import type { LocalCollectionRepository } from "./local-collection-repository";

/**
 * Reactive store for one saved-artifact collection (tunnels, mandalas,
 * 3D scenes). One behavior for all of them:
 *
 * - Signed in: Firestore is the source of truth; writes are optimistic with
 *   rollback so the UI never diverges from the store.
 * - Guest: the local repository persists the collection so saves survive a
 *   reload, and everything migrates to Firestore on sign-in.
 */
export class CollectionState<T extends CollectionEntry> {
  collection = $state<T[]>([]);
  // True while Firestore hydration is in flight, so galleries show a loading
  // indicator instead of mistaking "not loaded yet" for "empty".
  loading = $state(false);
  private userId: string | null = null;
  private localLoaded = false;

  constructor(
    private readonly repo: FirebaseCollectionRepository<T>,
    private readonly localRepo: LocalCollectionRepository<T>,
  ) {}

  async init(userId: string): Promise<void> {
    this.userId = userId;
    this.loading = true;
    try {
      const firebaseEntries = await this.repo.load(userId);
      this.collection = firebaseEntries;
      await this.migrateFromLocalStorage(userId, firebaseEntries);
    } finally {
      this.loading = false;
    }
  }

  /** Guest-mode boot: hydrate from localStorage without a Firestore read. */
  initLocal(): void {
    this.ensureLocalLoaded();
  }

  /**
   * Lazily pull persisted guest entries into the store before the first guest
   * read or mutation, so a guest save never overwrites earlier guest saves
   * that simply hadn't been loaded yet.
   */
  private ensureLocalLoaded(): void {
    if (this.userId || this.localLoaded) return;
    this.localLoaded = true;
    const persisted = this.localRepo.load();
    if (persisted.length === 0) return;
    const known = new Set(this.collection.map((e) => e.id));
    this.collection.push(...persisted.filter((e) => !known.has(e.id)));
  }

  teardown(): void {
    this.collection = [];
    this.loading = false;
    this.userId = null;
    this.localLoaded = false;
  }

  async add(entry: Omit<T, "id" | "createdAt">): Promise<T> {
    this.ensureLocalLoaded();
    const full = {
      ...entry,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    } as T;
    this.collection.unshift(full);

    if (this.userId) {
      try {
        await this.repo.save(this.userId, full);
      } catch (error) {
        const idx = this.collection.findIndex((e) => e.id === full.id);
        if (idx !== -1) this.collection.splice(idx, 1);
        throw error;
      }
    } else {
      this.localRepo.save(this.collection);
    }
    return full;
  }

  async remove(id: string): Promise<void> {
    this.ensureLocalLoaded();
    const idx = this.collection.findIndex((e) => e.id === id);
    if (idx === -1) return;
    const [removed] = this.collection.splice(idx, 1);
    if (this.userId) {
      try {
        await this.repo.remove(this.userId, id);
      } catch (error) {
        if (removed) this.collection.splice(idx, 0, removed);
        throw error;
      }
    } else {
      this.localRepo.save(this.collection);
    }
  }

  /** Rename an entry (immutable swap so $derived consumers re-run). Rolls the
   *  name back if the Firestore write fails. Returns null for a blank name or
   *  unknown id. */
  async rename(id: string, name: string): Promise<T | null> {
    this.ensureLocalLoaded();
    const trimmed = name.trim();
    const idx = this.collection.findIndex((e) => e.id === id);
    if (idx === -1 || !trimmed) return null;
    const prev = this.collection[idx]!;
    if (prev.name === trimmed) return prev;
    const next = { ...prev, name: trimmed } as T;
    this.collection[idx] = next;
    if (this.userId) {
      try {
        await this.repo.save(this.userId, next);
      } catch (error) {
        this.collection[idx] = prev;
        throw error;
      }
    } else {
      this.localRepo.save(this.collection);
    }
    return next;
  }

  get count(): number {
    return this.collection.length;
  }

  private async migrateFromLocalStorage(userId: string, existing: T[]): Promise<void> {
    const localEntries = this.localRepo.load();
    if (localEntries.length === 0) return;

    const existingIds = new Set(existing.map((e) => e.id));
    const toMigrate = localEntries.filter((e) => !existingIds.has(e.id));

    for (const entry of toMigrate) {
      await this.repo.save(userId, entry);
      this.collection.push(entry);
    }

    this.localRepo.clear();
  }
}
