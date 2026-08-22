import { describe, it, expect, beforeEach } from "vitest";
import { CollectionState } from "../collection-state.svelte";
import { LocalCollectionRepository } from "../local-collection-repository";
import type { CollectionEntry } from "../collection-entry";
import type { FirebaseCollectionRepository } from "../firebase-collection-repository";

function makeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

interface FakeRepo extends FirebaseCollectionRepository<CollectionEntry> {
  saved: CollectionEntry[];
  removed: string[];
  failNextSave: boolean;
  failNextRemove: boolean;
  remote: CollectionEntry[];
  remoteByUser: Map<string, CollectionEntry[]>;
  loadedUserIds: string[];
  loadImpl: ((uid: string) => Promise<CollectionEntry[]>) | null;
}

function makeRepo(): FakeRepo {
  const repo: FakeRepo = {
    saved: [],
    removed: [],
    failNextSave: false,
    failNextRemove: false,
    remote: [],
    remoteByUser: new Map(),
    loadedUserIds: [],
    loadImpl: null,
    async load(uid) {
      repo.loadedUserIds.push(uid);
      if (repo.loadImpl) return repo.loadImpl(uid);
      return [...(repo.remoteByUser.get(uid) ?? repo.remote)];
    },
    async save(_uid, entry) {
      if (repo.failNextSave) {
        repo.failNextSave = false;
        throw new Error("save denied");
      }
      repo.saved.push(entry);
    },
    async remove(_uid, id) {
      if (repo.failNextRemove) {
        repo.failNextRemove = false;
        throw new Error("delete denied");
      }
      repo.removed.push(id);
    },
  };
  return repo;
}

const base = { name: "E" };

