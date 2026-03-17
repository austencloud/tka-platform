import { describe, it, expect } from "vitest";
import { LetterParser } from "../../../src/core/letters/LetterParser.js";

describe("LetterParser", () => {
  const parser = new LetterParser();

  it("parses simple Latin word into individual letters", () => {
    expect(parser.parse("BOOK")).toEqual(["B", "O", "O", "K"]);
  });

  it("parses Greek letters alongside Latin letters", () => {
    expect(parser.parse("AΣB")).toEqual(["A", "Σ", "B"]);
  });

  it("parses dash-suffixed Greek letters", () => {
    expect(parser.parse("AΣ-B")).toEqual(["A", "Σ-", "B"]);
  });

  it("parses multiple consecutive dash-suffixed letters", () => {
    expect(parser.parse("Φ-Ψ-Λ-")).toEqual(["Φ-", "Ψ-", "Λ-"]);
  });

  it("returns empty array for empty string", () => {
    expect(parser.parse("")).toEqual([]);
  });

  it("skips non-letter characters", () => {
    expect(parser.parse("A 1 B")).toEqual(["A", "B"]);
  });

  it("handles dash-suffixed Latin letters", () => {
    expect(parser.parse("W-X-")).toEqual(["W-", "X-"]);
  });
});
