import { describe, expect, it } from "vitest";

import {
  filmOriginIsSaved,
  filmOriginLabel,
  filmOriginUrlKey,
  type FilmOrigin,
} from "../../../src/routes/test/film-director/_lib/film-origin";

const library: FilmOrigin = { kind: "library", key: "star" };
const saved: FilmOrigin = { kind: "saved", id: "abc123", name: "My cut" };

describe("filmOriginUrlKey", () => {
  it("names a library film by its bare key", () => {
    expect(filmOriginUrlKey(library)).toBe("star");
  });

  it("prefixes a saved film so its id cannot shadow a library key", () => {
    expect(filmOriginUrlKey(saved)).toBe("saved:abc123");
  });
});

describe("filmOriginIsSaved", () => {
  it("is false for a library film, so Save creates", () => {
    expect(filmOriginIsSaved(library)).toBe(false);
  });

  it("is true for a saved film, so Save overwrites", () => {
    expect(filmOriginIsSaved(saved)).toBe(true);
  });
});

describe("filmOriginLabel", () => {
  it("prefers the saved entry's name over the document title", () => {
    expect(filmOriginLabel(saved, "Star of Five")).toBe("My cut");
  });

  it("falls back to the document title for a library film", () => {
    expect(filmOriginLabel(library, "Star of Five")).toBe("Star of Five");
  });
});
