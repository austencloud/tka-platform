import { describe, it, expect } from "vitest";
import { organizeSections } from "$lib/shared/browse/services/browse-section-manager";
import { BrowseSortMethod } from "$lib/shared/browse/domain/enums/browse-enums";
import type { SectionConfig } from "$lib/shared/browse/domain/models/browse-models";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";

// Minimal StepData factory — only the fields the section manager reads
// (letter for word derivation, plus array length for the step count).
function makeStep(letter: string): StepData {
  return { letter, stepNumber: 1, isBlank: false } as unknown as StepData;
}

function lengthConfig(): SectionConfig {
  return {
    groupBy: "length",
    sortMethod: BrowseSortMethod.SEQUENCE_LENGTH,
    showEmptySections: false,
    expandedSections: new Set<string>(),
  };
}

describe("organizeSections — length grouping", () => {
  // Regression: a 3-step sequence whose word is "Δ-QZ-" (5 characters, because
  // the Type-3 dash convention adds a "-" to Δ- and Z-) was bucketed into
  // "5 steps" because the length key fell back to word.length when the optional
  // stored sequenceLength was absent. The step count must come from steps, not
  // from how many characters the word string happens to have.
  it("buckets by step count, not word character count, when sequenceLength is absent", () => {
    const seq = {
      id: "seq-puppyflower",
      name: "Δ-QZ-",
      word: "Δ-QZ-", // 5 characters
      steps: [makeStep("Δ-"), makeStep("Q"), makeStep("Z-")], // 3 steps
      thumbnails: [],
      tags: [],
      metadata: {},
      isFavorite: false,
      // sequenceLength intentionally omitted — legacy docs lack it
    } as unknown as SequenceData;

    const sections = organizeSections([seq], lengthConfig());

    expect(sections).toHaveLength(1);
    expect(sections[0]!.title).toContain("3 steps");
    expect(sections[0]!.title).not.toContain("5 steps");
    expect(sections[0]!.id).toBe("length-3-steps");
  });

  it("prefers the stored sequenceLength when present", () => {
    const seq = {
      id: "seq-stored",
      name: "AB",
      word: "AB",
      steps: [],
      thumbnails: [],
      tags: [],
      metadata: {},
      isFavorite: false,
      sequenceLength: 8,
    } as unknown as SequenceData;

    const sections = organizeSections([seq], lengthConfig());

    expect(sections[0]!.title).toContain("8 steps");
  });
});
