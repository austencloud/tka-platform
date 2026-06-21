import { describe, it, expect } from "vitest";
import { applyAssign, applyClear } from "../personal-museum-repository";
import { emptyPersonalMuseumDoc } from "../../domain/personal-museum-types";

describe("personal-museum placement mutations", () => {
  it("applyAssign sets a placement and bumps updatedAt", () => {
    const docData = emptyPersonalMuseumDoc("u1", 100);
    const next = applyAssign(docData, "slot-n1", "seqA", 200);
    expect(next.placements["slot-n1"]).toEqual({ sequenceId: "seqA", assignedAt: 200 });
    expect(next.updatedAt).toBe(200);
    expect(docData.placements["slot-n1"]).toBeUndefined(); // input untouched
  });

  it("applyAssign overwrites an existing slot", () => {
    const docData = applyAssign(emptyPersonalMuseumDoc("u1", 0), "slot-n1", "seqA", 1);
    const next = applyAssign(docData, "slot-n1", "seqB", 2);
    expect(next.placements["slot-n1"]!.sequenceId).toBe("seqB");
  });

  it("applyClear removes a placement and bumps updatedAt", () => {
    const docData = applyAssign(emptyPersonalMuseumDoc("u1", 0), "slot-n1", "seqA", 1);
    const next = applyClear(docData, "slot-n1", 5);
    expect(next.placements["slot-n1"]).toBeUndefined();
    expect(next.updatedAt).toBe(5);
  });

  it("applyClear on an empty slot is a no-op clone", () => {
    const docData = emptyPersonalMuseumDoc("u1", 0);
    const next = applyClear(docData, "slot-z9", 5);
    expect(next.placements).toEqual({});
  });
});
