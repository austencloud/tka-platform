import { describe, it, expect } from "vitest";
import { applySequenceOverrides, applyPerformerOverrides } from "../build-personal-grid";
import type { ExhibitDefinition, PerformerDefinition } from "../../../museum/domain/museum-grid-types";

const ex = (id: string, sequenceId?: string): ExhibitDefinition => ({
  id, tileX: 0, tileY: 0, size: "standard", sequenceId,
});

const perf = (id: string): PerformerDefinition => ({
  id, tileX: 0, tileY: 0, facing: "south", autoPlay: false,
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

  it("sets plaque title from slotMeta on a placed exhibit", () => {
    const out = applySequenceOverrides(
      [{ id: "slot-1", tileX: 0, tileY: 0, size: "standard" }],
      { "slot-1": "seqA" },
      { "slot-1": { name: "My Word" } },
    );
    expect(out[0]!.plaque?.title).toBe("My Word");
    expect(out[0]!.sequenceId).toBe("seqA");
  });
});

describe("applyPerformerOverrides", () => {
  it("sets sequenceId + autoPlay true on a placed performer", () => {
    const out = applyPerformerOverrides([perf("slot-1")], { "slot-1": "seqA" });
    expect(out[0]!.sequenceId).toBe("seqA");
    expect(out[0]!.autoPlay).toBe(true);
  });

  it("leaves an unplaced performer with no sequence and autoPlay false", () => {
    const out = applyPerformerOverrides([perf("slot-2")], { "slot-2": null });
    expect(out[0]!.sequenceId).toBeUndefined();
    expect(out[0]!.autoPlay).toBe(false);
  });

  it("does not mutate inputs", () => {
    const input = [perf("slot-1")];
    applyPerformerOverrides(input, { "slot-1": "seqA" });
    expect(input[0]!.sequenceId).toBeUndefined();
  });
});
