import { describe, it, expect } from "vitest";
import { ShortCodeCache } from "../short-code-cache";

// In the test env `$app/environment` browser=false, so IndexedDB is skipped and
// the memory layer is exercised in isolation (set writes memory before the
// browser guard; get/getMany read memory first). That's exactly the per-session
// hot path the cold-deck fix depends on.

describe("ShortCodeCache (memory layer)", () => {
  it("returns null for a miss", async () => {
    const cache = new ShortCodeCache();
    expect(await cache.get("nope")).toBeNull();
  });

  it("round-trips a set value", async () => {
    const cache = new ShortCodeCache();
    await cache.set("k1", { code: "AB12", url: "HTTPS://TKA.RUN/AB12" });
    expect(await cache.get("k1")).toEqual({
      code: "AB12",
      url: "HTTPS://TKA.RUN/AB12",
    });
  });

  it("getMany returns only the keys that hit", async () => {
    const cache = new ShortCodeCache();
    await cache.set("hit-a", { code: "AAAA", url: "u-a" });
    await cache.set("hit-b", { code: "BBBB", url: "u-b" });

    const found = await cache.getMany(["hit-a", "miss", "hit-b"]);
    expect(found.size).toBe(2);
    expect(found.get("hit-a")).toEqual({ code: "AAAA", url: "u-a" });
    expect(found.get("hit-b")).toEqual({ code: "BBBB", url: "u-b" });
    expect(found.has("miss")).toBe(false);
  });

  it("getMany on all-miss returns an empty map", async () => {
    const cache = new ShortCodeCache();
    const found = await cache.getMany(["x", "y"]);
    expect(found.size).toBe(0);
  });

  it("clear drops memory entries", async () => {
    const cache = new ShortCodeCache();
    await cache.set("k", { code: "C", url: "u" });
    await cache.clear();
    expect(await cache.get("k")).toBeNull();
  });
});
