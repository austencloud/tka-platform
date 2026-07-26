import { describe, it, expect } from "vitest";
import { canonicalDigest, sha256Hex } from "../canonical-digest";

const HEX_64 = /^[0-9a-f]{64}$/;

/**
 * Shape of the public-projection digest input: source-owned and profile-owned
 * fields only. Engagement counters and timestamps are deliberately absent —
 * the tests below prove the helper honours that exclusion by hashing exactly
 * what it is handed.
 */
function projectionFields() {
  return {
    word: "IIECCK",
    intendedWord: "IIECCK",
    name: "Fuse run",
    displayName: "Fuse run",
    sequenceLength: 6,
    gridMode: "diamond",
    contentHash: "a".repeat(64),
    contentHashVersion: 2,
    ownerDisplayName: "Austen",
    tags: ["loop", "fuse"],
    loop: { isCircular: true, loopType: "rotated", period: 3 },
  };
}

describe("sha256Hex", () => {
  it("matches the published SHA-256 test vector for \"abc\"", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });

  it("matches the published SHA-256 test vector for the empty string", async () => {
    expect(await sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
  });

  it("encodes a string as UTF-8, so it equals the pre-encoded bytes", async () => {
    const text = "IIECCK · Ψ";
    expect(await sha256Hex(text)).toBe(
      await sha256Hex(new TextEncoder().encode(text))
    );
  });

  it("is byte-identical to the hand-rolled expression it replaces", async () => {
    // The four lines copied into eight files today. Migrating any of them onto
    // sha256Hex must not change a stored hash.
    const bytes = new TextEncoder().encode("stored-hash-input");
    const legacy = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))
    )
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    expect(await sha256Hex("stored-hash-input")).toBe(legacy);
  });

  it("emits 64 lowercase hex characters", async () => {
    expect(await sha256Hex("anything")).toMatch(HEX_64);
  });
});

describe("canonicalDigest determinism", () => {
  it("is stable across key insertion order", async () => {
    const a = { word: "IIECCK", gridMode: "diamond", sequenceLength: 6 };
    const b = { sequenceLength: 6, word: "IIECCK", gridMode: "diamond" };
    expect(await canonicalDigest(a)).toBe(await canonicalDigest(b));
  });

  it("is stable across key insertion order in nested objects", async () => {
    const a = { loop: { period: 3, isCircular: true, loopType: "rotated" } };
    const b = { loop: { loopType: "rotated", isCircular: true, period: 3 } };
    expect(await canonicalDigest(a)).toBe(await canonicalDigest(b));
  });

  it("is stable across key order at every depth of a realistic projection", async () => {
    const forward = projectionFields();
    const shuffled = Object.fromEntries(
      Object.entries(forward)
        .reverse()
        .map(([k, v]) =>
          v && typeof v === "object" && !Array.isArray(v)
            ? [k, Object.fromEntries(Object.entries(v).reverse())]
            : [k, v]
        )
    );
    expect(Object.keys(shuffled)).not.toEqual(Object.keys(forward));
    expect(await canonicalDigest(shuffled)).toBe(
      await canonicalDigest(forward)
    );
  });

  it("returns the same digest when called repeatedly", async () => {
    const value = projectionFields();
    const runs = await Promise.all([
      canonicalDigest(value),
      canonicalDigest(value),
      canonicalDigest(value),
    ]);
    expect(new Set(runs).size).toBe(1);
    expect(runs[0]).toMatch(HEX_64);
  });

  it("equals sha256Hex over the canonical string", async () => {
    // The digest is not a second serializer — it is canonicalJSON + sha256Hex.
    const { canonicalJSON } = await import("../canonical-json");
    const value = projectionFields();
    expect(await canonicalDigest(value)).toBe(
      await sha256Hex(canonicalJSON(value))
    );
  });
});

describe("canonicalDigest discriminates content", () => {
  it("changes when a source-owned field changes", async () => {
    const base = projectionFields();
    expect(await canonicalDigest({ ...base, word: "IIECCKIIECCK" })).not.toBe(
      await canonicalDigest(base)
    );
  });

  it("changes when a profile-owned field changes", async () => {
    const base = projectionFields();
    expect(
      await canonicalDigest({ ...base, ownerDisplayName: "Someone Else" })
    ).not.toBe(await canonicalDigest(base));
  });

  it("changes when a nested LOOP field changes", async () => {
    const base = projectionFields();
    expect(
      await canonicalDigest({ ...base, loop: { ...base.loop, period: 4 } })
    ).not.toBe(await canonicalDigest(base));
  });

  it("changes when a field is added", async () => {
    const base = projectionFields();
    expect(await canonicalDigest({ ...base, encoderHash: "abc" })).not.toBe(
      await canonicalDigest(base)
    );
  });

  it("distinguishes a string from the number that prints the same", async () => {
    expect(await canonicalDigest({ level: 3 })).not.toBe(
      await canonicalDigest({ level: "3" })
    );
  });
});

