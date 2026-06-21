import { describe, it, expect } from "vitest";
import { applySequenceOverrides } from "../build-personal-grid";
import type { ExhibitDefinition } from "../../../museum/domain/museum-grid-types";

const ex = (id: string, sequenceId?: string): ExhibitDefinition => ({
  id, tileX: 0, tileY: 0, size: "standard", sequenceId,
});

describe("applySequenceOverrides", () => {
  it("sets sequenceId from the resolved map keyed by exhibit id", () => {
    const exhibits = [ex("slot-n1"), ex("slot-n2")];
    const out = applySequenceOverrides(exhibits, { "slot-n1": "seqA", "slot-n2": null });
    expect(out[0]!.sequenceId).toBe("seqA");
    expect(out[1]!.sequenceId).toBeUndefined(); // null => empty frame, no sequence
  });

  it("does not mutate the input exhibits", () => {
    const exhibits = [ex("slot-n1")];
    applySequenceOverrides(exhibits, { "slot-n1": "seqA" });
    expect(exhibits[0]!.sequenceId).toBeUndefined();
  });

  it("leaves an exhibit untouched (sequenceId undefined) when not in the resolved map", () => {
    const exhibits = [ex("slot-z9")];
    const out = applySequenceOverrides(exhibits, {});
    expect(out[0]!.sequenceId).toBeUndefined();
  });
});
