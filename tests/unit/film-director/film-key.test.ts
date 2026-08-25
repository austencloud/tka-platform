import { describe, expect, it } from "vitest";

import {
  parseFilmKey,
  savedFilmKey,
} from "../../../src/routes/test/film-director/_lib/film-key";

describe("parseFilmKey", () => {
  it("resolves a library key", () => {
    expect(parseFilmKey("star")).toEqual({ kind: "library", key: "star" });
  });

  it("resolves a saved id", () => {
    expect(parseFilmKey("saved:abc123")).toEqual({ kind: "saved", id: "abc123" });
  });

  it("treats a key the library does not have as unknown", () => {
    expect(parseFilmKey("nope")).toEqual({ kind: "unknown" });
  });

  it("treats missing and empty values as unknown", () => {
    expect(parseFilmKey(null)).toEqual({ kind: "unknown" });
    expect(parseFilmKey("")).toEqual({ kind: "unknown" });
    expect(parseFilmKey("saved:")).toEqual({ kind: "unknown" });
  });

  it("keeps a saved id that would otherwise collide with a library key", () => {
    // The prefix is the only thing keeping the two namespaces apart.
    expect(parseFilmKey("saved:star")).toEqual({ kind: "saved", id: "star" });
  });

  it("round-trips a saved id through the key it builds", () => {
    expect(parseFilmKey(savedFilmKey("xyz"))).toEqual({ kind: "saved", id: "xyz" });
  });
});