describe("canonicalDigest array and nesting stability", () => {
  it("preserves array order, because arrays are ordered data", async () => {
    expect(await canonicalDigest({ tags: ["a", "b"] })).not.toBe(
      await canonicalDigest({ tags: ["b", "a"] })
    );
  });

  it("is stable for an array of objects whose keys are written in any order", async () => {
    const a = {
      stepPairings: [
        { letter: "I", blue: "pro", red: "anti" },
        { red: "pro", letter: "E", blue: "anti" },
      ],
    };
    const b = {
      stepPairings: [
        { red: "anti", blue: "pro", letter: "I" },
        { blue: "anti", letter: "E", red: "pro" },
      ],
    };
    expect(await canonicalDigest(a)).toBe(await canonicalDigest(b));
  });

  it("distinguishes a nested value from the same value one level up", async () => {
    expect(await canonicalDigest({ loop: { period: 3 } })).not.toBe(
      await canonicalDigest({ period: 3 })
    );
  });

  it("digests deeply nested structures deterministically", async () => {
    const deep = (order: 1 | -1) => ({
      a: { b: { c: order === 1 ? { x: 1, y: 2 } : { y: 2, x: 1 } } },
    });
    expect(await canonicalDigest(deep(1))).toBe(
      await canonicalDigest(deep(-1))
    );
  });

  it("digests primitives, null, and empty containers without throwing", async () => {
    for (const value of ["x", 5, true, null, [], {}]) {
      expect(await canonicalDigest(value)).toMatch(HEX_64);
    }
  });
});

describe("canonicalDigest hashes exactly what it is given", () => {
  // The exclusion policy (engagement counters and timestamps out) lives in the
  // caller. These prove the helper neither strips nor injects fields, so the
  // caller's projection object IS the contract.

  it("a projection excluding counters digests the same as one that never had them", async () => {
    const withCounters = {
      ...projectionFields(),
      forkCount: 7,
      viewCount: 41,
      starCount: 2,
    };
    const {
      forkCount: _f,
      viewCount: _v,
      starCount: _s,
      ...withoutCounters
    } = withCounters;
    expect(await canonicalDigest(withoutCounters)).toBe(
      await canonicalDigest(projectionFields())
    );
  });

  it("counter drift cannot move the digest once the caller excludes counters", async () => {
    const excluded = projectionFields();
    const before = await canonicalDigest(excluded);
    // Counters changed on the live document; the caller still digests the same
    // excluded field set, so the digest must not move.
    expect(await canonicalDigest(projectionFields())).toBe(before);
  });

  it("counters DO move the digest if the caller wrongly includes them", async () => {
    // The complement of the test above: the helper is not silently filtering.
    // If this ever passes as equal, the helper grew an opinion it must not have.
    const base = projectionFields();
    expect(await canonicalDigest({ ...base, viewCount: 41 })).not.toBe(
      await canonicalDigest({ ...base, viewCount: 42 })
    );
  });

  it("timestamps DO move the digest if the caller wrongly includes them", async () => {
    const base = projectionFields();
    expect(await canonicalDigest({ ...base, updatedAt: 1000 })).not.toBe(
      await canonicalDigest({ ...base, updatedAt: 2000 })
    );
  });
});

describe("canonicalDigest documented serialization traps", () => {
  // Both behaviours are inherited from canonicalJSON and are documented on the
  // helper. They are pinned here because a caller that trips one gets a digest
  // that silently fails to match after a Firestore round trip.

  it("an undefined value is NOT the same as an absent key", async () => {
    expect(await canonicalDigest({ a: 1, b: undefined })).not.toBe(
      await canonicalDigest({ a: 1 })
    );
  });

  it("an undefined value digests identically to null", async () => {
    expect(await canonicalDigest({ a: undefined })).toBe(
      await canonicalDigest({ a: null })
    );
  });

  it("class instances collapse, so two different Dates digest identically", async () => {
    expect(await canonicalDigest({ at: new Date(0) })).toBe(
      await canonicalDigest({ at: new Date(86_400_000) })
    );
  });

  it("converting a Date to a primitive first restores discrimination", async () => {
    expect(await canonicalDigest({ at: new Date(0).getTime() })).not.toBe(
      await canonicalDigest({ at: new Date(86_400_000).getTime() })
    );
  });
});