describe("CollectionState", () => {
  let repo: FakeRepo;
  let local: LocalCollectionRepository<CollectionEntry>;
  let s: CollectionState<CollectionEntry>;

  beforeEach(() => {
    repo = makeRepo();
    local = new LocalCollectionRepository("tka:test", 1, makeStorage());
    s = new CollectionState(repo, local);
  });

  it("add() prepends, assigns id + createdAt, and persists when signed in", async () => {
    await s.init("user-1");
    const entry = await s.add(base);
    expect(entry.id).toBeTruthy();
    expect(typeof entry.createdAt).toBe("number");
    expect(s.collection[0]?.id).toBe(entry.id);
    expect(s.count).toBe(1);
    expect(repo.saved).toHaveLength(1);
  });

  it("add() rolls back when the repo write fails", async () => {
    await s.init("user-1");
    repo.failNextSave = true;
    await expect(s.add(base)).rejects.toThrow("save denied");
    expect(s.count).toBe(0);
  });

  it("guest add()/remove() persist to the local repository", async () => {
    const a = await s.add(base);
    expect(local.load()).toHaveLength(1);
    await s.remove(a.id);
    expect(local.load()).toHaveLength(0);
    expect(repo.saved).toHaveLength(0);
  });

  it("initLocal() hydrates a guest session from localStorage", async () => {
    await s.add(base);
    const fresh = new CollectionState<CollectionEntry>(repo, local);
    fresh.initLocal();
    expect(fresh.count).toBe(1);
  });

  it("init() migrates guest entries to Firestore and clears local", async () => {
    const guestEntry = await s.add(base);
    await s.init("user-1");
    expect(repo.saved.map((e) => e.id)).toContain(guestEntry.id);
    expect(s.count).toBe(1);
    expect(local.load()).toHaveLength(0);
  });

  it("remove() drops the entry and calls the repo", async () => {
    await s.init("user-1");
    const entry = await s.add(base);
    await s.remove(entry.id);
    expect(s.count).toBe(0);
    expect(repo.removed).toEqual([entry.id]);
  });

  it("remove() rolls the entry back into place when the repo delete fails", async () => {
    await s.init("user-1");
    const a = await s.add(base);
    const b = await s.add({ name: "B" }); // b prepends → order [b, a]
    repo.failNextRemove = true;
    await expect(s.remove(a.id)).rejects.toThrow("delete denied");
    expect(s.collection.map((x) => x.id)).toEqual([b.id, a.id]);
  });

  it("rename() swaps the entry immutably, trims, and persists", async () => {
    await s.init("user-1");
    const entry = await s.add(base);
    repo.saved.length = 0;
    const renamed = await s.rename(entry.id, "  Forest stage  ");
    expect(renamed?.name).toBe("Forest stage");
    expect(s.collection[0]?.name).toBe("Forest stage");
    expect(repo.saved).toHaveLength(1);
    expect(await s.rename(entry.id, "   ")).toBeNull();
  });

  it("rename() rolls back when the repo write fails", async () => {
    await s.init("user-1");
    const entry = await s.add(base);
    repo.failNextSave = true;
    await expect(s.rename(entry.id, "Nope")).rejects.toThrow("save denied");
    expect(s.collection[0]?.name).toBe("E");
  });

  it("update() preserves identity and rolls back a failed artifact edit", async () => {
    await s.init("user-1");
    const entry = await s.add(base);
    repo.saved.length = 0;

    const updated = await s.update(entry.id, { name: "Reconstructed tunnel" });
    expect(updated).toMatchObject({
      id: entry.id,
      createdAt: entry.createdAt,
      name: "Reconstructed tunnel",
    });
    expect(repo.saved).toEqual([updated]);

    repo.failNextSave = true;
    await expect(s.update(entry.id, { name: "Lost update" })).rejects.toThrow(
      "save denied"
    );
    expect(s.collection[0]?.name).toBe("Reconstructed tunnel");
  });

  it("shows a separate read-only preview and restores the owner's saved Art", async () => {
    const owned = { id: "owned", name: "Owner Art", createdAt: 1 };
    const previewed = { id: "preview", name: "Preview Art", createdAt: 2 };
    repo.remoteByUser.set("owner", [owned]);
    repo.remoteByUser.set("preview-user", [previewed]);

    await s.init("owner");
    await s.startReadOnlyPreview("preview-user");

    expect(s.isReadOnlyPreview).toBe(true);
    expect(s.collection).toEqual([previewed]);
    expect(repo.loadedUserIds).toEqual(["owner", "preview-user"]);

    const savedBefore = repo.saved.length;
    await expect(s.add(base)).rejects.toThrow("read-only");
    await expect(s.remove(previewed.id)).rejects.toThrow("read-only");
    await expect(s.rename(previewed.id, "Changed")).rejects.toThrow(
      "read-only"
    );
    await expect(s.update(previewed.id, { name: "Changed" })).rejects.toThrow(
      "read-only"
    );
    expect(repo.saved).toHaveLength(savedBefore);
    expect(repo.removed).toHaveLength(0);

    s.stopReadOnlyPreview();
    expect(s.isReadOnlyPreview).toBe(false);
    expect(s.collection).toEqual([owned]);
  });

  it("ignores an older saved-Art preview response after the identity changes", async () => {
    const pending = new Map<string, (entries: CollectionEntry[]) => void>();
    repo.loadImpl = (uid) =>
      new Promise((resolve) => {
        pending.set(uid, resolve);
      });

    const first = s.startReadOnlyPreview("first-user");
    const second = s.startReadOnlyPreview("second-user");
    pending.get("second-user")?.([
      { id: "second", name: "Second", createdAt: 2 },
    ]);
    await second;
    pending.get("first-user")?.([{ id: "first", name: "First", createdAt: 1 }]);
    await first;

    expect(s.collection.map((entry) => entry.id)).toEqual(["second"]);
    expect(s.loading).toBe(false);
  });

  it("teardown() clears state", async () => {
    await s.init("user-1");
    await s.add(base);
    s.teardown();
    expect(s.count).toBe(0);
  });
});
