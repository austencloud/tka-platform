import { simplifyRepeatedWord } from "./wordSimplifier";

describe("simplifyRepeatedWord (functions port)", () => {
  it("collapses a full-word repeat to its smallest unit", () => {
    expect(simplifyRepeatedWord("ABCABCABC")).toBe("ABC");
    expect(simplifyRepeatedWord("TESTTEST")).toBe("TEST");
  });

  it("collapses a repeated Greek/dash LOOP word (FΨFΨFΨFΨ → FΨ)", () => {
    expect(simplifyRepeatedWord("FΨFΨFΨFΨ")).toBe("FΨ");
  });

  it("collapses letter+dash units as single letters", () => {
    expect(simplifyRepeatedWord("Φ-Ψ-Φ-Ψ-")).toBe("Φ-Ψ-");
  });

  it("returns the original when there is no pattern", () => {
    expect(simplifyRepeatedWord("HELLO")).toBe("HELLO");
    expect(simplifyRepeatedWord("ABC")).toBe("ABC");
  });

  it("collapses an ABBA palindrome of groups to its first half", () => {
    // groups of 1: A B B A → A B
    expect(simplifyRepeatedWord("ABBA")).toBe("AB");
  });

  it("handles empty/short input", () => {
    expect(simplifyRepeatedWord("")).toBe("");
    expect(simplifyRepeatedWord("A")).toBe("A");
  });
});
