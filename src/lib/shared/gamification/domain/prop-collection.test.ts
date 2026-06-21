// src/lib/shared/gamification/domain/prop-collection.test.ts
import { describe, expect, it } from "vitest";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { UNLOCKABLE_POOL } from "./prop-pool";
import {
  defaultCollection,
  isUnlocked,
  remainingLocked,
  applyClaim,
  mergeCollections,
  recordOne,
} from "./prop-collection";

describe("prop-collection", () => {
  it("defaults to empty earned set", () => {
    const c = defaultCollection();
    expect(c.unlockedPropTypes).toEqual([]);
    expect(c.creationCount).toBe(0);
    expect(c.pendingPicks).toBe(0);
  });

  it("core props are always unlocked, locked pool props are not", () => {
    const c = defaultCollection();
    expect(isUnlocked(c, PropType.STAFF)).toBe(true);
    expect(isUnlocked(c, PropType.SWORD)).toBe(false);
  });

  it("remainingLocked excludes earned props", () => {
    const c = { ...defaultCollection(), unlockedPropTypes: [PropType.SWORD] };
    expect(remainingLocked(c)).not.toContain(PropType.SWORD);
    expect(remainingLocked(c).length).toBe(UNLOCKABLE_POOL.length - 1);
  });

  it("recordOne increments count and earns a pick when a milestone is crossed", () => {
    const c1 = recordOne(defaultCollection());
    expect(c1.creationCount).toBe(1);
    expect(c1.pendingPicks).toBe(1);
    const c2 = recordOne(c1);
    expect(c2.creationCount).toBe(2);
    expect(c2.pendingPicks).toBe(1);
    const c3 = recordOne(c2);
    expect(c3.pendingPicks).toBe(2);
  });

  it("pendingPicks never exceeds the remaining locked pool", () => {
    let c = defaultCollection();
    for (let i = 0; i < 300; i++) c = recordOne(c);
    expect(c.pendingPicks).toBeLessThanOrEqual(UNLOCKABLE_POOL.length);
  });

  it("applyClaim adds a locked prop and spends a pick", () => {
    const c = { unlockedPropTypes: [], creationCount: 1, pendingPicks: 1 };
    const next = applyClaim(c, PropType.SWORD);
    expect(next.unlockedPropTypes).toContain(PropType.SWORD);
    expect(next.pendingPicks).toBe(0);
  });

  it("applyClaim is a no-op with no pending picks or for a non-pool prop", () => {
    const noPending = applyClaim({ unlockedPropTypes: [], creationCount: 1, pendingPicks: 0 }, PropType.SWORD);
    expect(noPending.unlockedPropTypes).toEqual([]);
    const corePick = applyClaim({ unlockedPropTypes: [], creationCount: 1, pendingPicks: 1 }, PropType.STAFF);
    expect(corePick.unlockedPropTypes).toEqual([]);
    expect(corePick.pendingPicks).toBe(1);
  });

  it("mergeCollections unions unlocked, takes max count, sums picks, clamps", () => {
    const guest = { unlockedPropTypes: [PropType.SWORD], creationCount: 5, pendingPicks: 1 };
    const member = { unlockedPropTypes: [PropType.TORCH], creationCount: 3, pendingPicks: 1 };
    const merged = mergeCollections(guest, member);
    expect(merged.unlockedPropTypes).toContain(PropType.SWORD);
    expect(merged.unlockedPropTypes).toContain(PropType.TORCH);
    expect(merged.creationCount).toBe(5);
    expect(merged.pendingPicks).toBe(2);
  });
});
