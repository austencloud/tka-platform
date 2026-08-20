import {
  _affectedPublicSequenceIds,
  _reconcilePublicPerformanceMetadata,
} from "./syncPublicPerformanceMetadata";

describe("public performance projection", () => {
  it("nominates public creates, removals, and relinks without exposing restricted videos", () => {
    expect(
      _affectedPublicSequenceIds(undefined, {
        sequenceId: "a",
        visibility: "public",
      })
    ).toEqual(["a"]);
    expect(
      _affectedPublicSequenceIds(
        { sequenceId: "a", visibility: "public" },
        { sequenceId: "a", visibility: "private" }
      )
    ).toEqual(["a"]);
    expect(
      _affectedPublicSequenceIds(
        { sequenceId: "a", visibility: "public" },
        { sequenceId: "b", visibility: "public" }
      )
    ).toEqual(["a", "b"]);
    expect(
      _affectedPublicSequenceIds(undefined, {
        sequenceId: "secret",
        visibility: "collaborators-only",
      })
    ).toEqual([]);
  });

  it("writes an exact count and newest public timestamp", async () => {
    const publicSequenceRef = { kind: "public-sequence" };
    const countQuery = { kind: "count" };
    const latestQuery = { kind: "latest" };
    const latestAt = { toMillis: () => 2_000 };
    const update = jest.fn();
    const query = {
      where: jest.fn().mockReturnThis(),
      count: jest.fn(() => countQuery),
      orderBy: jest.fn(() => ({ limit: jest.fn(() => latestQuery) })),
    };
    const get = jest.fn(async (target: unknown) => {
      if (target === publicSequenceRef) return { exists: true };
      if (target === countQuery) return { data: () => ({ count: 3 }) };
      return { docs: [{ data: () => ({ createdAt: latestAt }) }] };
    });
    const db = {
      doc: jest.fn(() => publicSequenceRef),
      collection: jest.fn(() => query),
      runTransaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
        fn({ get, update })
      ),
    };

    await expect(
      _reconcilePublicPerformanceMetadata("seq", db as never)
    ).resolves.toBe(true);

    expect(query.where).toHaveBeenNthCalledWith(1, "sequenceId", "==", "seq");
    expect(query.where).toHaveBeenNthCalledWith(
      2,
      "visibility",
      "==",
      "public"
    );
    expect(update).toHaveBeenCalledWith(publicSequenceRef, {
      publicPerformanceCount: 3,
      latestPublicPerformanceAt: latestAt,
    });
  });

  it("does not recreate an unpublished sequence projection", async () => {
    const update = jest.fn();
    const db = {
      doc: jest.fn(() => ({})),
      collection: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
      })),
      runTransaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
        fn({ get: jest.fn(async () => ({ exists: false })), update })
      ),
    };

    await expect(
      _reconcilePublicPerformanceMetadata("private-seq", db as never)
    ).resolves.toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});
