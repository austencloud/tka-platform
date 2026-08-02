import {
  _applyLibraryCountEvent,
  _reconcileLibraryCountsOnProfileCreate,
} from "./syncLibraryCounts";

function eventHarness(options: {
  profileExists?: boolean;
  ledgerExists?: boolean;
  ready?: boolean;
  cutoff?: number;
}) {
  const refs = {
    profile: { path: "users/uid" },
    state: { path: "users/uid/system/libraryCounts" },
    ledger: { path: "users/uid/libraryCountEvents/event-1" },
  };
  const update = jest.fn();
  const create = jest.fn();
  const get = jest.fn(async (ref: { path: string }) => {
    if (ref === refs.profile)
      return { exists: options.profileExists ?? true, data: () => ({}) };
    if (ref === refs.state)
      return {
        exists: true,
        data: () => ({
          ready: options.ready ?? true,
          cutoff: { toMillis: () => options.cutoff ?? 1_000 },
        }),
      };
    return { exists: options.ledgerExists ?? false, data: () => ({}) };
  });
  return {
    refs,
    update,
    create,
    db: {
      doc: jest.fn((path: string) =>
        path.includes("/system/")
          ? refs.state
          : path.includes("/libraryCountEvents/")
            ? refs.ledger
            : refs.profile
      ),
      runTransaction: jest.fn(
        (callback: (transaction: unknown) => Promise<void>) =>
          callback({ get, update, create })
      ),
    },
  };
}

const baseEvent = {
  userId: "uid",
  kind: "sequences" as const,
  delta: 1 as const,
  eventId: "event-1",
  eventTime: new Date(2_000),
  counted: true,
};

describe("library profile count events", () => {
  it("applies a post-reconciliation event with an atomic increment", async () => {
    const harness = eventHarness({ ready: true, cutoff: 1_000 });

    await expect(
      _applyLibraryCountEvent(baseEvent, harness.db as never, (delta) => ({
        increment: delta,
      }))
    ).resolves.toBe(false);

    expect(harness.update).toHaveBeenCalledWith(harness.refs.profile, {
      sequenceCount: { increment: 1 },
    });
    expect(harness.create).toHaveBeenCalledWith(
      harness.refs.ledger,
      expect.objectContaining({
        applied: true,
        processedAt: expect.objectContaining({
          toMillis: expect.any(Function),
        }),
        expiresAt: expect.objectContaining({ toMillis: expect.any(Function) }),
      })
    );
    const ledger = harness.create.mock.calls[0]![1];
    expect(ledger.expiresAt.toMillis() - ledger.processedAt.toMillis()).toBe(
      30 * 24 * 60 * 60 * 1_000
    );
  });

  it("applies collection deletes as atomic decrements", async () => {
    const harness = eventHarness({ ready: true, cutoff: 1_000 });

    await _applyLibraryCountEvent(
      {
        ...baseEvent,
        kind: "collections",
        delta: -1,
        eventId: "delete-1",
      },
      harness.db as never,
      (delta) => ({ increment: delta })
    );

    expect(harness.update).toHaveBeenCalledWith(harness.refs.profile, {
      collectionCount: { increment: -1 },
    });
  });

  it("is idempotent when Eventarc redelivers the same event", async () => {
    const harness = eventHarness({ ledgerExists: true });

    await expect(
      _applyLibraryCountEvent(baseEvent, harness.db as never, jest.fn())
    ).resolves.toBe(false);

    expect(harness.update).not.toHaveBeenCalled();
    expect(harness.create).not.toHaveBeenCalled();
  });

  it("ledgers but does not double-count an event covered by aggregation", async () => {
    const harness = eventHarness({ ready: true, cutoff: 2_000 });

    await expect(
      _applyLibraryCountEvent(baseEvent, harness.db as never, jest.fn())
    ).resolves.toBe(false);

    expect(harness.update).not.toHaveBeenCalled();
    expect(harness.create).toHaveBeenCalledWith(
      harness.refs.ledger,
      expect.objectContaining({ applied: false })
    );
  });

  it("ledgers without incrementing while the initial baseline is pending", async () => {
    const harness = eventHarness({ ready: false });

    await expect(
      _applyLibraryCountEvent(baseEvent, harness.db as never, jest.fn())
    ).resolves.toBe(true);

    expect(harness.update).not.toHaveBeenCalled();
    expect(harness.create).toHaveBeenCalled();
  });

  it("cannot resurrect a profile deleted during cleanup", async () => {
    const harness = eventHarness({ profileExists: false });

    await expect(
      _applyLibraryCountEvent(baseEvent, harness.db as never, jest.fn())
    ).resolves.toBe(false);

    expect(harness.update).not.toHaveBeenCalled();
    expect(harness.create).not.toHaveBeenCalled();
  });

  it("does no Firestore work for a system collection event", async () => {
    const harness = eventHarness({});

    await expect(
      _applyLibraryCountEvent(
        { ...baseEvent, kind: "collections", counted: false },
        harness.db as never,
        jest.fn()
      )
    ).resolves.toBe(false);

    expect(harness.db.runTransaction).not.toHaveBeenCalled();
  });

  it("requests reconciliation again when a prior baseline attempt failed", async () => {
    const harness = eventHarness({ ready: false, ledgerExists: true });

    await expect(
      _applyLibraryCountEvent(baseEvent, harness.db as never, jest.fn())
    ).resolves.toBe(true);

    expect(harness.update).not.toHaveBeenCalled();
    expect(harness.create).not.toHaveBeenCalled();
  });
});

