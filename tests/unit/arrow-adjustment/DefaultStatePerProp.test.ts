import { describe, it, expect } from "vitest";
import { createDefaultArrowPlacementState } from "$lib/shared/pictograph/arrow/positioning/default-override/state/default-arrow-placement-state.svelte";

describe("default state per-prop isolation", () => {
  it("stores and reads a value under its propType", () => {
    const s = createDefaultArrowPlacementState();
    s.setValue("diamond", "fan", "pro", "pro_to_layer1_alpha", "0", [3, 4], "me");
    expect(s.getValue("diamond", "fan", "pro", "pro_to_layer1_alpha", "0")).toEqual([3, 4]);
  });

  it("does not bleed a fan value into staff", () => {
    const s = createDefaultArrowPlacementState();
    s.setValue("diamond", "fan", "pro", "pro_to_layer1_alpha", "0", [3, 4], "me");
    expect(s.getValue("diamond", "staff", "pro", "pro_to_layer1_alpha", "0")).toBeNull();
  });

  it("removeValue clears only the targeted prop", () => {
    const s = createDefaultArrowPlacementState();
    s.setValue("diamond", "fan", "pro", "pro_to_layer1_alpha", "0", [3, 4], "me");
    s.setValue("diamond", "staff", "pro", "pro_to_layer1_alpha", "0", [9, 9], "me");
    s.removeValue("diamond", "fan", "pro", "pro_to_layer1_alpha", "0");
    expect(s.getValue("diamond", "fan", "pro", "pro_to_layer1_alpha", "0")).toBeNull();
    expect(s.getValue("diamond", "staff", "pro", "pro_to_layer1_alpha", "0")).toEqual([9, 9]);
  });

  it("re-keys a legacy 2-part doc so the staff read path finds it", () => {
    const s = createDefaultArrowPlacementState();
    // Simulate a legacy Firestore doc: raw 2-part id, propType defaulted to
    // "staff" by the schema. setDoc must re-key it to the canonical 3-part id
    // ("box_staff_pro") or the staff read path (which computes the 3-part id)
    // would miss it.
    s.setDoc({
      id: "box_pro",
      gridMode: "box",
      propType: "staff",
      motionType: "pro",
      placements: { pro_to_layer1_alpha: { "0": [7, 8] } },
      updatedAt: undefined as never,
      updatedBy: "legacy",
    });
    expect(s.getValue("box", "staff", "pro", "pro_to_layer1_alpha", "0")).toEqual([7, 8]);
  });
});
