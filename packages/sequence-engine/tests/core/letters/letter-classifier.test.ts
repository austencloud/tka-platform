import { describe, it, expect } from "vitest";
import { LetterClassifier } from "../../../src/core/letters/LetterClassifier.js";

describe("LetterClassifier", () => {
  const classifier = new LetterClassifier();

  it("classifies Type 1 letters (dual-shift)", () => {
    expect(classifier.getType("A")).toBe(1);
    expect(classifier.getType("V")).toBe(1);
    expect(classifier.getType("M")).toBe(1);
  });

  it("classifies Type 2 letters (shift)", () => {
    expect(classifier.getType("W")).toBe(2);
    expect(classifier.getType("Σ")).toBe(2);
    expect(classifier.getType("μ")).toBe(2);
    expect(classifier.getType("ν")).toBe(2);
  });

  it("classifies Type 3 letters (cross-shift)", () => {
    expect(classifier.getType("W-")).toBe(3);
    expect(classifier.getType("Σ-")).toBe(3);
    expect(classifier.getType("Ω-")).toBe(3);
  });

  it("classifies Type 4 letters (dash)", () => {
    expect(classifier.getType("Φ")).toBe(4);
    expect(classifier.getType("Ψ")).toBe(4);
    expect(classifier.getType("Λ")).toBe(4);
    expect(classifier.getType("τ-")).toBe(4);
  });

  it("classifies Type 5 letters (dual-dash)", () => {
    expect(classifier.getType("Φ-")).toBe(5);
    expect(classifier.getType("Ψ-")).toBe(5);
    expect(classifier.getType("Λ-")).toBe(5);
  });

  it("classifies Type 6 letters (static)", () => {
    expect(classifier.getType("α")).toBe(6);
    expect(classifier.getType("β")).toBe(6);
    expect(classifier.getType("γ")).toBe(6);
    expect(classifier.getType("τ")).toBe(6);
    expect(classifier.getType("⊕")).toBe(6);
  });

  it("returns undefined for unknown letters", () => {
    expect(classifier.getType("?")).toBeUndefined();
    expect(classifier.getType("!")).toBeUndefined();
    expect(classifier.getType("1")).toBeUndefined();
  });

  it("isType6 returns true only for Type 6 letters", () => {
    expect(classifier.isType6("α")).toBe(true);
    expect(classifier.isType6("β")).toBe(true);
    expect(classifier.isType6("A")).toBe(false);
    expect(classifier.isType6("W")).toBe(false);
    expect(classifier.isType6("?")).toBe(false);
  });
});