describe("profile-create count reconciliation", () => {
  it("uses count aggregations and subtracts every current system marker", async () => {
    const profileRef = { path: "users/uid" };
    const stateRef = { path: "users/uid/system/libraryCounts" };
    const aggregate = (name: string) => ({ name });
    const sequenceQuery = { count: () => aggregate("sequences") };
    const collectionQuery = {
      count: () => aggregate("collections"),
      where: (_field: string, op: string) => ({
        count: () => aggregate(op === "in" ? "typed-system" : "null-system"),
      }),
    };
    const update = jest.fn();
    const set = jest.fn();
    const readTime = { toMillis: () => 5_000 };
    const counts: Record<string, number> = {
      sequences: 3,
      collections: 5,
      "typed-system": 2,
      "null-system": 1,
    };
    const get = jest.fn(async (ref: { path?: string; name?: string }) => {
      if (ref === profileRef) return { exists: true, data: () => ({}) };
      if (ref === stateRef) return { exists: false, data: () => undefined };
      return {
        data: () => ({ count: counts[ref.name!] }),
        readTime,
      };
    });
    const db = {
      doc: jest.fn((path: string) =>
        path.includes("/system/") ? stateRef : profileRef
      ),
      collection: jest.fn((path: string) =>
        path.endsWith("/sequences") ? sequenceQuery : collectionQuery
      ),
      runTransaction: jest.fn(
        (callback: (transaction: unknown) => Promise<void>) =>
          callback({ get, update, set })
      ),
    };

    await _reconcileLibraryCountsOnProfileCreate("uid", db as never);

    expect(update).toHaveBeenCalledWith(profileRef, {
      sequenceCount: 3,
      collectionCount: 2,
    });
    expect(set).toHaveBeenCalledWith(
      stateRef,
      { ready: true, cutoff: readTime, reconciledAt: readTime },
      { merge: true }
    );
    expect(get).toHaveBeenCalledTimes(6);
  });

  it("does not aggregate or write when the parent was deleted", async () => {
    const profileRef = { path: "profile" };
    const stateRef = { path: "state" };
    const count = jest.fn();
    const db = {
      doc: jest.fn((path: string) =>
        path.includes("/system/") ? stateRef : profileRef
      ),
      collection: jest.fn(() => ({ count })),
      runTransaction: jest.fn(
        (callback: (transaction: unknown) => Promise<void>) =>
          callback({
            get: jest.fn(async (ref: unknown) =>
              ref === profileRef
                ? { exists: false }
                : { exists: false, data: () => undefined }
            ),
            update: jest.fn(),
            set: jest.fn(),
          })
      ),
    };

    await _reconcileLibraryCountsOnProfileCreate("uid", db as never);

    expect(count).not.toHaveBeenCalled();
  });
});
