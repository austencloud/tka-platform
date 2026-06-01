import { describe, it, expect } from "vitest";
import { computeBundleSignature } from "../card-pool-prewarm";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

const seq = (id: string) => ({ id, word: id, steps: [] }) as unknown as SequenceData;
const base = {
  sequences: [seq("a"), seq("b")],
  bluePropType: "staff" as const,
  redPropType: "staff" as const,
  theme: "cosmic",
};

describe("computeBundleSignature", () => {
  it("is stable for the same inputs regardless of sequence order", () => {
    const s1 = computeBundleSignature(base);
    const s2 = computeBundleSignature({ ...base, sequences: [seq("b"), seq("a")] });
    expect(s1).toBe(s2);
  });

  it("changes when a sequence id set changes", () => {
    const s1 = computeBundleSignature(base);
    const s2 = computeBundleSignature({ ...base, sequences: [seq("a"), seq("c")] });
    expect(s1).not.toBe(s2);
  });

  it("changes when prop types change", () => {
    const s1 = computeBundleSignature(base);
    const s2 = computeBundleSignature({ ...base, redPropType: "fan" as never });
    expect(s1).not.toBe(s2);
  });
});
