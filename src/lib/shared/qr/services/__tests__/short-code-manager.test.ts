import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory Firestore fake. `store` maps "collection/id" → data. Transactions
// stage writes and apply them on successful completion, like the real SDK.
const store = new Map<string, Record<string, unknown>>();
let transactionRuns = 0;
let queryResults: Array<{ id: string; data: Record<string, unknown> }> = [];
// One-shot OCC-contention injector. Simulates a competing DEVICE that commits
// its own allocation (both the code doc AND the index doc) in the window
// between our transaction reading the index as empty and committing. Firestore
// then forces our transaction to retry; the re-run sees the claimed index and
// adopts the competitor's code. This is the only way to exercise the
// cross-device write-write invariant in-process.
let occInjection:
  | { indexPath: string; competitorDocs: Array<[string, Record<string, unknown>]> }
  | null = null;

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
      // Run the callback once, tracking the paths it read + its staged writes.
      const runCallback = async () => {
        const readPaths = new Set<string>();
        const staged = new Map<string, Record<string, unknown>>();
        const result = await fn({
          get: async (ref) => {
            readPaths.add(ref.path);
            const data = staged.get(ref.path) ?? store.get(ref.path);
            return data
              ? { exists: () => true, data: () => data }
              : { exists: () => false };
          },
          set: (ref, data) => staged.set(ref.path, data),
        });
        return { readPaths, staged, result };
      };

      transactionRuns++;
      let run = await runCallback();

      // OCC contention: a competing writer claimed a doc this callback read as
      // empty, between read and commit. Apply the competitor's writes and
      // re-run the callback ONCE (Firestore's serializable retry). The re-read
      // now sees the conflict and the manager takes its adopt branch. The
      // first attempt's staged writes are DISCARDED — matching a real abort.
      if (
        occInjection &&
        run.readPaths.has(occInjection.indexPath) &&
        !store.has(occInjection.indexPath)
      ) {
        for (const [path, data] of occInjection.competitorDocs) {
          store.set(path, data);
        }
        occInjection = null; // one-shot
        transactionRuns++;
        run = await runCallback();
      }

      for (const [path, data] of run.staged) store.set(path, data);
      return run.result;
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

import { addDoc } from "firebase/firestore";
import { ShortCodeManager } from "../short-code-manager";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

// Steps carry letters: the mint path runs STRICT payload-word derivation and
// rejects a letterless payload (parity-repair spec, shortcode mint path).
const SEQUENCE = {
  id: "seq-1",
  word: "TEST",
  ownerId: "user-1",
  steps: [{ id: "step-1", stepNumber: 1, letter: "A" }],
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
  occInjection = null;
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

  it("loser in a cross-device write-write race retries and adopts the winner's code (OCC)", async () => {
    // COVERED here: the serializable-transaction RETRY path — the load-bearing
    // cross-device invariant of the whole fix. Our allocation reads
    // shortcodeHashes/HASH_A as empty; a competing DEVICE commits its own code
    // doc + index doc in the gap; Firestore re-invokes our callback; the
    // re-read sees the claimed index and adopts "COMP1" instead of minting a
    // duplicate. (Same-tab races are already covered by single-flight above.)
    // NOT covered here — only the manual Task-7 live check can: real Firestore
    // OCC version-conflict detection and genuine multi-client timing. The mock
    // forces the retry deterministically rather than proving Firestore aborts.
    occInjection = {
      indexPath: "shortcodeHashes/HASH_A",
      competitorDocs: [
        [
          "shortcodes/COMP1",
          { encoderHash: "HASH_A", createdAt: "2026-07-05T00:00:00.000Z" },
        ],
        [
          "shortcodeHashes/HASH_A",
          { code: "COMP1", createdAt: "2026-07-05T00:00:00.000Z" },
        ],
      ],
    };
    const manager = makeManager();

    const [a, b] = await Promise.all([
      manager.createShortCode(SEQUENCE, { embedSequenceData: true }),
      manager.createShortCode(SEQUENCE, { bluePropType: "C" }),
    ]);

    expect(a.code).toBe("COMP1");
    expect(b.code).toBe("COMP1");
    expect(a.isNew).toBe(false);
    // Exactly one code doc (the competitor's) + one index doc: our aborted
    // attempt's staged writes were discarded, so NO duplicate was minted.
    expect(docsIn("shortcodes")).toEqual(["shortcodes/COMP1"]);
    expect(docsIn("shortcodeHashes")).toEqual(["shortcodeHashes/HASH_A"]);
    expect(transactionRuns).toBe(2); // initial run + one OCC retry
  });

  it("tie-breaks on smaller doc id when legacy duplicates share a createdAt", async () => {
    // 0ms-apart dups exist in real data; without a deterministic tie-break two
    // clients could converge on different codes for the same hash. Smaller id
    // wins — regardless of the arbitrary query order.
    queryResults = [
      { id: "ZZ99", data: { createdAt: "2026-05-01T00:00:00.000Z" } },
      { id: "AA11", data: { createdAt: "2026-05-01T00:00:00.000Z" } },
    ];
    const manager = makeManager();

    const result = await manager.createShortCode(SEQUENCE, {});

    expect(result.code).toBe("AA11");
    expect(result.isNew).toBe(false);
  });
});

describe("ShortCodeManager scan events", () => {
  it("persists the physical card's resolved prop configuration", async () => {
    vi.mocked(addDoc).mockClear();
    const manager = makeManager();

    await manager.logScanEvent("PROP", {
      printId: "print-1",
      country: "US",
      city: "Chicago",
      userAgent: "test",
      screenWidth: 1200,
      screenHeight: 800,
      referrer: null,
      userId: "user-1",
      deviceId: "device-1",
      bluePropType: "poi",
      redPropType: "fan",
      catDogMode: true,
    });

    expect(vi.mocked(addDoc)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        bluePropType: "poi",
        redPropType: "fan",
        catDogMode: true,
        timestamp: expect.any(String),
      })
    );
  });
});
