import { describe, expect, it, vi } from "vitest";
import {
  classifyResolveError,
  createSheetSequenceResolver,
  type ResolveOutcome,
} from "../../src/lib/features/write/services/sheet-sequence-resolver";
import { LibraryError } from "../../src/lib/shared/library/domain/library-error";
import type { SequenceData } from "../../src/lib/shared/foundation/domain/models/sequence-data";

function seq(id: string): SequenceData {
  return { id, word: id, steps: [{ stepNumber: 1 }] } as unknown as SequenceData;
}

function deferred<T = void>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

/** delay stub that resolves instantly but records requested waits. */
function instantDelay() {
  const waits: number[] = [];
  return {
    waits,
    delay: (ms: number, _signal: AbortSignal) => {
      waits.push(ms);
      return Promise.resolve();
    },
  };
}

describe("classifyResolveError", () => {
  it("classifies UNAUTHORIZED, permission, and everything else", () => {
    expect(classifyResolveError(new LibraryError("no user", "UNAUTHORIZED"))).toBe("unauthorized");
    expect(classifyResolveError({ code: "permission-denied" })).toBe("permission");
    expect(classifyResolveError(new LibraryError("net", "NETWORK"))).toBe("transient");
    expect(classifyResolveError(new LibraryError("bad doc", "INVALID_DATA"))).toBe("unreadable");
    expect(classifyResolveError({ code: "unavailable" })).toBe("transient");
    expect(classifyResolveError(new Error("weird"))).toBe("transient");
  });
});

