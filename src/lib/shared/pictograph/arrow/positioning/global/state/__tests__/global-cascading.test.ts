import { describe, it, expect } from "vitest";
import { createGlobalArrowAdjustmentState } from "../GlobalArrowAdjustmentState.svelte";
import type { GlobalArrowAdjustment } from "../../domain/GlobalArrowAdjustment";
import type { Timestamp } from "firebase/firestore";

function fakeTimestamp(): Timestamp {
  return {
    seconds: 0,
    nanoseconds: 0,
    toDate: () => new Date(0),
    toMillis: () => 0,
    isEqual: () => false,
    valueOf: () => "",
  } as unknown as Timestamp;
}

function adj(over: Partial<GlobalArrowAdjustment>): GlobalArrowAdjustment {
  return {
    gridMode: "diamond",
    oriKey: "from_layer1",
    letter: "A",
    turnsTuple: "(0, 0)",
    arrowKey: "pro",
    adjustmentX: 0,
    adjustmentY: 0,
    updatedAt: fakeTimestamp(),
    updatedBy: "test",
    ...over,
  } as GlobalArrowAdjustment;
}

describe("GlobalArrowAdjustmentState.getAdjustmentCascading", () => {
  it("returns layer-2 prop-specific adjustment for non-staff props", () => {
    const s = createGlobalArrowAdjustmentState();
    s.loadAll([adj({ propType: "fan", adjustmentX: 7, adjustmentY: 9 })]);
    const r = s.getAdjustmentCascading(
      {
        gridMode: "diamond",
        oriKey: "from_layer1",
        letter: "A",
        turnsTuple: "(0, 0)",
        arrowKey: "pro",
      },
      "fan",
      "fan",
    );
    expect(r).not.toBeNull();
    expect(r!.layer).toBe(2);
    expect(r!.adjustment.x).toBe(7);
  });

  it("returns null when no adjustment exists", () => {
    const s = createGlobalArrowAdjustmentState();
    const r = s.getAdjustmentCascading(
      {
        gridMode: "diamond",
        oriKey: "from_layer1",
        letter: "A",
        turnsTuple: "(0, 0)",
        arrowKey: "pro",
      },
      "fan",
      "fan",
    );
    expect(r).toBeNull();
  });

  it("returns layer-3 combination-specific adjustment when both props match", () => {
    const s = createGlobalArrowAdjustmentState();
    s.loadAll([adj({ propType: "fan", otherPropType: "club", adjustmentX: 5, adjustmentY: 3 })]);
    const r = s.getAdjustmentCascading(
      {
        gridMode: "diamond",
        oriKey: "from_layer1",
        letter: "A",
        turnsTuple: "(0, 0)",
        arrowKey: "pro",
      },
      "fan",
      "club",
    );
    expect(r).not.toBeNull();
    expect(r!.layer).toBe(3);
    expect(r!.adjustment.x).toBe(5);
  });

  it("returns layer-1 base adjustment for staff+staff", () => {
    const s = createGlobalArrowAdjustmentState();
    s.loadAll([adj({ adjustmentX: 2, adjustmentY: 4 })]);
    const r = s.getAdjustmentCascading(
      {
        gridMode: "diamond",
        oriKey: "from_layer1",
        letter: "A",
        turnsTuple: "(0, 0)",
        arrowKey: "pro",
      },
      "staff",
      "staff",
    );
    expect(r).not.toBeNull();
    expect(r!.layer).toBe(1);
    expect(r!.adjustment.x).toBe(2);
  });

  it("non-staff does NOT fall back to layer-1 staff adjustment", () => {
    const s = createGlobalArrowAdjustmentState();
    // Only a layer-1 (staff) adjustment exists
    s.loadAll([adj({ adjustmentX: 10, adjustmentY: 10 })]);
    const r = s.getAdjustmentCascading(
      {
        gridMode: "diamond",
        oriKey: "from_layer1",
        letter: "A",
        turnsTuple: "(0, 0)",
        arrowKey: "pro",
      },
      "fan",
      "fan",
    );
    expect(r).toBeNull();
  });
});
