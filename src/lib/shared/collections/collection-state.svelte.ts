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
  private ownedCollection = $state<T[]>([]);
  private previewCollection = $state<T[] | null>(null);
  private previewUserId = $state<string | null>(null);
  // True while Firestore hydration is in flight, so galleries show a loading
  // indicator instead of mistaking "not loaded yet" for "empty".
  private ownedLoading = $state(false);
  private previewLoading = $state(false);
  private userId: string | null = null;
  private localLoaded = false;
  private startedFor: string | null = null;
  private previewRevision = 0;

  constructor(
    private readonly repo: FirebaseCollectionRepository<T>,
    private readonly localRepo: LocalCollectionRepository<T>
  ) {}

  get collection(): T[] {
    return this.previewCollection ?? this.ownedCollection;
  }

  get loading(): boolean {
    return this.previewUserId ? this.previewLoading : this.ownedLoading;
  }

  get isReadOnlyPreview(): boolean {
    return this.previewUserId !== null;
  }

  /**
   * Hydrate this store for a user, and point its WRITES at them.
   *
   * The uid passed here must always be the signed-in user's. These stores are
   * module-level singletons standing for "my saved art", and this call
   * repoints `add`/`remove`/`rename` as well as the read — so handing it
   * somebody else's uid quietly makes your own saves target their namespace.
   *
   * The profile stage did exactly that while rendering a visited creator, and
   * because ordinary cross-user reads are rejected, `collection` kept the
   * previous user's entries, and one person's saved art rendered on another
   * person's profile. Admin preview uses `startReadOnlyPreview()` so another
   * user's data never becomes this singleton's write target.
   */
  async init(userId: string): Promise<void> {
    this.userId = userId;
    this.startedFor = userId;
    this.ownedLoading = true;
    try {
      const firebaseEntries = await this.repo.load(userId);
      this.ownedCollection = firebaseEntries;
      await this.migrateFromLocalStorage(userId, firebaseEntries);
    } finally {
      this.ownedLoading = false;
    }
  }

  /**
   * Idempotently kick off Firestore hydration for this user. A no-op once
   * already started (or starting) for the current uid, so a lazy consumer
   * (e.g. the Library Art shelf) never races or duplicates the boot-time
   * `init()` auth-boot-orchestrator already triggered. Mirrors
   * collections-state.svelte.ts's `ensureStarted()`.
   */
  ensureStarted(userId: string): void {
    if (this.startedFor === userId) return;
    void this.init(userId);
  }

  /**
   * Show another user's saved Art without repointing this singleton's writes.
   * Preview changes can arrive faster than Firestore; only the newest request
   * may replace what the Library shows.
   */
  async startReadOnlyPreview(userId: string): Promise<void> {
    if (this.previewUserId === userId) return;
    const revision = ++this.previewRevision;
    this.previewUserId = userId;
    this.previewCollection = [];
    this.previewLoading = true;
    try {
      const entries = await this.repo.load(userId);
      if (revision !== this.previewRevision || this.previewUserId !== userId) {
        return;
      }
      this.previewCollection = entries;
    } finally {
      if (revision === this.previewRevision && this.previewUserId === userId) {
        this.previewLoading = false;
      }
    }
  }

  stopReadOnlyPreview(): void {
    this.previewRevision += 1;
    this.previewUserId = null;
    this.previewCollection = null;
    this.previewLoading = false;
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
    const known = new Set(this.ownedCollection.map((e) => e.id));
    this.ownedCollection.push(...persisted.filter((e) => !known.has(e.id)));
  }

  teardown(): void {
    this.ownedCollection = [];
    this.ownedLoading = false;
    this.userId = null;
    this.localLoaded = false;
    this.startedFor = null;
    this.stopReadOnlyPreview();
  }

  private assertWritable(): void {
    if (this.isReadOnlyPreview) {
      throw new Error("Saved Art is read-only while previewing another user");
    }
  }

  async add(entry: Omit<T, "id" | "createdAt">): Promise<T> {
    this.assertWritable();
    this.ensureLocalLoaded();
    const full = {
      ...entry,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    } as T;
    this.ownedCollection.unshift(full);

    if (this.userId) {
      try {
        await this.repo.save(this.userId, full);
      } catch (error) {
        const idx = this.ownedCollection.findIndex((e) => e.id === full.id);
        if (idx !== -1) this.ownedCollection.splice(idx, 1);
        throw error;
      }
    } else {
      this.localRepo.save(this.ownedCollection);
    }
    return full;
  }

  async remove(id: string): Promise<void> {
    this.assertWritable();
    this.ensureLocalLoaded();
    const idx = this.ownedCollection.findIndex((e) => e.id === id);
    if (idx === -1) return;
    const [removed] = this.ownedCollection.splice(idx, 1);
    if (this.userId) {
      try {
        await this.repo.remove(this.userId, id);
      } catch (error) {
        if (removed) this.ownedCollection.splice(idx, 0, removed);
        throw error;
      }
    } else {
      this.localRepo.save(this.ownedCollection);
    }
  }

  /** Rename an entry (immutable swap so $derived consumers re-run). Rolls the
   *  name back if the Firestore write fails. Returns null for a blank name or
   *  unknown id. */
  async rename(id: string, name: string): Promise<T | null> {
    this.assertWritable();
    this.ensureLocalLoaded();
    const trimmed = name.trim();
    const idx = this.ownedCollection.findIndex((e) => e.id === id);
    if (idx === -1 || !trimmed) return null;
    const prev = this.ownedCollection[idx]!;
    if (prev.name === trimmed) return prev;
    const next = { ...prev, name: trimmed } as T;
    this.ownedCollection[idx] = next;
    if (this.userId) {
      try {
        await this.repo.save(this.userId, next);
      } catch (error) {
        this.ownedCollection[idx] = prev;
        throw error;
      }
    } else {
      this.localRepo.save(this.ownedCollection);
    }
    return next;
  }

  get count(): number {
    return this.collection.length;
  }

  private async migrateFromLocalStorage(
    userId: string,
    existing: T[]
  ): Promise<void> {
    const localEntries = this.localRepo.load();
    if (localEntries.length === 0) return;

    const existingIds = new Set(existing.map((e) => e.id));
    const toMigrate = localEntries.filter((e) => !existingIds.has(e.id));

    for (const entry of toMigrate) {
      await this.repo.save(userId, entry);
      this.ownedCollection.push(entry);
    }

    this.localRepo.clear();
  }
}