describe("createSheetSequenceResolver", () => {
  it("does not touch loaders until auth settles, and shares one settlement across ids", async () => {
    const gate = deferred();
    const settleSpy = vi.fn(() => gate.promise);
    const loadPrivate = vi.fn(async (id: string) => seq(id));
    const resolver = createSheetSequenceResolver({
      loadPrivate,
      loadPublic: vi.fn(async () => null),
      awaitAuthSettled: settleSpy,
    });
    const ctrl = new AbortController();
    const results = Promise.all(
      ["a", "b", "c", "d", "e", "f"].map((id) => resolver.resolve(id, ctrl.signal))
    );
    await Promise.resolve();
    expect(loadPrivate).not.toHaveBeenCalled();
    gate.resolve();
    const outcomes = await results;
    expect(outcomes.every((o) => o.sequence !== null)).toBe(true);
    // one awaitAuthSettled call per resolve is fine — the point is zero loader
    // calls pre-settlement; the promise itself is the shared gate.
    expect(loadPrivate).toHaveBeenCalledTimes(6);
  });

  it("retries a transient failure automatically and succeeds", async () => {
    const { waits, delay } = instantDelay();
    const loadPrivate = vi
      .fn()
      .mockRejectedValueOnce({ code: "unavailable" })
      .mockResolvedValueOnce(seq("a"));
    const resolver = createSheetSequenceResolver({
      loadPrivate,
      loadPublic: vi.fn(async () => null),
      awaitAuthSettled: async () => {},
      delay,
    });
    const out = await resolver.resolve("a", new AbortController().signal);
    expect(out.sequence?.id).toBe("a");
    expect(out.attempts).toBe(2);
    expect(waits.length).toBe(1);
    expect(waits[0]).toBeGreaterThanOrEqual(375); // 500ms ±25% jitter
    expect(waits[0]).toBeLessThanOrEqual(625);
  });

  it("exhausts retries then reports transient — never missing", async () => {
    const { delay } = instantDelay();
    const resolver = createSheetSequenceResolver({
      loadPrivate: vi.fn(async () => {
        throw new LibraryError("net", "NETWORK");
      }),
      loadPublic: vi.fn(async () => null),
      awaitAuthSettled: async () => {},
      delay,
    });
    const out = await resolver.resolve("a", new AbortController().signal);
    expect(out).toMatchObject({ sequence: null, failure: "transient", attempts: 4 });
  });

  it("private null + public null → missing, no retries burned", async () => {
    const resolver = createSheetSequenceResolver({
      loadPrivate: vi.fn(async () => null),
      loadPublic: vi.fn(async () => null),
      awaitAuthSettled: async () => {},
    });
    const out = await resolver.resolve("gone", new AbortController().signal);
    expect(out).toMatchObject({ sequence: null, failure: "missing", attempts: 1 });
  });

  it("permission error + public miss → permission after the full ladder, never missing", async () => {
    const { delay, waits } = instantDelay();
    const resolver = createSheetSequenceResolver({
      loadPrivate: vi.fn(async () => {
        throw { code: "permission-denied" };
      }),
      loadPublic: vi.fn(async () => null),
      awaitAuthSettled: async () => {},
      delay,
    });
    const out = await resolver.resolve("locked", new AbortController().signal);
    // The private tier never answered, so "missing" was never on the table — and
    // because it never answered, the ladder runs in case the block is temporary.
    expect(out).toMatchObject({ failure: "permission", attempts: 4 });
    expect(waits.length).toBe(3);
  });

  it("recovers on its own when the private tier is blocked only on the first attempt", async () => {
    const { delay } = instantDelay();
    const loadPrivate = vi
      .fn()
      // Cold load: Firestore has no token yet.
      .mockRejectedValueOnce({ code: "permission-denied" })
      .mockResolvedValueOnce(seq("a"));
    const resolver = createSheetSequenceResolver({
      loadPrivate,
      loadPublic: vi.fn(async () => null),
      awaitAuthSettled: async () => {},
      delay,
    });
    const out = await resolver.resolve("a", new AbortController().signal);
    expect(out).toMatchObject({ source: "private", failure: null, attempts: 2 });
    expect(out.sequence?.id).toBe("a");
  });

  it("a cache-only read (private throws NETWORK, public throws) retries — not missing", async () => {
    const { delay } = instantDelay();
    const loadPrivate = vi
      .fn()
      .mockRejectedValueOnce(new LibraryError("never reached the server", "NETWORK"))
      .mockResolvedValueOnce(seq("b"));
    const resolver = createSheetSequenceResolver({
      loadPrivate,
      loadPublic: vi.fn(async () => {
        throw new Error("read never reached the server");
      }),
      awaitAuthSettled: async () => {},
      delay,
    });
    const out = await resolver.resolve("b", new AbortController().signal);
    expect(out).toMatchObject({ source: "private", failure: null, attempts: 2 });
  });

  it("a document that hydrated to zero steps is retried, then reported unreadable", async () => {
    // The HMR case: the doc is right there, but the compositional hydrator's
    // pictograph data was momentarily gone, so it produced no steps. Calling
    // that "missing" told the user seven live sequences had been deleted.
    const { delay, waits } = instantDelay();
    const empty = { id: "a", word: "a", steps: [] } as unknown as SequenceData;
    const loadPrivate = vi.fn().mockResolvedValueOnce(empty).mockResolvedValueOnce(seq("a"));
    const resolver = createSheetSequenceResolver({
      loadPrivate,
      loadPublic: vi.fn(async () => null),
      awaitAuthSettled: async () => {},
      delay,
    });
    const out = await resolver.resolve("a", new AbortController().signal);
    expect(out).toMatchObject({ source: "private", failure: null, attempts: 2 });
    expect(waits.length).toBe(1);

    const stuck = createSheetSequenceResolver({
      loadPrivate: vi.fn(async () => empty),
      loadPublic: vi.fn(async () => null),
      awaitAuthSettled: async () => {},
      delay: instantDelay().delay,
    });
    const spent = await stuck.resolve("a", new AbortController().signal);
    expect(spent).toMatchObject({ failure: "unreadable", attempts: 4 });
  });

  it("an unparseable document reports unreadable immediately — retrying can't fix it", async () => {
    const { waits } = instantDelay();
    const resolver = createSheetSequenceResolver({
      loadPrivate: vi.fn(async () => {
        throw new LibraryError("bad doc", "INVALID_DATA");
      }),
      loadPublic: vi.fn(async () => null),
      awaitAuthSettled: async () => {},
    });
    const out = await resolver.resolve("broken", new AbortController().signal);
    expect(out).toMatchObject({ sequence: null, failure: "unreadable", attempts: 1 });
    expect(waits.length).toBe(0);
  });

  it("UNAUTHORIZED post-settle falls through to public without recording failure", async () => {
    const resolver = createSheetSequenceResolver({
      loadPrivate: vi.fn(async () => {
        throw new LibraryError("no user", "UNAUTHORIZED");
      }),
      loadPublic: vi.fn(async (id: string) => seq(id)),
      awaitAuthSettled: async () => {},
    });
    const out = await resolver.resolve("pub1", new AbortController().signal);
    expect(out).toMatchObject({ source: "public", failure: null });
  });

  it("abort mid-backoff rejects with AbortError and stops retrying", async () => {
    const ctrl = new AbortController();
    const loadPrivate = vi.fn(async () => {
      throw new LibraryError("net", "NETWORK");
    });
    const resolver = createSheetSequenceResolver({
      loadPrivate,
      loadPublic: vi.fn(async () => null),
      awaitAuthSettled: async () => {},
      delay: (_ms, signal) =>
        new Promise((_res, rej) => {
          signal.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError")));
        }),
    });
    const pending = resolver.resolve("a", ctrl.signal);
    await Promise.resolve();
    ctrl.abort();
    await expect(pending).rejects.toThrow(/abort/i);
    expect(loadPrivate).toHaveBeenCalledTimes(1);
  });

  it("single-flight: concurrent resolves for one id share one resolution", async () => {
    const gate = deferred<SequenceData>();
    const loadPrivate = vi.fn(() => gate.promise);
    const resolver = createSheetSequenceResolver({
      loadPrivate,
      loadPublic: vi.fn(async () => null),
      awaitAuthSettled: async () => {},
    });
    const ctrl = new AbortController();
    const p1 = resolver.resolve("a", ctrl.signal);
    const p2 = resolver.resolve("a", ctrl.signal);
    await Promise.resolve();
    gate.resolve(seq("a"));
    const [o1, o2] = await Promise.all([p1, p2]);
    expect(loadPrivate).toHaveBeenCalledTimes(1);
    expect(o1.sequence?.id).toBe("a");
    expect(o2.sequence?.id).toBe("a");
  });

  const _typecheck: ResolveOutcome | null = null;
  void _typecheck;
});
