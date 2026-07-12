import { describe, it, expect } from "vitest";
import { hasLineageSource } from "../open-lineage-source";

// hasLineageSource gates the "From <word>" chip: a word alone isn't enough to
// render an interactive chip (clickables-look-like-buttons.md) — there also
// has to be somewhere for the tap to go. Silent-bug risk: get an OR/AND wrong
// here and the chip either never shows, or shows and dead-ends on tap.
describe("hasLineageSource", () => {
  it("is false with no source word at all", () => {
    expect(hasLineageSource({})).toBe(false);
    expect(hasLineageSource({ sourceSequenceId: "seq-1", steps: [] as never[] })).toBe(false);
  });

  it("is false when a word exists but there is nothing to open (scene look-only save)", () => {
    expect(hasLineageSource({ sourceWord: "FΨ" })).toBe(false);
    expect(hasLineageSource({ sourceWord: "FΨ", steps: [] as never[] })).toBe(false);
  });

  it("is true when a word exists and a source sequence id is known", () => {
    expect(hasLineageSource({ sourceWord: "FΨ", sourceSequenceId: "seq-1" })).toBe(true);
  });

  it("is true when a word exists and the entry has its own steps (id-less fallback)", () => {
    expect(hasLineageSource({ sourceWord: "FΨ", steps: [{}] as never[] })).toBe(true);
  });
});
