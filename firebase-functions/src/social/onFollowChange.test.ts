import { _reconcileFollowCounts } from "./onFollowChange";

function countHarness(options?: {
  targetExists?: boolean;
  followerExists?: boolean;
}) {
  const refs = {
    target: { path: "users/target" },
    follower: { path: "users/follower" },
  };
  const aggregates = {
    followers: { name: "followers" },
    following: { name: "following" },
  };
  const update = jest.fn();
  const get = jest.fn(async (ref: { path?: string; name?: string }) => {
    if (ref === refs.target) {
      return { exists: options?.targetExists ?? true };
    }
    if (ref === refs.follower) {
      return { exists: options?.followerExists ?? true };
    }
    return {
      data: () => ({ count: ref.name === "followers" ? 1 : 4 }),
    };
  });
  const db = {
    doc: jest.fn((path: string) =>
      path === "users/target" ? refs.target : refs.follower
    ),
    collection: jest.fn((path: string) => ({
      count: () =>
        path.endsWith("/followers")
          ? aggregates.followers
          : aggregates.following,
    })),
    runTransaction: jest.fn(
      (callback: (transaction: unknown) => Promise<void>) =>
        callback({ get, update })
    ),
  };

  return { db, refs, update };
}

describe("follow count reconciliation", () => {
  it("writes exact relationship totals instead of applying a delta", async () => {
    const harness = countHarness();

    await _reconcileFollowCounts("target", "follower", harness.db as never);

    expect(harness.update).toHaveBeenCalledWith(harness.refs.target, {
      followerCount: 1,
    });
    expect(harness.update).toHaveBeenCalledWith(harness.refs.follower, {
      followingCount: 4,
    });
  });

  it("cannot recreate profiles deleted before a delayed event runs", async () => {
    const harness = countHarness({
      targetExists: false,
      followerExists: false,
    });

    await _reconcileFollowCounts("target", "follower", harness.db as never);

    expect(harness.update).not.toHaveBeenCalled();
  });

  it("ignores a malformed self-follow event", async () => {
    const harness = countHarness();

    await _reconcileFollowCounts("same-user", "same-user", harness.db as never);

    expect(harness.db.runTransaction).not.toHaveBeenCalled();
  });
});
