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
    expect(
      _affectedPublicSequenceIds(undefined, {
        visibility: "public",
        associations: [
          {
            subjectType: "sequence",
            subjectId: "typed-sequence",
            relationship: "performance",
          },
          {
            subjectType: "tunnel",
            subjectId: "tunnel-1",
            relationship: "realization",
            sourceSequenceId: "lineage-only",
          },
        ],
      })
    ).toEqual(["typed-sequence"]);
  });

  it("writes an exact count and newest public timestamp", async () => {
    const publicSequenceRef = { kind: "public-sequence" };
    const latestAt = { toMillis: () => 2_000 };
    const middleAt = { toMillis: () => 1_000 };
    const firstAt = { toMillis: () => 500 };
    const update = jest.fn();
    const whereCalls: unknown[][] = [];
    const makeQuery = (kind: string) => ({
      kind,
      where(field: string, operator: string, value: string) {
        whereCalls.push([field, operator, value]);
        return makeQuery(`${kind}:${field}`);
      },
    });
    const videos = makeQuery("videos");
    const video = (id: string, createdAt: unknown) => ({
      id,
      data: () => ({ createdAt }),
    });
    const get = jest.fn(async (target: unknown) => {
      if (target === publicSequenceRef) return { exists: true };
      const kind = (target as { kind?: string }).kind ?? "";
      if (kind.includes("sequenceId")) {
        return { docs: [video("legacy", firstAt), video("shared", middleAt)] };
      }
      return { docs: [video("shared", middleAt), video("typed", latestAt)] };
    });
    const db = {
      doc: jest.fn(() => publicSequenceRef),
      collection: jest.fn(() => videos),
      runTransaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
        fn({ get, update })
      ),
    };

    await expect(
      _reconcilePublicPerformanceMetadata("seq", db as never)
    ).resolves.toBe(true);

    expect(whereCalls).toContainEqual(["sequenceId", "==", "seq"]);
    expect(whereCalls).toContainEqual([
      "associationKeys",
      "array-contains",
      "sequence:seq",
    ]);
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
