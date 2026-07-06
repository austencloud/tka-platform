import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory Firestore fake. `store` maps "collection/id" → data. Transactions
// stage writes and apply them on successful completion, like the real SDK.
const store = new Map<string, Record<string, unknown>>();
let transactionRuns = 0;
let queryResults: Array<{ id: string; data: Record<string, unknown> }> = [];

vi.mock("firebase/firestore", () => ({
  addDoc: vi.fn(),
  collection: vi.fn((_db: unknown, name: string) => ({ collection: name })),
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({
    path: segments.join("/"),
  })),
  getDoc: vi.fn(async (ref: { path: string }): Promise<unknown> => {
    const data = store.get(ref.path);
    return data
      ? { exists: () => true, id: ref.path.split("/").pop(), data: () => data }
      : { exists: () => false };
  }),
  setDoc: vi.fn(async (ref: { path: string }, data: Record<string, unknown>) => {
    store.set(ref.path, data);
  }),
  query: vi.fn(() => ({})),
  where: vi.fn(),
  getDocs: vi.fn(async () => ({
    empty: queryResults.length === 0,
    docs: queryResults.map((r) => ({ id: r.id, data: () => r.data })),
  })),
  updateDoc: vi.fn(),
  increment: vi.fn(),
  runTransaction: vi.fn(
    async (
      _db: unknown,
      fn: (tx: {
        get: (ref: { path: string }) => Promise<unknown>;
        set: (ref: { path: string }, data: Record<string, unknown>) => void;
      }) => Promise<unknown>
    ) => {
      transactionRuns++;
      const staged = new Map<string, Record<string, unknown>>();
      const result = await fn({
        get: async (ref) => {
          const data = staged.get(ref.path) ?? store.get(ref.path);
          return data
            ? { exists: () => true, data: () => data }
            : { exists: () => false };
        },
        set: (ref, data) => staged.set(ref.path, data),
      });
      for (const [path, data] of staged) store.set(path, data);
      return result;
    }
  ),
}));
vi.mock("$lib/shared/auth/firebase", () => ({
  getFirestoreInstance: vi.fn(async () => ({})),
}));
vi.mock("$lib/shared/navigation/services/sequence-encoder", () => ({
  encodeSequenceForQR: vi.fn(async () => "s~test-blob"),
  isInlineEncoded: (s: string) => s.startsWith("s~"),
  decodeSequenceFromQR: vi.fn(),
}));

import { ShortCodeManager } from "../short-code-manager";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

const SEQUENCE = {
  id: "seq-1",
  word: "TEST",
  ownerId: "user-1",
  steps: [{ id: "step-1" }],
} as unknown as SequenceData;

const hashMatcher = {
  computeEncoderHash: vi.fn(async () => "HASH_A"),
} as never;

function makeManager() {
  const browseLoader = { loadFullSequenceData: vi.fn(async () => null) };
  return new ShortCodeManager(browseLoader as never, hashMatcher);
}

function docsIn(collectionName: string): string[] {
  return [...store.keys()].filter((k) => k.startsWith(`${collectionName}/`));
}

beforeEach(() => {
  store.clear();
  transactionRuns = 0;
  queryResults = [];
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404 })));
});

describe("ShortCodeManager allocation", () => {
  it("two concurrent calls with different options mint ONE code (the 2026-07-05 dup-mint race)", async () => {
    const manager = makeManager();
    // Exactly the two production call sites: overlay state (embed, no props)
    // and QR generator (lean, prop options). Pre-fix these used different
    // single-flight scopes and each wrote its own doc — 1,044 dup groups.
    const [a, b] = await Promise.all([
      manager.createShortCode(SEQUENCE, { embedSequenceData: true }),
      manager.createShortCode(SEQUENCE, { bluePropType: "C", redPropType: "C" }),
    ]);

    expect(a.code).toBe(b.code);
    expect(docsIn("shortcodes")).toHaveLength(1);
    expect(docsIn("shortcodeHashes")).toEqual([`shortcodeHashes/HASH_A`]);
    expect(store.get("shortcodeHashes/HASH_A")?.code).toBe(a.code);
    // Each caller still gets a URL shaped by its OWN options.
    expect(b.url).toContain("bp=C");
    expect(b.url).toContain("rp=C");
    expect(a.url).not.toContain("bp=");
  });

  it("adopts the code from an existing hash-index doc instead of minting", async () => {
    store.set("shortcodeHashes/HASH_A", { code: "OLD1" });
    const manager = makeManager();

    const result = await manager.createShortCode(SEQUENCE, {});

    expect(result.code).toBe("OLD1");
    expect(result.isNew).toBe(false);
    expect(docsIn("shortcodes")).toHaveLength(0);
  });

  it("picks the OLDEST doc when legacy duplicates exist for a hash", async () => {
    queryResults = [
      { id: "NEW1", data: { createdAt: "2026-06-01T00:00:00.000Z" } },
      { id: "OLD9", data: { createdAt: "2026-05-01T00:00:00.000Z" } },
    ];
    const manager = makeManager();

    const result = await manager.createShortCode(SEQUENCE, {});

    expect(result.code).toBe("OLD9");
    expect(result.isNew).toBe(false);
  });

  it("second sequential call resolves from cache without another transaction", async () => {
    const manager = makeManager();
    const first = await manager.createShortCode(SEQUENCE, {});
    const runsAfterFirst = transactionRuns;

    const second = await manager.createShortCode(SEQUENCE, {
      bluePropType: "F",
    });

    expect(second.code).toBe(first.code);
    expect(transactionRuns).toBe(runsAfterFirst);
    expect(second.url).toContain("bp=F");
  });
});
