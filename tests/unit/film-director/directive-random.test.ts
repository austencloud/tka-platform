// tests/unit/film-director/directive-random.test.ts
import { describe, expect, it } from "vitest";

import {
  createAxisStream,
  resolveFilmSeed,
  seededPick,
  seededShuffle,
} from "../../../src/routes/test/film-director/_lib/directive-random";

describe("resolveFilmSeed", () => {
  it("derives a stable base from the film id when none is given", () => {
    expect(resolveFilmSeed("my-film")).toEqual(resolveFilmSeed("my-film"));
    expect(resolveFilmSeed("my-film").base).not.toBe(
      resolveFilmSeed("other-film").base
    );
  });

  it("honors an explicit base and axis salts", () => {
    const seed = resolveFilmSeed("my-film", { base: 7, axes: { prop: 2 } });
    expect(seed.base).toBe(7);
    expect(seed.axes.prop).toBe(2);
  });
});

describe("createAxisStream", () => {
  const items = ["a", "b", "c", "d", "e", "f", "g", "h"];

  it("is deterministic per (seed, shot, axis)", () => {
    const seed = resolveFilmSeed("my-film");
    const one = seededShuffle(items, createAxisStream(seed, "shot-1", "prop"));
    const two = seededShuffle(items, createAxisStream(seed, "shot-1", "prop"));
    expect(one).toEqual(two);
  });

  it("bumping one axis salt changes only that axis's stream", () => {
    const before = resolveFilmSeed("my-film");
    const after = resolveFilmSeed("my-film", { axes: { prop: 1 } });
    expect(
      seededShuffle(items, createAxisStream(before, "shot-1", "avatarId"))
    ).toEqual(seededShuffle(items, createAxisStream(after, "shot-1", "avatarId")));
    expect(
      seededShuffle(items, createAxisStream(before, "shot-1", "prop"))
    ).not.toEqual(seededShuffle(items, createAxisStream(after, "shot-1", "prop")));
  });

  it("different shots draw different streams", () => {
    const seed = resolveFilmSeed("my-film");
    expect(
      seededShuffle(items, createAxisStream(seed, "shot-1", "prop"))
    ).not.toEqual(seededShuffle(items, createAxisStream(seed, "shot-2", "prop")));
  });
});

describe("seededShuffle / seededPick", () => {
  it("shuffle returns a permutation without mutating the input", () => {
    const items = ["a", "b", "c", "d"];
    const stream = createAxisStream(resolveFilmSeed("f"), "s", "prop");
    const shuffled = seededShuffle(items, stream);
    expect(items).toEqual(["a", "b", "c", "d"]);
    expect([...shuffled].sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("pick returns a member", () => {
    const stream = createAxisStream(resolveFilmSeed("f"), "s", "prop");
    expect(["x", "y", "z"]).toContain(seededPick(["x", "y", "z"], stream));
  });
});
